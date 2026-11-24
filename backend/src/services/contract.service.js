import {
  Project, Milestone, Job, User, Wallet, Transaction, Payment,
  Escrow, Review, Report, Conversation, Message,
} from '../models/index.js';
import { ApiError } from '../utils/apiResponse.js';
import { generateTxRef, calculateCommission } from '../utils/helpers.js';
import { withTransaction } from './payment.service.js';
import { config } from '../config/env.js';
import { emitToProject } from './socket.service.js';
import { assertProjectTransition, TERMINAL_PROJECT_STATUSES } from '../utils/projectStateMachine.js';
import { getCommissionRate } from './settings.service.js';
import { recordCommissionTransaction, resolveCommissionSnapshot } from './commission.service.js';

// ─── Status taxonomy ──────────────────────────────────────────────────────────
// PROJECT/WORK status is independent of PAYMENT status. A contract can be
// "Completed" (work) while its payment is still "Pending Payment", or "In
// Progress" (work) while the payment is "Funded".

export const CONTRACT_PROJECT_STATUS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  completed: 'Completed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
};

export const CONTRACT_PAYMENT_STATUS = {
  pending_payment: 'Pending Payment',
  funded: 'Funded',
  in_escrow: 'In Escrow',
  released: 'Released',
  refunded: 'Refunded',
};

const PROJECT_STATUS_FROM_DB = {
  pending_payment: 'not_started',
  active: 'in_progress',
  on_hold: 'in_progress',
  pending_delivery: 'submitted',
  in_revision: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  disputed: 'disputed',
};

export const resolveProjectStatus = (project) =>
  PROJECT_STATUS_FROM_DB[project?.status] || 'not_started';

/**
 * Derive the payment status from the real escrow / milestone / payment / job
 * data. 100% work progress NEVER forces a payment status — payment is only
 * "released" after funds were actually released to the freelancer's wallet.
 */
export const resolvePaymentStatus = ({ milestone, escrow, payment, job, project }) => {
  if (escrow) {
    switch (escrow.status) {
      case 'pending': return 'pending_payment';
      case 'funded':
      case 'in_progress': return 'funded';
      case 'submitted': return 'in_escrow';
      case 'revision_requested': return 'in_escrow';
      case 'released': return 'released';
      case 'refunded': return 'refunded';
      case 'disputed': return 'in_escrow';
      case 'cancelled':
      case 'expired': return 'refunded';
      default: return 'pending_payment';
    }
  }

  if (milestone) {
    switch (milestone.status) {
      case 'pending': return 'pending_payment';
      case 'funded':
      case 'in_progress': return 'funded';
      case 'submitted': return 'in_escrow';
      case 'revision_requested': return 'in_escrow';
      case 'approved': return 'released';
      case 'released': return 'released';
      case 'disputed': return 'in_escrow';
      case 'cancelled': return 'refunded';
      default: return 'pending_payment';
    }
  }

  if (payment) {
    if (payment.status === 'refunded') return 'refunded';
    if (payment.status === 'completed' && payment.isEscrow) {
      return payment.escrowReleasedAt ? 'released' : 'in_escrow';
    }
  }

  if (job) {
    switch (job.paymentStatus) {
      case 'pending': return 'pending_payment';
      case 'funded': return 'funded';
      case 'released': return 'released';
      case 'refunded': return 'refunded';
      default: return 'pending_payment';
    }
  }

  return 'pending_payment';
};

export const generateContractNumber = (project) =>
  `CT-${String(project._id).toUpperCase().slice(-10)}`;

const userShape = (u) => {
  if (!u) return null;
  const obj = u.toObject ? u.toObject() : u;
  return {
    _id: obj._id,
    firstName: obj.firstName,
    lastName: obj.lastName,
    email: obj.email,
    role: obj.role,
    avatar: obj.avatar?.url || obj.avatar || null,
    isOnline: obj.isOnline,
    isVerifiedFreelancer: obj.isVerifiedFreelancer,
    stats: obj.stats ? {
      averageRating: obj.stats.averageRating,
      totalReviews: obj.stats.totalReviews,
      reputationScore: obj.stats.reputationScore,
    } : undefined,
  };
};

const milestoneShape = (m) => {
  if (!m) return null;
  return {
    _id: m._id,
    title: m.title,
    description: m.description || '',
    amount: m.amount,
    currency: m.currency,
    dueDate: m.dueDate,
    order: m.order,
    status: m.status,
    // delivery
    deliveryFiles: m.deliveryFiles || [],
    deliveryNote: m.deliveryNote || '',
    submittedAt: m.submittedAt || null,
    // client approval
    approvedAt: m.approvedAt || null,
    approvedBy: m.approvedBy || null,
    revisionNote: m.revisionNote || '',
    revisionsCount: m.revisionsCount || 0,
    // payment / release
    paymentId: m.paymentId || null,
    transactionId: m.transactionId || null,
    escrowReleasedAt: m.escrowReleasedAt || null,
    isOverdue: m.isOverdue,
  };
};

const deliveryShape = (d) => ({
  _id: d._id,
  submittedBy: d.submittedBy,
  message: d.message,
  files: d.files || [],
  submittedAt: d.submittedAt,
  status: d.status,
  revisionNote: d.revisionNote || '',
  reviewedAt: d.reviewedAt || null,
  reviewedBy: d.reviewedBy || null,
});

const escrowShape = (e) => {
  if (!e) return null;
  return {
    _id: e._id,
    status: e.status,
    amount: e.amount,
    currency: e.currency,
    commissionRate: e.commissionRate,
    commissionAmount: e.commissionAmount,
    freelancerAmount: e.freelancerAmount,
    fundedAt: e.fundedAt,
    submittedAt: e.submittedAt,
    releasedAt: e.releasedAt,
    refundedAt: e.refundedAt,
    expiresAt: e.expiresAt,
    releasedBy: e.releasedBy,
    refundReason: e.refundReason || '',
    disputeReason: e.disputeReason || '',
  };
};

const reviewShape = (r) => ({
  _id: r._id,
  reviewer: userShape(r.reviewer),
  reviewee: userShape(r.reviewee),
  reviewerRole: r.reviewerRole,
  rating: r.rating,
  comment: r.comment,
  reply: r.reply?.content ? { content: r.reply.content, repliedAt: r.reply.repliedAt } : null,
  isPublic: r.isPublic,
  createdAt: r.createdAt,
});

const reportShape = (r) => ({
  _id: r._id,
  reporter: r.reporter,
  resourceType: r.resourceType,
  reason: r.reason,
  description: r.description,
  status: r.status,
  priority: r.priority,
  createdAt: r.createdAt,
});

const messageShape = (m) => ({
  _id: m._id,
  sender: userShape(m.sender),
  content: m.content,
  messageType: m.messageType,
  attachments: m.attachments || [],
  createdAt: m.createdAt,
});

/**
 * Build a full activity timeline from every real persisted event on the
 * contract (creation, funding, milestones, deliveries, reviews, disputes...).
 */
export const buildContractTimeline = ({ project, milestone, milestones, deliveries, payments, reviews, reports, escrow }) => {
  const events = [];

  const push = (type, title, description, at, meta = {}) => {
    if (!at) return;
    events.push({ type, title, description, at: new Date(at), meta });
  };

  push('created', 'Contract created', `Contract "${project.title}" was created.`, project.createdAt, {
    actor: project.client,
  });

  if (milestone) {
    if (milestone.status === 'pending') {
      push('milestone', 'Milestone awaiting payment', `Milestone "${milestone.title}" (${milestone.amount} ${milestone.currency}) is awaiting funding.`, milestone.createdAt, { milestoneId: milestone._id });
    }
    if (['funded', 'in_progress', 'submitted', 'revision_requested', 'released'].includes(milestone.status)) {
      push('payment', 'Payment funded', `Payment of ${milestone.amount} ${milestone.currency} was funded into escrow.`, milestone.updatedAt || milestone.createdAt, { milestoneId: milestone._id });
    }
    if (milestone.submittedAt) {
      push('delivery', 'Work submitted', `Work was submitted for milestone "${milestone.title}".`, milestone.submittedAt, { milestoneId: milestone._id });
    }
    if (milestone.escrowReleasedAt) {
      push('payment', 'Payment released', `Escrow of ${milestone.amount} ${milestone.currency} was released to the freelancer after client approval.`, milestone.escrowReleasedAt, { milestoneId: milestone._id });
    }
    if (milestone.approvedAt && !milestone.escrowReleasedAt) {
      push('milestone', 'Milestone approved', `Milestone "${milestone.title}" was approved by the client.`, milestone.approvedAt, { milestoneId: milestone._id });
    }
  }

  (milestones || []).forEach((m) => {
    if (m._id?.toString() === milestone?._id?.toString()) return;
    if (m.submittedAt) push('delivery', 'Work submitted', `Work was submitted for milestone "${m.title}".`, m.submittedAt, { milestoneId: m._id });
    if (m.escrowReleasedAt) push('payment', 'Payment released', `Escrow of ${m.amount} ${m.currency} was released to the freelancer after client approval.`, m.escrowReleasedAt, { milestoneId: m._id });
  });

  (deliveries || []).forEach((d) => {
    push('delivery', 'Delivery submitted', d.message || 'A delivery was submitted.', d.submittedAt, { deliveryId: d._id });
    if (d.status === 'approved' && d.reviewedAt) push('delivery', 'Delivery approved', 'Delivery was approved by the client.', d.reviewedAt, { deliveryId: d._id });
    if (d.status === 'revision_requested' && d.reviewedAt) push('delivery', 'Revision requested', d.revisionNote || 'The client requested revisions.', d.reviewedAt, { deliveryId: d._id });
  });

  (reviews || []).forEach((r) => {
    push('review', 'Review left', `${r.reviewerRole === 'client' ? 'Client' : 'Freelancer'} left a ${r.rating?.overall}-star review.`, r.createdAt, { reviewId: r._id });
  });

  (reports || []).forEach((r) => {
    push('dispute', 'Dispute reported', r.description || 'A dispute was reported.', r.createdAt, { reportId: r._id });
  });

  if (project.dispute?.raisedAt) {
    push('dispute', 'Dispute opened', project.dispute.reason || 'A dispute was opened.', project.dispute.raisedAt);
  }
  if (project.dispute?.resolvedAt) {
    push('dispute', 'Dispute resolved', project.dispute.resolution || 'The dispute was resolved.', project.dispute.resolvedAt);
  }
  if (project.timeline?.completedAt) {
    push('completed', 'Contract completed', 'The contract was completed.', project.timeline.completedAt);
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  return events;
};

/**
 * Resolve the contract's payment record. Contracts created from jobs hold
 * escrow via the wallet + a Payment record linked to the first milestone.
 */
export const findContractPayment = async (project) => {
  const milestone = await Milestone.findOne({ project: project._id }).sort({ order: 1, createdAt: 1 });
  if (!milestone) return { milestone: null, payment: null, escrow: null, job: null };

  const job = project.job ? await Job.findById(project.job).lean() : null;
  const payment = milestone.paymentId
    ? await Payment.findById(milestone.paymentId).lean()
    : job?.paymentId
      ? await Payment.findById(job.paymentId).lean()
      : null;
  const escrow = await Escrow.findOne({ project: project._id }).lean();
  return { milestone, payment, escrow, job };
};

/**
 * Assemble the public contract DTO. Every amount comes from the real
 * contract/payment/milestone data — nothing is fabricated.
 */
export const buildContract = async (project, ctx = {}) => {
  const {
    milestones, deliveries, reviews, reports, conversation, recentMessages,
    milestone, payment, escrow, job, viewerId,
  } = ctx;
  const resolvedDeliveries = deliveries || project.deliveries || [];
  const resolvedMilestones = milestones || project.milestones || [];
  const projectStatus = resolveProjectStatus(project);
  const paymentStatus = resolvePaymentStatus({ milestone, escrow, payment, job, project });

  const paidAmount =
    (payment?.status === 'completed' && payment.escrowReleasedAt)
      ? payment.amount
      : (escrow?.status === 'released' ? escrow.amount : (project.budget?.paidAmount || 0));

  return {
    _id: project._id,
    contractNumber: generateContractNumber(project),
    title: project.title,
    description: project.description || '',
    isServiceOrder: !!project.serviceOrder,
    isClient: viewerId ? String(project.client?._id || project.client) === String(viewerId) : false,
    isFreelancer: viewerId ? String(project.freelancer?._id || project.freelancer) === String(viewerId) : false,
    client: userShape(project.client),
    freelancer: userShape(project.freelancer),
    job: project.job
      ? { _id: project.job._id, title: project.job.title, category: project.job.category }
      : null,
    amount: project.budget?.agreedAmount,
    paidAmount,
    currency: project.budget?.currency || 'ETB',
    deadline: project.timeline?.deadline || null,
    startDate: project.timeline?.startDate || null,
    completedAt: project.timeline?.completedAt || null,
    progress: project.progress ?? 0,
    updatedAt: project.updatedAt,
    projectStatus: {
      key: projectStatus,
      label: CONTRACT_PROJECT_STATUS[projectStatus],
    },
    paymentStatus: {
      key: paymentStatus,
      label: CONTRACT_PAYMENT_STATUS[paymentStatus],
    },
    escrow: escrowShape(escrow),
    milestone: milestone ? milestoneShape(milestone) : null,
    milestones: resolvedMilestones.map(milestoneShape),
    deliverables: resolvedDeliveries.map(deliveryShape),
    dispute: project.dispute && project.dispute.isDisputed
      ? {
          isDisputed: true,
          reason: project.dispute.reason,
          raisedBy: project.dispute.raisedBy,
          raisedAt: project.dispute.raisedAt,
          resolvedAt: project.dispute.resolvedAt,
          resolution: project.dispute.resolution,
        }
      : { isDisputed: false },
    revisions: {
      allowed: project.revisionsAllowed,
      used: project.revisionsUsed,
    },
    reviews: (reviews || []).map(reviewShape),
    reports: (reports || []).map(reportShape),
    conversationId: conversation?._id || project.conversationId || null,
    recentMessages: (recentMessages || []).map(messageShape),
    timeline: buildContractTimeline({
      project, milestone, milestones: resolvedMilestones, deliveries: resolvedDeliveries,
      payments: payment ? [payment] : [],
      reviews, reports, escrow,
    }),
  };
};

// ─── Payment release (escrow → freelancer wallet, after client approval) ──────
// This is the ONLY place a job-contract escrow is released. It is never called
// before the client approves the delivery, and it creates exactly one set of
// transactions (client release, freelancer payout, platform commission).
export const releaseProjectPayment = async ({ project, releasedBy, rating = null }) => {
  const milestone = await Milestone.findOne({ project: project._id }).sort({ order: 1, createdAt: 1 });
  if (!milestone) throw new ApiError(400, 'No milestone is linked to this contract');
  if (['released', 'approved'].includes(milestone.status)) {
    throw new ApiError(400, 'Payment for this contract was already released');
  }
  if (!['funded', 'in_progress', 'submitted', 'revision_requested'].includes(milestone.status)) {
    throw new ApiError(400, 'Cannot release payment — this contract has not been funded yet');
  }

  const amount = milestone.amount;
  const currency = milestone.currency || 'ETB';
  const paymentId = milestone.paymentId || null;

  const result = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // The commission snapshot is taken from the escrow created at funding time,
    // so changing the platform rate later never alters an existing contract.
    const escrowForRelease = await Escrow.findOne({
      $or: [{ milestone: milestone._id }, { project: project._id }],
    }).session(session);
    const { commission, netAmount, commissionRate } = resolveCommissionSnapshot(
      escrowForRelease,
      amount,
      getCommissionRate()
    );

    const clientWallet = await Wallet.findOne({ user: project.client }).session(session);
    if (!clientWallet) throw new ApiError(400, 'Client wallet not found');
    if (clientWallet.escrowBalance < amount) {
      throw new ApiError(400, 'Insufficient escrow balance — payment cannot be released');
    }
    clientWallet.escrowBalance -= amount;
    clientWallet.balance -= amount;
    clientWallet.totalSpent += amount;
    await clientWallet.save(opts);

    let freelancerWallet = await Wallet.findOne({ user: project.freelancer }).session(session);
    if (!freelancerWallet) freelancerWallet = (await Wallet.create([{ user: project.freelancer }], opts))[0];
    freelancerWallet.balance += netAmount;
    freelancerWallet.totalEarned += netAmount;
    await freelancerWallet.save(opts);

    const clientTx = await Transaction.create([{
      user: project.client,
      wallet: clientWallet._id,
      type: 'escrow_release',
      amount,
      fee: 0,
      netAmount: amount,
      status: 'completed',
      reference: generateTxRef('ESCR'),
      description: `Escrow released for contract: ${project.title}`,
      paymentId,
      projectId: project._id,
      milestoneId: milestone._id,
      metadata: { contractId: project._id.toString(), freelancerId: project.freelancer.toString() },
      balanceBefore: clientWallet.balance + amount,
      balanceAfter: clientWallet.balance,
      processedAt: new Date(),
    }], opts);

    const freelancerTx = await Transaction.create([{
      user: project.freelancer,
      wallet: freelancerWallet._id,
      type: 'escrow_release',
      amount,
      fee: commission,
      netAmount,
      status: 'completed',
      reference: generateTxRef('ESCP'),
      description: `Payment received for contract: ${project.title}`,
      paymentId,
      projectId: project._id,
      milestoneId: milestone._id,
      metadata: { contractId: project._id.toString(), clientId: project.client.toString() },
      balanceBefore: freelancerWallet.balance - netAmount,
      balanceAfter: freelancerWallet.balance,
      processedAt: new Date(),
    }], opts);

    if (commission > 0) {
      await recordCommissionTransaction({
        scopeKey: `M-${milestone._id}`,
        fields: {
          user: project.freelancer,
          wallet: freelancerWallet._id,
          type: 'commission',
          amount: commission,
          fee: 0,
          netAmount: commission,
          status: 'completed',
          description: `Platform commission (${(commissionRate * 100).toFixed(0)}%) — contract: ${project.title}`,
          paymentId,
          projectId: project._id,
          milestoneId: milestone._id,
          metadata: { contractId: project._id.toString() },
          balanceBefore: freelancerWallet.balance,
          balanceAfter: freelancerWallet.balance,
          processedAt: new Date(),
        },
      }, opts);
    }

    milestone.status = 'released';
    milestone.approvedAt = new Date();
    milestone.approvedBy = releasedBy;
    milestone.escrowReleasedAt = new Date();
    milestone.transactionId = freelancerTx[0]._id;
    await milestone.save(opts);

    if (paymentId) {
      await Payment.findByIdAndUpdate(paymentId, {
        status: 'completed',
        isEscrow: true,
        escrowReleasedAt: new Date(),
        processedAt: new Date(),
      }, opts).catch(() => null);
    }

    // Sync the canonical Escrow record so escrow engine + admin views reflect
    // the release (contracts created before this fix had no Escrow document).
    const escrowDoc = await Escrow.findOne({
      $or: [{ milestone: milestone._id }, { project: project._id }],
    }).session(session);
    if (escrowDoc && !['released', 'refunded'].includes(escrowDoc.status)) {
      escrowDoc.status = 'released';
      escrowDoc.releasedAt = new Date();
      escrowDoc.releasedBy = releasedBy;
      escrowDoc.milestone = milestone._id;
      escrowDoc.releaseTransaction = clientTx[0]._id;
      await escrowDoc.save(opts);
    }

    // Centralized state machine: a terminal or unfunded project must never be
    // marked completed by a release.
    if (!TERMINAL_PROJECT_STATUSES.includes(project.status)) {
      assertProjectTransition(project.status, 'completed');
    }
    project.status = 'completed';
    project.timeline.completedAt = new Date();
    project.progress = 100;
    project.budget.paidAmount = (project.budget.paidAmount || 0) + amount;
    project.clientRating = rating || project.clientRating;
    await project.save(opts);

    if (project.job) {
      await Job.findByIdAndUpdate(project.job, {
        status: 'completed',
        paymentStatus: 'released',
      }, opts);
    }

    await User.findByIdAndUpdate(project.client, {
      $inc: { 'stats.completedProjects': 1, 'stats.activeProjects': -1 },
    }, opts).catch(() => null);
    await User.findByIdAndUpdate(project.freelancer, {
      $inc: { 'stats.completedProjects': 1, 'stats.activeProjects': -1 },
    }, opts).catch(() => null);

    return { milestone, clientTx: clientTx[0], freelancerTx: freelancerTx[0], commission, netAmount, amount };
  });

  emitToProject(project._id.toString(), 'project:update', { projectId: project._id, status: project.status, progress: project.progress, updatedAt: new Date().toISOString() });
  emitToProject(project._id.toString(), 'contract:payment-released', { projectId: project._id });
  return result;
};

// ─── Funding (client "Pay Now") — creates a single Payment + escrow hold ──────
export const fundProjectPayment = async ({ project, clientId, amount }) => {
  if (project.status !== 'pending_payment') {
    throw new ApiError(400, `Contract is ${project.status}, cannot be funded`);
  }

  let milestone = await Milestone.findOne({ project: project._id }).sort({ order: 1, createdAt: 1 });
  if (milestone && milestone.status !== 'pending') {
    throw new ApiError(400, `Payment for this contract is already ${milestone.status}`);
  }

  const currency = project.budget?.currency || 'ETB';
  const fundAmount = amount || project.budget?.agreedAmount;
  if (!fundAmount || fundAmount <= 0) throw new ApiError(400, 'Invalid payment amount');

  const commissionRate = getCommissionRate();
  const job = project.job ? await Job.findById(project.job) : null;

  const result = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    const wallet = await Wallet.findOne({ user: clientId }).session(session);
    if (!wallet || wallet.balance - wallet.escrowBalance < fundAmount) {
      throw new ApiError(400, `Insufficient wallet balance. Required: ${fundAmount} ${currency}. Available: ${(wallet?.balance ?? 0) - (wallet?.escrowBalance ?? 0)} ${currency}`);
    }

    wallet.escrowBalance += fundAmount;
    await wallet.save(opts);

    const reference = generateTxRef('CTR');
    const payment = await Payment.create([{
      payer: clientId,
      payee: project.freelancer,
      project: project._id,
      milestone: milestone?._id || null,
      type: 'escrow',
      amount: fundAmount,
      currency,
      commission: 0,
      commissionRate,
      netAmount: fundAmount,
      status: 'completed',
      provider: 'wallet',
      reference,
      description: `Escrow for contract: ${project.title}`,
      isEscrow: true,
      escrowHeldAt: new Date(),
      processedAt: new Date(),
    }], opts);

    const holdTx = await Transaction.create([{
      user: clientId,
      wallet: wallet._id,
      type: 'escrow_hold',
      amount: fundAmount,
      fee: 0,
      netAmount: fundAmount,
      status: 'completed',
      reference: generateTxRef('TX'),
      description: `Escrow hold for contract: ${project.title}`,
      paymentId: payment[0]._id,
      projectId: project._id,
      milestoneId: milestone?._id || null,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance,
      processedAt: new Date(),
    }], opts);

    if (!milestone) {
      milestone = (await Milestone.create([{
        project: project._id,
        client: project.client,
        freelancer: project.freelancer,
        title: project.title,
        description: `Payment for: ${project.title}`,
        amount: fundAmount,
        currency,
        dueDate: project.timeline?.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'funded',
      }], opts))[0];
    } else {
      milestone.status = 'funded';
      milestone.paymentId = payment[0]._id;
      await milestone.save(opts);
    }

    // Canonical Escrow record (contracts previously had no Escrow document, so
    // the escrow engine could not see, release or refund them).
    const { commission: escrowCommission, netAmount: escrowNet } =
      calculateCommission(fundAmount, commissionRate);
    let escrow = milestone
      ? await Escrow.findOne({ milestone: milestone._id }).session(session)
      : await Escrow.findOne({ project: project._id }).session(session);
    if (escrow) {
      escrow.status = 'funded';
      escrow.fundedAt = new Date();
      escrow.paymentId = payment[0]._id;
      if (holdTx?.[0]?._id) escrow.fundingTransaction = holdTx[0]._id;
      escrow.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (milestone) escrow.milestone = milestone._id;
      await escrow.save(opts);
    } else {
      [escrow] = await Escrow.create([{
        client: project.client,
        freelancer: project.freelancer,
        project: project._id,
        milestone: milestone?._id || null,
        amount: fundAmount,
        currency,
        commissionRate,
        commissionAmount: escrowCommission,
        freelancerAmount: escrowNet,
        status: 'funded',
        fundedAt: new Date(),
        fundingTransaction: holdTx?.[0]?._id || null,
        paymentId: payment[0]._id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: `Escrow for contract: ${project.title}`,
      }], opts);
    }

    project.status = 'active';
    project.escrowPaymentId = payment[0]._id;
    if (!project.timeline.startDate) project.timeline.startDate = new Date();
    await project.save(opts);

    if (job) {
      job.status = 'funded';
      job.paymentStatus = 'funded';
      job.paymentId = payment[0]._id;
      job.milestoneId = milestone._id;
      job.escrowId = escrow._id;
      await job.save(opts);
    }

    return { project, milestone, payment: payment[0], escrow };
  });

  try {
    const { notifyEscrowFunded } = await import('./notification.service.js');
    await notifyEscrowFunded(project.freelancer, fundAmount, project.title);
  } catch (_) {}

  return result;
};
