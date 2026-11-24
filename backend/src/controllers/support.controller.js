import { SupportTicket, User } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import {
  getAIResponse,
  createTicket,
  addMessageToTicket,
  resolveTicket,
  getTicketStats,
  getTicketByTicketId,
  getTicketContext,
  updateTicketStatus,
  updateTicketPriority,
  addInternalNote,
  saveInvestigation,
} from '../services/support.service.js';
import { createNotification } from '../services/notification.service.js';

// ─── AI Chat with Support Agent ───────────────────────────────────────────────
export const aiChat = catchAsync(async (req, res) => {
  const { message, conversationHistory = [] } = req.body;

  if (!message || message.trim().length === 0) {
    throw new ApiError(400, 'Message is required');
  }

  const user = req.user
    ? {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
      }
    : null;

  const result = await getAIResponse(message, conversationHistory, user);
  sendResponse(res, 200, 'AI response', result);
});

// ─── Create Support Ticket ────────────────────────────────────────────────────
export const createSupportTicket = catchAsync(async (req, res) => {
  const { subject, category, priority, initialMessage, relatedJob, relatedProject, tags } = req.body;

  const ticket = await createTicket(req.user._id, {
    subject,
    category,
    priority,
    initialMessage,
    relatedJob,
    relatedProject,
    tags,
  });

  // Notify admins
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  for (const admin of admins) {
    await createNotification({
      recipient: admin._id,
      sender: req.user._id,
      type: 'support_ticket_created',
      title: 'New Support Ticket',
      message: `New ${priority} priority ticket: ${subject}`,
      actionUrl: `/admin/support/${ticket.ticketId}`,
      resourceType: 'support_ticket',
      resourceId: ticket._id,
    });
  }

  sendResponse(res, 201, 'Support ticket created', ticket);
});

// ─── Get User's Tickets ───────────────────────────────────────────────────────
export const getMyTickets = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, category } = req.query;

  const filter = { user: req.user._id };
  if (status) filter.status = status;
  if (category) filter.category = category;

  const total = await SupportTicket.countDocuments(filter);
  const tickets = await SupportTicket.find(filter)
    .sort({ lastReplyAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('assignedTo', 'firstName lastName avatar');

  sendResponse(res, 200, 'Tickets fetched', tickets, paginationMeta(total, page, limit));
});

// ─── Get Single Ticket ────────────────────────────────────────────────────────
export const getTicket = catchAsync(async (req, res) => {
  const ticket = await SupportTicket.findOne({
    ticketId: req.params.ticketId,
    user: req.user._id,
  })
    .select('-internalNotes -activities -rootCause -investigationNotes')
    .populate('assignedTo', 'firstName lastName avatar')
    .populate('messages.sender', 'firstName lastName avatar role');

  if (!ticket) throw new ApiError(404, 'Ticket not found');

  sendResponse(res, 200, 'Ticket fetched', ticket);
});

// ─── Reply to Ticket ──────────────────────────────────────────────────────────
export const replyToTicket = catchAsync(async (req, res) => {
  const ticket = await SupportTicket.findOne({
    ticketId: req.params.ticketId,
    user: req.user._id,
  });

  if (!ticket) throw new ApiError(404, 'Ticket not found');
  if (ticket.status === 'closed') throw new ApiError(400, 'Ticket is closed');

  const updatedTicket = await addMessageToTicket(ticket._id, req.user._id, req.body.content, 'user');

  // Notify assigned admin
  if (ticket.assignedTo) {
    await createNotification({
      recipient: ticket.assignedTo,
      sender: req.user._id,
      type: 'support_ticket_reply',
      title: 'Ticket Reply',
      message: `New reply on ticket ${ticket.ticketId}`,
      actionUrl: `/admin/support/${ticket.ticketId}`,
      resourceType: 'support_ticket',
      resourceId: ticket._id,
    });
  }

  sendResponse(res, 200, 'Reply added', updatedTicket);
});

// ─── Rate Ticket Resolution ───────────────────────────────────────────────────
export const rateTicket = catchAsync(async (req, res) => {
  const { rating } = req.body;
  const ticket = await SupportTicket.findOne({
    ticketId: req.params.ticketId,
    user: req.user._id,
    status: 'resolved',
  });

  if (!ticket) throw new ApiError(404, 'Resolved ticket not found');

  ticket.satisfactionRating = rating;
  await ticket.save();

  sendResponse(res, 200, 'Rating submitted', ticket);
});

// ─── Admin: Get All Tickets ───────────────────────────────────────────────────
export const adminGetAllTickets = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, priority, category, assignedTo, role, q, from, to } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  if (role) {
    const roleUsers = await User.find({ role }).select('_id');
    filter.user = { $in: roleUsers.map((u) => u._id) };
  }
  if (q && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const matchingUsers = await User.find({
      $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
    }).select('_id');
    filter.$or = [
      { subject: regex },
      { ticketId: regex },
      { tags: regex },
      { user: { $in: matchingUsers.map((u) => u._id) } },
    ];
  }

  const total = await SupportTicket.countDocuments(filter);
  const tickets = await SupportTicket.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'firstName lastName email avatar role')
    .populate('assignedTo', 'firstName lastName avatar role');

  sendResponse(res, 200, 'Tickets fetched', tickets, paginationMeta(total, page, limit));
});

// ─── Admin: Get Single Ticket ─────────────────────────────────────────────────
export const adminGetTicket = catchAsync(async (req, res) => {
  const ticket = await getTicketByTicketId(req.params.ticketId);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  sendResponse(res, 200, 'Ticket fetched', ticket);
});

// ─── Admin: Get Ticket Context (read-only investigation data) ────────────────
export const adminGetTicketContext = catchAsync(async (req, res) => {
  const ticket = await getTicketByTicketId(req.params.ticketId);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  const context = await getTicketContext(ticket);
  sendResponse(res, 200, 'Ticket context fetched', context);
});

// ─── Admin: Update Ticket Status ──────────────────────────────────────────────
export const adminUpdateTicketStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  if (!status) throw new ApiError(400, 'Status is required');

  const ticket = await updateTicketStatus(req.params.ticketId, status, req.user._id);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  sendResponse(res, 200, 'Ticket status updated', ticket);
});

// ─── Admin: Update Ticket Priority ────────────────────────────────────────────
export const adminUpdateTicketPriority = catchAsync(async (req, res) => {
  const { priority } = req.body;
  if (!priority) throw new ApiError(400, 'Priority is required');

  const ticket = await updateTicketPriority(req.params.ticketId, priority, req.user._id);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  sendResponse(res, 200, 'Ticket priority updated', ticket);
});

// ─── Admin: Add Internal Note ─────────────────────────────────────────────────
export const adminAddInternalNote = catchAsync(async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) throw new ApiError(400, 'Note content is required');

  const ticket = await addInternalNote(req.params.ticketId, content.trim(), req.user._id);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  sendResponse(res, 200, 'Internal note added', ticket);
});

// ─── Admin: Save Investigation ────────────────────────────────────────────────
export const adminSaveInvestigation = catchAsync(async (req, res) => {
  const { investigationNotes = '', rootCause = '' } = req.body;

  if (!investigationNotes.trim() && !rootCause.trim()) {
    throw new ApiError(400, 'Enter investigation notes or a root cause');
  }

  const ticket = await saveInvestigation(
    req.params.ticketId,
    { investigationNotes: investigationNotes.trim(), rootCause: rootCause.trim() },
    req.user._id
  );
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  sendResponse(res, 200, 'Investigation updated', ticket);
});

// ─── Admin: Reply to Ticket ───────────────────────────────────────────────────
export const adminReplyToTicket = catchAsync(async (req, res) => {
  const ticket = await SupportTicket.findOne({ ticketId: req.params.ticketId });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  if (ticket.status === 'closed') throw new ApiError(400, 'Cannot reply to a closed ticket');

  const updatedTicket = await addMessageToTicket(ticket._id, req.user._id, req.body.content, 'admin');

  await createNotification({
    recipient: ticket.user,
    sender: req.user._id,
    type: 'support_ticket_reply',
    title: 'Support Reply',
    message: `Support team replied to your ticket "${ticket.subject}"`,
    actionUrl: `/support/${ticket.ticketId}`,
    resourceType: 'support_ticket',
    resourceId: ticket._id,
  });

  sendResponse(res, 200, 'Reply added', updatedTicket);
});

// ─── Admin: Resolve Ticket ────────────────────────────────────────────────────
export const adminResolveTicket = catchAsync(async (req, res) => {
  const { resolution, rootCause, investigationNotes } = req.body;
  if (!resolution || !resolution.trim()) throw new ApiError(400, 'Resolution is required');
  if (!rootCause || !rootCause.trim()) throw new ApiError(400, 'Root cause is required');

  const ticket = await resolveTicket(
    req.params.ticketId,
    resolution,
    req.user._id,
    { rootCause, investigationNotes }
  );
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  await createNotification({
    recipient: ticket.user,
    sender: req.user._id,
    type: 'support_ticket_resolved',
    title: 'Ticket Resolved',
    message: `Your ticket "${ticket.subject}" has been resolved`,
    actionUrl: `/support/${ticket.ticketId}`,
    resourceType: 'support_ticket',
    resourceId: ticket._id,
  });

  sendResponse(res, 200, 'Ticket resolved', ticket);
});

// ─── Admin: Get Stats ─────────────────────────────────────────────────────────
export const adminGetTicketStats = catchAsync(async (req, res) => {
  const stats = await getTicketStats();
  sendResponse(res, 200, 'Ticket stats', stats);
});
