import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preferenceKeyFor,
  shouldDeliverNotification,
  NOTIFICATION_PREFERENCE_KEYS,
} from '../notificationPreference.js';

test('NOTIFICATION_PREFERENCE_KEYS matches the NotificationPreferences model keys', () => {
  const expected = [
    'jobs', 'projects', 'payments', 'messages', 'reviews', 'aiRecommendations',
    'weeklyDigest', 'systemAlerts', 'jobInvitations', 'jobMatches', 'proposals',
    'contracts', 'milestones', 'serviceOrders', 'catalogPerformance', 'verification',
    'proposalUpdates', 'freelancerMessages',
  ];
  assert.deepEqual([...NOTIFICATION_PREFERENCE_KEYS].sort(), [...expected].sort());
});

test('preferenceKeyFor maps known types explicitly', () => {
  assert.equal(preferenceKeyFor('new_message'), 'messages');
  assert.equal(preferenceKeyFor('job_invitation'), 'jobInvitations');
  assert.equal(preferenceKeyFor('review_received'), 'reviews');
  assert.equal(preferenceKeyFor('order_placed'), 'serviceOrders');
  assert.equal(preferenceKeyFor('project_milestone_released'), 'milestones');
  assert.equal(preferenceKeyFor('ai_job_match'), 'jobMatches');
  assert.equal(preferenceKeyFor('ai_weekly_digest'), 'weeklyDigest');
  assert.equal(preferenceKeyFor('account_banned'), 'systemAlerts');
});

test('preferenceKeyFor falls back to the coarse category', () => {
  assert.equal(preferenceKeyFor('unknown_type', 'payment'), 'payments');
  assert.equal(preferenceKeyFor('unknown_type', 'message'), 'messages');
  assert.equal(preferenceKeyFor('unknown_type', 'project'), 'projects');
});

test('preferenceKeyFor returns null for types with no exposed toggle', () => {
  assert.equal(preferenceKeyFor('meeting_request'), null);
  assert.equal(preferenceKeyFor('new_follower'), null);
  assert.equal(preferenceKeyFor('unknown_type', 'social'), null);
});

test('preferenceKeyFor defaults unknown to the system category', () => {
  assert.equal(preferenceKeyFor('totally_unknown'), 'systemAlerts');
});

test('no preferences document means everything is allowed', () => {
  assert.equal(shouldDeliverNotification({ prefs: null, type: 'new_message' }), true);
  assert.equal(shouldDeliverNotification({ prefs: undefined, type: 'account_banned' }), true);
});

test('a disabled category suppresses its notifications', () => {
  const prefs = { channels: { inApp: true }, categories: { messages: false } };
  assert.equal(shouldDeliverNotification({ prefs, type: 'new_message' }), false);
  assert.equal(shouldDeliverNotification({ prefs, type: 'review_received' }), true);
});

test('disabling the in-app channel suppresses non-critical notifications', () => {
  const prefs = { channels: { inApp: false }, categories: {} };
  assert.equal(shouldDeliverNotification({ prefs, type: 'new_message' }), false);
});

test('security and account-critical notifications always deliver', () => {
  const prefs = {
    channels: { inApp: false },
    categories: { systemAlerts: false, verification: false, payments: false, systemAlerts2: false },
  };
  // critical type
  assert.equal(shouldDeliverNotification({ prefs, type: 'account_banned' }), true);
  assert.equal(shouldDeliverNotification({ prefs, type: 'account_verified' }), true);
  assert.equal(shouldDeliverNotification({ prefs, type: 'payment_failed' }), true);
  assert.equal(shouldDeliverNotification({ prefs, type: 'verification' }), true);
  // critical category (system)
  assert.equal(shouldDeliverNotification({ prefs, type: 'admin_announcement' }), true);
  assert.equal(shouldDeliverNotification({ prefs, type: 'unknown_thing' }), true);
});

test('non-critical payments respect the preference', () => {
  const prefs = { channels: { inApp: true }, categories: { payments: false } };
  assert.equal(shouldDeliverNotification({ prefs, type: 'payment_received' }), false);
  assert.equal(shouldDeliverNotification({ prefs, type: 'escrow_released' }), false);
});

test('explicit category argument participates in critical detection', () => {
  const prefs = { channels: { inApp: false }, categories: { systemAlerts: false } };
  assert.equal(shouldDeliverNotification({ prefs, type: 'whatever', category: 'system' }), true);
});
