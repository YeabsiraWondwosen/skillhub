// Central mapping between notification types and their UI category.
//
// Kept in ONE place so the model, the creation service and the query
// controller all agree on how a notification is categorised. An explicit,
// valid `category` always wins; otherwise the type map is consulted; a truly
// unknown type falls back to 'system' so a record is never dropped from the
// filtered views (unknown / legacy types are handled safely).

export const NOTIFICATION_CATEGORIES = ['system', 'job', 'project', 'payment', 'message', 'social', 'ai'];

const TYPE_CATEGORY_ENTRIES = {
  // ── Job / proposals ───────────────────────────────────────────────────────
  job_invitation: 'job',
  job_application_received: 'job',
  job_application_viewed: 'job',
  job_application_accepted: 'job',
  job_application_rejected: 'job',
  job_application_shortlisted: 'job',
  job_application_withdrawn: 'job',
  job_closed: 'job',

  // ── Projects / milestones / tasks ─────────────────────────────────────────
  project_started: 'project',
  project_milestone_funded: 'project',
  project_milestone_submitted: 'project',
  project_milestone_approved: 'project',
  project_milestone_released: 'project',
  project_milestone_revision: 'project',
  project_milestone_created: 'project',
  project_delivery_submitted: 'project',
  project_delivery_approved: 'project',
  project_delivery_revision: 'project',
  project_completed: 'project',
  project_cancelled: 'project',
  project_disputed: 'system',
  task_assigned: 'project',
  task_started: 'project',
  task_review: 'project',
  task_approved: 'project',
  task_revision_requested: 'project',
  task_updated: 'project',
  task_deleted: 'project',

  // ── Service orders ────────────────────────────────────────────────────────
  order_placed: 'project',
  order_funded: 'payment',
  order_accepted: 'project',
  order_declined: 'project',
  order_delivery_submitted: 'project',
  order_revision_requested: 'project',
  order_completed: 'project',
  order_cancelled: 'project',
  order_refunded: 'payment',
  order_disputed: 'system',
  order_review_received: 'social',
  order_cancelled_admin: 'project',
  order_refunded_admin: 'payment',
  order_completed_admin: 'project',
  dispute_resolved_admin: 'system',

  // ── Payments ──────────────────────────────────────────────────────────────
  payment_received: 'payment',
  payment_sent: 'payment',
  payment_failed: 'payment',
  withdrawal_requested: 'payment',
  withdrawal_completed: 'payment',
  escrow_funded: 'payment',
  escrow_released: 'payment',
  escrow_refunded: 'payment',
  commission_deducted: 'payment',
  refund_issued: 'payment',

  // ── Messages ──────────────────────────────────────────────────────────────
  new_message: 'message',

  // ── Reviews & social ──────────────────────────────────────────────────────
  review_received: 'social',
  review_replied: 'social',
  new_follower: 'social',
  freelancer_available: 'social',
  profile_viewed: 'social',
  meeting_request: 'social',
  meeting_accepted: 'social',
  meeting_declined: 'social',
  meeting_cancelled: 'social',
  meeting_completed: 'social',
  meeting_reminder: 'social',

  // ── Account / system / support ────────────────────────────────────────────
  account_verified: 'system',
  account_banned: 'system',
  admin_announcement: 'system',
  system_notification: 'system',
  verification: 'system',
  verification_submitted: 'system',
  report_submitted: 'system',
  report_resolved: 'system',
  report_dismissed: 'system',
  report_update: 'system',
  contact_message_received: 'system',
  support_ticket_created: 'system',
  support_ticket_reply: 'system',
  support_ticket_resolved: 'system',
  content_warning: 'system',
  catalog_moderated: 'system',
  catalog_featured: 'system',
  catalog_removed: 'system',

  // ── AI-generated ──────────────────────────────────────────────────────────
  ai_job_match: 'job',
  ai_skill_recommendation: 'ai',
  ai_profile_tip: 'ai',
  ai_earning_insight: 'payment',
  ai_project_suggestion: 'project',
  ai_deadline_reminder: 'project',
  ai_trend_alert: 'ai',
  ai_competition_update: 'ai',
  ai_weekly_digest: 'ai',
  ai_price_suggestion: 'payment',
  ai_portfolio_tip: 'ai',
  ai_inactive_alert: 'ai',
};

export const TYPE_TO_CATEGORY = Object.freeze(TYPE_CATEGORY_ENTRIES);

export const isNotificationCategory = (value) =>
  typeof value === 'string' && NOTIFICATION_CATEGORIES.includes(value);

/**
 * Resolve the category for a notification.
 * - explicit valid category wins
 * - otherwise derive from the type map
 * - otherwise fall back to 'system' (unknown / legacy safe)
 */
export const resolveNotificationCategory = (type, category) => {
  if (isNotificationCategory(category)) return category;
  if (type && TYPE_TO_CATEGORY[type]) return TYPE_TO_CATEGORY[type];
  return 'system';
};

// Types that historically belong to each category. Used to match legacy
// documents whose `category` was persisted as null before the field existed.
export const typesForCategory = (category) =>
  Object.entries(TYPE_TO_CATEGORY)
    .filter(([, cat]) => cat === category)
    .map(([type]) => type);
