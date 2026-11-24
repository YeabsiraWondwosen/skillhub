import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { ApiError } from '../utils/apiResponse.js';
import { User } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';

/**
 * Verify access token and attach user to request
 */
export const protect = catchAsync(async (req, res, next) => {
  let token;

  // 1. Extract token from Authorization header or cookie
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw new ApiError(401, 'Access denied. No token provided.');
  }

  // 2. Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.accessSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Access token expired. Please refresh your token.');
    }
    throw new ApiError(401, 'Invalid access token.');
  }

  // 3. Check user still exists and is active
  const user = await User.findById(decoded.userId).select(
    '-password -refreshTokens -emailVerificationToken -passwordResetToken'
  );

  if (!user) {
    throw new ApiError(401, 'User no longer exists.');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated.');
  }

  if (user.isBanned) {
    throw new ApiError(403, `Your account has been banned. Reason: ${user.banReason || 'Violation of terms'}`);
  }

  // 4. Check if password changed after token was issued (security)
  // This is optional — skipped if passwordChangedAt not tracked
  // if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000) {
  //   throw new ApiError(401, 'Password changed recently. Please log in again.');
  // }

  req.user = user;
  next();
});

/**
 * Require the authenticated user to have a verified email address.
 * Must be used after `protect`.
 */
export const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required.'));
  }
  if (!req.user.isEmailVerified) {
    const err = new ApiError(403, 'Please verify your email address to continue.');
    err.code = 'EMAIL_NOT_VERIFIED';
    return next(err);
  }
  return next();
};

/**
 * Optional authentication — attaches user if token present, continues if not
 */
export const optionalAuth = catchAsync(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    const user = await User.findById(decoded.userId).select(
      '-password -refreshTokens -emailVerificationToken -passwordResetToken'
    );
    if (user && user.isActive && !user.isBanned) {
      req.user = user;
    }
  } catch {
    // Silently ignore invalid/expired token in optional auth
  }

  next();
});

/**
 * Verify that the access token payload matches expected structure (type-safe guard)
 */
export const verifyTokenPayload = (payload) => {
  if (!payload?.userId || !payload?.role || !payload?.tokenType) {
    throw new ApiError(401, 'Malformed token payload.');
  }
};
