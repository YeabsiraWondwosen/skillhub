import { User, Meeting, Job, Project, Application } from '../models/index.js';
import { ApiError, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import {
  assertNoParticipantConflict,
  assertWithinWeeklySlot,
  availabilityBlockedReason,
} from './availability.service.js';
import {
  notifyMeetingCreated,
  notifyMeetingAccepted,
  notifyMeetingDeclined,
  notifyMeetingCancelled,
  notifyMeetingCompleted,
} from './notification.service.js';

export const MEETING_STATUSES = ['pending', 'accepted', 'declined', 'completed', 'cancelled'];
export const MEETING_TYPES = ['video_call', 'phone', 'in_person', 'other'];

const MIN_DURATION_MIN = 15;
const MAX_DURATION_MIN = 480;
const LEGACY_GRACE_MS = 60 * 1000;

// ─── Reference id helpers ────────────────────────────────────────────────────
// Meeting participant refs may be raw ObjectIds/strings (when a document is not
// populated) OR populated Mongoose documents (getMeetingDocument populates
// `client`/`freelancer`). A populated document's `.toString()` returns its
// inspect representation — NOT the id — so `.toString() === id` silently fails
// and produces spurious 403s. Always normalize through `refId`/`sameId`.
export const refId = (ref) => {
  if (ref == null) return '';
  if (typeof ref === 'string') return ref;
  if (ref._id != null) return String(ref._id);
  return String(ref);
};

export const sameId = (a, b) => {
  const idA = refId(a);
  return idA !== '' && idA === refId(b);
};

// Allowed status transitions with who may perform each action.
// Terminal states (declined / completed / cancelled) cannot be left.
const TRANSITIONS = {
  pending: {
    accepted: ['freelancer', 'admin'],
    declined: ['freelancer', 'admin'],
    cancelled: ['client', 'freelancer', 'admin'],
  },
  accepted: {
    completed: ['client', 'freelancer', 'admin'],
    cancelled: ['client', 'freelancer', 'admin'],
  },
  declined: {},
  completed: {},
  cancelled: {},
};

export const getTransitionActors = (fromStatus, toStatus) => TRANSITIONS[fromStatus]?.[toStatus] || null;

const PARTICIPANTS_SELECT = 'firstName lastName avatar role';
const RELATED_JOB_SELECT = 'title status';
const RELATED_PROJECT_SELECT = 'title status';
const RELATED_PROPOSAL_SELECT = 'status proposalText';

const unserializeUser = (u) => {
  if (!u) return null;
  return {
    _id: u._id,
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    avatar: u.avatar || {},
    role: u.role || 'user',
  };
};

// Stable response contract — every meeting endpoint returns this exact shape.
export const serializeMeeting = (m, { includeRelations = true } = {}) => {
  if (!m) return null;
  const doc = m.toObject ? m.toObject() : m;
  const out = {
    _id: doc._id,
    title: doc.title || '',
    description: doc.description || '',
    notes: doc.notes || '',
    client: unserializeUser(doc.client),
    freelancer: unserializeUser(doc.freelancer),
    startTime: doc.startTime,
    endTime: doc.endTime,
    duration: doc.duration ?? Math.round(((new Date(doc.endTime).getTime() - new Date(doc.startTime).getTime()) / 60000)),
    timezone: doc.timezone || 'UTC',
    meetingType: doc.meetingType || 'video_call',
    meetingUrl: doc.meetingUrl || '',
    location: doc.location || '',
    status: doc.status,
    declinedReason: doc.declinedReason || '',
    createdBy: doc.createdBy || null,
    cancelledBy: doc.cancelledBy || null,
    cancelledAt: doc.cancelledAt || null,
    cancellationReason: doc.cancellationReason || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  if (includeRelations) {
    out.relatedJob = doc.relatedJob && doc.relatedJob._id ? { _id: doc.relatedJob._id, title: doc.relatedJob.title || '' } : null;
    out.relatedProject = doc.relatedProject && doc.relatedProject._id ? { _id: doc.relatedProject._id, title: doc.relatedProject.title || '', status: doc.relatedProject.status || '' } : null;
    out.relatedProposal = doc.relatedProposal && doc.relatedProposal._id ? { _id: doc.relatedProposal._id, status: doc.relatedProposal.status || '' } : null;
  }
  return out;
};

const assertValidWindow = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, 'startTime and endTime must be valid dates');
  }
  if (start.getTime() >= end.getTime()) {
    throw new ApiError(400, 'endTime must be after startTime');
  }

  const duration = Math.round((end.getTime() - start.getTime()) / 60000);
  if (duration < MIN_DURATION_MIN || duration > MAX_DURATION_MIN) {
    throw new ApiError(400, `Meeting duration must be between ${MIN_DURATION_MIN} and ${MAX_DURATION_MIN} minutes`);
  }
  if (start.getTime() < Date.now() - LEGACY_GRACE_MS) {
    throw new ApiError(400, 'Meeting time cannot be in the past');
  }
  return { start, end, duration };
};

const loadRelated = async ({ relatedJob, relatedProposal, relatedProject }) => {
  const linked = {};
  if (relatedJob) linked.job = await Job.findById(relatedJob).select(RELATED_JOB_SELECT).lean();
  if (relatedProject) linked.project = await Project.findById(relatedProject).select(RELATED_PROJECT_SELECT).lean();
  if (relatedProposal) linked.proposal = await Application.findById(relatedProposal).select(RELATED_PROPOSAL_SELECT).lean();
  return {
    relatedJob: linked.job?._id || null,
    relatedProject: linked.project?._id || null,
    relatedProposal: linked.proposal?._id || null,
    relatedJobTitle: linked.job?.title || null,
    relatedProjectTitle: linked.project?.title || null,
  };
};

const notificationTarget = (meeting, actorId) =>
  sameId(meeting.client, actorId)
    ? { user: refId(meeting.freelancer), role: 'freelancer' }
    : { user: refId(meeting.client), role: 'client' };

/**
 * Create a meeting. `client` must be a client-role account, `freelancer` must be
 * a freelancer-role account. Every business rule (availability status, weekly
 * slots, no-past, no-conflict) is enforced here — never only in the frontend.
 * Sender identity always comes from `req.user`, never from the request body.
 */
export const createMeeting = async (creator, body) => {
  const { freelancerId, clientId: bodyClientId, title, description, notes, startTime, endTime, timezone, meetingType, meetingLink, location, relatedJob, relatedProposal, relatedProject, requesterTimezone } = body;

  if (!freelancerId) throw new ApiError(400, 'freelancerId is required');

  if (creator.role !== 'client' && creator.role !== 'admin') {
    throw new ApiError(403, 'Only clients can book meetings with freelancers');
  }

  const clientId = creator.role === 'client' ? creator._id : bodyClientId || null;
  if (!clientId || String(clientId) === String(freelancerId)) {
    throw new ApiError(400, 'A meeting must be between two different accounts');
  }

  const [freelancer, client] = await Promise.all([
    User.findById(freelancerId).select('-password -refreshTokens'),
    User.findById(clientId).select('-password -refreshTokens'),
  ]);

  if (!freelancer) throw new ApiError(404, 'Freelancer not found');
  if (freelancer.role !== 'freelancer') throw new ApiError(400, 'The requested account is not a freelancer');
  if (!client) throw new ApiError(404, 'Client not found');
  if (client.role !== 'client') throw new ApiError(400, 'The requesting account is not a client');

  const { start, end, duration } = assertValidWindow(startTime, endTime);

  // A malicious client must not bypass the freelancer's availability.
  const blocked = availabilityBlockedReason(freelancer, start);
  if (blocked.blocked) throw new ApiError(409, blocked.reason);
  await assertWithinWeeklySlot(freelancer, start, end);

  // Both participants' calendars are protected from double bookings.
  await assertNoParticipantConflict(freelancer._id, start, end);
  await assertNoParticipantConflict(client._id, start, end);

  const { relatedJob: rj, relatedProject: rp, relatedProposal: rpr } = await loadRelated({ relatedJob, relatedProposal, relatedProject });

  const meeting = await Meeting.create({
    client: client._id,
    freelancer: freelancer._id,
    title: (title || '').trim() || 'Meeting',
    description: description || '',
    notes: notes || '',
    startTime: start,
    endTime: end,
    duration,
    timezone: timezone || freelancer.timezone || 'UTC',
    meetingType: MEETING_TYPES.includes(meetingType) ? meetingType : 'video_call',
    meetingUrl: meetingLink || '',
    location: location || '',
    relatedJob: rj,
    relatedProject: rp,
    relatedProposal: rpr,
    createdBy: creator._id,
    status: 'pending',
  });

  const populated = await Meeting.findById(meeting._id).populate([
    { path: 'client', select: PARTICIPANTS_SELECT },
    { path: 'freelancer', select: PARTICIPANTS_SELECT },
  ]);

  await notifyMeetingCreated(freelancer._id, creator, populated);

  return populated;
};

export const createMeetingLegacy = async (creator, body) => {
  const { attendeeId, title, description, scheduledAt, duration, timezone, meetingType, meetingLink } = body;
  if (!attendeeId || !scheduledAt) throw new ApiError(400, 'attendeeId and scheduledAt are required');

  const attendee = await User.findById(attendeeId).select('-password -refreshTokens');
  if (!attendee) throw new ApiError(404, 'Attendee not found');

  const dur = Math.max(MIN_DURATION_MIN, Number(duration) || 30);
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + dur * 60000);

  if (creator.role === 'client') {
    if (attendee.role !== 'freelancer') throw new ApiError(400, 'Clients can only book meetings with freelancers');
    return createMeeting(creator, {
      freelancerId: attendee._id,
      title, description, startTime: start, endTime: end,
      timezone, meetingType, meetingLink,
    });
  }

  if (creator.role === 'freelancer') {
    if (attendee.role !== 'client') throw new ApiError(400, 'Freelancers can only schedule meetings with clients');
    const { start: s, end: e, duration: d } = assertValidWindow(start, end);
    const blocked = availabilityBlockedReason(creator, s);
    if (blocked.blocked) throw new ApiError(409, blocked.reason);
    await assertWithinWeeklySlot(creator, s, e);
    await assertNoParticipantConflict(creator._id, s, e);
    await assertNoParticipantConflict(attendee._id, s, e);

    const meeting = await Meeting.create({
      client: attendee._id,
      freelancer: creator._id,
      title: (title || '').trim() || 'Meeting',
      description: description || '',
      startTime: s,
      endTime: e,
      duration: d,
      timezone: timezone || creator.timezone || 'UTC',
      meetingType: MEETING_TYPES.includes(meetingType) ? meetingType : 'video_call',
      meetingUrl: meetingLink || '',
      createdBy: creator._id,
      status: 'pending',
    });

    const populated = await Meeting.findById(meeting._id).populate([
      { path: 'client', select: PARTICIPANTS_SELECT },
      { path: 'freelancer', select: PARTICIPANTS_SELECT },
    ]);
    await notifyMeetingCreated(attendee._id, creator, populated);
    return populated;
  }

  throw new ApiError(403, 'Only client or freelancer accounts can schedule meetings');
};

export const listMeetingDocuments = async ({ userId, status, scope, role, page = 1, limit = 20, sort }) => {
  const query = { $or: [{ client: userId }, { freelancer: userId }] };
  if (role) {
    const field = role === 'client' ? 'client' : role === 'freelancer' ? 'freelancer' : null;
    if (field) query[field] = userId;
  }
  if (status && MEETING_STATUSES.includes(status)) query.status = status;

  const now = new Date();
  if (scope === 'upcoming') query.endTime = { $gte: now };
  if (scope === 'past') query.endTime = { $lt: now };

  const effectiveSort = sort || (scope === 'upcoming' ? { startTime: 1 } : { startTime: -1 });
  const { skip } = parsePagination({ page, limit });

  const [total, docs] = await Promise.all([
    Meeting.countDocuments(query),
    Meeting.find(query)
      .populate([
        { path: 'client', select: PARTICIPANTS_SELECT },
        { path: 'freelancer', select: PARTICIPANTS_SELECT },
        { path: 'relatedJob', select: RELATED_JOB_SELECT },
        { path: 'relatedProject', select: RELATED_PROJECT_SELECT },
        { path: 'relatedProposal', select: RELATED_PROPOSAL_SELECT },
      ])
      .sort(effectiveSort)
      .skip(skip)
      .limit(limit),
  ]);

  return { meetings: docs.map((m) => serializeMeeting(m)), total, page, limit };
};

export const getMeetingDocument = async (meetingId) => {
  const meeting = await Meeting.findById(meetingId).populate([
    { path: 'client', select: PARTICIPANTS_SELECT },
    { path: 'freelancer', select: PARTICIPANTS_SELECT },
    { path: 'relatedJob', select: RELATED_JOB_SELECT },
    { path: 'relatedProject', select: RELATED_PROJECT_SELECT },
    { path: 'relatedProposal', select: RELATED_PROPOSAL_SELECT },
  ]);
  if (!meeting) throw new ApiError(404, 'Meeting not found');
  return meeting;
};

export const assertParticipantOrAdmin = (meeting, actor) => {
  if (actor.role === 'admin') return;
  const isParticipant = sameId(meeting.client, actor._id) || sameId(meeting.freelancer, actor._id);
  if (!isParticipant) throw new ApiError(403, 'You are not a participant of this meeting');
};

/**
 * Pure authorization for a status transition. Callers pass the (possibly
 * populated) meeting, the authenticated actor, and the target status. Throws
 * ApiError with the correct code (400 invalid status, 403 insufficient
 * permission, 409 invalid/conflicting state). Extracted from transitionMeeting
 * so the rules are unit-testable without a database.
 */
export const authorizeMeetingTransition = ({ meeting, actor, toStatus }) => {
  if (!MEETING_STATUSES.includes(toStatus)) {
    throw new ApiError(400, `status must be one of ${MEETING_STATUSES.join(', ')}`);
  }

  assertParticipantOrAdmin(meeting, actor);

  if (meeting.status === toStatus) {
    throw new ApiError(409, `Meeting is already ${toStatus}`);
  }

  const allowedActors = getTransitionActors(meeting.status, toStatus);
  if (!allowedActors) {
    throw new ApiError(409, `Meeting cannot transition from "${meeting.status}" to "${toStatus}"`);
  }
  if (!allowedActors.includes(actor.role)) {
    throw new ApiError(403, `You are not allowed to ${toStatus} a meeting in "${meeting.status}" state`);
  }

  if (meeting.status === 'pending' && (toStatus === 'accepted' || toStatus === 'declined')) {
    const isFreelancerSide = sameId(meeting.freelancer, actor._id);
    if (!isFreelancerSide && actor.role !== 'admin') {
      throw new ApiError(403, 'Only the freelancer can accept or decline a meeting request');
    }
  }

  return true;
};

/**
 * Status transitions with role + ownership enforcement. Returns the populated
 * meeting with the other participant already notified.
 */
export const transitionMeeting = async ({ meetingId, actor, status, declinedReason, cancellationReason }) => {
  const meeting = await getMeetingDocument(meetingId);
  authorizeMeetingTransition({ meeting, actor, toStatus: status });

  meeting.status = status;
  if (status === 'declined') meeting.declinedReason = (declinedReason || '').slice(0, 500);
  if (status === 'cancelled') {
    meeting.cancelledBy = actor._id;
    meeting.cancelledAt = new Date();
    meeting.cancellationReason = (cancellationReason || '').slice(0, 500);
  }

  await meeting.save();

  const target = notificationTarget(meeting, actor._id);
  const sender = await User.findById(actor._id).select(PARTICIPANTS_SELECT).lean();

  const notifier = {
    accepted: notifyMeetingAccepted,
    declined: notifyMeetingDeclined,
    cancelled: notifyMeetingCancelled,
    completed: notifyMeetingCompleted,
  }[status];

  if (notifier) await notifier(target.user, sender, meeting, target.role, status);

  return Meeting.findById(meeting._id).populate([
    { path: 'client', select: PARTICIPANTS_SELECT },
    { path: 'freelancer', select: PARTICIPANTS_SELECT },
    { path: 'relatedJob', select: RELATED_JOB_SELECT },
    { path: 'relatedProject', select: RELATED_PROJECT_SELECT },
    { path: 'relatedProposal', select: RELATED_PROPOSAL_SELECT },
  ]);
};

export const meetingService = { serializeMeeting, createMeeting, createMeetingLegacy, listMeetingDocuments, getMeetingDocument, transitionMeeting };