import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNotificationFilter,
  buildUnreadFilter,
  adminRecipientFilter,
  buildNotificationRecord,
} from '../notificationQuery.js';

// ─── buildNotificationFilter ─────────────────────────────────────────────────

test('buildNotificationFilter always scopes to the caller recipient', () => {
  const filter = buildNotificationFilter({ userId: 'user-1' });
  assert.equal(filter.recipient, 'user-1');
  assert.equal('isRead' in filter, false);
  assert.equal('isAiGenerated' in filter, false);
  assert.equal('$or' in filter, false);
});

test('buildNotificationFilter applies unread-only, type and priority', () => {
  const filter = buildNotificationFilter({
    userId: 'u',
    unreadOnly: true,
    type: 'order_disputed',
    priority: 'high',
  });
  assert.equal(filter.isRead, false);
  assert.equal(filter.type, 'order_disputed');
  assert.equal(filter.priority, 'high');
});

test('buildNotificationFilter maps a known category to category OR legacy-null types', () => {
  const filter = buildNotificationFilter({ userId: 'u', category: 'system' });
  assert.ok(Array.isArray(filter.$or));
  assert.deepEqual(filter.$or[0], { category: 'system' });
  const legacy = filter.$or[1];
  assert.equal(legacy.category, null);
  assert.ok(legacy.type.$in.includes('order_disputed'));
  assert.ok(legacy.type.$in.includes('support_ticket_created'));
});

test('buildNotificationFilter ignores unknown / empty categories', () => {
  for (const category of ['all', 'unknown', '', null, undefined]) {
    const filter = buildNotificationFilter({ userId: 'u', category });
    assert.equal('$or' in filter, false, `category=${String(category)} should not filter`);
  }
});

test('buildNotificationFilter: aiOnly wins over includeAi and excludes nothing else', () => {
  const filter = buildNotificationFilter({ userId: 'u', aiOnly: true, includeAi: false });
  assert.equal(filter.isAiGenerated, true);
});

test('buildNotificationFilter: includeAi=false excludes AI without aiOnly', () => {
  const filter = buildNotificationFilter({ userId: 'u', aiOnly: false, includeAi: false });
  assert.deepEqual(filter.isAiGenerated, { $ne: true });
});

test('buildNotificationFilter: default keeps AI items (no isAiGenerated clause)', () => {
  const filter = buildNotificationFilter({ userId: 'u' });
  assert.equal('isAiGenerated' in filter, false);
});

test('buildNotificationFilter combines category + unread + AI filters together', () => {
  const filter = buildNotificationFilter({
    userId: 'u',
    unreadOnly: true,
    category: 'payment',
    aiOnly: true,
  });
  assert.equal(filter.recipient, 'u');
  assert.equal(filter.isRead, false);
  assert.equal(filter.isAiGenerated, true);
  assert.ok(filter.$or.some((clause) => clause.category === 'payment'));
});

// ─── buildUnreadFilter ───────────────────────────────────────────────────────

test('buildUnreadFilter always constrains to unread records and caller', () => {
  const filter = buildUnreadFilter({ userId: 'u' });
  assert.equal(filter.isRead, false);
  assert.equal(filter.recipient, 'u');
});

test('buildUnreadFilter mirrors the category legacy-null handling', () => {
  const filter = buildUnreadFilter({ userId: 'u', category: 'system' });
  assert.ok(filter.$or.some((clause) => clause.category === 'system'));
  assert.ok(filter.$or.some((clause) => clause.category === null));
});

test('buildUnreadFilter honours aiOnly', () => {
  assert.equal(buildUnreadFilter({ userId: 'u', aiOnly: true }).isAiGenerated, true);
  assert.equal('isAiGenerated' in buildUnreadFilter({ userId: 'u' }), false);
});

// ─── adminRecipientFilter ────────────────────────────────────────────────────

test('adminRecipientFilter only targets active admins', () => {
  assert.deepEqual(adminRecipientFilter(), { role: 'admin', isActive: true });
});

// ─── buildNotificationRecord ─────────────────────────────────────────────────

test('buildNotificationRecord resolves the category from the type map', () => {
  const record = buildNotificationRecord({
    recipient: 'admin-1',
    type: 'support_ticket_created',
    title: 't',
    message: 'm',
  });
  assert.equal(record.category, 'system');
  assert.equal(record.priority, 'medium');
  assert.equal(record.isRead, undefined);
});

test('buildNotificationRecord keeps an explicit valid category', () => {
  const record = buildNotificationRecord({
    recipient: 'u',
    type: 'order_placed',
    category: 'payment',
    title: 't',
    message: 'm',
  });
  assert.equal(record.category, 'payment');
});

test('buildNotificationRecord unknown types fall back to system (never dropped)', () => {
  const record = buildNotificationRecord({
    recipient: 'u',
    type: 'brand_new_event_type',
    title: 't',
    message: 'm',
  });
  assert.equal(record.category, 'system');
});

test('buildNotificationRecord preserves every real resourceType used in the codebase', () => {
  // These values previously failed the model's stale enum and were silently
  // swallowed, which is why admins only ever saw service-order disputes.
  const resourceTypes = ['serviceOrder', 'service_order', 'support_ticket', 'contact_message', 'withdrawal', 'escrow', 'report', 'verification'];
  for (const resourceType of resourceTypes) {
    const record = buildNotificationRecord({
      recipient: 'u',
      type: 'system_notification',
      resourceType,
      title: 't',
      message: 'm',
    });
    assert.equal(record.resourceType, resourceType);
  }
});

test('buildNotificationRecord folds the dedup key into data', () => {
  const record = buildNotificationRecord({
    recipient: 'u',
    type: 'report_submitted',
    title: 't',
    message: 'm',
    data: { reportId: 'r1' },
    uniqueKey: 'report_submitted_r1',
  });
  assert.deepEqual(record.data, { reportId: 'r1', uniqueKey: 'report_submitted_r1' });
});
