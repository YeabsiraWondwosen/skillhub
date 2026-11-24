import { catchAsync } from '../utils/catchAsync.js';
import { sendResponse } from '../utils/apiResponse.js';
import * as availabilityService from '../services/availability.service.js';

export const getMyAvailability = catchAsync(async (req, res) => {
  const summary = await availabilityService.getAvailabilitySummary(req.user._id);
  sendResponse(res, 200, 'Availability fetched', summary);
});

export const updateMyStatus = catchAsync(async (req, res) => {
  const result = await availabilityService.updateAvailabilityStatus(req.user._id, req.body);
  sendResponse(res, 200, 'Availability updated', result);
});

export const getMySlots = catchAsync(async (req, res) => {
  const slots = await availabilityService.getSlotsForUser(req.user._id);
  sendResponse(res, 200, 'Availability slots fetched', slots);
});

export const saveMySlots = catchAsync(async (req, res) => {
  const slots = await availabilityService.saveSlotsForUser(req.user._id, req.body.slots);
  sendResponse(res, 200, 'Availability slots updated', slots);
});

export const getPublicAvailability = catchAsync(async (req, res) => {
  const summary = await availabilityService.getAvailabilitySummary(req.params.userId);
  sendResponse(res, 200, 'Public availability fetched', summary);
});

export const getPublicSlots = catchAsync(async (req, res) => {
  const result = await availabilityService.getFreeSlots(req.params.userId, {
    fromISO: req.query.from,
    toISO: req.query.to,
    durationMinutes: req.query.durationMinutes,
    stepMinutes: req.query.stepMinutes,
    limit: req.query.limit,
  });
  sendResponse(res, 200, 'Available time slots fetched', result);
});