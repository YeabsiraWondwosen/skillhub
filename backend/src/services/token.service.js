import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { ApiError } from '../utils/apiResponse.js';

/**
 * Generate a signed JWT access token
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(
    { ...payload, tokenType: 'access' },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn, issuer: 'skillhub', audience: 'skillhub-client' }
  );
};

/**
 * Generate a signed JWT refresh token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(
    { ...payload, tokenType: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn, issuer: 'skillhub', audience: 'skillhub-client' }
  );
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.accessSecret, {
      issuer: 'skillhub',
      audience: 'skillhub-client',
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new ApiError(401, 'Access token expired.');
    if (err.name === 'JsonWebTokenError') throw new ApiError(401, 'Invalid access token.');
    throw new ApiError(401, 'Token verification failed.');
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret, {
      issuer: 'skillhub',
      audience: 'skillhub-client',
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new ApiError(401, 'Refresh token expired. Please log in again.');
    if (err.name === 'JsonWebTokenError') throw new ApiError(401, 'Invalid refresh token.');
    throw new ApiError(401, 'Token verification failed.');
  }
};

/**
 * Build the token pair (access + refresh)
 */
export const generateTokenPair = (user) => {
  const payload = {
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Calculate refresh token expiry date for storage
  const refreshExpiresAt = new Date();
  const days = config.jwt.refreshExpiresIn.includes('d')
    ? parseInt(config.jwt.refreshExpiresIn)
    : 7;
  refreshExpiresAt.setDate(refreshExpiresAt.getDate() + days);

  return { accessToken, refreshToken, refreshExpiresAt };
};

/**
 * Set auth cookies on the response
 */
export const setAuthCookies = (res, accessToken, refreshToken) => {
  const isProduction = config.isProd;

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth/refresh',
  });
};

/**
 * Clear auth cookies
 */
export const clearAuthCookies = (res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });
};

/**
 * Hash a plain token for secure storage
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
