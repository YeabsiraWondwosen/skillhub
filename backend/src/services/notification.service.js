import { Notification, User, NotificationPreferences } from '../models/index.js';
import { emitToUser } from './socket.service.js';
import { logger } from '../utils/logger.js';
import { buildNotificationRecord, adminRecipientFilter } from '../utils/notificationQuery.js';
import { shouldDeliverNotification } from '../utils/notificationPreference.js';

const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a notification and emit it via Socket.io.
 *
 * Every notification is created from a real system event only. Callers pass the
 * actual entity ids / names. No fake or demo notifications are ever produced here.
 *
 * Deduplication: if `uniqueKey` is provided, we refuse to create a second
 * identical notification (same recipient + type + key) within the dedup window,
 * so a single real event never produces duplicate notifications.
 */
export const createNotification = async ({
  recipient,
  sender = null,
  type,
  title,
  message,
  data = {},
  actionUrl = '',
  resourceType = null,
  resourceId = null,
  category = null,
  priority = 'medium',
  uniqueKey = null,
}) => {
  try {
    if (!recipient) return null;

    // Respect the recipient's saved notification preferences. A missing row
    // means "everything on"; security/system alerts always deliver.
    const prefs = await NotificationPreferences.findOne({ user: recipient })
      .select('channels categories')
      .lean();
    if (!shouldDeliverNotification({ prefs, type, category })) return null;

    if (uniqueKey) {
      const existing = await Notification.findOne({
        recipient,
        type,
        'data.uniqueKey': uniqueKey,
        createdAt: { $gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
      }).lean();
      if (existing) return existing;
    }

    const payload = uniqueKey ? { ...data, uniqueKey } : data;
    const notification = await Notification.create(
      buildNotificationRecord({
        recipient,
        sender,
        type,
        title,
        message,
        data,
        actionUrl,
        resourceType,
        resourceId,
        category,
        priority,
        uniqueKey,
      })
    );

    // Real-time push via Socket.io
    emitToUser(recipient.toString(), 'notification:new', {
      _id: notification._id,
      sender,
      type,
      title,
      message,
      actionUrl,
      category: notification.category,
      priority,
      resourceType,
      resourceId,
      isRead: false,
      isAiGenerated: false,
      data: payload,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (error) {
    logger.error(`Failed to create notification: ${error.message}`);
    // Don't throw — notifications are non-critical
  }
};

/**
 * Bulk create notifications (e.g. broadcast)
 */
export const createBulkNotifications = async (notifications) => {
  try {
    const created = await Notification.insertMany(notifications, { ordered: false });
    created.forEach((n) => {
      emitToUser(n.recipient.toString(), 'notification:new', n);
    });
    return created;
  } catch (error) {
    logger.error(`Bulk notification error: ${error.message}`);
  }
};

// ─── Admin notifications ──────────────────────────────────────────────────────
// Admin-relevant events fan out to every active admin (and never to clients or
// freelancers). The recipient scope comes from `adminRecipientFilter()`; each
// admin receives their own notification so read state is independent per admin.

export const notifyAdmins = async ({
  sender = null,
  type,
  title,
  message,
  data = {},
  actionUrl = '',
  resourceType = null,
  resourceId = null,
  category = null,
  priority = 'medium',
  uniqueKey = null,
}) => {
  const admins = await User.find(adminRecipientFilter()).select('_id').lean();
  const notifications = await Promise.all(
    admins.map((admin) =>
      createNotification({
        recipient: admin._id,
        sender,
        type,
        title,
        message,
        data,
        actionUrl,
        resourceType,
        resourceId,
        category,
        priority,
        uniqueKey,
      })
    )
  );
  return notifications;
};

// ─── Convenience wrappers (all use real event data) ─────────────────────────

export const notifyJobApplication = async (clientId, freelancer, job) => {
  return createNotification({
    recipient: clientId,
    sender: freelancer._id,
    type: 'job_application_received',
    title: 'New Proposal Received',
    message: `${freelancer.firstName} ${freelancer.lastName} submitted a proposal for "${job.title}".`,
    actionUrl: `/client/jobs/${job._id}/applicants`,
    resourceType: 'application',
    resourceId: job._id,
    category: 'job',
    data: { jobId: job._id, freelancerId: freelancer._id },
    uniqueKey: `job_application_${job._id}_${freelancer._id}`,
  });
};

export const notifyApplicationStatus = async (freelancerId, client, job, status, appId) => {
  const map = {
    accepted: { type: 'job_application_accepted', title: 'Proposal Accepted', message: `Your proposal for "${job.title}" was accepted.` },
    rejected: { type: 'job_application_rejected', title: 'Proposal Update', message: `Your proposal for "${job.title}" was not selected.` },
    shortlisted: { type: 'job_application_shortlisted', title: 'Proposal Shortlisted', message: `Your proposal for "${job.title}" has been shortlisted.` },
    viewed: { type: 'job_application_viewed', title: 'Proposal Viewed', message: `${client.firstName} viewed your proposal for "${job.title}".` },
    withdrawn: { type: 'job_application_withdrawn', title: 'Proposal Withdrawn', message: `Your proposal for "${job.title}" was withdrawn.` },
  };

  const meta = map[status] || map.rejected;
  const detailUrl = `/freelancer/proposals/${appId || ''}`;

  return createNotification({
    recipient: freelancerId,
    sender: client._id,
    type: meta.type,
    title: meta.title,
    message: meta.message,
    actionUrl: detailUrl,
    resourceType: 'application',
    resourceId: appId || job._id,
    category: 'job',
    data: { jobId: job._id, status },
    uniqueKey: `application_status_${appId || job._id}_${status}`,
  });
};

export const notifyJobInvitation = async (freelancerId, client, job) => {
  return createNotification({
    recipient: freelancerId,
    sender: client._id,
    type: 'job_invitation',
    title: 'New Job Invitation',
    message: `You've been invited to apply for "${job.title}".`,
    actionUrl: `/jobs/${job._id}`,
    resourceType: 'job',
    resourceId: job._id,
    category: 'job',
    data: { jobId: job._id, clientId: client._id },
    uniqueKey: `job_invitation_${job._id}_${freelancerId}`,
  });
};

export const notifyNewMessage = async (recipientId, senderId, senderName, conversationId) => {
  return createNotification({
    recipient: recipientId,
    sender: senderId,
    type: 'new_message',
    title: 'New Message',
    message: `${senderName} sent you a message`,
    actionUrl: `/messages/${conversationId}`,
    resourceType: 'message',
    resourceId: conversationId,
    category: 'message',
    data: { conversationId },
    uniqueKey: `message_${conversationId}_${senderId}`,
  });
};

const MILESTONE_STATUS_MAP = {
  funded: { type: 'project_milestone_funded', title: 'Milestone Funded', message: (t) => `Milestone "${t}" has been funded.` },
  submitted: { type: 'project_milestone_submitted', title: 'Milestone Submitted', message: (t) => `Work was submitted for milestone "${t}".` },
  approved: { type: 'project_milestone_approved', title: 'Milestone Approved', message: (t) => `Your client approved milestone "${t}".` },
  released: { type: 'project_milestone_released', title: 'Payment Released', message: (t, a) => a ? `${formatAmount(a)} was released for your completed milestone "${t}".` : `Payment was released for milestone "${t}".` },
  revision_requested: { type: 'project_milestone_revision', title: 'Revision Requested', message: (t) => `Revision requested for milestone "${t}".` },
};

const formatAmount = (amount) => {
  const n = Number(amount);
  if (Number.isNaN(n)) return '';
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ETB`;
};

export const notifyMilestoneUpdate = async ({
  recipientId, senderId, projectTitle, milestoneTitle, status, projectId, milestoneId, amount,
}) => {
  const meta = MILESTONE_STATUS_MAP[status] || MILESTONE_STATUS_MAP.funded;
  const url = projectId ? `/projects/${projectId}` : `/projects`;

  return createNotification({
    recipient: recipientId,
    sender: senderId,
    type: meta.type,
    title: meta.title,
    message: meta.message(milestoneTitle, amount),
    actionUrl: url,
    resourceType: 'milestone',
    resourceId: milestoneId || projectId || null,
    category: 'project',
    data: { projectTitle, milestoneTitle, status, projectId, milestoneId, amount: amount ?? null },
    uniqueKey: `milestone_${milestoneId || milestoneTitle || projectTitle}_${status}`,
  });
};

export const notifyMilestoneCreated = async (freelancerId, client, project, milestone) => {
  return createNotification({
    recipient: freelancerId,
    sender: client._id,
    type: 'project_milestone_created',
    title: 'New Milestone',
    message: `A new milestone "${milestone.title}" was created for the project "${project.title}".`,
    actionUrl: `/projects/${project._id}`,
    resourceType: 'milestone',
    resourceId: milestone._id,
    category: 'project',
    data: { projectId: project._id, milestoneId: milestone._id },
    uniqueKey: `milestone_created_${milestone._id}`,
  });
};

export const notifyProjectCompleted = async (userId, projectTitle, projectId) => {
  return createNotification({
    recipient: userId,
    type: 'project_completed',
    title: 'Project Completed',
    message: `Project "${projectTitle}" has been successfully completed.`,
    actionUrl: `/projects/${projectId}`,
    resourceType: 'project',
    resourceId: projectId,
    category: 'project',
    data: { projectTitle, projectId },
    uniqueKey: `project_completed_${projectId}`,
  });
};

// ─── Task notifications ───────────────────────────────────────────────────────
// Driven by real task events only (create/assign/status-change/delete/edit).

const TASK_EVENT_MAP = {
  assigned: { type: 'task_assigned', title: 'New Task Assigned', message: (t, p) => `A new task "${t}" was assigned to you in "${p}".` },
  started: { type: 'task_started', title: 'Task Started', message: (t, p) => `The freelancer started working on task "${t}" in "${p}".` },
  submitted_for_review: { type: 'task_review', title: 'Task Awaiting Review', message: (t, p) => `The freelancer marked task "${t}" as ready for review in "${p}".` },
  approved: { type: 'task_approved', title: 'Task Approved', message: (t, p) => `Your client approved task "${t}" in "${p}".` },
  revision_requested: { type: 'task_revision_requested', title: 'Changes Requested', message: (t, p) => `Your client requested changes on task "${t}" in "${p}".` },
  edited: { type: 'task_updated', title: 'Task Updated', message: (t, p) => `Task "${t}" in "${p}" was updated.` },
  deleted: { type: 'task_deleted', title: 'Task Removed', message: (t, p) => `Task "${t}" was removed from "${p}".` },
};

export const notifyTaskEvent = async ({
  recipientId,
  senderId,
  project,
  task,
  action,
}) => {
  const meta = TASK_EVENT_MAP[action];
  if (!meta) return null;
  const taskTitle = task?.title || 'Untitled task';
  return createNotification({
    recipient: recipientId,
    sender: senderId,
    type: meta.type,
    title: meta.title,
    message: meta.message(taskTitle, project.title),
    actionUrl: `/projects/${project._id}`,
    resourceType: 'project',
    resourceId: project._id,
    category: 'project',
    data: { projectId: project._id, projectTitle: project.title, taskId: task?._id, taskTitle, action },
    uniqueKey: `task_${task?._id || taskTitle}_${action}`,
  });
};

export const notifyTaskAssigned = async (freelancerId, clientId, project, task) =>
  notifyTaskEvent({ recipientId: freelancerId, senderId: clientId, project, task, action: 'assigned' });

export const notifyReviewReceived = async (userId, reviewerName, rating, reviewerId, revieweeId, projectId) => {
  return createNotification({
    recipient: userId,
    sender: reviewerId,
    type: 'review_received',
    title: 'New Review',
    message: `${reviewerName} left you a ${rating}-star review.`,
    actionUrl: revieweeId ? `/profile/${revieweeId}#reviews` : '/profile#reviews',
    resourceType: 'review',
    resourceId: projectId || null,
    category: 'social',
    data: { reviewerName, rating, reviewerId, projectId },
    uniqueKey: `review_${projectId || userId}_${reviewerId}`,
  });
};

export const notifyFollow = async (recipientId, follower) => {
  return createNotification({
    recipient: recipientId,
    sender: follower._id,
    type: 'new_follower',
    title: 'New Follower',
    message: `${follower.firstName} ${follower.lastName} started following you.`,
    actionUrl: `/profile/${follower._id}`,
    resourceType: 'user',
    resourceId: follower._id,
    category: 'social',
    data: { followerId: follower._id },
    uniqueKey: `follow_${follower._id}_${recipientId}`,
  });
};

// ─── Meeting notifications ────────────────────────────────────────────────────
// actionUrl is resolved per recipient role so a click lands on the right page:
// freelancers see the calendar, clients see their meeting list.
const meetingActionUrl = (recipientRole) => (recipientRole === 'freelancer' ? '/freelancer/calendar' : '/client/meetings');

export const notifyMeetingCreated = async (recipientId, sender, meeting, recipientRole = null) => {
  const role = recipientRole || (meeting.freelancer === recipientId ? 'freelancer' : null);
  const senderName = sender && `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'A client';
  return createNotification({
    recipient: recipientId,
    sender: sender?._id,
    type: 'meeting_request',
    title: 'New Meeting Request',
    message: `${senderName} requested a meeting: ${meeting.title}${meeting.freelancer ? '' : ''}`,
    actionUrl: meetingActionUrl(role || 'freelancer'),
    resourceType: 'meeting',
    resourceId: meeting._id,
    category: 'social',
    data: { meetingId: meeting._id },
    uniqueKey: `meeting_request_${meeting._id}`,
  });
};

export const notifyMeetingAccepted = async (recipientId, sender, meeting, recipientRole = 'client', status = 'accepted') => {
  const senderName = sender && `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'The freelancer';
  return createNotification({
    recipient: recipientId,
    sender: sender?._id,
    type: 'meeting_accepted',
    title: 'Meeting Accepted',
    message: `${senderName} accepted your meeting request: ${meeting.title}`,
    actionUrl: meetingActionUrl(recipientRole),
    resourceType: 'meeting',
    resourceId: meeting._id,
    category: 'social',
    data: { meetingId: meeting._id, status },
    uniqueKey: `meeting_accepted_${meeting._id}`,
  });
};

export const notifyMeetingDeclined = async (recipientId, sender, meeting, recipientRole = 'client', status = 'declined') => {
  const senderName = sender && `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'The freelancer';
  return createNotification({
    recipient: recipientId,
    sender: sender?._id,
    type: 'meeting_declined',
    title: 'Meeting Declined',
    message: `${senderName} declined your meeting request: ${meeting.title}`,
    actionUrl: meetingActionUrl(recipientRole),
    resourceType: 'meeting',
    resourceId: meeting._id,
    category: 'social',
    data: { meetingId: meeting._id, status },
    uniqueKey: `meeting_declined_${meeting._id}`,
  });
};

export const notifyMeetingCancelled = async (recipientId, sender, meeting, recipientRole = 'freelancer', status = 'cancelled') => {
  const senderName = sender && `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'A participant';
  return createNotification({
    recipient: recipientId,
    sender: sender?._id,
    type: 'meeting_cancelled',
    title: 'Meeting Cancelled',
    message: `${senderName} cancelled the meeting: ${meeting.title}`,
    actionUrl: meetingActionUrl(recipientRole === 'client' ? 'client' : 'freelancer'),
    resourceType: 'meeting',
    resourceId: meeting._id,
    category: 'social',
    data: { meetingId: meeting._id, status },
    uniqueKey: `meeting_cancelled_${meeting._id}`,
  });
};

export const notifyMeetingCompleted = async (recipientId, sender, meeting, recipientRole = 'client', status = 'completed') => {
  const senderName = sender && `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'A participant';
  return createNotification({
    recipient: recipientId,
    sender: sender?._id,
    type: 'meeting_completed',
    title: 'Meeting Completed',
    message: `${senderName} marked the meeting as completed: ${meeting.title}`,
    actionUrl: meetingActionUrl(recipientRole),
    resourceType: 'meeting',
    resourceId: meeting._id,
    category: 'social',
    data: { meetingId: meeting._id, status },
    uniqueKey: `meeting_completed_${meeting._id}`,
  });
};

export const notifyMeetingReminder = async (recipientId, meeting, windowLabel) => {
  return createNotification({
    recipient: recipientId,
    sender: null,
    type: 'meeting_reminder',
    title: 'Upcoming Meeting',
    message: `Reminder: "${meeting.title}" starts in ${windowLabel}.`,
    actionUrl: `/freelancer/calendar`,
    resourceType: 'meeting',
    resourceId: meeting._id,
    category: 'social',
    data: { meetingId: meeting._id, startTime: meeting.startTime },
    uniqueKey: `meeting_reminder_${meeting._id}_${windowLabel}`,
  });
};

// Backward-compatible aliases used by the legacy profile routes.
export const notifyMeetingRequest = notifyMeetingCreated;
export const notifyMeetingStatus = async (recipientId, sender, meeting, status) => {
  const map = {
    accepted: notifyMeetingAccepted,
    declined: notifyMeetingDeclined,
    cancelled: notifyMeetingCancelled,
    completed: notifyMeetingCompleted,
  };
  const fn = map[status];
  if (!fn) return null;
  const target = meeting.freelancer === recipientId ? { user: meeting.client, role: 'client' } : { user: meeting.freelancer, role: 'freelancer' };
  return fn(recipientId, sender, meeting, target.role, status);
};

export const notifyFreelancerAvailable = async (recipientId, freelancer) => {
  return createNotification({
    recipient: recipientId,
    sender: freelancer._id,
    type: 'freelancer_available',
    title: 'Freelancer Available',
    message: `${freelancer.firstName} ${freelancer.lastName} is now available for work.`,
    actionUrl: `/profile/${freelancer._id}`,
    resourceType: 'user',
    resourceId: freelancer._id,
    category: 'social',
    data: { userId: freelancer._id },
    uniqueKey: `freelancer_available_${freelancer._id}`,
  });
};

export const notifyPaymentReceived = async (userId, amount, currency, description) => {
  return createNotification({
    recipient: userId,
    type: 'payment_received',
    title: 'Payment Received',
    message: `You received ${currency || 'ETB'} ${Number(amount).toFixed(2)} — ${description}`,
    actionUrl: `/payments/wallet`,
    resourceType: 'payment',
    category: 'payment',
    data: { amount, currency },
  });
};

export const notifyEscrowReleased = async (freelancerId, grossAmount, netAmount, commission, rate) => {
  return createNotification({
    recipient: freelancerId,
    type: 'escrow_released',
    title: 'Payment Released',
    message: `Payment of ${formatAmount(grossAmount)} was released. Commission: ${(rate * 100).toFixed(0)}% (${formatAmount(commission)}). Net: ${formatAmount(netAmount)}`,
    actionUrl: `/payments/wallet`,
    resourceType: 'payment',
    category: 'payment',
    data: { grossAmount, netAmount, commission, rate },
  });
};

export const notifyWithdrawalRequested = async (userId, amount, method) => {
  return createNotification({
    recipient: userId,
    type: 'withdrawal_requested',
    title: 'Withdrawal Requested',
    message: `Withdrawal of ${formatAmount(amount)} via ${method} has been requested.`,
    actionUrl: `/payments/wallet`,
    resourceType: 'withdrawal',
    category: 'payment',
    data: { amount, method },
  });
};

export const notifyWithdrawalCompleted = async (userId, amount, method) => {
  return createNotification({
    recipient: userId,
    type: 'withdrawal_completed',
    title: 'Withdrawal Completed',
    message: `Withdrawal of ${formatAmount(amount)} via ${method} has been completed.`,
    actionUrl: `/payments/wallet`,
    resourceType: 'withdrawal',
    category: 'payment',
    data: { amount, method },
  });
};

export const notifyWithdrawalFailed = async (userId, amount, reason) => {
  return createNotification({
    recipient: userId,
    type: 'payment_failed',
    title: 'Withdrawal Failed',
    message: `Withdrawal of ${formatAmount(amount)} failed: ${reason}`,
    actionUrl: `/payments/wallet`,
    resourceType: 'withdrawal',
    category: 'payment',
    data: { amount, reason },
  });
};

export const notifyEscrowFunded = async (freelancerId, amount, projectTitle) => {
  return createNotification({
    recipient: freelancerId,
    type: 'escrow_funded',
    title: 'Escrow Funded',
    message: `Client funded escrow of ${formatAmount(amount)} for ${projectTitle || 'a project'}.`,
    actionUrl: `/payments/escrow`,
    resourceType: 'escrow',
    category: 'payment',
    data: { amount, projectTitle },
  });
};

export const notifyCommissionDeducted = async (userId, amount, rate) => {
  return createNotification({
    recipient: userId,
    type: 'payment_sent',
    title: 'Commission Deducted',
    message: `Platform commission of ${formatAmount(amount)} (${(rate * 100).toFixed(0)}%) deducted.`,
    actionUrl: `/payments/wallet`,
    resourceType: 'payment',
    category: 'payment',
    data: { amount, rate },
  });
};

// ─── Service Order notifications ─────────────────────────────────────────────
// All of these are driven by real, persisted order events.

const orderUrl = (order) => `/services/orders/${order._id}`;

export const notifyOrderPlaced = async (order, client) => {
  return createNotification({
    recipient: order.freelancer,
    sender: order.client,
    type: 'order_placed',
    title: 'New Service Order',
    message: `${client.firstName} ${client.lastName} placed an order: "${order.title}".`,
    actionUrl: orderUrl(order),
    resourceType: 'serviceOrder',
    resourceId: order._id,
    category: 'project',
    data: { orderId: order._id, serviceId: order.service },
    uniqueKey: `order_placed_${order._id}`,
  });
};

export const notifyOrderFunded = async (order) => {
  return createNotification({
    recipient: order.freelancer,
    sender: order.client,
    type: 'order_funded',
    title: 'Order Funded',
    message: `Your client funded ${formatAmount(order.budget.amount)} for "${order.title}". Review and accept the order to start.`,
    actionUrl: orderUrl(order),
    resourceType: 'serviceOrder',
    resourceId: order._id,
    category: 'payment',
    data: { orderId: order._id, amount: order.budget.amount },
    uniqueKey: `order_funded_${order._id}`,
  });
};

export const notifyOrderAccepted = async (order, freelancer) => {
  return createNotification({
    recipient: order.client,
    sender: order.freelancer,
    type: 'order_accepted',
    title: 'Order Accepted',
    message: `${freelancer.firstName} ${freelancer.lastName} accepted your order "${order.title}". Work has started.`,
    actionUrl: orderUrl(order),
    resourceType: 'serviceOrder',
    resourceId: order._id,
    category: 'project',
    data: { orderId: order._id, projectId: order.project },
    uniqueKey: `order_accepted_${order._id}`,
  });
};

export const notifyOrderDeclined = async (order, freelancer) => {
  return createNotification({
    recipient: order.client,
    sender: order.freelancer,
    type: 'order_declined',
    title: 'Order Declined',
    message: `${freelancer.firstName} ${freelancer.lastName} declined your order "${order.title}". Your payment was refunded to your wallet.`,
    actionUrl: orderUrl(order),
    resourceType: 'serviceOrder',
    resourceId: order._id,
    category: 'project',
    data: { orderId: order._id },
    uniqueKey: `order_declined_${order._id}`,
  });
};

export const notifyOrderDeliverySubmitted = async (order, freelancer) => {
  return createNotification({
    recipient: order.client,
    sender: order.freelancer,
    type: 'order_delivery_submitted',
    title: 'Delivery Submitted',
    message: `${freelancer.firstName} ${freelancer.lastName} submitted a delivery for "${order.title}".`,
    actionUrl: orderUrl(order),
    resourceType: 'serviceOrder',
    resourceId: order._id,
    category: 'project',
    data: { orderId: order._id, projectId: order.project },
    uniqueKey: `order_delivery_${order._id}`,
  });
};

export const notifyOrderRevisionRequested = async (order, client) => {
  return createNotification({
    recipient: order.freelancer,
    sender: order.client,
    type: 'order_revision_requested',
    title: 'Revision Requested',
    message: `${client.firstName} ${client.lastName} requested revisions on "${order.title}".`,
    actionUrl: orderUrl(order),
    resourceType: 'serviceOrder',
    resourceId: order._id,
    category: 'project',
    data: { orderId: order._id, projectId: order.project },
    uniqueKey: `order_revision_${order._id}`,
  });
};

export const notifyOrderCompleted = async (order) => {
  return createNotification({
    recipient: order.freelancer,
    sender: order.client,
    type: 'order_completed',
    title: 'Order Completed',
    message: `Order "${order.title}" was completed. Payment of ${formatAmount(order.budget.amount)} was released to your wallet.`,
    actionUrl: orderUrl(order),
    resourceType: 'serviceOrder',
    resourceId: order._id,
    category: 'project',
    data: { orderId: order._id, projectId: order.project },
    uniqueKey: `order_completed_${order._id}`,
  });
};

export const notifyOrderCancelled = async (order, client) => {
  return createNotification({
    recipient: order.freelancer,
    sender: order.client,
    type: 'order_cancelled',
    title: 'Order Cancelled',
    message: `Order "${order.title}" was cancelled by ${client.firstName} ${client.lastName}.`,
    actionUrl: orderUrl(order),
    resourceType: 'serviceOrder',
    resourceId: order._id,
    category: 'project',
    data: { orderId: order._id },
    uniqueKey: `order_cancelled_${order._id}`,
  });
};

export const notifyOrderReviewReceived = async (order, reviewerName, rating) => {
  return createNotification({
    recipient: order.freelancer,
    sender: order.client,
    type: 'order_review_received',
    title: 'New Service Review',
    message: `${reviewerName} left a ${rating}-star review for "${order.title}".`,
    actionUrl: orderUrl(order),
    resourceType: 'serviceOrder',
    resourceId: order._id,
    category: 'social',
    data: { orderId: order._id, rating },
    uniqueKey: `order_review_${order._id}`,
  });
};

export const notifyOrderDisputeReported = async (order, reporter) => {
  return notifyAdmins({
    sender: reporter._id,
    type: 'order_disputed',
    title: 'Service Order Dispute',
    message: `${reporter.firstName} ${reporter.lastName} reported a problem with order "${order.title}".`,
    actionUrl: '/admin/services/orders?status=disputed',
    resourceType: 'serviceOrder',
    resourceId: order._id,
    category: 'system',
    priority: 'high',
    data: { orderId: order._id, reporterId: reporter._id, reporterName: `${reporter.firstName} ${reporter.lastName}` },
    uniqueKey: `order_disputed_${order._id}`,
  });
};

// ─── Admin: reports / abuse / policy violations ───────────────────────────────
// Called from report.controller when a real report is persisted. The message
// only carries non-sensitive, admin-appropriate context (resource type, reason
// and reporter id), never credentials or financial details.
export const notifyAdminsReportSubmitted = async ({ report, reporter }) => {
  const reporterName = reporter ? `${reporter.firstName || ''} ${reporter.lastName || ''}`.trim() : '';
  const subject = String(report.resourceType || 'content').replace(/_/g, ' ');
  return notifyAdmins({
    sender: reporter?._id || null,
    type: 'report_submitted',
    title: 'New User Report',
    message: `${reporterName || 'A user'} reported a ${subject}${report.reason ? ` (${report.reason})` : ''}.`,
    actionUrl: '/admin/reports',
    resourceType: 'report',
    resourceId: report._id,
    category: 'system',
    priority: report.priority === 'critical' || report.priority === 'urgent' ? 'urgent' : report.priority === 'high' ? 'high' : 'medium',
    data: { reportId: report._id, resourceType: report.resourceType, resourceId: report.resourceId, reason: report.reason, reporterId: report.reporter },
    uniqueKey: `report_submitted_${report._id}`,
  });
};

// ─── Admin: withdrawal requests ───────────────────────────────────────────────
// Withdrawals sit in 'processing' until an admin releases them, so a request is
// a genuine admin action item.
export const notifyAdminsWithdrawalRequested = async ({ user, amount, method, transactionRef }) => {
  return notifyAdmins({
    sender: user?._id || null,
    type: 'withdrawal_requested',
    title: 'Withdrawal Requested',
    message: `${user?.firstName || 'A user'} ${user?.lastName || ''} requested a withdrawal of ${formatAmount(amount)} via ${method}.`,
    actionUrl: '/admin/finance/withdrawals',
    resourceType: 'withdrawal',
    category: 'payment',
    priority: 'medium',
    data: { amount, method, transactionRef: transactionRef || null, userId: user?._id },
    uniqueKey: `withdrawal_requested_admin_${transactionRef || 'unknown'}`,
  });
};

// ─── Admin: freelancer verification requests ──────────────────────────────────
// Every new / resubmitted verification needs an admin review.
export const notifyAdminsVerificationSubmitted = async ({ verification, user }) => {
  return notifyAdmins({
    sender: user?._id || null,
    type: 'verification_submitted',
    title: 'Verification Submitted',
    message: `${user?.firstName || 'A user'} ${user?.lastName || ''} submitted a ${verification.type} verification for review.`,
    actionUrl: '/admin/verifications',
    resourceType: 'verification',
    resourceId: verification._id,
    category: 'system',
    priority: 'medium',
    data: { verificationId: verification._id, type: verification.type },
    uniqueKey: `verification_submitted_${verification._id}`,
  });
};
