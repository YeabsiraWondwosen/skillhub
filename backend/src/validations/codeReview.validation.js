import Joi from 'joi';

const FOCUS_AREAS = ['bugs', 'security', 'performance', 'best_practice', 'maintainability', 'style'];
const SEVERITY_LEVELS = ['all', 'critical', 'high', 'medium'];

export const submitPasteReviewSchema = Joi.object({
  code: Joi.string().min(10).max(100000).required().messages({
    'string.min': 'Code must be at least 10 characters',
    'string.max': 'Code cannot exceed 100KB',
    'any.required': 'Code is required',
  }),
  language: Joi.string().max(50).optional(),
  fileName: Joi.string().max(500).optional(),
  focusAreas: Joi.alternatives().try(
    Joi.array().items(Joi.string().valid(...FOCUS_AREAS)),
    Joi.string().valid(...FOCUS_AREAS)
  ).optional(),
  severity: Joi.string().valid(...SEVERITY_LEVELS).default('all'),
  projectId: Joi.string().hex().length(24).optional(),
});

export const getReviewParamsSchema = Joi.object({
  reviewId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid review ID',
    'any.required': 'Review ID is required',
  }),
});

export const getMyReviewsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  status: Joi.string().valid('pending', 'analyzing', 'completed', 'failed').optional(),
});
