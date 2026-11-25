// Pure helpers describing the Notifications page filtering model.
//
// The real filtering happens server-side (the list endpoint accepts
// `category`, `unreadOnly` and `aiOnly`). These helpers build those query
// params and provide matching/count helpers so the behaviour is unit-testable
// without a running backend or React.
//
// Category ids mirror the backend `Notification.category` enum plus the
// dedicated `ai` recommendations tab.

export const NOTIFICATION_TABS = [
  { id: 'all', label: 'All Notifications' },
  { id: 'job', label: 'Proposals' },
  { id: 'project', label: 'Projects' },
  { id: 'message', label: 'Messages' },
  { id: 'payment', label: 'Payments' },
  { id: 'social', label: 'Social' },
  { id: 'system', label: 'System' },
];

export const RECOMMENDATIONS_TAB = 'ai';

export const CATEGORY_IDS = NOTIFICATION_TABS.map((t) => t.id).filter((id) => id !== 'all');

export const isCategoryTab = (tab) => CATEGORY_IDS.includes(tab);

/**
 * Build the query params sent to GET /notifications for the current controls.
 * Selecting a category tab, "Unread only" and "AI only" combine (AND).
 */
export const buildNotificationQuery = ({
  activeTab = 'all',
  unreadOnly = false,
  aiOnly = false,
  page = 1,
  limit = 15,
} = {}) => {
  const params = { page, limit };
  if (isCategoryTab(activeTab)) params.category = activeTab;
  if (unreadOnly) params.unreadOnly = 'true';
  // AI-generated items live in the dedicated recommendations tab, so the
  // standard feed excludes them unless the "AI only" filter is enabled.
  if (aiOnly) params.aiOnly = 'true';
  else params.includeAi = 'false';
  return params;
};

/**
 * Client-side predicate mirroring the server filters. Useful for optimistic
 * filtering and for tests. Unknown/legacy notifications (category null) are
 * treated as 'system'.
 */
export const normalizeCategory = (notification) =>
  notification?.category || 'system';

export const notificationMatchesTab = (
  notification,
  { activeTab = 'all', unreadOnly = false, aiOnly = false } = {}
) => {
  if (!notification) return false;
  if (unreadOnly && notification.isRead) return false;
  if (aiOnly && !notification.isAiGenerated) return false;
  if (isCategoryTab(activeTab) && normalizeCategory(notification) !== activeTab) return false;
  return true;
};

export const filterNotifications = (list = [], filters = {}) =>
  (Array.isArray(list) ? list : []).filter((n) => notificationMatchesTab(n, filters));

/**
 * Normalise the counts shown in the header from the server meta + unread
 * query so total and unread are never confused with each other.
 */
export const notificationSummary = ({ total = 0, unread = 0, filtered = null } = {}) => ({
  total,
  unread,
  filtered: filtered === null ? total : filtered,
  totalLabel: `${total} notification${total === 1 ? '' : 's'}`,
  unreadLabel: `${unread} unread`,
});

// ─── Scoped unread count ──────────────────────────────────────────────────────
// The unread-count endpoint accepts the same category / AI scoping as the list
// endpoint. This builds those params so a page header can show an unread number
// that matches the currently filtered records instead of the global total.

export const unreadCountQuery = ({
  activeTab = 'all',
  aiOnly = false,
} = {}) => {
  const params = {};
  if (isCategoryTab(activeTab)) params.category = activeTab;
  if (aiOnly) params.aiOnly = 'true';
  return params;
};

// ─── Related-entity labels ───────────────────────────────────────────────────
// The notification model stores `resourceType`/`resourceId` for the entity a
// notification refers to. These helpers render a stable, human-readable label
// and tolerate the historical value inconsistencies in stored records
// (e.g. 'service_order' vs 'serviceOrder').

const RESOURCE_TYPE_LABELS = {
  job: 'Job',
  application: 'Proposal',
  project: 'Project',
  milestone: 'Milestone',
  payment: 'Payment',
  message: 'Message',
  review: 'Review',
  user: 'User',
  serviceOrder: 'Service order',
  service_order: 'Service order',
  service: 'Service',
  catalog: 'Service',
  report: 'Report',
  meeting: 'Meeting',
  contact_message: 'Contact message',
  support_ticket: 'Support ticket',
  withdrawal: 'Withdrawal',
  escrow: 'Escrow',
  verification: 'Verification',
  transaction: 'Transaction',
};

export const resourceTypeLabel = (resourceType) => {
  if (!resourceType) return null;
  const key = String(resourceType);
  return RESOURCE_TYPE_LABELS[key] || key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const entityLabel = (notification = {}) => resourceTypeLabel(notification.resourceType);

// ─── Navigation ──────────────────────────────────────────────────────────────
// A notification should open its related page when it carries a usable deep
// link, and otherwise fall back to the notifications list (never an empty '#'
// link that leaves the user stranded).

export const DEFAULT_NOTIFICATION_TARGET = '/notifications';

export const notificationTarget = (notification, fallback = DEFAULT_NOTIFICATION_TARGET) => {
  const url = notification?.actionUrl;
  if (typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#') return fallback;
  return trimmed;
};

export const hasNotificationTarget = (notification) =>
  notificationTarget(notification, '') !== '';
