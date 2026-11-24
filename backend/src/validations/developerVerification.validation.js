import Joi from 'joi';

export const submitIdentitySchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(200).required().messages({
    'any.required': 'Full name is required',
  }),
  dateOfBirth: Joi.date().max('now').required().messages({
    'any.required': 'Date of birth is required',
  }),
  documentType: Joi.string().valid('passport', 'drivers_license', 'national_id').required().messages({
    'any.only': 'Document type must be passport, drivers_license, or national_id',
    'any.required': 'Document type is required',
  }),
  country: Joi.string().trim().max(100).required().messages({
    'any.required': 'Country is required',
  }),
});

export const submitGithubSchema = Joi.object({
  username: Joi.string().trim().min(1).max(39).required().messages({
    'any.required': 'GitHub username is required',
    'string.max': 'GitHub username cannot exceed 39 characters',
  }),
});

export const submitPortfolioSchema = Joi.object({
  websiteUrl: Joi.string().uri().required().messages({
    'any.required': 'Portfolio website URL is required',
    'string.uri': 'Must be a valid URL',
  }),
  projectDescription: Joi.string().trim().min(20).max(2000).required().messages({
    'string.min': 'Project description must be at least 20 characters',
    'any.required': 'Project description is required',
  }),
  technologiesUsed: Joi.array().items(Joi.string().trim().max(50)).min(1).max(20).required().messages({
    'array.min': 'At least one technology is required',
    'any.required': 'Technologies used is required',
  }),
  liveProjectUrl: Joi.string().uri().allow('', null).optional(),
  sourceCodeUrl: Joi.string().uri().allow('', null).optional(),
  clientTestimonial: Joi.string().trim().max(1000).allow('', null).optional(),
  clientName: Joi.string().trim().max(100).allow('', null).optional(),
});

export const reviewVerificationSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject', 'request_more_info').required().messages({
    'any.only': 'Action must be approve, reject, or request_more_info',
    'any.required': 'Action is required',
  }),
  notes: Joi.string().trim().max(1000).allow('', null).optional(),
  rejectionReason: Joi.string().trim().max(500).when('action', {
    is: 'reject',
    then: Joi.required().messages({
      'any.required': 'Rejection reason is required when rejecting',
    }),
    otherwise: Joi.optional().allow('', null),
  }),
});

export const verificationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  type: Joi.string().valid('identity', 'github', 'portfolio', 'skill').optional(),
  status: Joi.string()
    .custom((value, helpers) => {
      const allowed = ['pending', 'submitted', 'under_review', 'approved', 'rejected', 'expired'];
      const statuses = value.split(',').map((s) => s.trim());
      if (statuses.length === 0 || statuses.some((s) => !allowed.includes(s))) {
        return helpers.message('Status must be one or more of: pending, submitted, under_review, approved, rejected, expired');
      }
      return statuses.join(',');
    })
    .optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  sort: Joi.string().valid('latest', 'oldest', 'pending_first').optional(),
});
