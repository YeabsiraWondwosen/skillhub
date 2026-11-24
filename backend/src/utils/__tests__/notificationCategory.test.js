import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_CATEGORIES,
  TYPE_TO_CATEGORY,
  isNotificationCategory,
  resolveNotificationCategory,
  typesForCategory,
} from '../notificationCategory.js';

test('exposes the supported categories', () => {
  assert.deepEqual(
    [...NOTIFICATION_CATEGORIES].sort(),
    ['ai', 'job', 'message', 'payment', 'project', 'social', 'system']
  );
});

test('isNotificationCategory only accepts known categories', () => {
  assert.equal(isNotificationCategory('job'), true);
  assert.equal(isNotificationCategory('ai'), true);
  assert.equal(isNotificationCategory('all'), false);
  assert.equal(isNotificationCategory(''), false);
  assert.equal(isNotificationCategory(null), false);
  assert.equal(isNotificationCategory(undefined), false);
});

test('an explicit valid category always wins over the type map', () => {
  assert.equal(resolveNotificationCategory('ai_job_match', 'social'), 'social');
  assert.equal(resolveNotificationCategory('new_message', 'payment'), 'payment');
});

test('an invalid explicit category falls back to the type map', () => {
  assert.equal(resolveNotificationCategory('ai_job_match', 'not-a-category'), 'job');
  assert.equal(resolveNotificationCategory('new_message', null), 'message');
});

test('known types map to their category', () => {
  assert.equal(resolveNotificationCategory('job_application_received'), 'job');
  assert.equal(resolveNotificationCategory('task_assigned'), 'project');
  assert.equal(resolveNotificationCategory('order_funded'), 'payment');
  assert.equal(resolveNotificationCategory('support_ticket_created'), 'system');
  assert.equal(resolveNotificationCategory('review_received'), 'social');
  assert.equal(resolveNotificationCategory('ai_weekly_digest'), 'ai');
});

test('unknown or legacy types resolve safely to system', () => {
  assert.equal(resolveNotificationCategory('totally_unknown_type'), 'system');
  assert.equal(resolveNotificationCategory(''), 'system');
  assert.equal(resolveNotificationCategory(undefined), 'system');
  assert.equal(resolveNotificationCategory(null, undefined), 'system');
});

test('admin-facing event types map to their category', () => {
  assert.equal(resolveNotificationCategory('order_disputed'), 'system');
  assert.equal(resolveNotificationCategory('report_submitted'), 'system');
  assert.equal(resolveNotificationCategory('verification_submitted'), 'system');
  assert.equal(resolveNotificationCategory('withdrawal_requested'), 'payment');
  assert.equal(resolveNotificationCategory('dispute_resolved_admin'), 'system');
});

test('typesForCategory returns every type that maps to the category', () => {
  const jobTypes = typesForCategory('job');
  assert.ok(jobTypes.includes('job_application_received'));
  assert.ok(jobTypes.includes('ai_job_match'));
  assert.ok(jobTypes.every((t) => TYPE_TO_CATEGORY[t] === 'job'));

  const paymentTypes = typesForCategory('payment');
  assert.ok(paymentTypes.includes('payment_received'));
  assert.ok(paymentTypes.includes('order_refunded_admin'));

  assert.deepEqual(typesForCategory('does-not-exist'), []);
});

test('every mapped category is a supported category', () => {
  for (const [, category] of Object.entries(TYPE_TO_CATEGORY)) {
    assert.equal(NOTIFICATION_CATEGORIES.includes(category), true, `bad category: ${category}`);
  }
});
