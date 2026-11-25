import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_TABS,
  RECOMMENDATIONS_TAB,
  CATEGORY_IDS,
  isCategoryTab,
  buildNotificationQuery,
  notificationMatchesTab,
  filterNotifications,
  normalizeCategory,
  notificationSummary,
  unreadCountQuery,
  resourceTypeLabel,
  entityLabel,
  notificationTarget,
  hasNotificationTarget,
  DEFAULT_NOTIFICATION_TARGET,
} from '../notificationFilters.js';

test('exposes the expected tabs and category ids', () => {
  assert.deepEqual(
    NOTIFICATION_TABS.map((t) => t.id),
    ['all', 'job', 'project', 'message', 'payment', 'social', 'system']
  );
  assert.equal(RECOMMENDATIONS_TAB, 'ai');
  assert.deepEqual(CATEGORY_IDS, ['job', 'project', 'message', 'payment', 'social', 'system']);
  assert.equal(isCategoryTab('job'), true);
  assert.equal(isCategoryTab('all'), false);
  assert.equal(isCategoryTab('ai'), false);
  assert.equal(isCategoryTab('nonsense'), false);
});

test('buildNotificationQuery defaults to page 1 and excludes AI from the feed', () => {
  assert.deepEqual(buildNotificationQuery(), { page: 1, limit: 15, includeAi: 'false' });
});

test('buildNotificationQuery maps each category tab to its category param', () => {
  for (const id of CATEGORY_IDS) {
    const q = buildNotificationQuery({ activeTab: id });
    assert.equal(q.category, id, `category param for ${id}`);
  }
  assert.equal('category' in buildNotificationQuery({ activeTab: 'all' }), false);
  assert.equal('category' in buildNotificationQuery({ activeTab: RECOMMENDATIONS_TAB }), false);
});

test('buildNotificationQuery forwards unread-only and AI-only as server flags', () => {
  assert.equal(buildNotificationQuery({ unreadOnly: true }).unreadOnly, 'true');
  assert.equal('unreadOnly' in buildNotificationQuery({ unreadOnly: false }), false);

  const aiOnly = buildNotificationQuery({ aiOnly: true });
  assert.equal(aiOnly.aiOnly, 'true');
  assert.equal('includeAi' in aiOnly, false);

  const defaultFeed = buildNotificationQuery({ aiOnly: false });
  assert.equal(defaultFeed.includeAi, 'false');
  assert.equal('aiOnly' in defaultFeed, false);
});

test('buildNotificationQuery combines category + unread + AI filters and preserves paging', () => {
  const q = buildNotificationQuery({ activeTab: 'project', unreadOnly: true, aiOnly: true, page: 3, limit: 20 });
  assert.deepEqual(q, { page: 3, limit: 20, category: 'project', unreadOnly: 'true', aiOnly: 'true' });
});

test('notificationMatchesTab applies category, unread and AI predicates together', () => {
  const read = { _id: '1', category: 'project', isRead: true, isAiGenerated: false };
  const unread = { _id: '2', category: 'project', isRead: false, isAiGenerated: false };
  const unreadAi = { _id: '3', category: 'project', isRead: false, isAiGenerated: true };

  assert.equal(notificationMatchesTab(unread, { activeTab: 'project' }), true);
  assert.equal(notificationMatchesTab(read, { activeTab: 'project' }), true);
  assert.equal(notificationMatchesTab(unread, { activeTab: 'payment' }), false);
  assert.equal(notificationMatchesTab(read, { unreadOnly: true }), false);
  assert.equal(notificationMatchesTab(unread, { unreadOnly: true }), true);
  assert.equal(notificationMatchesTab(unread, { aiOnly: true }), false);
  assert.equal(notificationMatchesTab(unreadAi, { aiOnly: true }), true);
  assert.equal(notificationMatchesTab(unreadAi, { activeTab: 'project', unreadOnly: true, aiOnly: true }), true);
  assert.equal(notificationMatchesTab(read, { activeTab: 'project', unreadOnly: true, aiOnly: true }), false);
  assert.equal(notificationMatchesTab(null), false);
});

test('normalizeCategory treats legacy null category as system', () => {
  assert.equal(normalizeCategory({ category: null }), 'system');
  assert.equal(normalizeCategory({}), 'system');
  assert.equal(normalizeCategory({ category: 'job' }), 'job');
  assert.equal(normalizeCategory(undefined), 'system');
});

test('filterNotifications filters a mixed list without mutating it', () => {
  const list = [
    { _id: 'a', category: 'job', isRead: false, isAiGenerated: false },
    { _id: 'b', category: 'job', isRead: true, isAiGenerated: false },
    { _id: 'c', category: null, isRead: false, isAiGenerated: true },
  ];
  const out = filterNotifications(list, { activeTab: 'job', unreadOnly: true });
  assert.deepEqual(out.map((n) => n._id), ['a']);
  assert.equal(list.length, 3);
  assert.deepEqual(filterNotifications(list, { activeTab: 'system' }).map((n) => n._id), ['c']);
  assert.deepEqual(filterNotifications('not-an-array'), []);
});

test('notificationSummary keeps total and unread distinct with correct labels', () => {
  assert.deepEqual(notificationSummary({ total: 1, unread: 0 }), {
    total: 1,
    unread: 0,
    filtered: 1,
    totalLabel: '1 notification',
    unreadLabel: '0 unread',
  });
  const s = notificationSummary({ total: 5, unread: 3, filtered: 2 });
  assert.equal(s.total, 5);
  assert.equal(s.unread, 3);
  assert.equal(s.filtered, 2);
  assert.equal(s.totalLabel, '5 notifications');
  assert.equal(s.unreadLabel, '3 unread');
});

// ─── Scoped unread count ─────────────────────────────────────────────────────

test('unreadCountQuery scopes by category tab only for real categories', () => {
  assert.deepEqual(unreadCountQuery(), {});
  assert.deepEqual(unreadCountQuery({ activeTab: 'all' }), {});
  assert.deepEqual(unreadCountQuery({ activeTab: RECOMMENDATIONS_TAB }), {});
  assert.deepEqual(unreadCountQuery({ activeTab: 'payment' }), { category: 'payment' });
});

test('unreadCountQuery adds aiOnly only when requested', () => {
  assert.deepEqual(unreadCountQuery({ aiOnly: true }), { aiOnly: 'true' });
  assert.deepEqual(unreadCountQuery({ activeTab: 'system', aiOnly: true }), {
    category: 'system',
    aiOnly: 'true',
  });
  assert.deepEqual(unreadCountQuery({ activeTab: 'system', aiOnly: false }), { category: 'system' });
});

// ─── Related-entity labels ───────────────────────────────────────────────────

test('resourceTypeLabel renders friendly labels and tolerates legacy spellings', () => {
  assert.equal(resourceTypeLabel('serviceOrder'), 'Service order');
  assert.equal(resourceTypeLabel('service_order'), 'Service order');
  assert.equal(resourceTypeLabel('support_ticket'), 'Support ticket');
  assert.equal(resourceTypeLabel('contact_message'), 'Contact message');
  assert.equal(resourceTypeLabel('withdrawal'), 'Withdrawal');
  assert.equal(resourceTypeLabel('escrow'), 'Escrow');
  assert.equal(resourceTypeLabel('report'), 'Report');
});

test('resourceTypeLabel handles missing and unknown values safely', () => {
  assert.equal(resourceTypeLabel(null), null);
  assert.equal(resourceTypeLabel(undefined), null);
  assert.equal(resourceTypeLabel(''), null);
  assert.equal(resourceTypeLabel('some_custom_entity'), 'Some Custom Entity');
});

test('entityLabel reads resourceType from a notification', () => {
  assert.equal(entityLabel({ resourceType: 'withdrawal' }), 'Withdrawal');
  assert.equal(entityLabel({}), null);
  assert.equal(entityLabel(), null);
});

// ─── Navigation ──────────────────────────────────────────────────────────────

test('notificationTarget returns a usable deep link when present', () => {
  assert.equal(
    notificationTarget({ actionUrl: '/admin/reports' }),
    '/admin/reports'
  );
  assert.equal(
    notificationTarget({ actionUrl: '  /admin/verifications  ' }),
    '/admin/verifications'
  );
});

test('notificationTarget falls back for empty, blank or hash links', () => {
  assert.equal(notificationTarget({ actionUrl: '' }), DEFAULT_NOTIFICATION_TARGET);
  assert.equal(notificationTarget({ actionUrl: '#' }), DEFAULT_NOTIFICATION_TARGET);
  assert.equal(notificationTarget({ actionUrl: '   ' }), DEFAULT_NOTIFICATION_TARGET);
  assert.equal(notificationTarget({}), DEFAULT_NOTIFICATION_TARGET);
  assert.equal(notificationTarget(), DEFAULT_NOTIFICATION_TARGET);
  assert.equal(notificationTarget({ actionUrl: '#' }, '/custom'), '/custom');
});

test('hasNotificationTarget distinguishes real links from fallbacks', () => {
  assert.equal(hasNotificationTarget({ actionUrl: '/admin/reports' }), true);
  assert.equal(hasNotificationTarget({ actionUrl: '#' }), false);
  assert.equal(hasNotificationTarget({ actionUrl: '' }), false);
  assert.equal(hasNotificationTarget({}), false);
  assert.equal(hasNotificationTarget(), false);
});
