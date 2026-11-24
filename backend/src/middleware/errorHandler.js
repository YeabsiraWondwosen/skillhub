import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/apiResponse.js';

/**
 * Convert known error types to ApiError
 */
const normalizeError = (err) => {
  // Already an ApiError
  if (err instanceof ApiError) return err;

  // AI provider unavailable (not configured, quota exhausted, or all models down).
  // Surface an honest 503 instead of a generic 500 so the client can show the
  // real reason rather than a fabricated "successful" AI result.
  if (err.name === 'AIUnavailableError') {
    return new ApiError(503, err.message || 'AI service is temporarily unavailable.');
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return new ApiError(400, `Invalid ${err.path}: ${err.value}`);
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return new ApiError(400, 'Validation failed', messages);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return new ApiError(409, `${field} already exists`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return new ApiError(401, 'Invalid token. Please log in again.');
  }
  if (err.name === 'TokenExpiredError') {
    return new ApiError(401, 'Token expired. Please log in again.');
  }
  if (err.name === 'NotBeforeError') {
    return new ApiError(401, 'Token not yet valid.');
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new ApiError(400, 'File too large. Maximum size is 10MB.');
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new ApiError(400, 'Too many files uploaded at once.');
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new ApiError(400, `Unexpected field: ${err.field}`);
  }

  // CORS error
  if (err.message && err.message.startsWith('CORS blocked')) {
    return new ApiError(403, err.message);
  }

  // Default to 500
  return new ApiError(
    err.statusCode || 500,
    err.message || 'Internal Server Error'
  );
};

// Token-carrying route prefixes. The token travels in the URL path for these
// endpoints (e.g. /api/v1/auth/verify-email/<token>), so it must never reach
// logs.
const TOKEN_ROUTE_SEGMENTS = new Set(['verify-email-change']);

/**
 * Redact sensitive tokens from a request URL before it is logged.
 * Email verification / email-change tokens are 64-char hex strings and are
 * also caught generically if any future route puts one in the path.
 */
const sanitizeUrl = (url = '') => {
  if (!url) return url;
  return url
    .split('/')
    .map((segment, index, parts) => {
      const isTokenSegment =
        index > 0 &&
        (TOKEN_ROUTE_SEGMENTS.has(parts[index - 1]) ||
          /^[0-9a-f]{64}/.test(segment));
      return isTokenSegment ? '[REDACTED]' : segment;
    })
    .join('/');
};

/**
 * Global error handler middleware
 */
export const globalErrorHandler = (err, req, res, next) => {
  const normalizedError = normalizeError(err);
  const safeUrl = sanitizeUrl(req.originalUrl);

  // Log the error
  if (normalizedError.statusCode >= 500) {
    logger.error({
      message: normalizedError.message,
      stack: err.stack,
      url: safeUrl,
      method: req.method,
      ip: req.ip,
      userId: req.user?._id,
    });
  } else if (config.isDev) {
    logger.warn({
      message: normalizedError.message,
      url: safeUrl,
      method: req.method,
    });
  }

  const response = {
    success: false,
    statusCode: normalizedError.statusCode,
    message: normalizedError.message,
  };

  if (normalizedError.code) {
    response.code = normalizedError.code;
  }

  if (normalizedError.errors?.length > 0) {
    response.errors = normalizedError.errors;
  }

  // Include stack trace only in development
  if (config.isDev) {
    response.stack = err.stack;
  }

  res.status(normalizedError.statusCode).json(response);
};

/**
 * Handle 404 for unmatched routes (use before globalErrorHandler)
 */
export const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};
