import Joi from 'joi';

export const createProjectPlanSchema = Joi.object({
  projectDescription: Joi.string().trim().min(20).max(5000).required().messages({
    'string.min': 'Project description must be at least 20 characters',
    'string.max': 'Project description cannot exceed 5000 characters',
    'any.required': 'Project description is required',
  }),
  projectName: Joi.string().trim().max(200).allow('', null).optional(),
  budget: Joi.number().min(0).optional(),
  deadline: Joi.date().greater('now').optional(),
  teamSize: Joi.number().integer().min(1).max(100).optional(),
});

export const planQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
});
