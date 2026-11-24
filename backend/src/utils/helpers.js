import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a cryptographically secure random token
 */
export const generateToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Hash a token using SHA-256
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate a unique transaction reference
 */
export const generateTxRef = (prefix = 'SKH') => {
  return `${prefix}-${crypto.randomUUID()}`;
};

/**
 * Generate UUID
 */
export const generateUUID = () => uuidv4();

/**
 * Calculate platform commission
 */
export const calculateCommission = (amount, rate = 0.10) => {
  const commission = parseFloat((amount * rate).toFixed(2));
  const netAmount = parseFloat((amount - commission).toFixed(2));
  return { commission, netAmount, grossAmount: amount };
};

/**
 * Resolve the commission snapshot to use when releasing an escrow.
 *
 * The escrow created at funding time is the source of truth, so changing the
 * platform commission rate later never silently alters an existing transaction.
 * Falls back to computing from `fallbackRate` when no escrow snapshot exists.
 */
export const resolveCommissionSnapshot = (escrow, amount, fallbackRate = 0) => {
  if (escrow && Number.isFinite(escrow.commissionAmount) && Number.isFinite(escrow.freelancerAmount)) {
    return {
      commissionRate: Number.isFinite(escrow.commissionRate) ? escrow.commissionRate : fallbackRate,
      commission: escrow.commissionAmount,
      netAmount: escrow.freelancerAmount,
    };
  }
  const rate = Number.isFinite(fallbackRate) ? fallbackRate : 0;
  const commission = parseFloat((amount * rate).toFixed(2));
  return {
    commissionRate: rate,
    commission,
    netAmount: parseFloat((amount - commission).toFixed(2)),
  };
};

/**
 * Slugify a string
 */
export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

/**
 * Parse pagination params
 */
export const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Build MongoDB sort object from query string
 * e.g. sortBy=createdAt:desc
 */
export const buildSortObject = (sortBy) => {
  if (!sortBy) return { createdAt: -1 };

  const parts = sortBy.split(':');
  const field = parts[0];
  const order = parts[1] === 'asc' ? 1 : -1;
  return { [field]: order };
};

/**
 * Sanitize user object - remove sensitive fields
 */
export const sanitizeUser = (user) => {
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.password;
  delete userObj.refreshTokens;
  delete userObj.passwordResetToken;
  delete userObj.emailVerificationToken;
  delete userObj.__v;
  return userObj;
};

/**
 * Format currency
 */
export const formatCurrency = (amount, currency = 'ETB') => {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

/**
 * Calculate deadline date from days
 */
export const calculateDeadline = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + parseInt(days, 10));
  return date;
};

/**
 * Mask sensitive data
 */
export const maskEmail = (email) => {
  const [user, domain] = email.split('@');
  const maskedUser = user.charAt(0) + '*'.repeat(user.length - 2) + user.charAt(user.length - 1);
  return `${maskedUser}@${domain}`;
};

