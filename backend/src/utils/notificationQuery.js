// Pure, DB-free helpers that describe how notification list / unread-count
// requests are filtered. Both the "list" and "unread count" endpoints build
// their Mongo filters here so the two always agree on the same result set, and
// so the behaviour is trivially unit-testable without a running database.
//
// Semantics (mirrored by the frontend `notificationFilters.js`):
// - `category` restricts to one category. Legacy documents created before the
//   `category` field existed have `category: null`, so they are matched by
//   their type instead (see `typesForCategory`).
// - `aiOnly` and `includeAi=false` are mutually exclusive; `aiOnly` wins.
// - Every notification is always scoped to a single `recipient` so one user
//   can never read another user's (or an admin's) notifications.

import { isNotificationCategory, typesForCategory, resolveNotificationCategory } from './notificationCategory.js';

const applyCategory = (filter, category) => {
  if (!isNotificationCategory(category)) return;
  const legacyTypes = typesForCategory(category);
  filter.$or = [
    { category },
    ...(legacyTypes.length ? [{ category: null, type: { $in: legacyTypes } }] : []),
  ];
};

/**
 * Build the Mongo filter for GET /notifications.
 */
export const buildNotificationFilter = ({
  userId = null,
  unreadOnly = false,
  category = null,
  aiOnly = false,
  includeAi = true,
  type = null,
  priority = null,
} = {}) => {
  const filter = {};
  if (userId) filter.recipient = userId;
  if (unreadOnly) filter.isRead = false;
  if (type) filter.type = type;
  if (priority) filter.priority = priority;

  // AI flag: aiOnly=true shows only AI-generated items, includeAi=false
  // excludes them. They are mutually exclusive; aiOnly wins if both are sent.
  if (aiOnly) filter.isAiGenerated = true;
  else if (includeAi === false) filter.isAiGenerated = { $ne: true };

  applyCategory(filter, category);
  return filter;
};

/**
 * Build the Mongo filter for GET /notifications/unread-count. Mirrors the list
 * filter (minus the read flag) so the returned "unread" number always matches
 * the records the list endpoint would return for the same scope.
 */
export const buildUnreadFilter = ({
  userId = null,
  category = null,
  aiOnly = false,
  includeAi = true,
} = {}) => {
  const filter = { isRead: false };
  if (userId) filter.recipient = userId;
  if (aiOnly) filter.isAiGenerated = true;
  else if (includeAi === false) filter.isAiGenerated = { $ne: true };
  applyCategory(filter, category);
  return filter;
};

/**
 * Recipient scope for admin notifications: every active admin, never clients
 * or freelancers.
 */
export const adminRecipientFilter = () => ({ role: 'admin', isActive: true });

/**
 * Assemble the persisted fields for a notification record. Used by
 * `createNotification` so the stored category always agrees with the shared
 * category resolver and so the payload (incl. the optional dedup key) is
 * shaped consistently.
 */
export const buildNotificationRecord = ({
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
  const payload = uniqueKey ? { ...data, uniqueKey } : data;
  return {
    recipient,
    sender,
    type,
    title,
    message,
    data: payload,
    actionUrl,
    resourceType,
    resourceId,
    category: resolveNotificationCategory(type, category),
    priority,
  };
};