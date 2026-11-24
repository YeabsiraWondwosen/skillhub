import { initializeProviders, getProvider, getFallbackProvider, isAnyProviderAvailable } from './support/providers/index.js';
import { buildSystemPrompt } from './support/promptBuilder.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/apiResponse.js';
import {
  SupportTicket,
  User,
  Profile,
  Wallet,
  Payment,
  Transaction,
  Escrow,
  Project,
  Milestone,
} from '../models/index.js';

// ─── Initialize providers on module load ─────────────────────────────────────
let providersReady = false;

function ensureProviders() {
  if (!providersReady) {
    initializeProviders();
    providersReady = true;
  }
}

// ─── AI Chat ─────────────────────────────────────────────────────────────────
const EMPTY_MESSAGE_RESPONSE = {
  response: "Please send me a message so I can help you!",
  isAIGenerated: false,
  source: 'validation',
};

const NO_PROVIDER_RESPONSE = {
  response: "I'm currently unavailable because no AI service is configured. Please try again later or create a support ticket and our team will help you personally.\n\nYou can create a ticket at /support",
  isAIGenerated: false,
  source: 'fallback_no_provider',
};

const ERROR_FALLBACK_RESPONSE = {
  response: "I'm sorry, I'm having trouble connecting to my AI services right now.\n\nPlease try again in a moment, or if you need immediate help, create a support ticket and our team will get back to you shortly.\n\nYou can create a ticket at /support",
  isAIGenerated: false,
  source: 'fallback_error',
};

const QUOTA_FALLBACK_RESPONSE = {
  response: "My AI assistant has reached its free daily usage limit, so I'm running on a short break right now.\n\nFor an immediate answer, create a support ticket and our team will help you personally — you can create one at /support",
  isAIGenerated: false,
  source: 'fallback_quota',
};

/** Quota/budget pauses are expected states, not errors worth a stack trace. */
const isQuotaPause = (error) =>
  error?.name === 'AIUnavailableError' || /\b429\b|quota|rate limit/i.test(error?.message || '');

const logProviderError = (label, error) => {
  if (isQuotaPause(error)) {
    logger.debug(`[AI] ${label} unavailable — using fallback response`);
  } else {
    logger.error(`[AI] ${label} error: ${error.message}`);
    logger.error(`[AI] ${label} stack: ${error.stack}`);
  }
};

export const getAIResponse = async (message, conversationHistory = [], user = null) => {
  if (!message || message.trim().length === 0) {
    return EMPTY_MESSAGE_RESPONSE;
  }

  ensureProviders();

  if (!isAnyProviderAvailable()) {
    logger.warn('[AI] No AI provider available — using fallback response');
    return NO_PROVIDER_RESPONSE;
  }

  const systemPrompt = buildSystemPrompt(user);
  const normalizedHistory = conversationHistory.map((msg) => ({
    role: msg.senderType === 'user' ? 'user' : 'assistant',
    content: msg.content,
  }));

  const primary = getProvider();
  let quotaPaused = false;
  if (primary) {
    try {
      const reply = await primary.chat(message, {
        systemPrompt,
        history: normalizedHistory,
      });

      if (reply && reply.trim().length > 0) {
        logger.info(`[AI] Response generated via ${primary.name}`);
        return {
          response: reply,
          isAIGenerated: true,
          source: primary.name,
        };
      }

      logger.warn(`[AI] ${primary.name} returned empty reply, trying fallback`);
    } catch (error) {
      quotaPaused = quotaPaused || isQuotaPause(error);
      logProviderError(primary.name, error);
    }
  }

  const fallback = getFallbackProvider();
  if (fallback && !quotaPaused) {
    try {
      const reply = await fallback.chat(message, {
        systemPrompt,
        history: normalizedHistory,
      });

      if (reply && reply.trim().length > 0) {
        logger.info(`[AI] Response generated via fallback: ${fallback.name}`);
        return {
          response: reply,
          isAIGenerated: true,
          source: `fallback_${fallback.name}`,
        };
      }

      logger.warn(`[AI] Fallback ${fallback.name} also returned empty reply`);
    } catch (error) {
      quotaPaused = quotaPaused || isQuotaPause(error);
      logProviderError(`Fallback ${fallback.name}`, error);
    }
  }

  if (quotaPaused) {
    logger.warn('[AI] All providers in quota cooldown — returning quota fallback');
    return QUOTA_FALLBACK_RESPONSE;
  }

  logger.error('[AI] All providers failed — returning error fallback');
  return ERROR_FALLBACK_RESPONSE;
};

// ─── Support Tickets ─────────────────────────────────────────────────────────
export const STATUS_TRANSITIONS = {
  open: ['in_progress', 'closed'],
  in_progress: ['waiting_for_user', 'resolved', 'closed'],
  waiting_for_user: ['in_progress', 'resolved', 'closed'],
  resolved: ['open', 'closed'],
  closed: ['open'],
};

export const getValidNextStatuses = (status) => STATUS_TRANSITIONS[status] || [];

const recordActivity = async (ticket, { action, actor = null, from = '', to = '', note = '' }) => {
  ticket.activities.push({ action, actor, from, to, note });
  return ticket;
};

export const createTicket = async (userId, data) => {
  const ticket = await SupportTicket.create({
    user: userId,
    ...data,
    messages: [{
      sender: userId,
      senderType: 'user',
      content: data.initialMessage || data.subject,
    }],
  });

  ticket.activities.push({
    action: 'created',
    actor: userId,
    from: '',
    to: 'open',
    note: 'Ticket created',
  });
  await ticket.save();

  return ticket.populate('user', 'firstName lastName email avatar');
};

export const addMessageToTicket = async (ticketId, userId, content, senderType = 'user') => {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) return null;

  const previousStatus = ticket.status;

  ticket.messages.push({
    sender: userId,
    senderType,
    content,
  });

  if (senderType === 'admin') {
    ticket.status = 'waiting_for_user';
  } else if (senderType === 'user') {
    ticket.status = 'in_progress';
  }

  await recordActivity(ticket, {
    action: 'reply_sent',
    actor: userId,
    from: '',
    to: '',
    note: content.slice(0, 200),
  });

  if (ticket.status !== previousStatus) {
    await recordActivity(ticket, {
      action: 'status_changed',
      actor: userId,
      from: previousStatus,
      to: ticket.status,
      note: 'Status updated by reply',
    });
  }

  await ticket.save();
  return ticket;
};

export const getTicketByTicketId = async (ticketId) => {
  return SupportTicket.findOne({ ticketId })
    .populate('user', 'firstName lastName email avatar role')
    .populate('assignedTo', 'firstName lastName avatar role')
    .populate('messages.sender', 'firstName lastName avatar role')
    .populate('internalNotes.author', 'firstName lastName avatar role')
    .populate('activities.actor', 'firstName lastName avatar role');
};

export const updateTicketStatus = async (ticketId, status, actor) => {
  const ticket = await SupportTicket.findOne({ ticketId });
  if (!ticket) return null;

  if (!getValidNextStatuses(ticket.status).includes(status)) {
    throw new ApiError(400, `Cannot change status from "${ticket.status}" to "${status}"`);
  }

  const previousStatus = ticket.status;
  ticket.status = status;

  const action = status === 'closed' ? 'closed' : status === 'open' ? 'reopened' : 'status_changed';

  await recordActivity(ticket, {
    action,
    actor,
    from: previousStatus,
    to: status,
    note: '',
  });

  await ticket.save();
  return ticket;
};

export const updateTicketPriority = async (ticketId, priority, actor) => {
  const ticket = await SupportTicket.findOne({ ticketId });
  if (!ticket) return null;

  const previousPriority = ticket.priority;
  ticket.priority = priority;

  await recordActivity(ticket, {
    action: 'priority_changed',
    actor,
    from: previousPriority,
    to: priority,
    note: '',
  });

  await ticket.save();
  return ticket;
};

export const addInternalNote = async (ticketId, content, author) => {
  const ticket = await SupportTicket.findOne({ ticketId });
  if (!ticket) return null;

  ticket.internalNotes.push({ content, author });

  await recordActivity(ticket, {
    action: 'note_added',
    actor: author,
    from: '',
    to: '',
    note: content.slice(0, 200),
  });

  await ticket.save();
  return ticket;
};

export const saveInvestigation = async (ticketId, { investigationNotes = '', rootCause = '' }, actor) => {
  const ticket = await SupportTicket.findOne({ ticketId });
  if (!ticket) return null;

  const wasStarted = ticket.activities.some(
    (a) => a.action === 'investigation_started' || a.action === 'investigation_updated'
  );

  ticket.investigationNotes = investigationNotes;
  ticket.rootCause = rootCause;

  await recordActivity(ticket, {
    action: wasStarted ? 'investigation_updated' : 'investigation_started',
    actor,
    from: '',
    to: '',
    note: rootCause.slice(0, 200) || investigationNotes.slice(0, 200),
  });

  await ticket.save();
  return ticket;
};

export const resolveTicket = async (ticketId, resolution, resolvedBy, { rootCause = '', investigationNotes = '' } = {}) => {
  if (!resolution || !resolution.trim()) {
    throw new ApiError(400, 'Resolution is required');
  }
  if (!rootCause || !rootCause.trim()) {
    throw new ApiError(400, 'Root cause is required');
  }

  const ticket = await SupportTicket.findOne({ ticketId });
  if (!ticket) return null;

  const previousStatus = ticket.status;

  ticket.messages.push({
    sender: resolvedBy,
    senderType: 'admin',
    content: resolution,
  });

  ticket.status = 'resolved';
  ticket.resolution = {
    content: resolution,
    resolvedAt: new Date(),
    resolvedBy,
  };
  ticket.rootCause = rootCause.trim();
  if (investigationNotes && investigationNotes.trim()) {
    ticket.investigationNotes = investigationNotes.trim();
  }

  await recordActivity(ticket, {
    action: 'resolution_added',
    actor: resolvedBy,
    from: '',
    to: '',
    note: resolution.slice(0, 200),
  });

  await recordActivity(ticket, {
    action: 'resolved',
    actor: resolvedBy,
    from: previousStatus,
    to: 'resolved',
    note: rootCause.slice(0, 200),
  });

  await ticket.save();
  return ticket;
};

// ─── Ticket Context (read-only investigation data) ───────────────────────────
export const getTicketContext = async (ticket) => {
  const userId = ticket.user?._id || ticket.user;
  const context = {};

  if (!userId) return context;

  const user = await User.findById(userId)
    .select(
      'email firstName lastName role isActive isBanned banReason isEmailVerified isVerifiedFreelancer ' +
      'pendingEmail lastSeen createdAt country language availabilityStatus primaryCategory stats'
    )
    .lean();

  if (user) {
    context.account = {
      role: user.role,
      isActive: user.isActive,
      isBanned: user.isBanned,
      banReason: user.banReason || '',
      isEmailVerified: user.isEmailVerified,
      isVerifiedFreelancer: user.isVerifiedFreelancer,
      pendingEmail: user.pendingEmail || '',
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
      country: user.country || '',
      availabilityStatus: user.availabilityStatus,
      primaryCategory: user.primaryCategory || null,
      stats: {
        totalEarnings: user.stats?.totalEarnings ?? null,
        totalSpent: user.stats?.totalSpent ?? null,
        completedProjects: user.stats?.completedProjects ?? null,
        activeProjects: user.stats?.activeProjects ?? null,
        averageRating: user.stats?.averageRating ?? null,
      },
    };
  }

  const profile = await Profile.findOne({ user: userId })
    .select('tagline bio hourlyRate yearsOfExperience availability skills completionScore')
    .lean();

  if (profile) {
    context.profile = {
      tagline: profile.tagline || '',
      bio: profile.bio || '',
      hourlyRate: profile.hourlyRate ?? null,
      yearsOfExperience: profile.yearsOfExperience ?? null,
      availability: profile.availability || '',
      skillsCount: Array.isArray(profile.skills) ? profile.skills.length : 0,
      completionScore: profile.completionScore ?? null,
    };
  }

  const category = ticket.category || '';

  if (category === 'payment_problem' || category === 'billing') {
    const wallet = await Wallet.findOne({ user: userId }).lean();
    if (wallet) {
      context.wallet = {
        balance: wallet.balance,
        escrowBalance: wallet.escrowBalance,
        pendingBalance: wallet.pendingBalance,
        totalEarned: wallet.totalEarned,
        totalWithdrawn: wallet.totalWithdrawn,
        totalSpent: wallet.totalSpent,
        isActive: wallet.isActive,
      };
    }

    const payments = await Payment.find({ $or: [{ payer: userId }, { payee: userId }] })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    if (payments.length) {
      context.payments = payments.map((p) => ({
        reference: p.reference,
        type: p.type,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        description: p.description || '',
        failureReason: p.failureReason || '',
        createdAt: p.createdAt,
      }));
    }

    const transactions = await Transaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    if (transactions.length) {
      context.transactions = transactions.map((t) => ({
        reference: t.reference,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        description: t.description || '',
        failureReason: t.failureReason || '',
        createdAt: t.createdAt,
      }));
    }

    const escrows = await Escrow.find({ $or: [{ client: userId }, { freelancer: userId }] })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    if (escrows.length) {
      context.escrows = escrows.map((e) => ({
        amount: e.amount,
        status: e.status,
        disputeReason: e.disputeReason || '',
        createdAt: e.createdAt,
      }));
    }
  }

  if (category === 'project_dispute' || category === 'technical_issue') {
    const projects = await Project.find({ $or: [{ client: userId }, { freelancer: userId }] })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();
    if (projects.length) {
      context.projects = projects.map((pr) => ({
        title: pr.title,
        status: pr.status,
        agreedAmount: pr.budget?.agreedAmount ?? null,
        paidAmount: pr.budget?.paidAmount ?? null,
        currency: pr.budget?.currency || 'ETB',
        deadline: pr.timeline?.deadline || null,
        isDisputed: !!pr.dispute?.isDisputed,
        disputeReason: pr.dispute?.reason || '',
        createdAt: pr.createdAt,
      }));
    }

    if (ticket.relatedProject) {
      const rp = await Project.findById(ticket.relatedProject).lean();
      if (rp) {
        context.relatedProject = {
          title: rp.title,
          status: rp.status,
          agreedAmount: rp.budget?.agreedAmount ?? null,
          paidAmount: rp.budget?.paidAmount ?? null,
          currency: rp.budget?.currency || 'ETB',
          isDisputed: !!rp.dispute?.isDisputed,
          disputeReason: rp.dispute?.reason || '',
          createdAt: rp.createdAt,
        };

        const milestones = await Milestone.find({ project: rp._id })
          .sort({ order: 1 })
          .limit(10)
          .lean();
        if (milestones.length) {
          context.relatedProject.milestones = milestones.map((m) => ({
            title: m.title,
            amount: m.amount,
            status: m.status,
            dueDate: m.dueDate,
          }));
        }

        const relatedEscrows = await Escrow.find({ project: rp._id })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();
        if (relatedEscrows.length) {
          context.relatedProject.escrows = relatedEscrows.map((e) => ({
            amount: e.amount,
            status: e.status,
            disputeReason: e.disputeReason || '',
            createdAt: e.createdAt,
          }));
        }
      }
    }
  }

  return context;
};

export const getTicketStats = async () => {
  const stats = await SupportTicket.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const priorityStats = await SupportTicket.aggregate([
    { $match: { status: { $in: ['open', 'in_progress'] } } },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 },
      },
    },
  ]);

  return { statusStats: stats, priorityStats };
};
