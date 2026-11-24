import { ApiError } from '../utils/apiResponse.js';

/**
 * Role-Based Access Control
 * Usage: authorize('admin') or authorize('admin', 'client')
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
        )
      );
    }

    next();
  };
};

/**
 * Require user to be the owner of a resource or an admin
 * Usage: authorizeOwner('userId') where 'userId' is the field name in req.params
 */
export const authorizeOwner = (paramField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }

    const resourceOwnerId = req.params[paramField] || req.body[paramField];

    if (
      req.user.role === 'admin' ||
      req.user._id.toString() === resourceOwnerId?.toString()
    ) {
      return next();
    }

    return next(
      new ApiError(403, 'Access denied. You do not own this resource.')
    );
  };
};

/**
 * Require verified freelancer status
 */
export const requireVerifiedFreelancer = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required.'));
  }

  if (req.user.role !== 'freelancer') {
    return next(new ApiError(403, 'Only freelancers can access this resource.'));
  }

  if (!req.user.isVerifiedFreelancer) {
    return next(new ApiError(403, 'Your freelancer profile must be verified first.'));
  }

  next();
};

/**
 * Admin only shorthand
 */
export const adminOnly = authorize('admin');

/**
 * Freelancer only shorthand
 */
export const freelancerOnly = authorize('freelancer');

/**
 * Client only shorthand
 */
export const clientOnly = authorize('client');

/**
 * Freelancer or Admin
 */
export const freelancerOrAdmin = authorize('freelancer', 'admin');

/**
 * Client or Admin
 */
export const clientOrAdmin = authorize('client', 'admin');

/**
 * Any authenticated user (freelancer, client, admin)
 */
export const anyRole = authorize('freelancer', 'client', 'admin');
