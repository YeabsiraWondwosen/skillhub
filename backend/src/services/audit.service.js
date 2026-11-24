import { AuditLog } from '../models/index.js';
import { logger } from '../utils/logger.js';

export const logAudit = async ({
  userId = null,
  action,
  category,
  resourceType = '',
  resourceId = null,
  details = {},
  amount = null,
  currency = '',
  reference = '',
  ipAddress = '',
  userAgent = '',
  status = 'success',
  errorMessage = '',
}) => {
  try {
    const log = await AuditLog.create({
      user: userId,
      action,
      category,
      resourceType,
      resourceId,
      details,
      amount,
      currency,
      reference,
      ipAddress,
      userAgent,
      status,
      errorMessage,
    });
    return log;
  } catch (error) {
    logger.error(`Audit log creation failed: ${error.message}`);
    return null;
  }
};

export const getAuditLogs = async (filters = {}, { page = 1, limit = 50 } = {}) => {
  const skip = (Math.max(1, page) - 1) * limit;
  const total = await AuditLog.countDocuments(filters);
  const logs = await AuditLog.find(filters)
    .populate('user', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    logs,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const getAuditSummary = async (startDate, endDate) => {
  const matchFilter = {};
  if (startDate || endDate) {
    matchFilter.createdAt = {};
    if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
    if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
  }

  const summary = await AuditLog.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: { category: '$category', status: '$status' },
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
      },
    },
    { $sort: { '_id.category': 1 } },
  ]);

  return summary;
};
