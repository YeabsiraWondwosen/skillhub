import Joi from 'joi';
import { commonSchemas } from '../middleware/validate.middleware.js';

const objectId = commonSchemas.objectId;

const createMeeting = Joi.object({
  freelancerId: objectId.required(),
  title: Joi.string().max(200).allow('', null).default(''),
  description: Joi.string().max(2000).allow('', null).default(''),
  notes: Joi.string().max(2000).allow('', null).default(''),
  startTime: Joi.date().greater('now').required().messages({
    'date.greater': 'Meeting time cannot be in the past',
    'any.required': 'startTime is required',
  }),
  endTime: Joi.date()
    .greater('now')
    .greater(Joi.ref('startTime'))
    .required()
    .messages({
      'date.greater': 'Meeting time cannot be in the past',
      'any.required': 'endTime is required',
      'date.ref': 'endTime must be after startTime',
    }),
  timezone: Joi.string().max(100).allow('', null).default(''),
  requesterTimezone: Joi.string().max(100).allow('', null).default(''),
  meetingType: Joi.string().valid('video_call', 'phone', 'in_person', 'other').default('video_call'),
  meetingLink: Joi.string().max(500).allow('', null).default(''),
  location: Joi.string().max(300).allow('', null).default(''),
  relatedJob: objectId.allow(null).default(null),
  relatedProposal: objectId.allow(null).default(null),
  relatedProject: objectId.allow(null).default(null),
}).unknown(false);

const createMeetingLegacy = Joi.object({
  attendeeId: objectId.required(),
  title: Joi.string().max(200).allow('', null).default(''),
  description: Joi.string().max(2000).allow('', null).default(''),
  scheduledAt: Joi.date().greater('now').required().messages({
    'date.greater': 'Meeting time cannot be in the past',
    'any.required': 'scheduledAt is required',
  }),
  duration: Joi.number().integer().min(15).max(480).default(30),
  timezone: Joi.string().max(100).allow('', null).default(''),
  meetingType: Joi.string().valid('video_call', 'phone', 'in_person', 'other').default('video_call'),
  meetingLink: Joi.string().max(500).allow('', null).default(''),
}).unknown(false);

const updateMeetingStatus = Joi.object({
  status: Joi.string().valid('pending', 'accepted', 'declined', 'completed', 'cancelled').required(),
  declinedReason: Joi.string().max(500).allow('', null).default(''),
  cancellationReason: Joi.string().max(500).allow('', null).default(''),
}).unknown(false);

const listMeetings = Joi.object({
  status: Joi.string().valid('pending', 'accepted', 'declined', 'completed', 'cancelled').optional(),
  scope: Joi.string().valid('upcoming', 'past').optional(),
  role: Joi.string().valid('client', 'freelancer').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().optional(),
});

const meetingParams = Joi.object({
  meetingId: objectId.required(),
});

export const meetingValidation = { createMeeting, createMeetingLegacy, updateMeetingStatus, listMeetings, meetingParams };