import Joi from 'joi';

export const createApplicationSchema = Joi.object({
  coverLetter: Joi.string().trim().min(100).max(3000).required().messages({
    'string.min': 'Cover letter must be at least 100 characters',
  }),
  priceOffer: Joi.object({
    amount: Joi.number().min(1).required(),
    type: Joi.string().valid('fixed', 'hourly').required(),
    currency: Joi.string().uppercase().default('ETB'),
  }).required(),
  deliveryTime: Joi.object({
    value: Joi.number().integer().min(1).required(),
    unit: Joi.string().valid('hours', 'days', 'weeks', 'months').default('days'),
  }).required(),
});

export const updateApplicationStatusSchema = Joi.object({
  status: Joi.string()
    .valid('viewed', 'shortlisted', 'accepted', 'rejected')
    .required(),
  rejectionReason: Joi.string().max(500).when('status', {
    is: 'rejected',
    then: Joi.optional(),
    otherwise: Joi.optional(),
  }),
  clientNote: Joi.string().max(500).allow('', null),
});
