import mongoose from 'mongoose';
import { Milestone, Project, Wallet, Transaction, Escrow, Job, User } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse } from '../utils/apiResponse.js';
import { uploadMultipleFiles } from '../services/cloudinary.service.js';
import {
  holdEscrow, releaseEscrow, refundEscrow,
  recordTransaction, generateInvoiceNumber, withTransaction, propagateFunding,
} from '../services/payment.service.js';
import { notifyMilestoneUpdate, notifyMilestoneCreated } from '../services/notification.service.js';
import { Payment } from '../models/index.js';
import { generateTxRef, calculateCommission } from '../utils/helpers.js';
import { config } from '../config/env.js';
import { assertProjectTransition, TERMINAL_PROJECT_STATUSES } from '../utils/projectStateMachine.js';
import { getCommissionRate } from '../services/settings.service.js';
import { recordCommissionTransaction, resolveCommissionSnapshot } from '../services/commission.service.js';

// ─── Create Milestone ─────────────────────────────────────────────────────────
export const createMilestone = catchAsync(async (req, res) => {
  const project = await Project.findOne({
    _id: req.params.projectId,
    client: req.user._id,
    // Contracts are created as `pending_payment` when the freelancer is hired
    // (nothing has been paid yet), so milestone management must be allowed
    // BEFORE funding — previously this gate sent legitimate screens to
    // "Project not found or not authorized".
    status: { $in: ['pending_payment', 'active', 'on_hold'] },
  });
  if (!project) throw new ApiError(404, 'Project not found or not authorized');

  const milestone = await Milestone.create({
    project: project._id,
    client: req.user._id,
    freelancer: project.freelancer,
    ...req.body,
  });

  await notifyMilestoneCreated(project.freelancer, req.user, project, milestone).catch(() => null);

  sendResponse(res, 201, 'Milestone created', milestone);
});

// ─── Get Project Milestones ───────────────────────────────────────────────────
export const getProjectMilestones = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const isParticipant =
    project.client.toString() === req.user._id.toString() ||
    project.freelancer.toString() === req.user._id.toString() ||
    req.user.role === 'admin';
  if (!isParticipant) throw new ApiError(403, 'Not authorized');

  const milestones = await Milestone.find({ project: req.params.projectId }).sort({ order: 1, createdAt: 1 });
  sendResponse(res, 200, 'Milestones fetched', milestones);
});

// ─── Update Milestone ─────────────────────────────────────────────────────────
export const updateMilestone = catchAsync(async (req, res) => {
  const milestone = await Milestone.findOne({
    _id: req.params.milestoneId,
    client: req.user._id,
    status: 'pending',
  });
  if (!milestone) throw new ApiError(404, 'Milestone not found or cannot be edited');

  Object.assign(milestone, req.body);
  await milestone.save();
  sendResponse(res, 200, 'Milestone updated', milestone);
});

// ─── Delete Milestone ─────────────────────────────────────────────────────────
export const deleteMilestone = catchAsync(async (req, res) => {
  const milestone = await Milestone.findOne({
    _id: req.params.milestoneId,
    client: req.user._id,
    status: 'pending',
  });
  if (!milestone) throw new ApiError(404, 'Milestone not found or cannot be deleted');

  await milestone.deleteOne();
  sendResponse(res, 200, 'Milestone deleted');
});

// ─── Fund Milestone (Escrow) ──────────────────────────────────────────────────
export const fundMilestone = catchAsync(async (req, res) => {
  const result = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    const milestone = await Milestone.findOne({
      _id: req.params.milestoneId,
      client: req.user._id,
      status: 'pending',
    }).session(session);
    if (!milestone) throw new ApiError(404, 'Milestone not found');

    const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
    if (!wallet || wallet.balance - wallet.escrowBalance < milestone.amount) {
      throw new ApiError(400, 'Insufficient wallet balance to fund this milestone');
    }

    // Hold in escrow
    await holdEscrow(req.user._id, milestone.amount, session);

    const commissionRate = getCommissionRate();

    // Create payment record
    const reference = generateTxRef('MS');
    const invoiceNumber = await generateInvoiceNumber();
    const payment = await Payment.create([{
      payer: req.user._id,
      payee: milestone.freelancer,
      project: milestone.project,
      milestone: milestone._id,
      type: 'escrow',
      amount: milestone.amount,
      currency: milestone.currency,
      commission: 0,
      commissionRate,
      netAmount: milestone.amount,
      status: 'completed',
      provider: 'wallet',
      reference,
      invoiceNumber,
      description: `Escrow for milestone: ${milestone.title}`,
      isEscrow: true,
      escrowHeldAt: new Date(),
      processedAt: new Date(),
    }], opts);

    // Record transaction
    const updatedWallet = await Wallet.findOne({ user: req.user._id }).session(session);
    const holdTx = await recordTransaction({
      userId: req.user._id,
      walletId: wallet._id,
      type: 'escrow_hold',
      amount: milestone.amount,
      netAmount: milestone.amount,
      status: 'completed',
      reference: generateTxRef('TX'),
      description: `Escrow hold for milestone: ${milestone.title}`,
      paymentId: payment[0]._id,
      projectId: milestone.project,
      milestoneId: milestone._id,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance, // balance unchanged, just escrowBalance increased
    });

    milestone.status = 'funded';
    milestone.paymentId = payment[0]._id;
    await milestone.save(opts);

    // Canonical Escrow record so the escrow engine (admin release/refund,
    // escrow APIs) can see and operate on milestone-backed contracts too.
    const { commission: escrowCommission, netAmount: escrowNet } =
      calculateCommission(milestone.amount, commissionRate);
    let escrow = await Escrow.findOne({ milestone: milestone._id }).session(session);
    if (escrow) {
      escrow.status = 'funded';
      escrow.fundedAt = new Date();
      escrow.paymentId = payment[0]._id;
      if (holdTx?._id) escrow.fundingTransaction = holdTx._id;
      escrow.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (!escrow.client && req.user._id) escrow.client = req.user._id;
      if (!escrow.freelancer && milestone.freelancer) escrow.freelancer = milestone.freelancer;
      await escrow.save(opts);
    } else {
      [escrow] = await Escrow.create([{
        client: req.user._id,
        freelancer: milestone.freelancer,
        project: milestone.project,
        milestone: milestone._id,
        amount: milestone.amount,
        currency: milestone.currency,
        commissionRate,
        commissionAmount: escrowCommission,
        freelancerAmount: escrowNet,
        status: 'funded',
        fundedAt: new Date(),
        fundingTransaction: holdTx?._id || null,
        paymentId: payment[0]._id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: `Escrow for milestone: ${milestone.title}`,
      }], opts);
    }

    // Propagate funding to the project + job so the whole chain agrees
    // (previously the milestone went "funded" while the job still showed
    // "In Progress / Pending Payment" and the contract "Not Started / Funded").
    await propagateFunding({
      projectId: milestone.project,
      milestoneId: milestone._id,
      paymentId: payment[0]._id,
      escrowId: escrow._id,
      session,
    });

    return milestone;
  });

  try {
    const ms = result._id ? result : await Milestone.findById(result);
    if (ms) await notifyMilestoneUpdate({
      recipientId: ms.freelancer,
      senderId: req.user._id,
      milestoneTitle: ms.title,
      status: 'funded',
      projectId: ms.project,
      milestoneId: ms._id,
      amount: ms.amount,
    });
  } catch (_) {}

  sendResponse(res, 200, 'Milestone funded successfully', result);
});

// ─── Submit Milestone ─────────────────────────────────────────────────────────
export const submitMilestone = catchAsync(async (req, res) => {
  const milestone = await Milestone.findOne({
    _id: req.params.milestoneId,
    freelancer: req.user._id,
    status: { $in: ['funded', 'revision_requested'] },
  });
  if (!milestone) throw new ApiError(404, 'Milestone not found or cannot be submitted');

  const files = req.files?.length
    ? await uploadMultipleFiles(req.files, 'deliveries')
    : [];

  milestone.status = 'submitted';
  milestone.deliveryFiles = files;
  milestone.deliveryNote = req.body.note || '';
  milestone.submittedAt = new Date();
  await milestone.save();

  await notifyMilestoneUpdate({
    recipientId: milestone.client,
    senderId: req.user._id,
    milestoneTitle: milestone.title,
    status: 'submitted',
    projectId: milestone.project,
    milestoneId: milestone._id,
  });
  sendResponse(res, 200, 'Milestone submitted', milestone);
});

// ─── Approve Milestone & Release Escrow ──────────────────────────────────────
export const approveMilestone = catchAsync(async (req, res) => {
  let commission, netAmount, milestone;

  const result = await withTransaction(async (session) => {
    milestone = await Milestone.findOne({
      _id: req.params.milestoneId,
      client: req.user._id,
      status: 'submitted',
    }).session(session);
    if (!milestone) throw new ApiError(404, 'Milestone not found or not submitted');

    // Release escrow to freelancer — the commission snapshot comes from the
    // escrow created at funding time so later rate changes never affect it.
    const escrowForRelease = await Escrow.findOne({ milestone: milestone._id }).session(session);
    const releaseSnapshot = resolveCommissionSnapshot(
      escrowForRelease,
      milestone.amount,
      getCommissionRate()
    );

    const result = await releaseEscrow(
      req.user._id,
      milestone.freelancer,
      milestone.amount,
      releaseSnapshot.commissionRate,
      session
    );
    commission = result.commission;
    netAmount = result.netAmount;

    // Record release transactions (source of truth for freelancer earnings)
    const clientWallet = await Wallet.findOne({ user: req.user._id }).session(session);
    const freelancerWallet = await Wallet.findOne({ user: milestone.freelancer }).session(session);
    const opts = session ? { session } : {};

    await Transaction.create([{
      user: req.user._id,
      wallet: clientWallet._id,
      type: 'escrow_release',
      amount: milestone.amount,
      fee: 0,
      netAmount: milestone.amount,
      status: 'completed',
      reference: generateTxRef('ESCR'),
      description: `Escrow released for milestone: ${milestone.title}`,
      paymentId: milestone.paymentId,
      projectId: milestone.project,
      milestoneId: milestone._id,
      balanceBefore: clientWallet.balance + milestone.amount,
      balanceAfter: clientWallet.balance,
      processedAt: new Date(),
    }], opts);

    await Transaction.create([{
      user: milestone.freelancer,
      wallet: freelancerWallet._id,
      type: 'escrow_release',
      amount: milestone.amount,
      fee: commission,
      netAmount,
      status: 'completed',
      reference: generateTxRef('ESCR'),
      description: `Payment received for milestone: ${milestone.title}`,
      paymentId: milestone.paymentId,
      projectId: milestone.project,
      milestoneId: milestone._id,
      balanceBefore: freelancerWallet.balance - netAmount,
      balanceAfter: freelancerWallet.balance,
      processedAt: new Date(),
    }], opts);

    if (commission > 0) {
      await recordCommissionTransaction({
        scopeKey: `M-${milestone._id}`,
        fields: {
          user: milestone.freelancer,
          wallet: freelancerWallet._id,
          type: 'commission',
          amount: commission,
          fee: 0,
          netAmount: commission,
          status: 'completed',
          description: `Platform commission (${(releaseSnapshot.commissionRate * 100).toFixed(0)}%) for milestone: ${milestone.title}`,
          paymentId: milestone.paymentId,
          projectId: milestone.project,
          milestoneId: milestone._id,
          balanceBefore: freelancerWallet.balance,
          balanceAfter: freelancerWallet.balance,
          processedAt: new Date(),
        },
      }, opts);
    }

    milestone.status = 'released';
    milestone.approvedAt = new Date();
    milestone.approvedBy = req.user._id;
    milestone.escrowReleasedAt = new Date();
    await milestone.save(session ? { session } : {});

    // Mark the funding Payment released (previously approval left the Payment
    // without escrowReleasedAt, so it stayed "in escrow" forever).
    const releasedAt = new Date();
    if (milestone.paymentId) {
      await Payment.updateOne(
        { _id: milestone.paymentId },
        { $set: { isEscrow: true, escrowReleasedAt: releasedAt, processedAt: releasedAt } },
        opts
      );
    }

    // Sync the canonical Escrow record.
    const escrow = await Escrow.findOne({ milestone: milestone._id }).session(session);
    if (escrow && !['released', 'refunded'].includes(escrow.status)) {
      escrow.status = 'released';
      escrow.releasedAt = releasedAt;
      escrow.releasedBy = req.user._id;
      if (milestone.transactionId) escrow.releaseTransaction = milestone.transactionId;
      await escrow.save(opts);
    }

    // Update project progress; complete the whole chain when every milestone is
    // released (single-milestone contracts complete here).
    const allMilestones = await Milestone.find({ project: milestone.project }).session(session);
    const completedCount = allMilestones.filter((m) => m.status === 'released').length;
    const progress = Math.round((completedCount / allMilestones.length) * 100);

    if (allMilestones.length > 0 && allMilestones.every((m) => m.status === 'released')) {
      const project = await Project.findById(milestone.project).session(session);
      if (project) {
        // Centralized transition guard: never complete a terminal project.
        if (!TERMINAL_PROJECT_STATUSES.includes(project.status)) {
          assertProjectTransition(project.status, 'completed');
        }
        project.status = 'completed';
        project.timeline.completedAt = releasedAt;
        project.progress = 100;
        project.budget.paidAmount = (project.budget.paidAmount || 0) + (milestone.amount || 0);
        await project.save(opts);
        if (project.job) {
          await Job.updateOne(
            { _id: project.job },
            { $set: { status: 'completed', paymentStatus: 'released' } },
            opts
          );
        }
      }
      await User.findByIdAndUpdate(milestone.client, {
        $inc: { 'stats.completedProjects': 1, 'stats.activeProjects': -1 },
      }, opts).catch(() => null);
      await User.findByIdAndUpdate(milestone.freelancer, {
        $inc: { 'stats.completedProjects': 1, 'stats.activeProjects': -1 },
      }, opts).catch(() => null);
    } else {
      await Project.updateOne({ _id: milestone.project }, { $set: { progress } }, { session });
    }

    return milestone;
  });

  try {
    await notifyMilestoneUpdate({
      recipientId: milestone.freelancer,
      senderId: req.user._id,
      milestoneTitle: milestone.title,
      status: 'released',
      projectId: milestone.project,
      milestoneId: milestone._id,
      amount: netAmount,
    });
  } catch (_) {}

  sendResponse(res, 200, 'Milestone approved and payment released', { milestone, commission, netAmount });
});

// ─── Request Revision ─────────────────────────────────────────────────────────
export const requestMilestoneRevision = catchAsync(async (req, res) => {
  const milestone = await Milestone.findOne({
    _id: req.params.milestoneId,
    client: req.user._id,
    status: 'submitted',
  });
  if (!milestone) throw new ApiError(404, 'Milestone not found');

  milestone.status = 'revision_requested';
  milestone.revisionNote = req.body.note;
  milestone.revisionsCount += 1;
  await milestone.save();

  await notifyMilestoneUpdate({
    recipientId: milestone.freelancer,
    senderId: req.user._id,
    milestoneTitle: milestone.title,
    status: 'revision_requested',
    projectId: milestone.project,
    milestoneId: milestone._id,
  });
  sendResponse(res, 200, 'Revision requested', milestone);
});
