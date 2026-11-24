import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/apiResponse.js';

// When RATE_LIMIT_DISABLED=true, ALL rate limiters are bypassed. This is NOT
// automatic in development — only explicit opt-in. The production environment
// always enforces rate limits. Set RATE_LIMIT_DISABLED=true only in local
// development when you need to make rapid requests without throttling.
const createLimiter = (options) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.RATE_LIMIT_DISABLED === 'true',
    handler: (req, res, next) => {
      next(
        new ApiError(
          429,
          options.message || 'Too many requests. Please try again later.'
        )
      );
    },
    ...options,
  });

/**
 * General API rate limiter — 200 req / 15 min per IP
 */
export const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP. Please try again in 15 minutes.',
});

/**
 * Auth endpoints — 10 attempts / 15 min per IP
 */
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true,
});

/**
 * Password reset — 5 attempts / hour per IP
 */
export const passwordResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many password reset attempts. Please try again in an hour.',
});

/**
 * File upload — 20 uploads / 10 min per user
 */
export const uploadLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many file uploads. Please try again in 10 minutes.',
});

/**
 * Payment endpoints — 30 req / 15 min
 */
export const paymentLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many payment requests. Please try again in 15 minutes.',
});

/**
 * Search endpoints — 60 req / min
 */
export const searchLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many search requests. Please slow down.',
});

/**
 * Message sending — 60 msgs / min
 */
export const messageLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Sending messages too fast. Please slow down.',
});

/**
 * Refresh-token endpoint — 15 requests / 15 min per IP
 * Separate from authLimiter so a refresh-token leak cannot block login/register.
 */
export const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many token refresh requests. Please try again later.',
});

export const emailVerificationLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many verification attempts, please try again later.',
});

export const otpResendLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many verification code requests, please try again later.',
});
