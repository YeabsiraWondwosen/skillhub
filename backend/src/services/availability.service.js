import { User, Follow, AvailabilitySlot, Meeting } from '../models/index.js';
import { ApiError } from '../utils/apiResponse.js';
import { emitAvailabilityChange } from './socket.service.js';
import { notifyFreelancerAvailable } from './notification.service.js';
import { isDateOnlyInPast } from '../utils/dateValidation.js';
import {
  AVAILABILITY_STATUSES,
  availabilityBlockedReason,
  evaluateBookingEligibility,
  zonedParts,
  toMinutes,
  windowsOverlap,
} from '../utils/availabilityRules.js';

export const ACTIVE_MEETING_STATUSES = ['pending', 'accepted'];
export const SLOT_STEP_MINUTES = 30;
export const DEFAULT_SLOT_MINUTES = 30;
export const MAX_SLOT_DAYS = 60;

export {
  AVAILABILITY_STATUSES,
  availabilityBlockedReason,
  toMinutes,
  windowsOverlap,
};

export const findParticipantConflicts = async (userId, startTime, endTime, excludeMeetingId = null) => {
  const query = {
    $or: [{ client: userId }, { freelancer: userId }],
    status: { $in: ACTIVE_MEETING_STATUSES },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeMeetingId) query._id = { $ne: excludeMeetingId };
  return Meeting.find(query).select('_id startTime endTime status client freelancer').lean();
};

export const assertNoParticipantConflict = async (userId, startTime, endTime, excludeMeetingId = null) => {
  const conflicts = await findParticipantConflicts(userId, startTime, endTime, excludeMeetingId);
  if (conflicts.length > 0) {
    const c = conflicts[0];
    throw new ApiError(409, 'This time slot conflicts with another meeting already on your calendar', [
      { meetingId: String(c._id), startTime: c.startTime, endTime: c.endTime, status: c.status },
    ]);
  }
};

export const getWeeklySlots = async (freelancerId) => {
  return AvailabilitySlot.find({ freelancer: freelancerId })
    .sort({ dayOfWeek: 1, startMinute: 1 })
    .lean();
};

// Verify a concrete [startTime, endTime] window fully fits inside one of the
// freelancer's weekly slots (expressed in the freelancer's timezone).
export const assertWithinWeeklySlot = async (freelancer, startTime, endTime) => {
  const tz = freelancer.timezone || 'UTC';
  const slots = await getWeeklySlots(freelancer._id);

  if (slots.length === 0) {
    throw new ApiError(400, 'This freelancer has not defined any available time slots yet.');
  }

  const startParts = zonedParts(startTime, tz);
  const endParts = zonedParts(endTime, tz);

  if (startParts.date !== endParts.date) {
    throw new ApiError(400, 'A meeting must start and end on the same day in the freelancer\'s timezone.');
  }

  const startMin = toMinutes(startParts.hour, startParts.minute);
  const endMin = toMinutes(endParts.hour, endParts.minute);

  for (const slot of slots) {
    if (slot.dayOfWeek !== startParts.weekday) continue;
    if (startMin >= slot.startMinute && endMin >= slot.startMinute && endMin <= slot.endMinute) {
      return true;
    }
  }

  throw new ApiError(400, 'The requested time is outside this freelancer\'s available schedule.');
};

// ─── Public summary ──────────────────────────────────────────────────────────
export const getAvailabilitySummary = async (userId) => {
  const user = await User.findById(userId).select('availabilityStatus nextAvailableDate timezone role isOnline').lean();
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role !== 'freelancer') throw new ApiError(400, 'Availability is only defined for freelancers');

  const schedule = await getWeeklySlots(user._id);
  const eligibility = evaluateBookingEligibility({
    availabilityStatus: user.availabilityStatus,
    nextAvailableDate: user.nextAvailableDate,
    schedule,
  });

  return {
    userId: user._id,
    availabilityStatus: eligibility.availabilityStatus,
    nextAvailableDate: user.nextAvailableDate || null,
    timezone: user.timezone || 'UTC',
    online: !!user.isOnline,
    hasSchedule: eligibility.hasSchedule,
    bookable: eligibility.bookable,
    blockedReason: eligibility.blockedReason,
    schedule,
  };
};

// ─── Free slot generation ─────────────────────────────────────────────────────
// Returns concrete UTC instants the freelancer could accept a booking at.
// Each candidate is generated in the freelancer's timezone by scanning UTC
// instants, which makes DST transitions safe.
export const getFreeSlots = async (freelancerId, { fromISO, toISO, durationMinutes = DEFAULT_SLOT_MINUTES, stepMinutes = SLOT_STEP_MINUTES, limit = 200 }) => {
  const freelancer = await User.findById(freelancerId).select('availabilityStatus nextAvailableDate timezone role').lean();
  if (!freelancer) throw new ApiError(404, 'Freelancer not found');
  if (freelancer.role !== 'freelancer') throw new ApiError(400, 'Only freelancers have bookable schedules');

  const tz = freelancer.timezone || 'UTC';
  const now = Date.now();
  const from = new Date(fromISO && !Number.isNaN(new Date(fromISO).getTime()) ? fromISO : now).getTime();
  const to = new Date(toISO && !Number.isNaN(new Date(toISO).getTime()) ? toISO : from + MAX_SLOT_DAYS * 86400000).getTime();
  const durMs = Math.max(15, Number(durationMinutes) || DEFAULT_SLOT_MINUTES) * 60000;
  const stepMs = Math.max(15, Number(stepMinutes) || SLOT_STEP_MINUTES) * 60000;

  const slots = await getWeeklySlots(freelancerId);
  const byDay = {};
  for (const s of slots) (byDay[s.dayOfWeek] = byDay[s.dayOfWeek] || []).push(s);

  const results = [];
  let cursor = Math.max(from, now + 15 * 60000);

  while (cursor < to && results.length < limit) {
    const p = zonedParts(cursor, tz);
    const localMin = toMinutes(p.hour, p.minute);
    const daySlots = byDay[p.weekday] || [];
    const endMs = cursor + durMs;

    for (const slot of daySlots) {
      if (localMin < slot.startMinute || localMin + (durMs / 60000) > slot.endMinute) continue;
      if (endMs > to) continue;

      const block = availabilityBlockedReason(freelancer, new Date(cursor));
      if (block.blocked) continue;

      const conflicts = await findParticipantConflicts(freelancerId, cursor, endMs);
      if (conflicts.length > 0) continue;

      results.push({ startTime: new Date(cursor), endTime: new Date(endMs), timezone: tz });
      break;
    }

    cursor += stepMs;
  }

  return { freelancer: freelancer._id, timezone: tz, availabilityStatus: freelancer.availabilityStatus, nextAvailableDate: freelancer.nextAvailableDate || null, slots: results };
};

// ─── User actions ────────────────────────────────────────────────────────────
export const updateAvailabilityStatus = async (userId, { availabilityStatus, nextAvailableDate = null }) => {
  if (!AVAILABILITY_STATUSES.includes(availabilityStatus)) {
    throw new ApiError(400, `availabilityStatus must be one of ${AVAILABILITY_STATUSES.join(', ')}`);
  }

  const prev = await User.findById(userId).select('availabilityStatus nextAvailableDate').lean();
  if (!prev) throw new ApiError(404, 'User not found');

  const cleanNext = availabilityStatus === 'vacation' && nextAvailableDate ? new Date(nextAvailableDate) : null;
  if (cleanNext && Number.isNaN(cleanNext.getTime())) {
    throw new ApiError(400, 'Invalid nextAvailableDate');
  }

  if (cleanNext) {
    const dateCheck = isDateOnlyInPast(cleanNext);
    if (!dateCheck.valid) {
      throw new ApiError(400, dateCheck.message);
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { availabilityStatus, nextAvailableDate: cleanNext },
    { new: true, runValidators: true }
  ).select('availabilityStatus nextAvailableDate timezone role firstName lastName');

  emitAvailabilityChange(userId, availabilityStatus);

  if (prev.availabilityStatus !== 'available' && availabilityStatus === 'available') {
    const followers = await Follow.find({ following: userId, notifyOnAvailable: true }).select('follower').lean();
    for (const f of followers) {
      await notifyFreelancerAvailable(f.follower, user).catch(() => null);
    }
  }

  return { availabilityStatus: user.availabilityStatus, nextAvailableDate: user.nextAvailableDate, timezone: user.timezone };
};

// ─── Weekly schedule editing ─────────────────────────────────────────────────
export const getSlotsForUser = async (userId) => {
  const user = await User.findById(userId).select('timezone role').lean();
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role !== 'freelancer') throw new ApiError(400, 'Only freelancers can define availability slots');
  return getWeeklySlots(userId);
};

export const saveSlotsForUser = async (userId, inputSlots) => {
  const user = await User.findById(userId).select('timezone role').lean();
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role !== 'freelancer') throw new ApiError(400, 'Only freelancers can define availability slots');

  if (!Array.isArray(inputSlots) || inputSlots.length === 0) throw new ApiError(400, 'At least one availability slot is required');

  const tz = user.timezone || 'UTC';
  const normalized = [];

  for (const s of inputSlots) {
    const dayOfWeek = Number(s.dayOfWeek);
    const startMinute = Number(s.startMinute);
    const endMinute = Number(s.endMinute);

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new ApiError(400, 'dayOfWeek must be an integer between 0 (Sunday) and 6 (Saturday)');
    }
    if (!Number.isInteger(startMinute) || startMinute < 0 || startMinute > 1439) {
      throw new ApiError(400, 'startMinute must be an integer between 0 and 1439');
    }
    if (!Number.isInteger(endMinute) || endMinute <= startMinute || endMinute > 1440) {
      throw new ApiError(400, 'endMinute must be greater than startMinute and at most 1440');
    }

    normalized.push({ dayOfWeek, startMinute, endMinute, timezone: tz });
  }

  await AvailabilitySlot.deleteMany({ freelancer: userId });
  if (normalized.length > 0) {
    await AvailabilitySlot.insertMany(normalized.map((n) => ({ freelancer: userId, ...n })));
  }

  return getWeeklySlots(userId);
};

export const timezoneHelpers = { zonedParts, toMinutes };