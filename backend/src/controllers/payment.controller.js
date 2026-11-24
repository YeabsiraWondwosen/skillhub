import { Wallet, Transaction, Payment, Escrow, Milestone, Withdrawal, PaymentMethod } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination, generateTxRef } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import {
  getOrCreateWallet, createStripePaymentIntent, constructStripeEvent,
  verifyChapaTransaction, generateInvoiceNumber, creditWallet,
  recordTransaction, initiateChapaPayment, createDemoDeposit,
  createWithdrawal, createEscrow, fundEscrow, startEscrowWork,
  submitEscrowWork, releaseEscrowFunds, refundEscrowFunds, getUserEscrows,
  initiateTelebirrPayment, verifyTelebirrTransaction,
  initiateCbeBirrPayment, verifyCbeBirrTransaction,
} from '../services/payment.service.js';
import { config } from '../config/env.js';
import { getCommissionRate } from '../services/settings.service.js';
import {
  verifyTelebirrWebhook, verifyCbeBirrWebhook, isSuccessfulWebhookStatus,
} from '../services/paymentWebhook.verify.service.js';

// ─── Unified Demo Handler ─────────────────────────────────────────────────────
// All deposit endpoints call this when in demo mode. Returns consistent response.
const handleDemoDeposit = async (userId, amount, currency, provider, res) => {
  const result = await createDemoDeposit(userId, amount, currency);
  return sendResponse(res, 200, `Demo deposit successful via ${provider}. No real money was charged.`, {
    success: true,
    transactionId: result.transactionId,
    provider: result.provider,
    amount: result.amount,
    currency: result.currency,
    status: result.status,
    receiptNumber: result.receiptNumber,
    createdAt: result.createdAt,
    wallet: { balance: result.wallet.balance, totalEarned: result.wallet.totalEarned },
  });
};

// ─── Safe notification wrapper ────────────────────────────────────────────────
const safeNotify = async (userId, amount, currency, description) => {
  try {
    const { notifyPaymentReceived } = await import('../services/notification.service.js');
    await notifyPaymentReceived(userId, amount, currency, description);
  } catch (_) {}
  try {
    const { User } = await import('../models/index.js');
    const { sendPaymentReceivedEmail } = await import('../services/email.service.js');
    const user = await User.findById(userId);
    if (user) await sendPaymentReceivedEmail(user, amount, currency, description).catch(() => {});
  } catch (_) {}
};

// ─── Get My Wallet ────────────────────────────────────────────────────────────
export const getWallet = catchAsync(async (req, res) => {
  const wallet = await getOrCreateWallet(req.user._id);
  const pendingEarnings = req.user.role === 'freelancer' ? await getPendingEarnings(req.user._id) : 0;
  sendResponse(res, 200, 'Wallet fetched', {
    ...wallet.toObject(),
    pendingEarnings,
  });
});

// ─── Payment Mode Status (public — no auth required) ──────────────────────────
export const getPaymentModeStatus = catchAsync(async (req, res) => {
  sendResponse(res, 200, 'Payment mode status', {
    mode: config.paymentMode,
    isDemo: config.paymentMode === 'demo',
    availableProviders: config.paymentMode === 'demo'
      ? ['demo']
      : [
          config.chapa.secretKey ? 'chapa' : null,
          config.stripe.secretKey ? 'stripe' : null,
          config.telebirr.merchantId ? 'telebirr' : null,
          config.cbeBirr.merchantCode ? 'cbe_birr' : null,
        ].filter(Boolean),
  });
});

// ─── Create Deposit (Stripe) ──────────────────────────────────────────────────
export const createStripeDeposit = catchAsync(async (req, res) => {
  const { amount, currency = 'ETB' } = req.body;

  if (config.paymentMode === 'demo') {
    return handleDemoDeposit(req.user._id, amount, currency, 'Stripe', res);
  }

  const wallet = await getOrCreateWallet(req.user._id);
  const reference = generateTxRef('DEP');

  const paymentIntent = await createStripePaymentIntent({
    amount,
    currency: currency.toLowerCase(),
    metadata: {
      userId: req.user._id.toString(),
      walletId: wallet._id.toString(),
      reference,
      type: 'deposit',
    },
  });

  // Create pending payment record
  const invoiceNumber = await generateInvoiceNumber();
  await Payment.create({
    payer: req.user._id,
    type: 'deposit',
    amount,
    currency,
    netAmount: amount,
    status: 'pending',
    provider: 'stripe',
    providerPaymentId: paymentIntent.id,
    reference,
    invoiceNumber,
    description: `Wallet deposit via Stripe`,
    metadata: { paymentIntentId: paymentIntent.id },
  });

  sendResponse(res, 200, 'Payment intent created', {
    clientSecret: paymentIntent.client_secret,
    reference,
    amount,
  });
});

// ─── Create Deposit (Chapa) ───────────────────────────────────────────────────
export const createChapaDeposit = catchAsync(async (req, res) => {
  const { amount, currency = 'ETB' } = req.body;
  const txRef = generateTxRef('CHP');

  if (config.paymentMode === 'demo') {
    return handleDemoDeposit(req.user._id, amount, currency, 'Chapa', res);
  }

  // Chapa mode — real API call
  const chapa_currency = 'ETB';

  const response = await initiateChapaPayment({
    amount,
    currency: chapa_currency,
    email: req.user.email,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    txRef,
  });

  if (response.status !== 'success') {
    throw new ApiError(502, `Chapa initiation failed: ${response.message || 'Unknown error'}`);
  }

  await Payment.create({
    payer: req.user._id,
    type: 'deposit',
    amount,
    currency: chapa_currency,
    netAmount: amount,
    status: 'pending',
    provider: 'chapa',
    providerTransactionRef: txRef,
    reference: txRef,
    description: 'Wallet deposit via Chapa',
  });

  sendResponse(res, 200, 'Chapa payment initiated', {
    checkoutUrl: response.data.checkout_url,
    txRef,
  });
});

// ─── Stripe Webhook ───────────────────────────────────────────────────────────
export const stripeWebhook = catchAsync(async (req, res) => {
  if (config.paymentMode === 'demo') {
    return res.json({ received: true, demo: true });
  }

  const sig = req.headers['stripe-signature'];
  const event = constructStripeEvent(req.body, sig);

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const { userId, walletId, reference, type } = pi.metadata;

    // Atomic: only update if still pending — prevents double-credit on retry
    const payment = await Payment.findOneAndUpdate(
      { providerPaymentId: pi.id, status: 'pending' },
      { status: 'completed', processedAt: new Date() },
      { new: true }
    );

    if (payment && type === 'deposit') {
      const amount = pi.amount / 100;
      const wallet = await creditWallet(userId, amount);

      await recordTransaction({
        userId,
        walletId,
        type: 'deposit',
        amount,
        netAmount: amount,
        status: 'completed',
        reference,
        description: 'Stripe deposit',
        paymentId: payment._id,
        balanceBefore: wallet.balance - amount,
        balanceAfter: wallet.balance,
      });

      await safeNotify(userId, amount, 'ETB', 'Wallet deposit via Stripe');
    }
  }

  res.json({ received: true });
});

// ─── Chapa Webhook/Verify ─────────────────────────────────────────────────────
export const verifyChapaDeposit = catchAsync(async (req, res) => {
  const { txRef } = req.params;

  // Demo mode — no pending payment to verify
  if (config.paymentMode === 'demo') {
    return sendResponse(res, 200, 'Demo deposit already confirmed', { amount: 0 });
  }

  const verification = await verifyChapaTransaction(txRef);
  if (verification.status !== 'success' || verification.data?.status !== 'success') {
    throw new ApiError(400, 'Payment not successful');
  }

  const payment = await Payment.findOneAndUpdate(
    { providerTransactionRef: txRef, status: 'pending' },
    { status: 'completed', processedAt: new Date() },
    { new: true }
  );
  if (!payment) throw new ApiError(404, 'Payment record not found or already processed');

  const wallet = await creditWallet(payment.payer, payment.amount);
  await recordTransaction({
    userId: payment.payer,
    walletId: wallet._id,
    type: 'deposit',
    amount: payment.amount,
    netAmount: payment.amount,
    status: 'completed',
    reference: txRef,
    description: 'Chapa deposit',
    paymentId: payment._id,
    balanceBefore: wallet.balance - payment.amount,
    balanceAfter: wallet.balance,
  });

  await safeNotify(payment.payer, payment.amount, payment.currency, 'Wallet deposit via Chapa');
  sendResponse(res, 200, 'Deposit confirmed', { amount: payment.amount });
});

// ─── Create Deposit (Telebirr) ───────────────────────────────────────────────
export const createTelebirrDeposit = catchAsync(async (req, res) => {
  const { amount, currency = 'ETB', phone } = req.body;
  const txRef = generateTxRef('TB');

  if (config.paymentMode === 'demo') {
    return handleDemoDeposit(req.user._id, amount, currency, 'Telebirr', res);
  }

  const response = await initiateTelebirrPayment({
    amount,
    currency,
    phone,
    txRef,
    subject: 'SkillHub Wallet Deposit',
  });

  if (response.status !== 'success') {
    throw new ApiError(502, `Telebirr initiation failed: ${response.message || 'Unknown error'}`);
  }

  await Payment.create({
    payer: req.user._id,
    type: 'deposit',
    amount,
    currency,
    netAmount: amount,
    status: 'pending',
    provider: 'telebirr',
    providerTransactionRef: txRef,
    reference: txRef,
    description: 'Wallet deposit via Telebirr',
  });

  sendResponse(res, 200, 'Telebirr payment initiated', {
    checkoutUrl: response.data?.checkoutUrl || response.data?.payLink,
    txRef,
  });
});

// ─── Telebirr Webhook ────────────────────────────────────────────────────────
export const telebirrWebhook = catchAsync(async (req, res) => {
  if (config.paymentMode === 'demo') {
    return res.json({ received: true, demo: true });
  }

  // Fail closed: never trust req.body.status. The webhook is rejected unless the
  // provider proves authenticity via a verified signature.
  verifyTelebirrWebhook(req.body, req.headers);

  const { outTradeNo, status, amount } = req.body;

  if (isSuccessfulWebhookStatus(status)) {
    const payment = await Payment.findOne({
      providerTransactionRef: outTradeNo,
      status: 'pending',
    });

    if (payment) {
      // Amount parity check FIRST — before any state mutation. A verified
      // webhook that claims a different amount than the recorded pending
      // payment must not leave the payment partially marked completed.
      if (amount != null && Number(amount) !== Number(payment.amount)) {
        logger.error(
          `[TELEBIRR] Amount mismatch for ${outTradeNo}: provider=${amount}, recorded=${payment.amount}. Rejecting webhook.`
        );
        throw new ApiError(409, 'Telebirr webhook amount mismatch');
      }

      // Atomic claim: at most one webhook attempt can transition pending → completed.
      const claimed = await Payment.updateOne(
        { _id: payment._id, status: 'pending' },
        {
          status: 'completed',
          processedAt: new Date(),
          $push: { webhookEvents: { eventId: outTradeNo, eventType: 'telebirr_webhook', receivedAt: new Date(), payload: req.body } },
        }
      );

      if (claimed.matchedCount === 0) {
        // Already processed by an earlier retry — idempotent no-op.
        return res.json({ received: true });
      }

      const wallet = await creditWallet(payment.payer, payment.amount);
      await recordTransaction({
        userId: payment.payer,
        walletId: wallet._id,
        type: 'deposit',
        amount: payment.amount,
        netAmount: payment.amount,
        status: 'completed',
        reference: outTradeNo,
        description: 'Telebirr deposit',
        paymentId: payment._id,
        balanceBefore: wallet.balance - payment.amount,
        balanceAfter: wallet.balance,
      });

      await safeNotify(payment.payer, payment.amount, payment.currency, 'Wallet deposit via Telebirr');
    }
  }

  res.json({ received: true });
});

// ─── Telebirr Verify ─────────────────────────────────────────────────────────
export const verifyTelebirrDeposit = catchAsync(async (req, res) => {
  const { txRef } = req.params;

  if (config.paymentMode === 'demo') {
    return sendResponse(res, 200, 'Demo deposit already confirmed', { amount: 0 });
  }

  const verification = await verifyTelebirrTransaction(txRef);
  if (verification.status !== 'success' && verification.data?.status !== 'success' && verification.data?.status !== 'COMPLETED') {
    throw new ApiError(400, 'Payment not successful');
  }

  const payment = await Payment.findOneAndUpdate(
    { providerTransactionRef: txRef, status: 'pending' },
    { status: 'completed', processedAt: new Date() },
    { new: true }
  );
  if (!payment) throw new ApiError(404, 'Payment record not found or already processed');

  const wallet = await creditWallet(payment.payer, payment.amount);
  await recordTransaction({
    userId: payment.payer,
    walletId: wallet._id,
    type: 'deposit',
    amount: payment.amount,
    netAmount: payment.amount,
    status: 'completed',
    reference: txRef,
    description: 'Telebirr deposit',
    paymentId: payment._id,
    balanceBefore: wallet.balance - payment.amount,
    balanceAfter: wallet.balance,
  });

  await safeNotify(payment.payer, payment.amount, payment.currency, 'Wallet deposit via Telebirr');
  sendResponse(res, 200, 'Deposit confirmed', { amount: payment.amount });
});

// ─── Create Deposit (CBE Birr) ───────────────────────────────────────────────
export const createCbeBirrDeposit = catchAsync(async (req, res) => {
  const { amount, currency = 'ETB', accountNumber } = req.body;
  const txRef = generateTxRef('CBE');

  if (config.paymentMode === 'demo') {
    return handleDemoDeposit(req.user._id, amount, currency, 'CBE Birr', res);
  }

  const response = await initiateCbeBirrPayment({
    amount,
    currency,
    accountNumber,
    txRef,
    subject: 'SkillHub Wallet Deposit',
  });

  if (response.status !== 'success') {
    throw new ApiError(502, `CBE Birr initiation failed: ${response.message || 'Unknown error'}`);
  }

  await Payment.create({
    payer: req.user._id,
    type: 'deposit',
    amount,
    currency,
    netAmount: amount,
    status: 'pending',
    provider: 'cbe_birr',
    providerTransactionRef: txRef,
    reference: txRef,
    description: 'Wallet deposit via CBE Birr',
  });

  sendResponse(res, 200, 'CBE Birr payment initiated', {
    checkoutUrl: response.data?.checkoutUrl,
    txRef,
    ussdCode: response.data?.ussdCode,
  });
});

// ─── CBE Birr Webhook ────────────────────────────────────────────────────────
export const cbeBirrWebhook = catchAsync(async (req, res) => {
  if (config.paymentMode === 'demo') {
    return res.json({ received: true, demo: true });
  }

  // Fail closed: never trust req.body.status. The webhook is rejected unless the
  // provider proves authenticity via a verified signature.
  verifyCbeBirrWebhook(req.body, req.headers);

  const { referenceId, status, amount } = req.body;

  if (isSuccessfulWebhookStatus(status)) {
    const payment = await Payment.findOne({
      providerTransactionRef: referenceId,
      status: 'pending',
    });

    if (payment) {
      // Amount parity check FIRST — before any state mutation. A verified
      // webhook that claims a different amount than the recorded pending
      // payment must not leave the payment partially marked completed.
      if (amount != null && Number(amount) !== Number(payment.amount)) {
        logger.error(
          `[CBE-BIRR] Amount mismatch for ${referenceId}: provider=${amount}, recorded=${payment.amount}. Rejecting webhook.`
        );
        throw new ApiError(409, 'CBE Birr webhook amount mismatch');
      }

      // Atomic claim: at most one webhook attempt can transition pending → completed.
      const claimed = await Payment.updateOne(
        { _id: payment._id, status: 'pending' },
        {
          status: 'completed',
          processedAt: new Date(),
          $push: { webhookEvents: { eventId: referenceId, eventType: 'cbe_birr_webhook', receivedAt: new Date(), payload: req.body } },
        }
      );

      if (claimed.matchedCount === 0) {
        // Already processed by an earlier retry — idempotent no-op.
        return res.json({ received: true });
      }

      const wallet = await creditWallet(payment.payer, payment.amount);
      await recordTransaction({
        userId: payment.payer,
        walletId: wallet._id,
        type: 'deposit',
        amount: payment.amount,
        netAmount: payment.amount,
        status: 'completed',
        reference: referenceId,
        description: 'CBE Birr deposit',
        paymentId: payment._id,
        balanceBefore: wallet.balance - payment.amount,
        balanceAfter: wallet.balance,
      });

      await safeNotify(payment.payer, payment.amount, payment.currency, 'Wallet deposit via CBE Birr');
    }
  }

  res.json({ received: true });
});

// ─── CBE Birr Verify ─────────────────────────────────────────────────────────
export const verifyCbeBirrDeposit = catchAsync(async (req, res) => {
  const { txRef } = req.params;

  if (config.paymentMode === 'demo') {
    return sendResponse(res, 200, 'Demo deposit already confirmed', { amount: 0 });
  }

  const verification = await verifyCbeBirrTransaction(txRef);
  if (verification.status !== 'success' && verification.data?.status !== 'success' && verification.data?.status !== 'COMPLETED') {
    throw new ApiError(400, 'Payment not successful');
  }

  const payment = await Payment.findOneAndUpdate(
    { providerTransactionRef: txRef, status: 'pending' },
    { status: 'completed', processedAt: new Date() },
    { new: true }
  );
  if (!payment) throw new ApiError(404, 'Payment record not found or already processed');

  const wallet = await creditWallet(payment.payer, payment.amount);
  await recordTransaction({
    userId: payment.payer,
    walletId: wallet._id,
    type: 'deposit',
    amount: payment.amount,
    netAmount: payment.amount,
    status: 'completed',
    reference: txRef,
    description: 'CBE Birr deposit',
    paymentId: payment._id,
    balanceBefore: wallet.balance - payment.amount,
    balanceAfter: wallet.balance,
  });

  await safeNotify(payment.payer, payment.amount, payment.currency, 'Wallet deposit via CBE Birr');
  sendResponse(res, 200, 'Deposit confirmed', { amount: payment.amount });
});

// ─── Get Transaction History ──────────────────────────────────────────────────
export const getTransactions = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { type, status, startDate, endDate } = req.query;

  const filter = { user: req.user._id };
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const total = await Transaction.countDocuments(filter);
  const transactions = await Transaction.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('projectId', 'title')
    .populate('milestoneId', 'title');

  sendResponse(res, 200, 'Transactions fetched', transactions, paginationMeta(total, page, limit));
});

// ─── Get Payment History ──────────────────────────────────────────────────────
export const getPaymentHistory = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const filter = { $or: [{ payer: req.user._id }, { payee: req.user._id }] };
  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate('project', 'title')
    .populate('milestone', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Payment history fetched', payments, paginationMeta(total, page, limit));
});

// ─── Get Invoice ──────────────────────────────────────────────────────────────
export const getInvoice = catchAsync(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.paymentId,
    $or: [{ payer: req.user._id }, { payee: req.user._id }],
  })
    .populate('payer', 'firstName lastName email')
    .populate('payee', 'firstName lastName email')
    .populate('project', 'title')
    .populate('milestone', 'title');

  if (!payment) throw new ApiError(404, 'Invoice not found');
  sendResponse(res, 200, 'Invoice fetched', payment);
});

// ─── Demo Deposit (testing mode — no real payment) ────────────────────────────
export const createDemoDepositCtrl = catchAsync(async (req, res) => {
  if (config.paymentMode !== 'demo') {
    throw new ApiError(403, 'Demo deposits are only available when PAYMENT_MODE=demo');
  }

  const { amount, currency = 'ETB' } = req.body;
  return handleDemoDeposit(req.user._id, amount, currency, 'Demo', res);
});

// ─── Withdraw ─────────────────────────────────────────────────────────────────
export const createWithdrawalCtrl = catchAsync(async (req, res) => {
  const { amount, method, details, currency } = req.body;

  const minimumWithdrawal = config.platform.minWithdrawal || 10;
  if (amount < minimumWithdrawal) {
    throw new ApiError(400, `Minimum withdrawal amount is ${minimumWithdrawal} ETB`);
  }

  const { transaction, wallet } = await createWithdrawal(req.user._id, {
    amount,
    method,
    details,
    currency,
  });

  try {
    const { notifyWithdrawalRequested, notifyAdminsWithdrawalRequested } = await import('../services/notification.service.js');
    await notifyWithdrawalRequested(req.user._id, amount, method);
    await notifyAdminsWithdrawalRequested({
      user: req.user,
      amount,
      method,
      transactionRef: transaction?.reference,
    });
  } catch (_) {}

  sendResponse(res, 201, 'Withdrawal initiated. Processing may take 1-3 business days.', {
    transaction,
    wallet: { balance: wallet.balance },
  });
});

// ─── Get Wallet Balance ───────────────────────────────────────────────────────
export const getWalletBalance = catchAsync(async (req, res) => {
  const wallet = await getOrCreateWallet(req.user._id);
  sendResponse(res, 200, 'Wallet balance fetched', {
    balance: wallet.balance,
    escrowBalance: wallet.escrowBalance,
    pendingBalance: wallet.pendingBalance,
    availableBalance: wallet.balance - wallet.escrowBalance,
    totalEarned: wallet.totalEarned,
    totalWithdrawn: wallet.totalWithdrawn,
    totalSpent: wallet.totalSpent,
    currency: wallet.currency,
  });
});

// ─── Create Escrow ────────────────────────────────────────────────────────────
export const createEscrowCtrl = catchAsync(async (req, res) => {
  const { freelancerId, projectId, milestoneId, amount, currency, description } = req.body;

  const escrow = await createEscrow({
    clientId: req.user._id,
    freelancerId,
    projectId,
    milestoneId,
    amount,
    currency,
    description,
  });

  sendResponse(res, 201, 'Escrow created. Fund it to lock the payment.', escrow);
});

// ─── Fund Escrow ──────────────────────────────────────────────────────────────
export const fundEscrowCtrl = catchAsync(async (req, res) => {
  const { escrowId } = req.params;

  const { escrow, transaction } = await fundEscrow(escrowId, req.user._id);

  try {
    const { notifyEscrowFunded } = await import('../services/notification.service.js');
    await notifyEscrowFunded(escrow.freelancer, escrow.amount, escrow.project?.title);
  } catch (_) {}

  sendResponse(res, 200, 'Escrow funded. Payment is now locked.', { escrow, transaction });
});

// ─── Start Work on Escrow ─────────────────────────────────────────────────────
export const startEscrowWorkCtrl = catchAsync(async (req, res) => {
  const { escrowId } = req.params;

  const escrow = await startEscrowWork(escrowId, req.user._id);

  sendResponse(res, 200, 'Work started on escrow', escrow);
});

// ─── Submit Escrow Work ───────────────────────────────────────────────────────
export const submitEscrowWorkCtrl = catchAsync(async (req, res) => {
  const { escrowId } = req.params;

  const escrow = await submitEscrowWork(escrowId, req.user._id);

  sendResponse(res, 200, 'Work submitted for review', escrow);
});

// ─── Release Escrow ───────────────────────────────────────────────────────────
export const releaseEscrowCtrl = catchAsync(async (req, res) => {
  const { escrowId } = req.params;
  const { rating } = req.body;

  const { escrow, clientTransaction, freelancerTransaction } = await releaseEscrowFunds(
    escrowId,
    req.user._id,
    { rating }
  );

  try {
    const { notifyEscrowReleased } = await import('../services/notification.service.js');
    await notifyEscrowReleased(escrow.freelancer, escrow.amount, escrow.freelancerAmount, escrow.commissionAmount, escrow.commissionRate);
    const { notifyPaymentReceived } = await import('../services/notification.service.js');
    await notifyPaymentReceived(escrow.freelancer, escrow.freelancerAmount, escrow.currency, `Escrow released - Payment received`);
  } catch (_) {}

  sendResponse(res, 200, 'Payment released to freelancer', {
    escrow,
    clientTransaction,
    freelancerTransaction,
  });
});

// ─── Refund Escrow ────────────────────────────────────────────────────────────
export const refundEscrowCtrl = catchAsync(async (req, res) => {
  const { escrowId } = req.params;
  const { reason } = req.body;

  // Ownership guard: only the client who funded the escrow may request a refund.
  // Admin callers use adminFinance/adminService routes (separate middleware).
  const Escrow = (await import('../models/index.js')).Escrow;
  const escrowDoc = await Escrow.findById(escrowId);
  if (!escrowDoc) throw new ApiError(404, 'Escrow not found');
  if (escrowDoc.client.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized — only the escrow client may request a refund');
  }

  const { escrow, transaction } = await refundEscrowFunds(escrowId, req.user._id, { reason });

  sendResponse(res, 200, 'Escrow refunded', { escrow, transaction });
});

// ─── Get My Escrows ───────────────────────────────────────────────────────────
export const getMyEscrows = catchAsync(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { status } = req.query;

  const result = await getUserEscrows(req.user._id, { status, page, limit });

  sendResponse(res, 200, 'Escrows fetched', result.escrows, result.meta);
});

// ─── Get Single Escrow ────────────────────────────────────────────────────────
export const getEscrow = catchAsync(async (req, res) => {
  const escrow = await Escrow.findById(req.params.escrowId)
    .populate('client', 'firstName lastName avatar')
    .populate('freelancer', 'firstName lastName avatar')
    .populate('project', 'title description')
    .populate('milestone', 'title amount')
    .populate('fundingTransaction')
    .populate('releaseTransaction')
    .populate('refundTransaction');

  if (!escrow) throw new ApiError(404, 'Escrow not found');

  const userId = req.user._id.toString();
  if (escrow.client._id.toString() !== userId && escrow.freelancer._id.toString() !== userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to view this escrow');
  }

  sendResponse(res, 200, 'Escrow fetched', escrow);
});

// ─── Commission Report (Admin) ───────────────────────────────────────────────
export const getCommissionReport = catchAsync(async (req, res) => {
  const { startDate, endDate, page = 1, limit = 20 } = req.query;
  const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  const matchFilter = { type: 'commission', status: 'completed' };
  if (startDate || endDate) {
    matchFilter.createdAt = {};
    if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
    if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
  }

  const total = await Transaction.countDocuments(matchFilter);

  const commissionTransactions = await Transaction.find(matchFilter)
    .populate('user', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const totalCommissions = commissionTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const aggregate = await Transaction.aggregate([
    { $match: { type: 'commission', status: 'completed', ...(matchFilter.createdAt ? { createdAt: matchFilter.createdAt } : {}) } },
    { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 }, avgAmount: { $avg: '$amount' } } },
  ]);

  const summary = aggregate[0] || { totalAmount: 0, count: 0, avgAmount: 0 };

  sendResponse(res, 200, 'Commission report fetched', {
    summary: {
      totalCommissions: summary.totalAmount,
      totalTransactions: summary.count,
      avgCommission: summary.avgAmount,
    },
    transactions: commissionTransactions,
  }, paginationMeta(total, parseInt(page), parseInt(limit)));
});

// ─── Payment Provider Stats ──────────────────────────────────────────────────
export const getProviderStats = catchAsync(async (req, res) => {
  const stats = await Payment.aggregate([
    { $match: { status: 'completed', type: 'deposit' } },
    { $group: {
      _id: '$provider',
      totalDeposits: { $sum: 1 },
      totalAmount: { $sum: '$amount' },
      avgAmount: { $avg: '$amount' },
    } },
    { $sort: { totalAmount: -1 } },
  ]);

  const allTimeStats = await Payment.aggregate([
    { $match: { status: 'completed' } },
    { $group: {
      _id: null,
      totalTransactions: { $sum: 1 },
      totalAmount: { $sum: '$amount' },
      totalCommission: { $sum: '$commission' },
    } },
  ]);

  sendResponse(res, 200, 'Provider stats fetched', {
    byProvider: stats,
    allTime: allTimeStats[0] || { totalTransactions: 0, totalAmount: 0, totalCommission: 0 },
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EARNINGS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Earnings ────────────────────────────────────────────────────────────────

// Active escrows/milestones where funds are held for the freelancer but not released.
// Escrow funds are held in the client's wallet, so a freelancer's own wallet
// escrowBalance is always 0 — compute the held amount from escrow/milestone records
// instead (display-only aggregation, no payment/escrow logic changes).
const PENDING_ESCROW_STATUSES = ['funded', 'in_progress', 'submitted', 'disputed'];

async function getPendingEarnings(userId) {
  const milestoneIdsInEscrows = await Escrow.distinct('milestone', { freelancer: userId });
  const [escrowPending, milestonePending] = await Promise.all([
    Escrow.aggregate([
      { $match: { freelancer: userId, status: { $in: PENDING_ESCROW_STATUSES } } },
      { $group: { _id: null, total: { $sum: '$freelancerAmount' } } },
    ]),
    Milestone.aggregate([
      {
        $match: {
          freelancer: userId,
          status: { $in: PENDING_ESCROW_STATUSES },
          _id: { $nin: milestoneIdsInEscrows },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $multiply: ['$amount', 1 - getCommissionRate()],
            },
          },
        },
      },
    ]),
  ]);

  return (escrowPending[0]?.total || 0) + (milestonePending[0]?.total || 0);
}

export const getEarnings = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const matchReleased = (start) => ({
    user: userId,
    type: 'escrow_release',
    status: 'completed',
    createdAt: { $gte: start },
  });

  const baseMatch = { user: userId, type: 'escrow_release', status: 'completed' };

  const [
    today, week, month, year,
    grossEarnings, netEarnings, totalFees,
    completedProjects, avgProjectValue,
    byProject, byClient,
  ] = await Promise.all([
    // today net
    Transaction.aggregate([
      { $match: matchReleased(startOfDay) },
      { $group: { _id: null, total: { $sum: '$netAmount' } } },
    ]),
    // this week net
    Transaction.aggregate([
      { $match: matchReleased(startOfWeek) },
      { $group: { _id: null, total: { $sum: '$netAmount' } } },
    ]),
    // this month net
    Transaction.aggregate([
      { $match: matchReleased(startOfMonth) },
      { $group: { _id: null, total: { $sum: '$netAmount' } } },
    ]),
    // this year net
    Transaction.aggregate([
      { $match: matchReleased(startOfYear) },
      { $group: { _id: null, total: { $sum: '$netAmount' } } },
    ]),
    // gross earnings (sum of amount, before commission)
    Transaction.aggregate([
      { $match: baseMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    // net earnings (sum of netAmount)
    Transaction.aggregate([
      { $match: baseMatch },
      { $group: { _id: null, total: { $sum: '$netAmount' } } },
    ]),
    // total fees (commission transactions)
    Transaction.aggregate([
      { $match: { user: userId, type: 'commission', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    // completed projects count
    Transaction.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$projectId' } },
      { $count: 'count' },
    ]),
    // average project value (net)
    Transaction.aggregate([
      { $match: baseMatch },
      { $group: { _id: null, avg: { $avg: '$netAmount' } } },
    ]),
    // earnings by project
    Transaction.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$projectId', total: { $sum: '$netAmount' } } },
      { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project' } },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ]),
    // earnings by client
    Transaction.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$projectId', total: { $sum: '$netAmount' } } },
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: '_id',
          as: 'project',
        },
      },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$project.client',
          total: { $sum: '$total' },
          projectCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'client',
        },
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ]),
  ]);

  const pendingEarnings = await getPendingEarnings(userId);

  sendResponse(res, 200, 'Earnings fetched', {
    today: today[0]?.total || 0,
    thisWeek: week[0]?.total || 0,
    thisMonth: month[0]?.total || 0,
    thisYear: year[0]?.total || 0,
    grossEarnings: grossEarnings[0]?.total || 0,
    netEarnings: netEarnings[0]?.total || 0,
    totalFees: totalFees[0]?.total || 0,
    pendingEarnings,
    completedProjects: completedProjects[0]?.count || 0,
    avgProjectValue: avgProjectValue[0]?.avg || 0,
    byProject: byProject.map(p => ({
      projectId: p._id,
      title: p.project?.title || 'Unknown Project',
      earned: p.total,
    })),
    byClient: byClient.map(c => ({
      clientId: c._id,
      name: c.client ? `${c.client.firstName || ''} ${c.client.lastName || ''}`.trim() || 'Unknown Client' : 'Unknown Client',
      earned: c.total,
      projectCount: c.projectCount,
    })),
    commissionRate: getCommissionRate(),
  });
});

export const getEarningsChart = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { period = 'monthly' } = req.query;

  let groupFormat;
  if (period === 'weekly') {
    groupFormat = { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } };
  } else if (period === 'yearly') {
    groupFormat = { year: { $year: '$createdAt' } };
  } else {
    groupFormat = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
  }

  const data = await Transaction.aggregate([
    { $match: { user: userId, type: 'escrow_release', status: 'completed' } },
    { $group: { _id: groupFormat, earnings: { $sum: '$netAmount' }, gross: { $sum: '$amount' }, net: { $sum: '$netAmount' }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } },
    { $limit: 36 },
  ]);

  sendResponse(res, 200, 'Chart data fetched', data);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT METHODS
// ═══════════════════════════════════════════════════════════════════════════════

export const getPaymentMethods = catchAsync(async (req, res) => {
  const methods = await PaymentMethod.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
  sendResponse(res, 200, 'Payment methods fetched', methods);
});

export const createPaymentMethod = catchAsync(async (req, res) => {
  const { type, label, bankName, accountNumber, accountName, phone, cbeAccountNumber, chapaEmail, isDefault } = req.body;

  if (isDefault) {
    await PaymentMethod.updateMany({ user: req.user._id }, { isDefault: false });
  }

  const method = await PaymentMethod.create({
    user: req.user._id,
    type,
    label: label || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    bankName,
    accountNumber,
    accountName,
    phone,
    cbeAccountNumber,
    chapaEmail,
    isDefault: isDefault || false,
  });

  sendResponse(res, 201, 'Payment method added', method);
});

export const updatePaymentMethod = catchAsync(async (req, res) => {
  const method = await PaymentMethod.findOne({ _id: req.params.methodId, user: req.user._id });
  if (!method) throw new ApiError(404, 'Payment method not found');

  const { isDefault, label, bankName, accountNumber, accountName, phone, cbeAccountNumber, chapaEmail } = req.body;

  if (isDefault) {
    await PaymentMethod.updateMany({ user: req.user._id, _id: { $ne: method._id } }, { isDefault: false });
  }

  Object.assign(method, { isDefault, label, bankName, accountNumber, accountName, phone, cbeAccountNumber, chapaEmail });
  await method.save();

  sendResponse(res, 200, 'Payment method updated', method);
});

export const setDefaultPaymentMethod = catchAsync(async (req, res) => {
  const method = await PaymentMethod.findOne({ _id: req.params.methodId, user: req.user._id });
  if (!method) throw new ApiError(404, 'Payment method not found');

  await PaymentMethod.updateMany({ user: req.user._id }, { isDefault: false });
  method.isDefault = true;
  await method.save();

  sendResponse(res, 200, 'Default payment method set', method);
});

export const deletePaymentMethod = catchAsync(async (req, res) => {
  const method = await PaymentMethod.findOne({ _id: req.params.methodId, user: req.user._id });
  if (!method) throw new ApiError(404, 'Payment method not found');

  await method.deleteOne();
  sendResponse(res, 200, 'Payment method removed');
});

// ═══════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

export const getWithdrawals = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;

  const filter = { user: req.user._id };
  if (status) filter.status = status;

  const total = await Withdrawal.countDocuments(filter);
  const withdrawals = await Withdrawal.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Withdrawals fetched', withdrawals, paginationMeta(total, page, limit));
});

// ═══════════════════════════════════════════════════════════════════════════════
// RECEIPT
// ═══════════════════════════════════════════════════════════════════════════════

export const getReceipt = catchAsync(async (req, res) => {
  const receipt = await Payment.findOne({
    _id: req.params.receiptId,
    $or: [{ payer: req.user._id }, { payee: req.user._id }],
  })
    .populate('payer', 'firstName lastName email')
    .populate('payee', 'firstName lastName email')
    .populate('project', 'title')
    .populate('milestone', 'title');

  if (!receipt) throw new ApiError(404, 'Receipt not found');
  sendResponse(res, 200, 'Receipt fetched', receipt);
});

export const getReceiptByReference = catchAsync(async (req, res) => {
  const receipt = await Payment.findOne({
    reference: req.params.reference,
    $or: [{ payer: req.user._id }, { payee: req.user._id }],
  })
    .populate('payer', 'firstName lastName email')
    .populate('payee', 'firstName lastName email')
    .populate('project', 'title')
    .populate('milestone', 'title');

  if (!receipt) throw new ApiError(404, 'Receipt not found');
  sendResponse(res, 200, 'Receipt fetched', receipt);
});
