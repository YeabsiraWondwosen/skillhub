import Stripe from 'stripe';
import axios from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { Payment, Wallet, Transaction, Escrow, Job, Milestone, Project } from '../models/index.js';
import { generateTxRef, calculateCommission } from '../utils/helpers.js';
import { ApiError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import { assertProjectTransition, TERMINAL_PROJECT_STATUSES } from '../utils/projectStateMachine.js';
import { getCommissionRate } from './settings.service.js';
import { recordCommissionTransaction } from './commission.service.js';

// ─── MongoDB Transaction Support ─────────────────────────────────────────────
// Auto-detects replica set. Falls back to sequential operations on standalone.
let _supportsTransactions = null;

export const supportsTransactions = async () => {
  if (_supportsTransactions !== null) return _supportsTransactions;
  try {
    // Check server status for replica set name — most reliable method
    const admin = mongoose.connection.db.admin();
    const status = await admin.serverStatus();
    if (status.setName) {
      _supportsTransactions = true;
      logger.info('[DB] MongoDB transactions: supported (replica set detected)');
    } else {
      _supportsTransactions = false;
      logger.info('[DB] MongoDB transactions: NOT supported (standalone) — using sequential operations');
    }
  } catch {
    // Fallback: assume no transactions
    _supportsTransactions = false;
    logger.info('[DB] MongoDB transactions: detection failed — assuming not supported');
  }
  return _supportsTransactions;
};

/**
 * Execute operations atomically if transactions are available,
 * otherwise run sequentially without a session.
 * @param {(session: import('mongoose').ClientSession | null) => Promise<T>} operations
 * @returns {Promise<T>}
 */
export const withTransaction = async (operations) => {
  if (await supportsTransactions()) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await operations(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
  // In production, silent fallback to sequential operations can corrupt financial
  // data. Fail explicitly so the deployment uses a replica set.
  if (process.env.NODE_ENV === 'production') {
    logger.error(
      '[DB] Transaction required but MongoDB standalone detected in production. ' +
      'Use a replica set for multi-document financial operations.'
    );
    throw new ApiError(500, 'Production financial operations require a MongoDB replica set');
  }
  // Development/test: run without session so local dev works against standalone.
  return operations(null);
};

// ─── Stripe client (lazy — checked at call time so missing key gives clear error) ─
let _stripe = null;
const getStripe = () => {
  if (config.paymentMode === 'demo') {
    throw new ApiError(400, 'Stripe is not available in demo mode. Set PAYMENT_MODE=stripe for real payments.');
  }
  if (!config.stripe.secretKey) {
    throw new ApiError(400, 'Stripe is not configured. Please add STRIPE_SECRET_KEY to your backend .env file.');
  }
  if (!_stripe) {
    _stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2024-02-15' });
  }
  return _stripe;
};

// ─── Wallet helpers ───────────────────────────────────────────────────────────

export const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = await Wallet.create({ user: userId });
  }
  return wallet;
};

export const creditWallet = async (userId, amount, session = null) => {
  const opts = session ? { session } : {};
  const wallet = await Wallet.findOneAndUpdate(
    { user: userId },
    { $inc: { balance: amount } },
    { new: true, upsert: true, ...opts }
  );
  return wallet;
};

export const debitWallet = async (userId, amount, session = null) => {
  // Atomic conditional decrement: the balance check and debit happen as a single
  // MongoDB operation, preventing the read-modify-write race where two
  // concurrent debits could each see sufficient balance, then both succeed and
  // push the wallet negative.
  const wallet = await Wallet.findOneAndUpdate(
    {
      user: userId,
      $expr: { $gte: [{ $subtract: ['$balance', '$escrowBalance'] }, amount] },
    },
    { $inc: { balance: -amount, totalSpent: amount } },
    { new: true, ...(session ? { session } : {}) }
  );
  if (!wallet) {
    throw new ApiError(400, 'Insufficient wallet balance');
  }
  return wallet;
};

export const holdEscrow = async (userId, amount, session = null) => {
  // Atomic conditional hold: available = balance - escrowBalance. The hold is a
  // single $inc on escrowBalance guarded by an $expr filter so concurrent holds
  // can never exceed the spendable balance.
  const wallet = await Wallet.findOneAndUpdate(
    {
      user: userId,
      $expr: { $gte: [{ $subtract: ['$balance', '$escrowBalance'] }, amount] },
    },
    { $inc: { escrowBalance: amount } },
    { new: true, ...(session ? { session } : {}) }
  );
  if (!wallet) {
    throw new ApiError(400, 'Insufficient funds to hold in escrow');
  }
  return wallet;
};

export const releaseEscrow = async (clientId, freelancerId, amount, commissionRate = getCommissionRate(), session = null) => {
  const opts = session ? { session } : {};

  // Debit escrow from client (escrow leaves the client's spendable balance)
  await Wallet.findOneAndUpdate(
    { user: clientId },
    { $inc: { escrowBalance: -amount, balance: -amount, totalSpent: amount } },
    opts
  );

  // Calculate commission
  const { commission, netAmount } = calculateCommission(amount, commissionRate);

  // Credit net to freelancer
  await Wallet.findOneAndUpdate(
    { user: freelancerId },
    { $inc: { balance: netAmount, totalEarned: netAmount } },
    { upsert: true, ...opts }
  );

  return { commission, netAmount, grossAmount: amount };
};

export const refundEscrow = async (clientId, amount, session = null) => {
  const opts = session ? { session } : {};
  // Escrow was never debited from the client's balance while held — just unlock it
  await Wallet.findOneAndUpdate(
    { user: clientId },
    { $inc: { escrowBalance: -amount } },
    opts
  );
};

// ─── Contract-chain propagation (single source of truth) ─────────────────────
// Every funding / release / refund transition routes its *status change* through
// these helpers so the linked Milestone → Project → Job → Payment chain can never
// disagree (the root of "Pending Payment after refund", "Contract Not Started /
// Funded", and stalled delivery approvals). Money movement stays in each caller;
// these helpers only keep the domain state consistent.

const now = () => new Date();

const projectLink = async (projectId, session) => {
  if (!projectId) return { project: null, job: null };
  const project = await Project.findById(projectId).session(session);
  if (!project) return { project: null, job: null };
  const job = project.job ? await Job.findById(project.job).session(session) : null;
  return { project, job };
};

export const propagateFunding = async ({
  projectId, milestoneId, paymentId, escrowId, session = null,
}) => {
  const opts = session ? { session } : {};

  if (milestoneId) {
    const milestone = await Milestone.findById(milestoneId).session(session);
    if (milestone && !['released', 'approved', 'cancelled'].includes(milestone.status)) {
      if (paymentId && !milestone.paymentId) milestone.paymentId = paymentId;
      milestone.status = 'funded';
      await milestone.save(opts);
    }
  }

  if (projectId) {
    // Centralized transition guard: only funded projects may become active.
    // Terminal projects (completed/cancelled) must NEVER be re-activated.
    const projectDoc = await Project.findById(projectId).session(session);
    if (projectDoc && !TERMINAL_PROJECT_STATUSES.includes(projectDoc.status)) {
      assertProjectTransition(projectDoc.status, 'active');
      await Project.updateOne(
        { _id: projectId },
        {
          $set: {
            status: 'active',
            ...(paymentId ? { escrowPaymentId: paymentId } : {}),
          },
        },
        opts
      );
      // A contract only "starts" on the first funding. Documents created before
      // this fix (or with a legacy schema default) may already carry a startDate
      // at creation time; leave their stamp alone and only fill the gap.
      await Project.updateOne(
        { _id: projectId, 'timeline.startDate': null },
        { $set: { 'timeline.startDate': now() } },
        opts
      );
      const { job } = await projectLink(projectId, session);
      if (job && !['completed', 'cancelled'].includes(job.status)) {
        const update = { status: 'funded', paymentStatus: 'funded' };
        if (paymentId) update.paymentId = paymentId;
        if (milestoneId) update.milestoneId = milestoneId;
        if (escrowId) update.escrowId = escrowId;
        await Job.updateOne({ _id: job._id }, { $set: update }, opts);
      }
    } else if (projectDoc) {
      logger.warn(
        `[FUND-GUARD] Funding attempted on terminal project ${projectId} (status=${projectDoc.status}). ` +
        `Status left untouched.`
      );
    }
  }
};

export const propagateRelease = async ({
  projectId, milestoneId, paymentId, escrowId, amount, transactionId, session = null,
}) => {
  const opts = session ? { session } : {};
  const at = now();

  if (paymentId) {
    await Payment.updateOne(
      { _id: paymentId },
      { $set: { status: 'completed', isEscrow: true, escrowReleasedAt: at, processedAt: at } },
      opts
    );
  }

  if (milestoneId) {
    await Milestone.updateOne(
      { _id: milestoneId },
      {
        $set: {
          status: 'released',
          approvedAt: at,
          escrowReleasedAt: at,
          ...(transactionId ? { transactionId } : {}),
        },
      },
      opts
    );
  }

  if (projectId) {
    const { project, job } = await projectLink(projectId, session);
    if (project) {
      // Centralized transition guard: a release may only complete a project that
      // is currently on a valid pre-completion status. Terminal projects
      // (completed/cancelled) must NEVER be touched again — otherwise a replayed
      // release could overwrite a cancelled project back to 'completed' or
      // double-count paidAmount.
      if (TERMINAL_PROJECT_STATUSES.includes(project.status)) {
        logger.warn(
          `[RELEASE-GUARD] Release attempted on terminal project ${projectId} (status=${project.status}). ` +
          `Status and payment totals left untouched.`
        );
      } else {
        assertProjectTransition(project.status, 'completed');
        project.status = 'completed';
        project.timeline.completedAt = at;
        project.progress = 100;
        project.budget.paidAmount = (project.budget.paidAmount || 0) + (amount || 0);
        await project.save(opts);
      }
    }
    if (job) {
      await Job.updateOne(
        { _id: job._id },
        { $set: { status: 'completed', paymentStatus: 'released' } },
        opts
      );
    }
  }

  if (escrowId) {
    await Escrow.updateOne(
      { _id: escrowId },
      {
        $set: {
          status: 'released',
          releasedAt: at,
          ...(transactionId ? { releaseTransaction: transactionId } : {}),
        },
      },
      opts
    );
  }
};

export const propagateRefund = async ({
  projectId, milestoneId, paymentId, escrowId, amount, currency,
  clientId, reason = '', session = null,
}) => {
  const opts = session ? { session } : {};
  const at = now();

  if (paymentId) {
    await Payment.updateOne(
      { _id: paymentId },
      { $set: { status: 'refunded', refundedAt: at, refundReason: reason, isEscrow: true } },
      opts
    );
  }

  // Ledger record so refunds surface in the client payment history and admin
  // refund stats (type 'refund'). Idempotent per escrow.
  if (escrowId && clientId && amount) {
    await Payment.updateOne(
      { type: 'refund', 'metadata.escrowId': String(escrowId) },
      {
        $setOnInsert: {
          payer: clientId,
          payee: clientId,
          project: projectId || null,
          milestone: milestoneId || null,
          type: 'refund',
          amount,
          currency: currency || 'ETB',
          commission: 0,
          commissionRate: 0,
          netAmount: amount,
          status: 'completed',
          provider: 'wallet',
          reference: generateTxRef('RFN'),
          description: reason || 'Escrow refunded',
          metadata: { escrowId: String(escrowId) },
          refundedAt: at,
        },
      },
      { upsert: true, ...opts }
    );
  }

  if (milestoneId) {
    await Milestone.updateOne(
      {
        _id: milestoneId,
        status: { $in: ['funded', 'in_progress', 'submitted', 'revision_requested', 'disputed'] },
      },
      { $set: { status: 'pending', paymentId: null } },
      opts
    );
  }

  if (projectId) {
    // NEVER move a terminal project (completed/cancelled) back to pending_payment.
    // A refund may only rewind a project that is still funded/active. The linked
    // job is only rewound together with a non-terminal project so the chain can
    // never disagree (e.g. project completed but job pushed back to payment_pending).
    const project = await Project.findById(projectId).session(session);
    if (project && !TERMINAL_PROJECT_STATUSES.includes(project.status)) {
      assertProjectTransition(project.status, 'pending_payment');
      project.status = 'pending_payment';
      await project.save(opts);
      const { job } = await projectLink(projectId, session);
      if (job && !['completed', 'cancelled'].includes(job.status)) {
        await Job.updateOne(
          { _id: job._id },
          { $set: { status: 'payment_pending', paymentStatus: 'pending' } },
          opts
        );
      }
    } else if (project) {
      logger.warn(
        `[REFUND-GUARD] Refund attempted on terminal project ${projectId} (status=${project.status}). ` +
        `Project and job statuses left untouched to preserve financial record integrity.`
      );
    }
  }
};

// ─── Transaction recording ────────────────────────────────────────────────────

export const recordTransaction = async ({
  userId,
  walletId,
  type,
  amount,
  fee = 0,
  netAmount,
  status = 'completed',
  reference,
  description = '',
  metadata = {},
  paymentId,
  projectId,
  milestoneId,
  balanceBefore,
  balanceAfter,
}) => {
  return Transaction.create({
    user: userId,
    wallet: walletId,
    type,
    amount,
    fee,
    netAmount,
    status,
    reference: reference || generateTxRef(),
    description,
    metadata,
    paymentId,
    projectId,
    milestoneId,
    balanceBefore,
    balanceAfter,
    processedAt: new Date(),
  });
};

// ─── Stripe ───────────────────────────────────────────────────────────────────

export const createStripePaymentIntent = async ({ amount, currency = 'etb', metadata = {} }) => {
  try {
    const intent = await getStripe().paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency: currency.toLowerCase(),
      metadata,
      automatic_payment_methods: { enabled: true },
    });
    return intent;
  } catch (err) {
    logger.error(`Stripe PaymentIntent error: ${err.message}`);
    throw new ApiError(500, `Payment processing error: ${err.message}`);
  }
};

export const createStripeCustomer = async (user) => {
  try {
    const customer = await getStripe().customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: { userId: user._id.toString() },
    });
    return customer;
  } catch (err) {
    logger.error(`Stripe customer creation error: ${err.message}`);
    throw new ApiError(500, 'Could not create payment profile');
  }
};

export const constructStripeEvent = (payload, signature) => {
  try {
    return getStripe().webhooks.constructEvent(payload, signature, config.stripe.webhookSecret);
  } catch (err) {
    throw new ApiError(400, `Webhook signature verification failed: ${err.message}`);
  }
};

export const createStripeRefund = async (paymentIntentId, amount) => {
  return getStripe().refunds.create({
    payment_intent: paymentIntentId,
    amount: amount ? Math.round(amount * 100) : undefined,
  });
};

// ─── Chapa (Ethiopia) ─────────────────────────────────────────────────────────

export const initiateChapaPayment = async ({ amount, currency = 'ETB', email, firstName, lastName, txRef, returnUrl, callbackUrl }) => {
  // Demo mode — return fake success so no real API key is needed
  if (config.paymentMode === 'demo') {
    logger.info('[DEMO] initiateChapaPayment called — returning fake success');
    return {
      status: 'success',
      message: 'Demo mode — no real payment initiated',
      data: {
        checkout_url: `${config.frontendUrl}/payments/success?tx_ref=${txRef || 'DEMO_TX'}&demo=1`,
        tx_ref: txRef || generateTxRef('CHP'),
      },
    };
  }

  if (config.paymentMode !== 'chapa') {
    throw new ApiError(400, 'Chapa is not available in current mode. Set PAYMENT_MODE=chapa for real payments.');
  }
  if (!config.chapa.secretKey) {
    throw new ApiError(400, 'Chapa is not configured. Please add CHAPA_SECRET_KEY to your backend .env file.');
  }
  try {
    const response = await axios.post(
      `${config.chapa.baseUrl}/transaction/initialize`,
      {
        amount: amount.toString(),
        currency,
        email,
        first_name: firstName,
        last_name: lastName,
        tx_ref: txRef || generateTxRef('CHP'),
        return_url: returnUrl || `${config.frontendUrl}/payments/success`,
        callback_url: callbackUrl || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/v1/payments/webhook/chapa`,
      },
      {
        headers: {
          Authorization: `Bearer ${config.chapa.secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (err) {
    const chapaMsg = err.response?.data?.message || err.response?.data?.error || err.message;
    logger.error(`Chapa payment initiation error: ${JSON.stringify(err.response?.data || err.message)}`);
    throw new ApiError(502, `Chapa error: ${chapaMsg}`);
  }
};

export const verifyChapaTransaction = async (txRef) => {
  // Demo mode — always return success
  if (config.paymentMode === 'demo') {
    logger.info(`[DEMO] verifyChapaTransaction called for ${txRef} — returning fake success`);
    return {
      status: 'success',
      data: { status: 'success', amount: 0, currency: 'ETB' },
    };
  }

  try {
    const response = await axios.get(
      `${config.chapa.baseUrl}/transaction/verify/${txRef}`,
      {
        headers: { Authorization: `Bearer ${config.chapa.secretKey}` },
      }
    );
    return response.data;
  } catch (err) {
    logger.error(`Chapa verification error: ${err.response?.data || err.message}`);
    throw new ApiError(500, 'Chapa transaction verification failed');
  }
};

// ─── Telebirr (Ethiopia — Ethio Telecom) ─────────────────────────────────────

const generateTelebirrToken = async () => {
  if (config.paymentMode === 'demo') {
    throw new ApiError(400, 'Telebirr is not available in demo mode. Set PAYMENT_MODE=telebirr for real payments.');
  }
  const { merchantId, appKey, appSecret } = config.telebirr;
  if (!merchantId || !appKey || !appSecret) {
    throw new ApiError(400, 'Telebirr is not configured. Please add TELEBIRR_MERCHANT_ID, TELEBIRR_APP_KEY, TELEBIRR_APP_SECRET to your .env file.');
  }
  const auth = Buffer.from(`${appKey}:${appSecret}`).toString('base64');
  return auth;
};

export const initiateTelebirrPayment = async ({ amount, currency = 'ETB', phone, txRef, returnUrl, subject, description }) => {
  if (config.paymentMode === 'demo') {
    logger.info('[DEMO] initiateTelebirrPayment called — returning fake success');
    return {
      status: 'success',
      message: 'Demo mode — no real payment initiated',
      data: {
        checkoutUrl: `${config.frontendUrl}/payments/success?tx_ref=${txRef || 'DEMO_TB'}&provider=telebirr&demo=1`,
        txRef: txRef || generateTxRef('TB'),
        orderId: `DEMO_TB_${Date.now()}`,
      },
    };
  }

  const { merchantId, shortCode, baseUrl } = config.telebirr;
  if (!merchantId || !shortCode) {
    throw new ApiError(503, 'Telebirr merchant credentials not configured');
  }

  const token = await generateTelebirrToken();
  const reference = txRef || generateTxRef('TB');

  try {
    // Telebirr H5/MWeb payment request
    const payload = {
      appId: merchantId,
      appKey: config.telebirr.appKey,
      merchantCode: shortCode,
      receiveName: subject || 'SkillHub Payment',
      totalAmount: amount.toString(),
      subject: subject || 'SkillHub Wallet Deposit',
      outTradeNo: reference,
      notifyUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/v1/payments/webhook/telebirr`,
      returnUrl: returnUrl || `${config.frontendUrl}/payments/success?provider=telebirr`,
      timeoutExpress: '30',
      shortCode,
    };

    const response = await axios.post(
      `${baseUrl}/payment/H5`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data?.code === '0000' || response.data?.code === 200) {
      return {
        status: 'success',
        data: {
          checkoutUrl: response.data.data?.payLink || response.data.data?.deeplink,
          txRef: reference,
          orderId: response.data.data?.orderId,
          payLink: response.data.data?.payLink,
        },
      };
    }

    throw new Error(response.data?.message || response.data?.msg || 'Telebirr initiation failed');
  } catch (err) {
    const tbMsg = err.response?.data?.message || err.response?.data?.msg || err.message;
    logger.error(`Telebirr payment initiation error: ${JSON.stringify(err.response?.data || err.message)}`);
    throw new ApiError(502, `Telebirr error: ${tbMsg}`);
  }
};

export const verifyTelebirrTransaction = async (txRef) => {
  if (config.paymentMode === 'demo') {
    return { status: 'success', data: { status: 'success', amount: 0, currency: 'ETB' } };
  }

  const { merchantId, shortCode, baseUrl } = config.telebirr;
  const token = await generateTelebirrToken();

  try {
    const response = await axios.get(
      `${baseUrl}/payment/order/${merchantId}/${shortCode}/${txRef}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (err) {
    logger.error(`Telebirr verification error: ${err.response?.data || err.message}`);
    throw new ApiError(500, 'Telebirr transaction verification failed');
  }
};

// ─── CBE Birr (Ethiopia — Commercial Bank of Ethiopia) ──────────────────────

export const initiateCbeBirrPayment = async ({ amount, currency = 'ETB', accountNumber, txRef, subject, description }) => {
  if (config.paymentMode === 'demo') {
    logger.info('[DEMO] initiateCbeBirrPayment called — returning fake success');
    return {
      status: 'success',
      message: 'Demo mode — no real payment initiated',
      data: {
        checkoutUrl: `${config.frontendUrl}/payments/success?tx_ref=${txRef || 'DEMO_CBE'}&provider=cbe_birr&demo=1`,
        txRef: txRef || generateTxRef('CBE'),
        orderId: `DEMO_CBE_${Date.now()}`,
        ussdCode: `*847*0*100#`,
      },
    };
  }

  if (config.paymentMode !== 'cbe') {
    throw new ApiError(400, 'CBE Birr is not available in current mode. Set PAYMENT_MODE=cbe for real payments.');
  }
  const { merchantCode, apiKey, baseUrl, merchantName } = config.cbeBirr;
  if (!merchantCode || !apiKey) {
    throw new ApiError(400, 'CBE Birr is not configured. Please add CBE_BIRR_MERCHANT_CODE and CBE_BIRR_API_KEY to your .env file.');
  }

  const reference = txRef || generateTxRef('CBE');

  try {
    // CBE Birr Collection API — initiate payment request
    const payload = {
      merchantCode,
      amount: amount.toString(),
      currency,
      referenceId: reference,
      subject: subject || 'SkillHub Wallet Deposit',
      description: description || `Deposit ${amount} ${currency} to SkillHub wallet`,
      accountNumber: accountNumber || '',
      merchantName,
      callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/v1/payments/webhook/cbe-birr`,
      successRedirectUrl: `${config.frontendUrl}/payments/success?provider=cbe_birr`,
      failRedirectUrl: `${config.frontendUrl}/payments/failed?provider=cbe_birr`,
    };

    const response = await axios.post(
      `${baseUrl}/api/merchant/collection/initialize`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (response.data?.code === '000' || response.data?.code === '200' || response.data?.status === 'success') {
      return {
        status: 'success',
        data: {
          checkoutUrl: response.data.data?.paymentUrl || response.data.data?.redirectUrl,
          txRef: reference,
          orderId: response.data.data?.orderId,
          ussdCode: response.data.data?.ussdCode,
        },
      };
    }

    throw new Error(response.data?.message || 'CBE Birr initiation failed');
  } catch (err) {
    const cbeMsg = err.response?.data?.message || err.response?.data?.error || err.message;
    logger.error(`CBE Birr payment initiation error: ${JSON.stringify(err.response?.data || err.message)}`);
    throw new ApiError(502, `CBE Birr error: ${cbeMsg}`);
  }
};

export const verifyCbeBirrTransaction = async (txRef) => {
  if (config.paymentMode === 'demo') {
    return { status: 'success', data: { status: 'success', amount: 0, currency: 'ETB' } };
  }

  const { apiKey, baseUrl, merchantCode } = config.cbeBirr;

  try {
    const response = await axios.get(
      `${baseUrl}/api/merchant/collection/status/${merchantCode}/${txRef}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    return response.data;
  } catch (err) {
    logger.error(`CBE Birr verification error: ${err.response?.data || err.message}`);
    throw new ApiError(500, 'CBE Birr transaction verification failed');
  }
};

// ─── Invoice number generator ─────────────────────────────────────────────────
export const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const shortId = crypto.randomUUID().split('-')[0].toUpperCase(); // 8 hex chars
  return `SKH-INV-${year}-${shortId}`;
};

// ─── Demo Deposit (no real payment) ────────────────────────────────────────────
export const createDemoDeposit = async (userId, amount, currency = 'ETB') => {
  const reference = generateTxRef('DEMO');
  const invoiceNumber = await generateInvoiceNumber();
  const receiptNumber = `RCP-${Date.now()}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

  const result = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    const payment = await Payment.create([{
      payer: userId,
      type: 'deposit',
      amount,
      currency,
      netAmount: amount,
      status: 'completed',
      provider: 'demo',
      reference,
      invoiceNumber,
      description: 'Demo wallet deposit (testing mode)',
      processedAt: new Date(),
      metadata: { mode: 'demo', note: 'No real money was charged', receiptNumber },
    }], opts);

    const wallet = await creditWallet(userId, amount, session);

    await Transaction.create([{
      user: userId,
      wallet: wallet._id,
      type: 'deposit',
      amount,
      netAmount: amount,
      status: 'completed',
      reference,
      description: 'Demo wallet deposit',
      paymentId: payment[0]._id,
      balanceBefore: wallet.balance - amount,
      balanceAfter: wallet.balance,
      processedAt: new Date(),
    }], opts);

    return { payment: payment[0], wallet };
  });

  // Notifications (fire-and-forget — don't block deposit)
  try {
    const { notifyPaymentReceived } = await import('../services/notification.service.js');
    await notifyPaymentReceived(userId, amount, currency, 'Wallet deposit (demo)');
  } catch (_) {}
  try {
    const { User } = await import('../models/index.js');
    const { sendPaymentReceivedEmail } = await import('../services/email.service.js');
    const user = await User.findById(userId);
    if (user) await sendPaymentReceivedEmail(user, amount, currency, 'Wallet deposit (demo)').catch(() => {});
  } catch (_) {}

  return {
    success: true,
    transactionId: result.payment._id.toString(),
    provider: 'demo',
    amount,
    currency,
    status: 'completed',
    receiptNumber,
    createdAt: result.payment.createdAt,
    payment: result.payment,
    wallet: result.wallet,
  };
};

// ─── Withdraw ──────────────────────────────────────────────────────────────────
export const createWithdrawal = async (userId, { amount, method, details, currency = 'ETB' }) => {
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) throw new ApiError(404, 'Wallet not found');

  // Pre-flight check for a friendly error message. The authoritative guard is
  // the atomic conditional decrement below (balance check + decrement happen in
  // a single MongoDB operation so concurrent withdrawals can never overdraw).
  const available = wallet.balance - wallet.escrowBalance;
  if (available < amount) {
    throw new ApiError(400, `Insufficient balance. Available: ${available.toFixed(2)} ETB`);
  }

  const withdrawalFee = config.platform.withdrawalFee || 0;
  const netAmount = amount - withdrawalFee;
  if (netAmount <= 0) {
    throw new ApiError(400, `Amount must exceed withdrawal fee of ${withdrawalFee} ETB`);
  }

  const reference = generateTxRef('WDR');

  const result = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // Atomic conditional withdraw: only decrements if available
    // (balance - escrowBalance) is still sufficient at write time.
    const w = await Wallet.findOneAndUpdate(
      {
        user: userId,
        $expr: { $gte: [{ $subtract: ['$balance', '$escrowBalance'] }, amount] },
      },
      { $inc: { balance: -amount, totalWithdrawn: amount } },
      { new: true, ...opts }
    );
    if (!w) {
      throw new ApiError(400, 'Insufficient balance. Available funds may have changed. Please retry.');
    }

    const tx = await Transaction.create([{
      user: userId,
      wallet: w._id,
      type: 'withdrawal',
      amount,
      fee: withdrawalFee,
      netAmount,
      status: 'processing',
      reference,
      externalReference: '',
      description: `Withdrawal via ${method}`,
      metadata: { method, details, currency, fee: withdrawalFee },
      balanceBefore: w.balance + amount,
      balanceAfter: w.balance,
      processedAt: new Date(),
    }], opts);

    await Payment.create([{
      payer: userId,
      type: 'withdrawal',
      amount,
      currency,
      invoiceNumber: await generateInvoiceNumber(),
      fee: withdrawalFee,
      netAmount,
      status: 'processing',
      provider: 'manual',
      reference,
      description: `Withdrawal via ${method}`,
      metadata: { method, details, fee: withdrawalFee },
    }], opts);

    return { transaction: tx[0], wallet: w };
  });

  return result;
};

// ─── Escrow: Create & Fund ─────────────────────────────────────────────────────
export const createEscrow = async ({ clientId, freelancerId, projectId, milestoneId, amount, currency = 'ETB', description = '', serviceOrder = null }) => {
  const commissionRate = getCommissionRate();
  const { commission, netAmount } = calculateCommission(amount, commissionRate);

  const escrow = await Escrow.create({
    client: clientId,
    freelancer: freelancerId,
    project: projectId || null,
    milestone: milestoneId || null,
    serviceOrder: serviceOrder || null,
    amount,
    currency,
    commissionRate,
    commissionAmount: commission,
    freelancerAmount: netAmount,
    status: 'pending',
    description,
  });

  return escrow;
};

export const fundEscrow = async (escrowId, clientId) => {
  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw new ApiError(404, 'Escrow not found');
  if (escrow.client.toString() !== clientId.toString()) throw new ApiError(403, 'Not authorized');
  if (escrow.status !== 'pending') throw new ApiError(400, `Escrow is ${escrow.status}, cannot fund`);

  const wallet = await Wallet.findOne({ user: clientId });
  if (!wallet) throw new ApiError(404, 'Wallet not found');
  // Pre-flight check for a friendly message. The authoritative guard is the
  // atomic conditional hold below (available-balance check + $inc in one op).
  const available = wallet.balance - wallet.escrowBalance;
  if (available < escrow.amount) {
    throw new ApiError(400, `Insufficient balance. Available: ${available.toFixed(2)} ETB, required: ${escrow.amount} ETB`);
  }

  const result = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // Atomic conditional hold: verified available balance is still sufficient at
    // write time, preventing concurrent holds from double-spending the balance.
    const held = await Wallet.findOneAndUpdate(
      {
        user: clientId,
        $expr: { $gte: [{ $subtract: ['$balance', '$escrowBalance'] }, escrow.amount] },
      },
      { $inc: { escrowBalance: escrow.amount } },
      { new: true, ...opts }
    );
    if (!held) {
      throw new ApiError(400, 'Insufficient balance. Available funds may have changed. Please retry.');
    }

    const balanceBefore = held.balance;

    const tx = await Transaction.create([{
      user: clientId,
      wallet: held._id,
      type: 'escrow_hold',
      amount: escrow.amount,
      fee: 0,
      netAmount: escrow.amount,
      status: 'completed',
      reference: generateTxRef('ESC'),
      description: `Escrow funded for project`,
      metadata: { escrowId: escrow._id.toString() },
      balanceBefore,
      balanceAfter: held.balance,
      processedAt: new Date(),
    }], opts);

    // Link a Payment record if this escrow has none (escrows created through
    // the standalone escrow API were stored without a Payment document).
    if (!escrow.paymentId) {
      const pay = await Payment.create([{
        payer: clientId,
        payee: escrow.freelancer,
        project: escrow.project || null,
        milestone: escrow.milestone || null,
        type: 'escrow',
        amount: escrow.amount,
        currency: escrow.currency,
        invoiceNumber: await generateInvoiceNumber(),
        commission: 0,
        commissionRate: escrow.commissionRate,
        netAmount: escrow.amount,
        status: 'completed',
        provider: 'wallet',
        reference: generateTxRef('ESC'),
        description: escrow.description || 'Escrow funded',
        isEscrow: true,
        escrowHeldAt: new Date(),
        processedAt: new Date(),
      }], opts);
      escrow.paymentId = pay[0]._id;
    }

    escrow.status = 'funded';
    escrow.fundedAt = new Date();
    escrow.fundingTransaction = tx[0]._id;
    escrow.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await escrow.save(session ? { session } : {});

    // Propagate funding to the linked contract chain (milestone → project → job)
    // so the Job/Project/Milestone/Payment states never drift apart.
    let linkedMilestone = escrow.milestone;
    if (!linkedMilestone && escrow.project) {
      const first = await Milestone.findOne({ project: escrow.project })
        .sort({ order: 1, createdAt: 1 })
        .session(session);
      linkedMilestone = first?._id || null;
    }
    await propagateFunding({
      projectId: escrow.project,
      milestoneId: linkedMilestone,
      paymentId: escrow.paymentId,
      escrowId: escrow._id,
      session,
    });

    return { escrow, transaction: tx[0] };
  });

  return result;
};

// ─── Escrow: Mark In Progress ──────────────────────────────────────────────────
export const startEscrowWork = async (escrowId, freelancerId) => {
  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw new ApiError(404, 'Escrow not found');
  if (escrow.freelancer.toString() !== freelancerId.toString()) throw new ApiError(403, 'Not authorized');
  if (escrow.status !== 'funded') throw new ApiError(400, `Escrow is ${escrow.status}, cannot start work`);

  escrow.status = 'in_progress';
  await escrow.save();
  return escrow;
};

// ─── Escrow: Freelancer Submit ─────────────────────────────────────────────────
export const submitEscrowWork = async (escrowId, freelancerId) => {
  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw new ApiError(404, 'Escrow not found');
  if (escrow.freelancer.toString() !== freelancerId.toString()) throw new ApiError(403, 'Not authorized');
  if (escrow.status !== 'in_progress') throw new ApiError(400, `Escrow is ${escrow.status}, cannot submit`);

  escrow.status = 'submitted';
  escrow.submittedAt = new Date();
  await escrow.save();
  return escrow;
};

// ─── Escrow: Release to Freelancer ─────────────────────────────────────────────
export const releaseEscrowFunds = async (escrowId, clientId, { rating } = {}) => {
  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw new ApiError(404, 'Escrow not found');
  if (escrow.client.toString() !== clientId.toString()) throw new ApiError(403, 'Not authorized');
  if (!['funded', 'submitted'].includes(escrow.status)) {
    throw new ApiError(400, `Escrow is ${escrow.status}, cannot release`);
  }
  if (escrow.status === 'released') {
    throw new ApiError(400, 'Escrow already released');
  }
  if (escrow.releaseTransaction) {
    throw new ApiError(400, 'Escrow already has a release transaction');
  }

  const result = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // Atomic conditional release: escrow may only be debited while the client's
    // escrowBalance still covers it (single read-modify-write replaced by one
    // atomic findOneAndUpdate so concurrent releases can never underflow).
    const clientWallet = await Wallet.findOneAndUpdate(
      {
        user: clientId,
        $expr: { $gte: ['$escrowBalance', escrow.amount] },
      },
      { $inc: { escrowBalance: -escrow.amount, balance: -escrow.amount, totalSpent: escrow.amount } },
      { new: true, ...opts }
    );
    if (!clientWallet) throw new ApiError(400, 'Insufficient escrow balance');

    // Atomic freelancer credit (upsert keeps atomicity when the wallet is new).
    let freelancerWallet = await Wallet.findOneAndUpdate(
      { user: escrow.freelancer },
      { $inc: { balance: escrow.freelancerAmount, totalEarned: escrow.freelancerAmount } },
      { upsert: true, new: true, ...opts }
    );

    const clientTx = await Transaction.create([{
      user: clientId,
      wallet: clientWallet._id,
      type: 'escrow_release',
      amount: escrow.amount,
      fee: 0,
      netAmount: escrow.amount,
      status: 'completed',
      reference: generateTxRef('ESCR'),
      description: `Escrow released to freelancer`,
      projectId: escrow.project,
      milestoneId: escrow.milestone,
      metadata: { escrowId: escrow._id.toString(), freelancerId: escrow.freelancer.toString() },
      balanceBefore: clientWallet.balance + escrow.amount,
      balanceAfter: clientWallet.balance,
      processedAt: new Date(),
    }], opts);

    const freelancerTx = await Transaction.create([{
      user: escrow.freelancer,
      wallet: freelancerWallet._id,
      type: 'escrow_release',
      amount: escrow.amount,
      fee: escrow.commissionAmount,
      netAmount: escrow.freelancerAmount,
      status: 'completed',
      reference: generateTxRef('ESCP'),
      description: `Payment received for project`,
      projectId: escrow.project,
      milestoneId: escrow.milestone,
      metadata: { escrowId: escrow._id.toString(), clientId: clientId.toString() },
      balanceBefore: freelancerWallet.balance - escrow.freelancerAmount,
      balanceAfter: freelancerWallet.balance,
      processedAt: new Date(),
    }], opts);

    if (escrow.commissionAmount > 0) {
      await recordCommissionTransaction({
        scopeKey: `E-${escrow._id}`,
        fields: {
          user: escrow.freelancer,
          wallet: freelancerWallet._id,
          type: 'commission',
          amount: escrow.commissionAmount,
          fee: 0,
          netAmount: escrow.commissionAmount,
          status: 'completed',
          description: `Platform commission (${(escrow.commissionRate * 100).toFixed(0)}%)`,
          projectId: escrow.project,
          milestoneId: escrow.milestone,
          metadata: { escrowId: escrow._id.toString() },
          balanceBefore: freelancerWallet.balance,
          balanceAfter: freelancerWallet.balance,
          processedAt: new Date(),
        },
      }, opts);
    }

    escrow.status = 'released';
    escrow.releasedAt = new Date();
    escrow.releasedBy = clientId;
    escrow.rating = rating || null;
    escrow.releaseTransaction = clientTx[0]._id;
    await escrow.save(opts);

    // Propagate release to the linked contract chain (Payment escrowReleasedAt,
    // milestone released, project completed, job completed/released).
    await propagateRelease({
      projectId: escrow.project,
      milestoneId: escrow.milestone,
      paymentId: escrow.paymentId,
      escrowId: escrow._id,
      amount: escrow.amount,
      transactionId: clientTx[0]._id,
      session,
    });

    return { escrow, clientTransaction: clientTx[0], freelancerTransaction: freelancerTx[0] };
  });

  return result;
};

// ─── Escrow: Refund to Client ──────────────────────────────────────────────────
export const refundEscrowFunds = async (escrowId, userId, { reason = '' } = {}) => {
  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw new ApiError(404, 'Escrow not found');
  if (!['funded', 'submitted', 'disputed', 'expired'].includes(escrow.status)) {
    throw new ApiError(400, `Escrow is ${escrow.status}, cannot refund`);
  }

  const result = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // Atomic conditional refund: escrow may only be unlocked while the client's
    // escrowBalance still covers it (single atomic update, no read-modify-write).
    const clientWallet = await Wallet.findOneAndUpdate(
      {
        user: escrow.client,
        $expr: { $gte: ['$escrowBalance', escrow.amount] },
      },
      { $inc: { escrowBalance: -escrow.amount } },
      { new: true, ...opts }
    );
    if (!clientWallet) throw new ApiError(400, 'Insufficient escrow balance');

    const balanceBefore = clientWallet.balance;

    const tx = await Transaction.create([{
      user: escrow.client,
      wallet: clientWallet._id,
      type: 'escrow_refund',
      amount: escrow.amount,
      fee: 0,
      netAmount: escrow.amount,
      status: 'completed',
      reference: generateTxRef('REF'),
      description: reason || 'Escrow refunded',
      metadata: { escrowId: escrow._id.toString(), refundReason: reason },
      balanceBefore,
      balanceAfter: clientWallet.balance,
      processedAt: new Date(),
    }], opts);

    escrow.status = 'refunded';
    escrow.refundedAt = new Date();
    escrow.refundedBy = userId;
    escrow.refundReason = reason;
    escrow.refundTransaction = tx[0]._id;
    await escrow.save(opts);

    // Create the refund ledger record and reset the linked contract chain so the
    // Job/Project/Milestone/Payment stop showing "funded / completed" after a
    // refund (the "Pending Payment" that never went away).
    await propagateRefund({
      projectId: escrow.project,
      milestoneId: escrow.milestone,
      paymentId: escrow.paymentId,
      escrowId: escrow._id,
      amount: escrow.amount,
      currency: escrow.currency,
      clientId: escrow.client,
      freelancerId: escrow.freelancer,
      reason,
      session,
    });

    return { escrow, transaction: tx[0] };
  });

  return result;
};

// ─── Escrow: Get user escrows ──────────────────────────────────────────────────
export const getUserEscrows = async (userId, { status, page = 1, limit = 10 } = {}) => {
  const filter = {
    $or: [{ client: userId }, { freelancer: userId }],
  };
  if (status) filter.status = status;

  const skip = (Math.max(1, page) - 1) * limit;
  const total = await Escrow.countDocuments(filter);
  const escrows = await Escrow.find(filter)
    .populate('client', 'firstName lastName avatar')
    .populate('freelancer', 'firstName lastName avatar')
    .populate('project', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    escrows,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};
