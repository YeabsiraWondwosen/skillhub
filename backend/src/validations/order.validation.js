import Joi from 'joi';
import { isDateOnlyInPast } from '../utils/dateValidation.js';

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Invalid ID format' });

const dateString = Joi.date()
  .iso()
  .allow(null, '')
  .custom((value, helpers) => {
    if (!value) return value;
    if (isDateOnlyInPast(value).valid) return value;
    return helpers.error('date.min');
  }, 'future date check')
  .messages({
    'date.min': 'Expected delivery date cannot be in the past',
    'date.base': 'Expected delivery date must be a valid ISO date',
    'date.format': 'Expected delivery date must be a valid date',
  });

export const placeOrderSchema = Joi.object({
  serviceId: objectId.required(),
  tier: Joi.string().valid('basic', 'standard', 'premium').required(),
  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().min(10).max(5000).allow(''),
  requirements: Joi.string().trim().min(10).max(5000).allow(''),
  expectedDelivery: dateString,
  additionalNotes: Joi.string().trim().max(2000).allow(''),
});

export const fundOrderSchema = Joi.object({});

export const acceptOrderSchema = Joi.object({});

export const declineOrderSchema = Joi.object({
  reason: Joi.string().trim().max(1000).allow(''),
});

export const cancelOrderSchema = Joi.object({});

export const deliverOrderSchema = Joi.object({
  message: Joi.string().trim().max(5000).allow(''),
});

export const requestRevisionSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(2000).required(),
});

export const completeOrderSchema = Joi.object({});

export const reportOrderSchema = Joi.object({
  reason: Joi.string()
    .valid(
      'spam',
      'fake_account',
      'inappropriate_content',
      'harassment',
      'scam',
      'copyright_violation',
      'false_information',
      'other'
    )
    .required(),
  description: Joi.string().trim().min(20).max(2000).required(),
});

export const listOrdersSchema = Joi.object({
  as: Joi.string().valid('client', 'freelancer'),
  status: Joi.string().valid(
    'pending_payment',
    'funded',
    'accepted',
    'delivered',
    'revision_requested',
    'completed',
    'declined',
    'cancelled',
    'disputed'
  ),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
});
