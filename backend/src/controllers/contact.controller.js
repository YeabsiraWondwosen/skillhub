import { ContactMessage, User } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { createNotification } from '../services/notification.service.js';
import { sendContactReplyEmail } from '../services/email.service.js';
import { logger } from '../utils/logger.js';

const SUBJECT_OPTIONS = [
  'General Inquiry',
  'Technical Support',
  'Billing & Payments',
  'Dispute Resolution',
  'Partnership',
  'Feedback',
  'Other',
];

const STATUS_OPTIONS = ['New', 'In Progress', 'Replied', 'Resolved', 'Closed'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];

// Deliberately strict enough to reject header-injection payloads (CR/LF are
// rejected separately) and malformed addresses.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const hasLineBreaks = (value) => /[\r\n]/.test(String(value || ''));

export const submitContactMessage = catchAsync(async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Name is required');
  }
  if (!email || !email.trim()) {
    throw new ApiError(400, 'Email is required');
  }
  if (!subject || !subject.trim()) {
    throw new ApiError(400, 'Subject is required');
  }
  if (!SUBJECT_OPTIONS.includes(subject)) {
    throw new ApiError(400, 'Invalid subject selected');
  }
  if (!message || !message.trim()) {
    throw new ApiError(400, 'Message is required');
  }
  if (message.trim().length < 20) {
    throw new ApiError(400, 'Message must be at least 20 characters');
  }
  if (message.trim().length > 5000) {
    throw new ApiError(400, 'Message cannot exceed 5000 characters');
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail) || hasLineBreaks(normalizedEmail)) {
    throw new ApiError(400, 'Invalid email address');
  }

  const sanitized = {
    name: name.trim(),
    email: normalizedEmail,
    subject: subject.trim(),
    message: message.trim(),
  };

  // Duplicate-submission guard: an identical payload within 10 minutes is
  // almost always a double-click / retry. Acknowledge it without creating a
  // second record so admins do not receive the same message twice.
  const recentDuplicate = await ContactMessage.findOne({
    email: sanitized.email,
    subject: sanitized.subject,
    message: sanitized.message,
    createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
  }).sort({ createdAt: -1 });

  if (recentDuplicate) {
    return sendResponse(
      res,
      200,
      'Your message has already been received. Our team will get back to you within 24 hours.',
      recentDuplicate
    );
  }

  const contactMessage = await ContactMessage.create(sanitized);

  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    const promises = admins.map((admin) =>
      createNotification({
        recipient: admin._id,
        sender: null,
        type: 'contact_message_received',
        title: 'New Contact Message',
        message: `New contact message from ${contactMessage.name} (${contactMessage.email}): ${contactMessage.subject}`,
        actionUrl: '/admin/contact-messages',
        resourceType: 'contact_message',
        resourceId: contactMessage._id,
      })
    );
    await Promise.allSettled(promises);
  } catch (error) {
    console.error('Failed to send contact message notifications:', error);
  }

  sendResponse(res, 201, 'Your message has been received. Our team will get back to you within 24 hours.', contactMessage);
});

export const getAdminMessages = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, priority, subject, q, from, to } = req.query;

  const filter = {};
  if (status && STATUS_OPTIONS.includes(status)) {
    filter.status = status;
  }
  if (priority && PRIORITY_OPTIONS.includes(priority)) {
    filter.priority = priority;
  }
  if (subject && SUBJECT_OPTIONS.includes(subject)) {
    filter.subject = subject;
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  if (q && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [
      { name: regex },
      { email: regex },
      { subject: regex },
      { message: regex },
    ];
  }

  const total = await ContactMessage.countDocuments(filter);
  const messages = await ContactMessage.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('repliedBy', 'firstName lastName email avatar');

  sendResponse(res, 200, 'Contact messages fetched', messages, paginationMeta(total, page, limit));
});

export const getAdminMessageStats = catchAsync(async (req, res) => {
  const [total, newMessages, inProgress, replied, resolved, highPriority, emailFailed] = await Promise.all([
    ContactMessage.countDocuments(),
    ContactMessage.countDocuments({ status: 'New' }),
    ContactMessage.countDocuments({ status: 'In Progress' }),
    ContactMessage.countDocuments({ status: 'Replied' }),
    ContactMessage.countDocuments({ status: 'Resolved' }),
    ContactMessage.countDocuments({ priority: 'High' }),
    ContactMessage.countDocuments({ emailStatus: 'Failed' }),
  ]);

  sendResponse(res, 200, 'Contact message stats fetched', {
    total,
    newMessages,
    inProgress,
    replied,
    resolved,
    highPriority,
    emailFailed,
  });
});

export const getAdminMessage = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, 'Invalid message ID');
  }

  const message = await ContactMessage.findById(id).populate('repliedBy', 'firstName lastName email avatar');
  if (!message) {
    throw new ApiError(404, 'Contact message not found');
  }

  sendResponse(res, 200, 'Contact message fetched', message);
});

export const updateMessageStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, 'Invalid message ID');
  }
  if (!status || !STATUS_OPTIONS.includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  const message = await ContactMessage.findById(id);
  if (!message) {
    throw new ApiError(404, 'Contact message not found');
  }

  message.status = status;
  await message.save();

  sendResponse(res, 200, 'Message status updated', message);
});

export const updateMessagePriority = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { priority } = req.body;

  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, 'Invalid message ID');
  }
  if (!priority || !PRIORITY_OPTIONS.includes(priority)) {
    throw new ApiError(400, 'Invalid priority');
  }

  const message = await ContactMessage.findById(id);
  if (!message) {
    throw new ApiError(404, 'Contact message not found');
  }

  message.priority = priority;
  await message.save();

  sendResponse(res, 200, 'Message priority updated', message);
});

export const replyToContactMessage = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { adminReply } = req.body;

  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, 'Invalid message ID');
  }
  if (!adminReply || !adminReply.trim()) {
    throw new ApiError(400, 'Reply message is required');
  }
  const replyText = adminReply.trim();
  if (replyText.length < 10) {
    throw new ApiError(400, 'Reply must be at least 10 characters');
  }
  if (replyText.length > 5000) {
    throw new ApiError(400, 'Reply cannot exceed 5000 characters');
  }

  // Authorization: `protect` + `authorize('admin')` run in the route layer —
  // req.user is a verified, active admin at this point.
  const message = await ContactMessage.findById(id);
  if (!message) {
    throw new ApiError(404, 'Contact message not found');
  }

  // Validate the stored sender address before attempting delivery.
  const recipient = String(message.email || '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(recipient) || hasLineBreaks(recipient)) {
    throw new ApiError(
      422,
      'The email address stored with this message is invalid, so the reply cannot be delivered. Ask the sender to submit the Contact Us form again with a valid email address.'
    );
  }

  if (message.emailStatus === 'Sending') {
    throw new ApiError(409, 'A reply email for this message is already being sent.');
  }
  if (message.adminReply && message.adminReply === replyText && message.emailStatus === 'Sent') {
    throw new ApiError(400, 'This reply has already been emailed to the sender.');
  }

  // Persist the reply and mark the email as "Sending" BEFORE delivery so the
  // stored state is always truthful (never "Sent" ahead of the provider).
  message.adminReply = replyText;
  message.repliedBy = req.user._id;
  message.repliedAt = new Date();
  message.emailStatus = 'Sending';
  message.emailError = null;
  await message.save();

  try {
    await sendContactReplyEmail({
      to: recipient,
      userName: message.name,
      originalSubject: message.subject,
      originalMessage: message.message,
      reply: replyText,
    });
  } catch (err) {
    const reason = String(err?.message || err).replace(/\s+/g, ' ').trim().slice(0, 1000);
    message.emailStatus = 'Failed';
    message.emailError = reason;
    await message.save().catch(() => {});
    logger.error(
      `[contact] Reply email FAILED — message=${message._id}, to=${recipient}, reason: ${reason}, time: ${new Date().toISOString()}`
    );
    throw new ApiError(
      502,
      `The reply was saved, but the email to ${recipient} was NOT delivered: ${reason.slice(0, 300)}`
    );
  }

  // Provider accepted the message — only now mark it as sent.
  message.emailStatus = 'Sent';
  message.emailSentAt = new Date();
  message.emailError = null;
  if (message.status !== 'Resolved' && message.status !== 'Closed') {
    message.status = 'Replied';
  }
  await message.save();

  logger.info(
    `[contact] Reply email SENT — message=${message._id}, to=${recipient}, time: ${message.emailSentAt.toISOString()}`
  );

  sendResponse(res, 200, `Reply sent successfully — delivered to ${recipient}`, message);
});

export const deleteContactMessage = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, 'Invalid message ID');
  }

  const message = await ContactMessage.findById(id);
  if (!message) {
    throw new ApiError(404, 'Contact message not found');
  }

  await message.deleteOne();
  sendResponse(res, 200, 'Contact message deleted');
});
