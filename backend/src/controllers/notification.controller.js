import { Notification, NotificationPreferences } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { buildNotificationFilter, buildUnreadFilter } from '../utils/notificationQuery.js';
import {
  runAllAiNotifications,
  generateJobMatchNotifications,
  generateSkillRecommendations,
  generateEarningInsights,
  generateProfileTips,
  generateWeeklyDigest,
  resetDailyAiCounts,
} from '../services/aiNotification.service.js';

// ─── Get Notifications (enhanced) ────────────────────────────────────────────
export const getNotifications = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { unreadOnly, category, type, includeAi, aiOnly, priority } = req.query;

  const filter = buildNotificationFilter({
    userId: req.user._id,
    unreadOnly: unreadOnly === 'true',
    category,
    aiOnly: aiOnly === 'true',
    includeAi: includeAi !== 'false',
    type,
    priority,
  });

  // Scoped unread count built from the SAME filter (minus the read flag) so
  // the page header ("N notifications · M unread") always matches the records
  // the endpoint returns for the current category / AI / priority scope.
  const scopedUnreadFilter = buildUnreadFilter({
    userId: req.user._id,
    category,
    aiOnly: aiOnly === 'true',
    includeAi: includeAi !== 'false',
  });

  const [total, unread, notifications] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments(scopedUnreadFilter),
    Notification.find(filter)
      .populate('sender', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  sendResponse(res, 200, 'Notifications fetched', notifications, {
    ...paginationMeta(total, page, limit),
    unread,
  });
});

// ─── Get AI Recommendations ──────────────────────────────────────────────────
export const getAiRecommendations = catchAsync(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const filter = {
    recipient: req.user._id,
    isAiGenerated: true,
    isDismissed: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  };

  const total = await Notification.countDocuments(filter);
  const recommendations = await Notification.find(filter)
    .sort({ priority: 1, createdAt: -1 })
    .limit(limit);

  // Priority sort: urgent > high > medium > low
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

  sendResponse(res, 200, 'AI recommendations fetched', recommendations, paginationMeta(total, 1, limit));
});

// ─── Dismiss AI Notification ─────────────────────────────────────────────────
export const dismissNotification = catchAsync(async (req, res) => {
  const { notificationId } = req.params;
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: req.user._id },
    { isDismissed: true },
    { new: true }
  );
  if (!notification) throw new ApiError(404, 'Notification not found');
  sendResponse(res, 200, 'Notification dismissed');
});

// ─── Mark As Read (enhanced) ─────────────────────────────────────────────────
export const markAsRead = catchAsync(async (req, res) => {
  const { notificationId } = req.params;
  await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: req.user._id },
    { isRead: true, readAt: new Date() }
  );
  sendResponse(res, 200, 'Notification marked as read');
});

// ─── Mark All As Read (enhanced) ─────────────────────────────────────────────
export const markAllAsRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  sendResponse(res, 200, 'All notifications marked as read');
});

// ─── Delete Notification ─────────────────────────────────────────────────────
export const deleteNotification = catchAsync(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.notificationId,
    recipient: req.user._id,
  });
  if (!notification) throw new ApiError(404, 'Notification not found');
  sendResponse(res, 200, 'Notification deleted');
});

// ─── Get Unread Count ────────────────────────────────────────────────────────
// Accepts the same scoping params as the list endpoint (category, aiOnly) so
// callers can show a per-filter unread number. Called without params it returns
// the global unread count used by the navbar bell.
export const getUnreadCount = catchAsync(async (req, res) => {
  const { category, aiOnly, includeAi } = req.query;

  const baseFilter = buildUnreadFilter({
    userId: req.user._id,
    category,
    aiOnly: aiOnly === 'true',
    includeAi: includeAi !== 'false',
  });

  const [totalCount, aiCount, categoryCounts] = await Promise.all([
    Notification.countDocuments(baseFilter),
    Notification.countDocuments({ ...baseFilter, isAiGenerated: true }),
    Notification.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ]);

  const byCategory = {};
  categoryCounts.forEach(c => { byCategory[c._id || 'other'] = c.count; });

  sendResponse(res, 200, 'Unread count fetched', {
    total: totalCount,
    ai: aiCount,
    byCategory,
  });
});

// ─── Get Notification Preferences ────────────────────────────────────────────
export const getPreferences = catchAsync(async (req, res) => {
  let prefs = await NotificationPreferences.findOne({ user: req.user._id });
  if (!prefs) {
    prefs = await NotificationPreferences.create({ user: req.user._id });
  }
  sendResponse(res, 200, 'Preferences fetched', prefs);
});

// ─── Update Notification Preferences ─────────────────────────────────────────
export const updatePreferences = catchAsync(async (req, res) => {
  const { channels, categories, aiPreferences } = req.body;

  // Merge only the provided keys (dot-notation) instead of replacing whole
  // subdocuments, so a save can never silently wipe a hidden preference key
  // (e.g. `jobs` / `aiRecommendations`) that the current UI does not expose.
  const update = {};
  Object.entries(channels || {}).forEach(([k, v]) => { update[`channels.${k}`] = v; });
  Object.entries(categories || {}).forEach(([k, v]) => { update[`categories.${k}`] = v; });
  Object.entries(aiPreferences || {}).forEach(([k, v]) => { update[`aiPreferences.${k}`] = v; });

  const prefs = await NotificationPreferences.findOneAndUpdate(
    { user: req.user._id },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  sendResponse(res, 200, 'Preferences updated', prefs);
});

// ─── Trigger AI Notification Generation (admin/manual) ───────────────────────
export const triggerAiNotifications = catchAsync(async (req, res) => {
  // Run async — don't block response
  runAllAiNotifications().catch(() => {});
  sendResponse(res, 200, 'AI notification generation triggered');
});

// ─── Trigger Specific AI Notification Type ───────────────────────────────────
export const triggerSpecificAi = catchAsync(async (req, res) => {
  const { type } = req.params;

  const generators = {
    'job-matches': generateJobMatchNotifications,
    'skill-recommendations': generateSkillRecommendations,
    'earning-insights': generateEarningInsights,
    'profile-tips': generateProfileTips,
    'weekly-digest': generateWeeklyDigest,
  };

  const generator = generators[type];
  if (!generator) throw new ApiError(400, `Unknown AI notification type: ${type}`);

  generator().catch(() => {});
  sendResponse(res, 200, `AI notification generation triggered: ${type}`);
});

// ─── Reset Daily AI Counts (admin) ───────────────────────────────────────────
export const resetDailyCounts = catchAsync(async (req, res) => {
  await resetDailyAiCounts();
  sendResponse(res, 200, 'Daily AI notification counts reset');
});

// ─── Get AI Notification Stats (admin) ───────────────────────────────────────
export const getAiStats = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const matchFilter = { isAiGenerated: true };
  if (startDate || endDate) {
    matchFilter.createdAt = {};
    if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
    if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
  }

  const [typeBreakdown, totalStats, dailyTrend] = await Promise.all([
    Notification.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$type', count: { $sum: 1 }, avgConfidence: { $avg: '$aiConfidence' } } },
      { $sort: { count: -1 } },
    ]),
    Notification.aggregate([
      { $match: matchFilter },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        read: { $sum: { $cond: ['$isRead', 1, 0] } },
        dismissed: { $sum: { $cond: ['$isDismissed', 1, 0] } },
        clicked: { $sum: { $cond: [{ $gt: ['$actionUrl', ''] }, 1, 0] } },
      } },
    ]),
    Notification.aggregate([
      { $match: { ...matchFilter, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        readCount: { $sum: { $cond: ['$isRead', 1, 0] } },
      } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const stats = totalStats[0] || { total: 0, read: 0, dismissed: 0, clicked: 0 };
  const readRate = stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0;
  const clickRate = stats.total > 0 ? Math.round((stats.clicked / stats.total) * 100) : 0;

  sendResponse(res, 200, 'AI notification stats fetched', {
    overview: { ...stats, readRate, clickRate },
    byType: typeBreakdown,
    dailyTrend,
  });
});
