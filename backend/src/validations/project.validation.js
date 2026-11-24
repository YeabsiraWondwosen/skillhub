import Joi from 'joi';
import { isDateOnlyInPast } from '../utils/dateValidation.js';

export const createMilestoneSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().max(2000).allow('', null),
  amount: Joi.number().min(1).required(),
  dueDate: Joi.date().custom((value, helpers) => {
    if (isDateOnlyInPast(value).valid) return value;
    return helpers.error('date.past');
  }, 'future due date').required().messages({
    'date.past': 'Milestone due date cannot be in the past',
    'any.required': 'Milestone due date is required',
  }),
  order: Joi.number().integer().min(0).default(0),
});

export const updateMilestoneSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200),
  description: Joi.string().max(2000).allow('', null),
  amount: Joi.number().min(1),
  dueDate: Joi.date().custom((value, helpers) => {
    if (isDateOnlyInPast(value).valid) return value;
    return helpers.error('date.past');
  }, 'future due date').messages({
    'date.past': 'Milestone due date cannot be in the past',
  }),
  order: Joi.number().integer().min(0),
}).min(1);

export const createTaskSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().max(1000).allow('', null),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  dueDate: Joi.date().allow(null).custom((value, helpers) => {
    if (!value) return value;
    if (isDateOnlyInPast(value).valid) return value;
    return helpers.error('date.past');
  }, 'future due date').messages({
    'date.past': 'Task due date cannot be in the past',
  }),
  assignedTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Assigned to must be a valid user id').allow(null, ''),
  order: Joi.number().integer().min(0).default(0),
});

export const updateTaskSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200),
  description: Joi.string().max(1000).allow('', null),
  status: Joi.string().valid('todo', 'in_progress', 'review', 'done'),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
  dueDate: Joi.date().allow(null),
  order: Joi.number().integer().min(0),
}).min(1);

const normalizeDemoUrl = (value, helpers) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return helpers.error('string.uri', { value });
    }
    return url.href;
  } catch {
    return helpers.error('string.uri', { value });
  }
};

const deliveryUrl = Joi.string().trim().max(2048).allow('', null).custom(normalizeDemoUrl).messages({
  'string.uri': 'Live demo URL must be a valid http(s) link',
});

export const submitDeliverySchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).allow('', null),
  message: Joi.string().trim().min(20).max(3000).required().messages({
    'string.min': 'Delivery message must be at least 20 characters',
  }),
  demoUrl: deliveryUrl,
});

export const updateDeliverySchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).allow('', null),
  message: Joi.string().trim().min(20).max(3000).messages({
    'string.min': 'Delivery message must be at least 20 characters',
  }),
  demoUrl: deliveryUrl,
}).min(1);

export const reviewDeliverySchema = Joi.object({
  action: Joi.string().valid('approve', 'request_revision').required(),
  revisionNote: Joi.string().max(2000).when('action', {
    is: 'request_revision',
    then: Joi.required().messages({ 'any.required': 'Revision note is required when requesting revision' }),
    otherwise: Joi.optional(),
  }),
});

export const updateProjectSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200),
  description: Joi.string().max(5000).allow('', null),
  clientNotes: Joi.string().max(2000).allow('', null),
  freelancerNotes: Joi.string().max(2000).allow('', null),
  status: Joi.string().valid('on_hold', 'active'),
}).min(1);
