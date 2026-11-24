import mongoose from 'mongoose';
import { Project, Milestone, Payment, Escrow, Review, Report, Conversation, Message } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { buildContract, fundProjectPayment } from '../services/contract.service.js';
import { ACTIVE_PROJECT_STATUSES } from '../utils/projectStateMachine.js';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const PARTICIPANT_SELECT = 'firstName lastName email avatar role isOnline isVerifiedFreelancer stats';

/**
 * Load every record that feeds the contract DTO for a project.
 * Mirrors the shapes produced by buildContract in contract.service.js.
 */
const loadContractContext = async (project) => {
  const milestones = await Milestone.find({ project: project._id })
    .sort({ order: 1, createdAt: 1 })
    .populate('paymentId');

  const milestone = milestones[0] || null;
  const payment = milestone?.paymentId
    ? await Payment.findById(milestone.paymentId).lean()
    : project.escrowPaymentId
      ? await Payment.findById(project.escrowPaymentId).lean()
      : null;

  const escrow = await Escrow.findOne({ project: project._id }).lean();

  const [reviews, reports] = await Promise.all([
    Review.find({ project: project._id })
      .populate('reviewer', PARTICIPANT_SELECT)
      .populate('reviewee', PARTICIPANT_SELECT)
      .sort({ createdAt: -1 }),
    Report.find({ resourceType: 'project', resourceId: project._id })
      .sort({ createdAt: -1 }),
  ]);

  let conversation = null;
  let recentMessages = [];
  if (project.conversationId) {
    conversation = await Conversation.findById(project.conversationId).lean();
  } else {
    conversation = await Conversation.findOne({ project: project._id, type: 'project' }).lean();
  }
  if (conversation) {
    recentMessages = await Message.find({ conversation: conversation._id, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('sender', 'firstName lastName avatar')
      .lean();
  }

  return {
    milestone, milestones, deliveries: project.deliveries || [], payment, escrow,
    reviews, reports, conversation, recentMessages,
  };
};

const getContractById = async (contractId, userId) => {
  const project = await Project.findById(contractId)
    .populate('client', PARTICIPANT_SELECT)
    .populate('freelancer', PARTICIPANT_SELECT)
    .populate('job', 'title category budget paymentStatus');
  if (!project) throw new ApiError(404, 'Contract not found');

  const isParticipant =
    String(project.client?._id) === String(userId) ||
    String(project.freelancer?._id) === String(userId);
  if (!isParticipant) throw new ApiError(403, 'Not authorized to view this contract');

  return project;
};

// ─── Routes ────────────────────────────────────────────────────────────────────

export const getMyContracts = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;
  const as = req.query.as || req.user.role;

  const roleField = as === 'client' ? 'client' : as === 'freelancer' ? 'freelancer' : null;
  const filter = roleField
    ? { [roleField]: req.user._id }
    : { $or: [{ client: req.user._id }, { freelancer: req.user._id }] };
  if (status === 'active') filter.status = { $in: ACTIVE_PROJECT_STATUSES };
  else if (status) filter.status = status;

  const total = await Project.countDocuments(filter);
  const projects = await Project.find(filter)
    .populate('client', PARTICIPANT_SELECT)
    .populate('freelancer', PARTICIPANT_SELECT)
    .populate('job', 'title category budget paymentStatus')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);

  const contracts = await Promise.all(
    projects.map(async (project) => {
      const ctx = await loadContractContext(project);
      return buildContract(project, { ...ctx, viewerId: req.user._id });
    })
  );

  sendResponse(res, 200, 'Contracts fetched', contracts, paginationMeta(total, page, limit));
});

export const getContract = catchAsync(async (req, res) => {
  const project = await getContractById(req.params.contractId, req.user._id);
  const ctx = await loadContractContext(project);
  const contract = await buildContract(project, { ...ctx, viewerId: req.user._id });

  sendResponse(res, 200, 'Contract fetched', contract);
});

// Client funds the escrow for a contract (wallet → escrowBalance + Payment record).
export const fundContract = catchAsync(async (req, res) => {
  const project = await getContractById(req.params.contractId, req.user._id);

  if (String(project.client?._id) !== String(req.user._id)) {
    throw new ApiError(403, 'Only the client can fund this contract');
  }

  const { milestone, payment } = await fundProjectPayment({
    project,
    clientId: req.user._id,
    amount: req.body?.amount,
  });

  const ctx = await loadContractContext(project);
  const contract = await buildContract(project, { ...ctx, viewerId: req.user._id });

  sendResponse(res, 200, 'Contract funded — payment is held in escrow', {
    contract,
    milestone,
    payment,
  });
});

// Delivery / review / dispute reuse the project flow (one source of truth).
// The project flow already releases real escrow funds on approval via the
// contract service. We only remap `contractId` → `projectId` here.
const remapToProjectHandler = (handler, paramName) => (req, res) => {
  req.params[paramName] = req.params.contractId;
  return handler(req, res);
};

export { remapToProjectHandler };
