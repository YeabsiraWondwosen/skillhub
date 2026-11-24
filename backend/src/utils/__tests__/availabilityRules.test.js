import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVAILABILITY_STATUSES,
  availabilityBlockedReason,
  evaluateBookingEligibility,
  windowsOverlap,
  zonedParts,
  toMinutes,
} from '../availabilityRules.js';

const weeklySchedule = [{ dayOfWeek: 1, startMinute: 540, endMinute: 1020 }];
const future = new Date('2030-01-07T12:00:00Z');

// ─── Presence must not affect booking eligibility ────────────────────────────

test('an offline (disconnected) freelancer with future availability is still bookable', () => {
  const result = evaluateBookingEligibility({
    availabilityStatus: 'available',
    isOnline: false,
    schedule: weeklySchedule,
    now: future,
  });
  assert.equal(result.bookable, true);
  assert.equal(result.blockedReason, '');
  assert.equal(result.hasSchedule, true);
});

test('availabilityBlockedReason ignores online presence entirely', () => {
  for (const isOnline of [true, false]) {
    assert.equal(
      availabilityBlockedReason({ availabilityStatus: 'available', isOnline }, future).blocked,
      false,
      `isOnline=${isOnline}`,
    );
    assert.equal(
      availabilityBlockedReason({ availabilityStatus: 'busy', isOnline }, future).blocked,
      false,
      `isOnline=${isOnline}`,
    );
  }
});

test('a busy freelancer still accepts bookings', () => {
  const result = evaluateBookingEligibility({ availabilityStatus: 'busy', schedule: weeklySchedule, now: future });
  assert.equal(result.bookable, true);
});

// ─── No configured availability ──────────────────────────────────────────────

test('a freelancer with no configured availability is not bookable and explains why', () => {
  const result = evaluateBookingEligibility({ availabilityStatus: 'available', schedule: [], now: future });
  assert.equal(result.bookable, false);
  assert.equal(result.hasSchedule, false);
  assert.match(result.blockedReason, /has not set up any availability slots/i);
});

test('a missing schedule (undefined) is treated as no availability', () => {
  const result = evaluateBookingEligibility({ availabilityStatus: 'available', now: future });
  assert.equal(result.bookable, false);
  assert.equal(result.hasSchedule, false);
});

// ─── Booking intentionally disabled ──────────────────────────────────────────

test('an explicit offline availability setting disables booking with a correct reason', () => {
  const result = evaluateBookingEligibility({ availabilityStatus: 'offline', schedule: weeklySchedule, now: future });
  assert.equal(result.bookable, false);
  assert.match(result.blockedReason, /turned off booking requests/i);
  // The reason must not describe presence, which is a separate concern.
  assert.doesNotMatch(result.blockedReason, /currently offline/i);
});

test('the disabled-setting reason takes precedence even when a schedule exists', () => {
  const result = evaluateBookingEligibility({ availabilityStatus: 'offline', schedule: weeklySchedule, now: future });
  assert.equal(result.blockedReason, 'This freelancer has turned off booking requests.');
});

// ─── Blocked slots (vacation window) ─────────────────────────────────────────

test('vacation blocks bookings before nextAvailableDate and allows after', () => {
  const nextAvailableDate = new Date('2030-05-01T00:00:00Z');
  const before = new Date('2030-04-01T00:00:00Z');
  const atOrAfter = new Date('2030-06-01T00:00:00Z');

  assert.equal(availabilityBlockedReason({ availabilityStatus: 'vacation', nextAvailableDate }, before).blocked, true);
  assert.equal(availabilityBlockedReason({ availabilityStatus: 'vacation', nextAvailableDate }, atOrAfter).blocked, false);
});

test('vacation without a next date stays blocked and the reason names the vacation', () => {
  const block = availabilityBlockedReason({ availabilityStatus: 'vacation' }, future);
  assert.equal(block.blocked, true);
  assert.match(block.reason, /on vacation/i);
});

test('evaluateBookingEligibility surfaces the vacation window as not bookable', () => {
  const result = evaluateBookingEligibility({
    availabilityStatus: 'vacation',
    nextAvailableDate: new Date('2030-05-01T00:00:00Z'),
    schedule: weeklySchedule,
    now: new Date('2030-04-01T00:00:00Z'),
  });
  assert.equal(result.bookable, false);
  assert.match(result.blockedReason, /vacation/i);
});

// ─── Conflicting meetings (overlap rule) ─────────────────────────────────────

const t = (iso) => new Date(iso).getTime();

test('windowsOverlap detects overlapping meetings', () => {
  assert.equal(windowsOverlap(t('2030-01-07T10:00:00Z'), t('2030-01-07T11:00:00Z'), t('2030-01-07T10:30:00Z'), t('2030-01-07T11:30:00Z')), true);
  assert.equal(windowsOverlap(t('2030-01-07T10:00:00Z'), t('2030-01-07T12:00:00Z'), t('2030-01-07T11:00:00Z'), t('2030-01-07T13:00:00Z')), true);
});

test('windowsOverlap allows back-to-back and disjoint slots', () => {
  assert.equal(windowsOverlap(t('2030-01-07T10:00:00Z'), t('2030-01-07T11:00:00Z'), t('2030-01-07T11:00:00Z'), t('2030-01-07T12:00:00Z')), false);
  assert.equal(windowsOverlap(t('2030-01-07T10:00:00Z'), t('2030-01-07T11:00:00Z'), t('2030-01-07T09:00:00Z'), t('2030-01-07T10:00:00Z')), false);
  assert.equal(windowsOverlap(t('2030-01-07T10:00:00Z'), t('2030-01-07T11:00:00Z'), t('2030-01-07T13:00:00Z'), t('2030-01-07T14:00:00Z')), false);
});

// ─── Timezone conversion ─────────────────────────────────────────────────────

test('zonedParts converts a UTC instant into the freelancer timezone (EDT)', () => {
  const p = zonedParts('2024-06-15T12:00:00Z', 'America/New_York');
  assert.equal(p.hour, 8);
  assert.equal(p.minute, 0);
  assert.equal(p.date, '2024-06-15');
});

test('zonedParts is DST-safe (EST vs EDT)', () => {
  const winter = zonedParts('2024-01-15T12:00:00Z', 'America/New_York');
  const summer = zonedParts('2024-07-15T12:00:00Z', 'America/New_York');
  assert.equal(winter.hour, 7);
  assert.equal(summer.hour, 8);
});

test('zonedParts returns the local weekday index', () => {
  // 2024-06-15 is a Saturday in New York.
  const p = zonedParts('2024-06-15T12:00:00Z', 'America/New_York');
  assert.equal(p.weekday, 6);
});

// ─── Misc ────────────────────────────────────────────────────────────────────

test('toMinutes converts hours/minutes to minutes past midnight', () => {
  assert.equal(toMinutes(0, 0), 0);
  assert.equal(toMinutes(9, 30), 570);
  assert.equal(toMinutes(24, 0), 1440);
});

test('AVAILABILITY_STATUSES exposes exactly the four supported statuses', () => {
  assert.deepEqual(AVAILABILITY_STATUSES, ['available', 'busy', 'vacation', 'offline']);
});
