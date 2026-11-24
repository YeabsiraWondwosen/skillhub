import Joi from 'joi';
import { commonSchemas } from '../middleware/validate.middleware.js';
import { isDateOnlyInPast } from '../utils/dateValidation.js';

const objectId = commonSchemas.objectId;

const updateStatus = Joi.object({
  availabilityStatus: Joi.string().valid('available', 'busy', 'vacation', 'offline').required(),
  nextAvailableDate: Joi.date()
    .allow(null, '')
    .when('availabilityStatus', {
      is: 'vacation',
      then: Joi.date().custom((value, helpers) => {
        if (!value) return value;
        if (isDateOnlyInPast(value).valid) return value;
        return helpers.error('date.min');
      }, 'future available date').messages({
        'date.min': 'Return date cannot be in the past',
        'date.base': 'Return date must be a valid date',
      }),
      otherwise: Joi.allow(null, ''),
    })
    .default(null),
}).unknown(false);

const slotItem = Joi.object({
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  startMinute: Joi.number().integer().min(0).max(1439).required(),
  endMinute: Joi.number().integer().min(1).max(1440).required(),
});

const saveSlots = Joi.object({
  slots: Joi.array().items(slotItem).min(1).required(),
}).unknown(false);

const publicQuery = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  durationMinutes: Joi.number().integer().min(15).max(480).optional(),
  stepMinutes: Joi.number().integer().min(15).max(240).optional(),
  limit: Joi.number().integer().min(1).max(500).default(200),
});

const userParams = Joi.object({
  userId: objectId.required(),
});

export const availabilityValidation = { updateStatus, saveSlots, publicQuery, userParams };