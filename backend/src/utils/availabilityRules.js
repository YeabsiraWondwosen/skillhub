// Pure availability / booking-eligibility rules.
//
// IMPORTANT: booking eligibility is derived ONLY from the freelancer's explicit
// `availabilityStatus` (+ `nextAvailableDate`) and whether they configured a
// weekly schedule. Online PRESENCE (`isOnline` / `lastSeen`) is intentionally
// NOT part of any rule here: a freelancer who is offline right now can still be
// booked for a future slot they have explicitly made available. Presence is a
// socket/connection concern and must never be written into `availabilityStatus`.

export const AVAILABILITY_STATUSES = ['available', 'busy', 'vacation', 'offline'];

// ─── Timezone helpers (no external tz library) ───────────────────────────────
const dtfCache = new Map();
export const getFormatter = (timeZone) => {
  let dtf = dtfCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    dtfCache.set(timeZone, dtf);
  }
  return dtf;
};

const ZONED_PARTS_CACHE = new Map();
export const zonedParts = (date, timeZone) => {
  const ms = new Date(date).getTime();
  const key = `${timeZone}:${Math.floor(ms / 60000)}`;
  if (ZONED_PARTS_CACHE.has(key)) return ZONED_PARTS_CACHE.get(key);
  const parts = getFormatter(timeZone).formatToParts(new Date(ms));
  const map = { weekday: null, year: null, month: null, day: null, hour: null, minute: null };
  for (const p of parts) {
    if (map.weekday === null && p.type === 'weekday') map.weekday = p.value;
    if (p.type === 'year') map.year = Number(p.value);
    if (p.type === 'month') map.month = Number(p.value);
    if (p.type === 'day') map.day = Number(p.value);
    if (p.type === 'hour') map.hour = Number(p.value);
    if (p.type === 'minute') map.minute = Number(p.value);
  }
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday);
  const out = { weekday: weekdayIndex, hour: map.hour === 24 ? 0 : map.hour, minute: map.minute, date: `${map.year}-${String(map.month).padStart(2, '0')}-${String(map.day).padStart(2, '0')}` };
  if (ZONED_PARTS_CACHE.size > 50000) ZONED_PARTS_CACHE.clear();
  ZONED_PARTS_CACHE.set(key, out);
  return out;
};

export const toMinutes = (hour, minute) => hour * 60 + minute;

// ─── Conflict detection ──────────────────────────────────────────────────────
// Overlap rule: two windows overlap iff a.start < b.end && b.start < a.end.
// Back-to-back (end === start) is allowed.
export const windowsOverlap = (aS, aE, bS, bE) => aS < bE && bS < aE;

// ─── Availability gates ───────────────────────────────────────────────────────
// Returns whether the freelancer's EXPLICIT availability setting blocks a
// booking that would start at `startTime`. Presence (`isOnline`) is ignored.
export const availabilityBlockedReason = (freelancer, startTime) => {
  const status = freelancer?.availabilityStatus || 'available';

  if (status === 'offline') {
    return { blocked: true, reason: 'This freelancer has turned off booking requests.' };
  }

  if (status === 'vacation') {
    if (freelancer.nextAvailableDate && new Date(startTime).getTime() >= new Date(freelancer.nextAvailableDate).getTime()) {
      return { blocked: false, reason: '' };
    }
    const until = freelancer.nextAvailableDate
      ? ` until ${new Date(freelancer.nextAvailableDate).toISOString().slice(0, 10)}`
      : '';
    return { blocked: true, reason: `This freelancer is on vacation${until} and not accepting bookings.` };
  }

  return { blocked: false, reason: '' };
};

// Combine the explicit status and the presence of a configured weekly schedule
// into a single eligibility verdict for the public booking UI. `isOnline` is
// accepted (so callers can pass it) but deliberately NOT used.
export const evaluateBookingEligibility = ({
  availabilityStatus,
  nextAvailableDate = null,
  schedule = [],
  now = new Date(),
} = {}) => {
  const status = availabilityStatus || 'available';
  const hasSchedule = Array.isArray(schedule) && schedule.length > 0;
  const block = availabilityBlockedReason({ availabilityStatus: status, nextAvailableDate }, now);

  if (block.blocked) {
    return { availabilityStatus: status, bookable: false, blockedReason: block.reason, hasSchedule };
  }

  if (!hasSchedule) {
    return {
      availabilityStatus: status,
      bookable: false,
      blockedReason: 'This freelancer has not set up any availability slots yet.',
      hasSchedule: false,
    };
  }

  return { availabilityStatus: status, bookable: true, blockedReason: '', hasSchedule: true };
};
