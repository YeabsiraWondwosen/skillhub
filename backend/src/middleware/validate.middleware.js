import Joi from 'joi';
import { ApiError } from '../utils/apiResponse.js';

/**
 * Validate request against a Joi schema
 * @param {Joi.ObjectSchema} schema
 * @param {'body'|'query'|'params'} source - which part of req to validate
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,       // collect all errors
      allowUnknown: false,     // reject unknown fields
      stripUnknown: true,      // remove unknown fields from value
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
        type: d.type,
        value: d.context?.value,
      }));
      return next(new ApiError(400, 'Validation failed', errors));
    }

    // Replace req[source] with sanitized value
    req[source] = value;
    next();
  };
};

/**
 * Validate multiple sources (body + query, etc.)
 */
export const validateMultiple = (schemas) => {
  return (req, res, next) => {
    const errors = [];

    for (const [source, schema] of Object.entries(schemas)) {
      const { error, value } = schema.validate(req[source], {
        abortEarly: false,
        allowUnknown: source === 'query', // queries can have extra params
        stripUnknown: true,
      });

      if (error) {
        errors.push(...error.details.map((d) => d.message.replace(/['"]/g, '')));
      } else {
        req[source] = value;
      }
    }

    if (errors.length > 0) {
      const formattedErrors = errors.map((msg, idx) => ({ message: msg }));
      return next(new ApiError(400, 'Validation failed', formattedErrors));
    }

    next();
  };
};

// ─── Common Joi Schemas ───────────────────────────────────────────────────────
export const commonSchemas = {
  objectId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({ 'string.pattern.base': 'Invalid ID format' }),

  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().default('createdAt:desc'),
    search: Joi.string().max(200).allow('', null),
  }),

  email: Joi.string().email().lowercase().trim(),
  password: Joi.string().min(8).max(72).pattern(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
  ).messages({
    'string.pattern.base':
      'Password must contain at least one uppercase, lowercase, number, and special character',
  }),
};
