// Pure, DB-free helpers that decide whether a notification should be created
// for a recipient given their saved NotificationPreferences.
//
// Why this exists: the Settings page lets a user toggle delivery channels and
// per-category switches, and those choices are stored on the
// NotificationPreferences document. Historically the creation pipeline ignored
// them entirely, so every toggle was cosmetic. These helpers are the single
// source of truth that `createNotification` (and the AI notification service)
// consult before persisting/emitting a notification.
//
// Design rules:
// - A missing preferences document (e.g. an admin, or a brand-new user) means
//   "everything on" — we must never silently drop notifications just because a
//   row has not been created yet.
// - Security / account-critical notifications (category `system`, plus a small
//   explicit set of financial/security types) ALWAYS deliver, regardless of any
//   user preference, so someone can never switch off "your account was banned"
//   or a failed-payment alert.
// - In-app is the only channel that is actually delivered today (there is no
//   email/push provider wired for notifications). Channel toggles are therefore
//   still stored, but only `channels.inApp` can suppress creation.
// - A category that maps to no exposed preference key defaults to allowed.

import { resolveNotificationCategory } from './notificationCategory.js';

// The exact set of per-category keys stored on NotificationPreferences.categories.
export const NOTIFICATION_PREFERENCE_KEYS = Object.freeze([
  'jobs',
  'projects',
  'payments',
  'messages',
  'reviews',
  'aiRecommendations',
  'weeklyDigest',
  'systemAlerts',
  'jobInvitations',
  'jobMatches',
  'proposals',
  'contracts',
  'milestones',
  'serviceOrders',
  'catalogPerformance',
  'verification',
  'proposalUpdates',
  'freelancerMessages',
]);

// Explicit notification-type -> preference key map. Types not listed here fall
// back to the coarse category mapping below.
const TYPE_PREFERENCE_KEYS = Object.freeze({
  // Messages
  new_message: 'messages',

  // Job invitations / matches
  job_invitation: 'jobInvitations',
  ai_job_match: 'jobMatches',

  // Proposals / applications
  job_application_received: 'proposals',
  job_application_viewed: 'proposals',
  job_application_accepted: 'proposals',
  job_application_rejected: 'proposals',
  job_application_shortlisted: 'proposals',
  job_application_withdrawn: 'proposals',
  job_closed: 'proposals',

  // Projects / tasks
  project_started: 'projects',
  project_delivery_submitted: 'projects',
  project_delivery_approved: 'projects',
  project_delivery_revision: 'projects',
  project_completed: 'projects',
  project_cancelled: 'projects',
  task_assigned: 'projects',
  task_started: 'projects',
  task_review: 'projects',
  task_approved: 'projects',
  task_revision_requested: 'projects',
  task_updated: 'projects',
  task_deleted: 'projects',

  // Milestones
  project_milestone_funded: 'milestones',
  project_milestone_submitted: 'milestones',
  project_milestone_approved: 'milestones',
  project_milestone_released: 'milestones',
  project_milestone_revision: 'milestones',
  project_milestone_created: 'milestones',

  // Service orders
  order_placed: 'serviceOrders',
  order_accepted: 'serviceOrders',
  order_declined: 'serviceOrders',
  order_delivery_submitted: 'serviceOrders',
  order_revision_requested: 'serviceOrders',
  order_completed: 'serviceOrders',
  order_cancelled: 'serviceOrders',
  order_cancelled_admin: 'serviceOrders',
  order_completed_admin: 'serviceOrders',

  // Payments
  order_funded: 'payments',
  order_refunded: 'payments',
  order_refunded_admin: 'payments',
  payment_received: 'payments',
  payment_sent: 'payments',
  payment_failed: 'payments',
  withdrawal_requested: 'payments',
  withdrawal_completed: 'payments',
  escrow_funded: 'payments',
  escrow_released: 'payments',
  escrow_refunded: 'payments',
  commission_deducted: 'payments',
  refund_issued: 'payments',

  // Reviews
  review_received: 'reviews',
  review_replied: 'reviews',
  order_review_received: 'reviews',

  // Catalog performance
  catalog_moderated: 'catalogPerformance',
  catalog_featured: 'catalogPerformance',
  catalog_removed: 'catalogPerformance',

  // Verification / account status
  verification: 'verification',
  account_verified: 'verification',

  // System
  verification_submitted: 'systemAlerts',
  account_banned: 'systemAlerts',
  admin_announcement: 'systemAlerts',
  system_notification: 'systemAlerts',
  report_submitted: 'systemAlerts',
  report_resolved: 'systemAlerts',
  report_dismissed: 'systemAlerts',
  report_update: 'systemAlerts',
  contact_message_received: 'systemAlerts',
  support_ticket_created: 'systemAlerts',
  support_ticket_reply: 'systemAlerts',
  support_ticket_resolved: 'systemAlerts',
  content_warning: 'systemAlerts',

  // AI
  ai_skill_recommendation: 'aiRecommendations',
  ai_profile_tip: 'aiRecommendations',
  ai_earning_insight: 'aiRecommendations',
  ai_trend_alert: 'aiRecommendations',
  ai_competition_update: 'aiRecommendations',
  ai_price_suggestion: 'aiRecommendations',
  ai_portfolio_tip: 'aiRecommendations',
  ai_inactive_alert: 'aiRecommendations',
  ai_project_suggestion: 'projects',
  ai_deadline_reminder: 'projects',
  ai_weekly_digest: 'weeklyDigest',
});

// Coarse fallback: notification category -> preference key.
const CATEGORY_PREFERENCE_KEYS = Object.freeze({
  message: 'messages',
  job: 'jobs',
  project: 'projects',
  payment: 'payments',
  system: 'systemAlerts',
  ai: 'aiRecommendations',
  // `social` intentionally maps to no key (it covers follows / meetings / etc.
  // which have no dedicated toggle) so it always delivers.
});

// Security/financial notifications that must always be delivered.
const CRITICAL_CATEGORIES = new Set(['system']);
const CRITICAL_TYPES = new Set([
  'account_banned',
  'account_verified',
  'payment_failed',
  'verification',
]);

const isCritical = (type, category) =>
  CRITICAL_CATEGORIES.has(category) || CRITICAL_TYPES.has(type);

/**
 * Resolve which NotificationPreferences.categories key governs a notification.
 * Returns null when the notification has no exposed toggle (always allowed).
 */
export const preferenceKeyFor = (type, category) => {
  if (type && TYPE_PREFERENCE_KEYS[type]) return TYPE_PREFERENCE_KEYS[type];
  const resolved = resolveNotificationCategory(type, category);
  return CATEGORY_PREFERENCE_KEYS[resolved] || null;
};

/**
 * Decide whether a notification may be created/emitted for a recipient.
 *
 * @param {object} args
 * @param {object|null} args.prefs - the recipient's NotificationPreferences
 *   (plain object or Mongoose doc), or null when none exists.
 * @param {string} args.type - the notification type.
 * @param {string|null} [args.category] - an explicit category override.
 * @returns {boolean} true when the notification should be delivered.
 */
export const shouldDeliverNotification = ({ prefs, type, category = null } = {}) => {
  // No preferences row yet -> everything is on by default.
  if (!prefs) return true;

  const resolvedCategory = resolveNotificationCategory(type, category);

  // Critical security / account alerts can never be switched off.
  if (isCritical(type, resolvedCategory)) return true;

  // In-app is the only real delivery channel today.
  if (prefs.channels && prefs.channels.inApp === false) return false;

  const key = preferenceKeyFor(type, resolvedCategory);
  if (key && prefs.categories && prefs.categories[key] === false) return false;

  return true;
};
