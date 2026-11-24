import Joi from 'joi';

export const createReviewSchema = Joi.object({
  rating: Joi.object({
    overall: Joi.number().integer().min(1).max(5).required(),
    communication: Joi.number().integer().min(1).max(5),
    quality: Joi.number().integer().min(1).max(5),
    expertise: Joi.number().integer().min(1).max(5),
    professionalism: Joi.number().integer().min(1).max(5),
    deadlineAdherence: Joi.number().integer().min(1).max(5),
  }).required(),
  comment: Joi.string().trim().min(20).max(2000).required().messages({
    'string.min': 'Review comment must be at least 20 characters',
  }),
});

export const replyToReviewSchema = Joi.object({
  content: Joi.string().trim().min(10).max(1000).required().messages({
    'string.min': 'Reply must be at least 10 characters',
  }),
});

export const updateReviewSchema = Joi.object({
  rating: Joi.object({
    overall: Joi.number().integer().min(1).max(5),
    communication: Joi.number().integer().min(1).max(5),
    quality: Joi.number().integer().min(1).max(5),
    expertise: Joi.number().integer().min(1).max(5),
    professionalism: Joi.number().integer().min(1).max(5),
    deadlineAdherence: Joi.number().integer().min(1).max(5),
  })
    .min(1)
    .messages({
      'number.min': 'Ratings must be between 1 and 5',
      'number.max': 'Ratings must be between 1 and 5',
    }),
  comment: Joi.string().trim().min(20).max(2000).messages({
    'string.min': 'Review comment must be at least 20 characters',
  }),
}).min(1);
