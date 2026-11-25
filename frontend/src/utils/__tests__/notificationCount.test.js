import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNotificationCount, getUnreadNotificationsLabel } from '../notificationCount.js';

test('formatNotificationCount renders plain numbers up to 99', () => {
  assert.equal(formatNotificationCount(0), '0');
  assert.equal(formatNotificationCount(1), '1');
  assert.equal(formatNotificationCount(42), '42');
  assert.equal(formatNotificationCount(99), '99');
});

test('formatNotificationCount caps the display at 99+', () => {
  assert.equal(formatNotificationCount(100), '99+');
  assert.equal(formatNotificationCount(1000), '99+');
});

test('formatNotificationCount handles non-numeric and negative input safely', () => {
  assert.equal(formatNotificationCount(undefined), '0');
  assert.equal(formatNotificationCount(null), '0');
  assert.equal(formatNotificationCount(NaN), '0');
  assert.equal(formatNotificationCount(-5), '0');
  assert.equal(formatNotificationCount('7'), '7');
});

test('getUnreadNotificationsLabel builds a human-readable aria label', () => {
  assert.equal(getUnreadNotificationsLabel(0), '0 unread notifications');
  assert.equal(getUnreadNotificationsLabel(1), '1 unread notification');
  assert.equal(getUnreadNotificationsLabel(3), '3 unread notifications');
  assert.equal(getUnreadNotificationsLabel(100), '99+ unread notifications');
});
