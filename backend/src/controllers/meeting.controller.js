import { catchAsync } from '../utils/catchAsync.js';
import { sendResponse, paginationMeta } from '../utils/apiResponse.js';
import * as meetingService from '../services/meeting.service.js';

export const createMeeting = catchAsync(async (req, res) => {
  const meeting = await meetingService.createMeeting(req.user, req.body);
  const serialized = meetingService.serializeMeeting(meeting);
  sendResponse(res, 201, 'Meeting booked successfully', serialized);
});

export const createMeetingLegacy = catchAsync(async (req, res) => {
  const meeting = await meetingService.createMeetingLegacy(req.user, req.body);
  const serialized = meetingService.serializeMeeting(meeting);
  sendResponse(res, 201, 'Meeting scheduled', serialized);
});

export const myMeetings = catchAsync(async (req, res) => {
  const { page, limit, status, scope, role, sort } = req.query;
  const result = await meetingService.listMeetingDocuments({
    userId: req.user._id,
    status,
    scope,
    role,
    page,
    limit,
    sort,
  });
  sendResponse(
    res,
    200,
    'Meetings fetched',
    result.meetings,
    paginationMeta(result.total, result.page, result.limit)
  );
});

export const meetingById = catchAsync(async (req, res) => {
  const meeting = await meetingService.getMeetingDocument(req.params.meetingId);
  meetingService.assertParticipantOrAdmin(meeting, req.user);
  sendResponse(res, 200, 'Meeting fetched', meetingService.serializeMeeting(meeting));
});

export const updateMeetingStatus = catchAsync(async (req, res) => {
  const meeting = await meetingService.transitionMeeting({
    meetingId: req.params.meetingId,
    actor: req.user,
    status: req.body.status,
    declinedReason: req.body.declinedReason,
    cancellationReason: req.body.cancellationReason,
  });
  sendResponse(res, 200, `Meeting ${req.body.status}`, meetingService.serializeMeeting(meeting));
});