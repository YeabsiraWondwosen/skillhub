import Joi from 'joi';

export const estimateCostSchema = Joi.object({
  projectDescription: Joi.string().trim().min(20).max(5000).required().messages({
    'string.min': 'Project description must be at least 20 characters',
    'string.max': 'Project description cannot exceed 5000 characters',
    'any.required': 'Project description is required',
  }),
  projectName: Joi.string().trim().max(200).allow('', null).optional(),
});

export const estimateCostFromJobSchema = Joi.object({
  jobId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid job ID format',
    'string.length': 'Invalid job ID format',
    'any.required': 'Job ID is required',
  }),
});
