import Joi from 'joi';

export const createJobSchema = Joi.object({
  title: Joi.string().trim().min(10).max(150).required(),
  description: Joi.string().trim().min(50).max(10000).required(),
  requiredSkills: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()).min(1).max(20),
    Joi.string().trim().min(1)
  ).required().messages({
    'any.required': 'At least one required skill is needed',
  }),
  budget: Joi.object({
    type: Joi.string().valid('fixed', 'hourly').required(),
    minAmount: Joi.number().min(0).default(0).allow('', null),
    maxAmount: Joi.number().min(1).required(),
    currency: Joi.string().uppercase().default('ETB'),
  }).required(),
  deadline: Joi.date().greater('now').required().messages({
    'date.greater': 'Deadline must be a future date',
  }),
  duration: Joi.string()
    .valid('less_than_1_week', '1_to_4_weeks', '1_to_3_months', '3_to_6_months', 'more_than_6_months')
    .default('1_to_4_weeks'),
  experienceLevel: Joi.string().valid('entry', 'intermediate', 'expert').required(),
  category: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'any.required': 'Category is required',
      'string.pattern.base': 'Category must be a valid ID',
    }),
  subcategories: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim().max(100)).max(10),
    Joi.string().trim()
  ).default([]),
  visibility: Joi.string().valid('public', 'invite_only').default('public'),
  isUrgent: Joi.boolean().default(false),
});

export const updateJobSchema = Joi.object({
  title: Joi.string().trim().min(10).max(150),
  description: Joi.string().trim().min(50).max(10000),
  requiredSkills: Joi.array().items(Joi.string().trim()).min(1).max(20),
  budget: Joi.object({
    type: Joi.string().valid('fixed', 'hourly'),
    minAmount: Joi.number().min(0),
    maxAmount: Joi.number().min(1),
    currency: Joi.string().uppercase(),
  }),
  deadline: Joi.date().greater('now'),
  duration: Joi.string().valid(
    'less_than_1_week', '1_to_4_weeks', '1_to_3_months', '3_to_6_months', 'more_than_6_months'
  ),
  experienceLevel: Joi.string().valid('entry', 'intermediate', 'expert'),
  category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
  subcategories: Joi.array().items(Joi.string().trim().max(100)).max(10),
  visibility: Joi.string().valid('public', 'invite_only'),
  isUrgent: Joi.boolean(),
}).min(1);

export const inviteFreelancerSchema = Joi.object({
  freelancerId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'A valid freelancer id is required',
  }),
});

// Query schema for the client "My Jobs" dashboard. `status` uses the simplified
// lifecycle statuses; the controller maps them to the underlying DB statuses.
export const myJobsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().max(200).allow('', null),
  status: Joi.string()
    .valid('all', 'open', 'in_progress', 'paused', 'completed', 'cancelled', 'draft')
    .allow('', null),
  sortBy: Joi.string()
    .valid('newest', 'oldest', 'budget_high', 'budget_low', 'proposals', 'deadline')
    .default('newest'),
});

export const jobQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  search: Joi.string().max(200).allow('', null),
  category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow('', null),
  subcategory: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow('', null),
  experienceLevel: Joi.string().valid('entry', 'intermediate', 'expert').allow('', null),
  budgetType: Joi.string().valid('fixed', 'hourly').allow('', null),
  minBudget: Joi.number().min(0).allow('', null),
  maxBudget: Joi.number().min(0).allow('', null),
  skills: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ).allow('', null),
  duration: Joi.string().allow('', null),
  sortBy: Joi.string()
    .valid('createdAt:desc', 'createdAt:asc', 'budget.maxAmount:desc', 'budget.maxAmount:asc', 'deadline:asc', 'best_match')
    .default('createdAt:desc'),
  isUrgent: Joi.boolean().allow('', null),
  status: Joi.string().valid('all', 'open', 'in_progress', 'completed').allow('', null).default('open'),
});
