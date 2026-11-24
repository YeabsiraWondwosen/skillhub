import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import { Payment, Transaction, Wallet, Escrow, Withdrawal, User, AuditLog, Project, Category, AdvancedAnalytics } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { getAuditLogs, getAuditSummary, logAudit } from '../services/audit.service.js';
import { generateInvoicePDF } from '../services/invoice.service.js';
import { config } from '../config/env.js';
import {
  getCommissionRate,
  persistCommissionRate,
  getPlatformSettings,
} from '../services/settings.service.js';
import { parseCommissionRate } from '../utils/settings.validation.js';

// ─── Helper: Date range filter builder ──────────────────────────────────────
// The end date is clipped to the end of the day (23:59:59.999) when provided as
// a plain yyyy-MM-dd so "Today" / "Last 7 Days" ranges include the full day.
const buildDateFilter = (startDate, endDate, field = 'createdAt') => {
  const filter = {};
  if (startDate || endDate) {
    filter[field] = {};
    if (startDate) filter[field].$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) end.setHours(23, 59, 59, 999);
      filter[field].$lte = end;
    }
  }
  return filter;
};

// ─── Helper: Legitimate payment filtering ─────────────────────────────────────
// A payment is a legitimate platform transaction when it is linked to at least
// one real entity: an existing user (payer or payee), an existing project, an
// existing service order, or an existing escrow. Orphan records (e.g. payments
// whose user was deleted from the DB) are excluded.
//
// By default demo/test records (provider === 'demo') are excluded because they
// never move real money. However, when the platform runs in demo mode the
// deposit endpoints record genuine user wallet top-ups as provider === 'demo'
// (they still credit the user's real wallet). For the Deposits page those are
// intentional test transactions tied to a real user, so includeDemo is enabled
// when querying type === 'deposit'.
const buildPaymentValidityStages = ({ projectOnly = true, includeDemo = false } = {}) => {
  const match = {
    $or: [
      { '__validPayer.0': { $exists: true } },
      { '__validPayee.0': { $exists: true } },
      { '__validProject.0': { $exists: true } },
      { '__validOrder.0': { $exists: true } },
      { '__validEscrow.0': { $exists: true } },
    ],
  };
  if (!includeDemo) match.provider = { $ne: 'demo' };
  return [
    { $lookup: { from: 'users', localField: 'payer', foreignField: '_id', as: '__validPayer' } },
    { $lookup: { from: 'users', localField: 'payee', foreignField: '_id', as: '__validPayee' } },
    { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: '__validProject' } },
    { $lookup: { from: 'serviceorders', localField: 'serviceOrder', foreignField: '_id', as: '__validOrder' } },
    { $lookup: { from: 'escrows', localField: 'metadata.escrowId', foreignField: '_id', as: '__validEscrow' } },
    { $match: match },
    ...(projectOnly ? [{ $project: { _id: 1 } }] : []),
  ];
};

const getValidPaymentIds = async (match, options = {}) => {
  const docs = await Payment.aggregate([{ $match: match }, ...buildPaymentValidityStages(options)]);
  return docs.map((d) => d._id);
};

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCIAL OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

export const getFinancialOverview = catchAsync(async (req, res) => {
  const dateFilter = buildDateFilter(req.query.startDate, req.query.endDate);
  const validRecentIds = await getValidPaymentIds(dateFilter);

  const [
    totalRevenue,
    totalCommissions,
    activeEscrows,
    pendingWithdrawals,
    completedWithdrawals,
    failedWithdrawals,
    totalWithdrawals,
    recentPayments,
    walletStats,
    paymentStats,
    escrowStats,
    refundStats,
    userStats,
    contractStats,
  ] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'completed', ...dateFilter } },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 }, avgAmount: { $avg: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'commission', status: 'completed', ...dateFilter } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Escrow.aggregate([
      { $match: { status: { $in: ['funded', 'in_progress', 'submitted'] } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Withdrawal.countDocuments({ status: { $in: ['pending', 'processing'] } }),
    Withdrawal.countDocuments({ status: 'completed' }),
    Withdrawal.countDocuments({ status: 'failed' }),
    Withdrawal.aggregate([
      { $match: { status: 'completed', ...dateFilter } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.find({ _id: { $in: validRecentIds }, ...dateFilter }).sort({ createdAt: -1 }).limit(10)
      .populate('payer', 'firstName lastName email role')
      .populate('payee', 'firstName lastName email role')
      .populate('project', 'title')
      .populate('milestone', 'title')
      .populate({
        path: 'serviceOrder',
        select: 'title orderNumber status budget',
        populate: [
          { path: 'service', select: 'title slug' },
          { path: 'client', select: 'firstName lastName email' },
          { path: 'freelancer', select: 'firstName lastName email' },
        ],
      }),
    Wallet.aggregate([
      { $group: {
        _id: null,
        totalBalance: { $sum: '$balance' },
        totalEscrow: { $sum: '$escrowBalance' },
        totalEarned: { $sum: '$totalEarned' },
        totalWithdrawn: { $sum: '$totalWithdrawn' },
        walletCount: { $sum: 1 },
      } },
    ]),
    // Payment stats by status
    Payment.aggregate([
      { $match: { ...dateFilter } },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    // Escrow stats by status
    Escrow.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    // Refund stats
    Payment.aggregate([
      { $match: { type: 'refund', ...dateFilter } },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    // User stats
    Promise.all([
      User.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      User.countDocuments({ role: 'freelancer', isActive: true }),
      User.countDocuments({ role: 'client', isActive: true }),
    ]),
    // Active contracts (escrows that are funded/in_progress/submitted)
    Escrow.aggregate([
      { $match: { status: { $in: ['funded', 'in_progress', 'submitted'] } } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
  ]);

  const revenue = totalRevenue[0] || { total: 0, count: 0, avgAmount: 0 };
  const commissions = totalCommissions[0] || { total: 0, count: 0 };
  const escrows = activeEscrows[0] || { total: 0, count: 0 };
  const wallets = walletStats[0] || { totalBalance: 0, totalEscrow: 0, totalEarned: 0, totalWithdrawn: 0, walletCount: 0 };
  const withdrawalAgg = totalWithdrawals[0] || { total: 0, count: 0 };

  // Parse payment stats
  const psByStatus = {};
  paymentStats.forEach(s => { psByStatus[s._id] = { count: s.count, total: s.total }; });

  // Parse escrow stats
  const esByStatus = {};
  escrowStats.forEach(s => { esByStatus[s._id] = { count: s.count, total: s.total }; });

  // Parse refund stats
  const rsByStatus = {};
  refundStats.forEach(s => { rsByStatus[s._id] = { count: s.count, total: s.total }; });

  // Contracts
  const activeContractCount = contractStats.reduce((sum, c) => sum + c.count, 0);
  const activeContractAmount = contractStats.reduce((sum, c) => sum + c.total, 0);

  // Revenue growth (compare this month vs last month)
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [thisMonthRevenue, lastMonthRevenue] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: thisMonthStart } } },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: lastMonthStart, $lt: thisMonthStart } } },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const thisMonth = thisMonthRevenue[0]?.total || 0;
  const lastMonth = lastMonthRevenue[0]?.total || 0;
  const revenueGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth * 100) : 0;

  // Platform profit = commissions collected - operational costs (future: configurable)
  const platformProfit = commissions.total;
  const operationalCosts = 0; // future-ready
  const netProfit = platformProfit - operationalCosts;

  sendResponse(res, 200, 'Financial overview fetched', {
    revenue: {
      total: revenue.total,
      transactionCount: revenue.count,
      avgTransaction: revenue.avgAmount,
      monthlyRecurring: thisMonth,
      growthPercent: parseFloat(revenueGrowth.toFixed(1)),
    },
    commissions: {
      total: commissions.total,
      count: commissions.count,
    },
    platform: {
      balance: wallets.totalBalance,
      profit: platformProfit,
      operationalCosts,
      netProfit,
    },
    escrows: {
      activeAmount: escrows.total,
      activeCount: escrows.count,
      pendingAmount: (esByStatus.pending?.total || 0),
      pendingCount: (esByStatus.pending?.count || 0),
      releasedAmount: (esByStatus.released?.total || 0),
      releasedCount: (esByStatus.released?.count || 0),
      disputedAmount: (esByStatus.disputed?.total || 0),
      disputedCount: (esByStatus.disputed?.count || 0),
      refundedAmount: (esByStatus.refunded?.total || 0),
      refundedCount: (esByStatus.refunded?.count || 0),
    },
    withdrawals: {
      pending: pendingWithdrawals,
      completed: completedWithdrawals,
      failed: failedWithdrawals,
      totalAmount: withdrawalAgg.total,
      totalCount: withdrawalAgg.count,
    },
    refunds: {
      pending: (rsByStatus.pending?.count || 0) + (rsByStatus.processing?.count || 0),
      approved: (rsByStatus.completed?.count || 0),
      rejected: (rsByStatus.failed?.count || 0),
      totalAmount: Object.values(rsByStatus).reduce((sum, s) => sum + (s.total || 0), 0),
    },
    payments: {
      successful: (psByStatus.completed?.count || 0),
      failed: (psByStatus.failed?.count || 0),
      pending: (psByStatus.pending?.count || 0),
      total: revenue.count,
    },
    contracts: {
      active: activeContractCount,
      activeEscrow: activeContractAmount,
    },
    wallets,
    users: {
      newToday: userStats[0],
      activeFreelancers: userStats[1],
      activeClients: userStats[2],
    },
    recentPayments,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

export const getRevenueByPeriod = catchAsync(async (req, res) => {
  const { period = 'daily', startDate, endDate } = req.query;

  let groupId;
  if (period === 'daily') {
    groupId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };
  } else if (period === 'weekly') {
    groupId = { year: { $year: '$createdAt' }, week: { $isoWeek: '$createdAt' } };
  } else if (period === 'yearly') {
    groupId = { year: { $year: '$createdAt' } };
  } else {
    groupId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
  }

  const dateFilter = { status: 'completed', ...buildDateFilter(startDate, endDate) };

  const [revenue, commissions] = await Promise.all([
    Payment.aggregate([
      { $match: dateFilter },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: groupId, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'commission', status: 'completed', ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {}) } },
      { $group: { _id: groupId, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 } },
    ]),
  ]);

  sendResponse(res, 200, 'Revenue by period fetched', { revenue, commissions, period });
});

export const getAnalyticsTrends = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateFilter = buildDateFilter(startDate, endDate);

  const [depositTrend, withdrawalTrend, refundTrend, escrowTrend, transactionVolume] = await Promise.all([
    Payment.aggregate([
      { $match: { type: 'deposit', status: 'completed', ...dateFilter } },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'withdrawal', status: 'completed', ...dateFilter } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]),
    Payment.aggregate([
      { $match: { type: 'refund', ...dateFilter } },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]),
    Escrow.aggregate([
      { $match: { ...dateFilter } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]),
    Transaction.aggregate([
      { $match: { ...dateFilter } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]),
  ]);

  sendResponse(res, 200, 'Analytics trends fetched', {
    deposits: depositTrend,
    withdrawals: withdrawalTrend,
    refunds: refundTrend,
    escrows: escrowTrend,
    transactions: transactionVolume,
  });
});

export const getCategoryRevenue = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateFilter = buildDateFilter(startDate, endDate);

  const categoryRevenue = await Payment.aggregate([
    { $match: { status: 'completed', ...dateFilter } },
    ...buildPaymentValidityStages({ projectOnly: false }),
    { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'projectData' } },
    { $unwind: { path: '$projectData', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'categories', localField: 'projectData.category', foreignField: '_id', as: 'categoryData' } },
    { $unwind: { path: '$categoryData', preserveNullAndEmptyArrays: true } },
    { $group: {
      _id: { $ifNull: ['$categoryData.name', 'Uncategorized'] },
      totalRevenue: { $sum: '$amount' },
      totalCommission: { $sum: '$commission' },
      count: { $sum: 1 },
    } },
    { $sort: { totalRevenue: -1 } },
    { $limit: 20 },
  ]);

  sendResponse(res, 200, 'Category revenue fetched', categoryRevenue);
});

export const getTopCategories = catchAsync(async (req, res) => {
  const topCategories = await Payment.aggregate([
    { $match: { status: 'completed' } },
    ...buildPaymentValidityStages({ projectOnly: false }),
    { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'projectData' } },
    { $unwind: { path: '$projectData', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'categories', localField: 'projectData.category', foreignField: '_id', as: 'categoryData' } },
    { $unwind: { path: '$categoryData', preserveNullAndEmptyArrays: true } },
    { $group: {
      _id: { $ifNull: ['$categoryData.name', 'Uncategorized'] },
      totalRevenue: { $sum: '$amount' },
      transactionCount: { $sum: 1 },
      avgAmount: { $avg: '$amount' },
    } },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 },
  ]);

  sendResponse(res, 200, 'Top categories fetched', topCategories);
});

export const getTopClientsBySpending = catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;

  const topClients = await Payment.aggregate([
    { $match: { status: 'completed', type: { $in: ['deposit', 'milestone_payment', 'project_payment'] } } },
    ...buildPaymentValidityStages({ projectOnly: false }),
    { $group: {
      _id: '$payer',
      totalSpent: { $sum: '$amount' },
      transactionCount: { $sum: 1 },
      avgAmount: { $avg: '$amount' },
    } },
    { $sort: { totalSpent: -1 } },
    { $limit: parseInt(limit) },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { _id: 1, totalSpent: 1, transactionCount: 1, avgAmount: 1, 'user.firstName': 1, 'user.lastName': 1, 'user.email': 1, 'user.avatar': 1 } },
  ]);

  sendResponse(res, 200, 'Top clients fetched', topClients);
});

export const getTopFreelancersByEarnings = catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;

  const topFreelancers = await Transaction.aggregate([
    { $match: { type: 'escrow_release', status: 'completed' } },
    { $group: {
      _id: '$user',
      totalEarned: { $sum: '$amount' },
      transactionCount: { $sum: 1 },
      avgAmount: { $avg: '$amount' },
    } },
    { $sort: { totalEarned: -1 } },
    { $limit: parseInt(limit) },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { _id: 1, totalEarned: 1, transactionCount: 1, avgAmount: 1, 'user.firstName': 1, 'user.lastName': 1, 'user.email': 1, 'user.avatar': 1 } },
  ]);

  sendResponse(res, 200, 'Top freelancers fetched', topFreelancers);
});

export const getTopEarners = catchAsync(async (req, res) => {
  const { limit = 10, startDate, endDate } = req.query;
  const dateFilter = { type: 'escrow_release', status: 'completed', ...buildDateFilter(startDate, endDate) };

  const topEarners = await Transaction.aggregate([
    { $match: dateFilter },
    { $group: {
      _id: '$user',
      totalEarned: { $sum: '$amount' },
      transactionCount: { $sum: 1 },
      avgAmount: { $avg: '$amount' },
    } },
    { $sort: { totalEarned: -1 } },
    { $limit: parseInt(limit) },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { _id: 1, totalEarned: 1, transactionCount: 1, avgAmount: 1, 'user.firstName': 1, 'user.lastName': 1, 'user.email': 1, 'user.avatar': 1 } },
  ]);

  sendResponse(res, 200, 'Top earners fetched', topEarners);
});

export const getUserGrowth = catchAsync(async (req, res) => {
  const { period = 'daily', startDate, endDate } = req.query;

  let groupId;
  if (period === 'daily') {
    groupId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };
  } else if (period === 'weekly') {
    groupId = { year: { $year: '$createdAt' }, week: { $isoWeek: '$createdAt' } };
  } else {
    groupId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
  }

  const dateFilter = buildDateFilter(startDate, endDate);

  const userGrowth = await User.aggregate([
    { $match: dateFilter },
    { $group: { _id: { ...groupId, role: '$role' }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 } },
  ]);

  sendResponse(res, 200, 'User growth fetched', userGrowth);
});

export const getHeatMapData = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateFilter = buildDateFilter(startDate, endDate);

  const heatMap = await Transaction.aggregate([
    { $match: { status: 'completed', ...dateFilter } },
    { $group: {
      _id: {
        dayOfWeek: { $dayOfWeek: '$createdAt' },
        hour: { $hour: '$createdAt' },
      },
      count: { $sum: 1 },
      totalAmount: { $sum: '$amount' },
    } },
    { $sort: { '_id.dayOfWeek': 1, '_id.hour': 1 } },
  ]);

  sendResponse(res, 200, 'Heat map data fetched', heatMap);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ESCROW MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export const getAllEscrows = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, search, startDate, endDate } = req.query;

  const filter = { ...buildDateFilter(startDate, endDate) };
  if (status) {
    const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
    filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }

  const total = await Escrow.countDocuments(filter);
  const escrows = await Escrow.find(filter)
    .populate('client', 'firstName lastName email')
    .populate('freelancer', 'firstName lastName email')
    .populate('project', 'title category status')
    .populate('milestone', 'title')
    .populate('serviceOrder', 'orderNumber status title')
    .populate('paymentId', 'reference invoiceNumber status provider amount currency')
    .populate('fundingTransaction', 'reference type amount status createdAt')
    .populate('releaseTransaction', 'reference type amount status createdAt')
    .populate('refundTransaction', 'reference type amount status createdAt')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Escrows fetched', escrows, paginationMeta(total, page, limit));
});

export const getPaymentTransactions = catchAsync(async (req, res) => {
  const { paymentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(paymentId)) throw new ApiError(400, 'Invalid payment id');

  const payment = await Payment.findById(paymentId);
  if (!payment) throw new ApiError(404, 'Payment not found');

  const transactions = await Transaction.find({ $or: [{ paymentId }, { reference: payment.reference }] })
    .populate('user', 'firstName lastName email')
    .sort({ createdAt: -1 });

  sendResponse(res, 200, 'Payment transactions fetched', transactions);
});

export const getEscrowStats = catchAsync(async (req, res) => {
  const stats = await Escrow.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
  ]);

  sendResponse(res, 200, 'Escrow stats fetched', stats);
});

export const adminReleaseEscrow = catchAsync(async (req, res) => {
  const { escrowId } = req.params;
  const { adminNotes } = req.body;

  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw new ApiError(404, 'Escrow not found');
  if (!['funded', 'in_progress', 'submitted'].includes(escrow.status)) {
    throw new ApiError(400, `Escrow is ${escrow.status}, cannot release`);
  }

  const result = await (await import('../services/payment.service.js')).releaseEscrowFunds(escrowId, escrow.client, {});

  await logAudit({
    userId: req.user._id,
    action: 'admin_escrow_release',
    category: 'escrow',
    resourceType: 'Escrow',
    resourceId: escrow._id,
    amount: escrow.amount,
    currency: escrow.currency,
    details: { adminNotes, releasedTo: escrow.freelancer },
  });

  sendResponse(res, 200, 'Escrow released by admin', result.escrow);
});

export const adminHoldEscrow = catchAsync(async (req, res) => {
  const { escrowId } = req.params;
  const { adminNotes } = req.body;

  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw new ApiError(404, 'Escrow not found');

  escrow.metadata = { ...escrow.metadata, heldByAdmin: true, heldAt: new Date(), adminNotes };
  await escrow.save();

  await logAudit({
    userId: req.user._id,
    action: 'admin_escrow_hold',
    category: 'escrow',
    resourceType: 'Escrow',
    resourceId: escrow._id,
    amount: escrow.amount,
    currency: escrow.currency,
    details: { adminNotes },
  });

  sendResponse(res, 200, 'Escrow held by admin', escrow);
});

export const adminRefundEscrow = catchAsync(async (req, res) => {
  const { escrowId } = req.params;
  const { adminNotes } = req.body;

  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw new ApiError(404, 'Escrow not found');
  if (['released', 'refunded', 'cancelled'].includes(escrow.status)) {
    throw new ApiError(400, `Escrow is ${escrow.status}, cannot refund`);
  }

  const result = await (await import('../services/payment.service.js')).refundEscrowFunds(escrowId, req.user._id, { reason: adminNotes || 'Admin refund' });

  await logAudit({
    userId: req.user._id,
    action: 'admin_escrow_refund',
    category: 'escrow',
    resourceType: 'Escrow',
    resourceId: escrow._id,
    amount: escrow.amount,
    currency: escrow.currency,
    details: { adminNotes },
  });

  sendResponse(res, 200, 'Escrow refunded by admin', result.escrow);
});

export const adminResolveDispute = catchAsync(async (req, res) => {
  const { escrowId } = req.params;
  const { resolution, releaseTo, adminNotes } = req.body;

  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw new ApiError(404, 'Escrow not found');
  if (escrow.status !== 'disputed') throw new ApiError(400, 'Escrow is not in dispute');

  let result;
  if (releaseTo === 'freelancer') {
    result = await (await import('../services/payment.service.js')).releaseEscrowFunds(escrowId, escrow.client, {});
  } else {
    result = await (await import('../services/payment.service.js')).refundEscrowFunds(escrowId, req.user._id, { reason: resolution || adminNotes });
  }

  escrow.disputeResolvedAt = new Date();
  escrow.metadata = { ...escrow.metadata, disputeResolution: resolution, resolvedBy: req.user._id, adminNotes };
  await escrow.save();

  await logAudit({
    userId: req.user._id,
    action: 'admin_dispute_resolved',
    category: 'escrow',
    resourceType: 'Escrow',
    resourceId: escrow._id,
    amount: escrow.amount,
    currency: escrow.currency,
    details: { resolution, releaseTo, adminNotes },
  });

  sendResponse(res, 200, 'Dispute resolved', result.escrow);
});

export const getEscrowTimeline = catchAsync(async (req, res) => {
  const { escrowId } = req.params;

  const escrow = await Escrow.findById(escrowId)
    .populate('client', 'firstName lastName email')
    .populate('freelancer', 'firstName lastName email')
    .populate('project', 'title category status')
    .populate('milestone', 'title')
    .populate('serviceOrder', 'orderNumber status title')
    .populate('paymentId', 'reference invoiceNumber status provider amount currency')
    .populate('fundingTransaction', 'reference type amount status createdAt')
    .populate('releaseTransaction', 'reference type amount status createdAt')
    .populate('refundTransaction', 'reference type amount status createdAt')
    .populate('releasedBy', 'firstName lastName')
    .populate('refundedBy', 'firstName lastName')
    .populate('disputeOpenedBy', 'firstName lastName');

  if (!escrow) throw new ApiError(404, 'Escrow not found');

  const timeline = [];
  timeline.push({ event: 'created', date: escrow.createdAt, by: escrow.client, details: `Escrow created for ${escrow.amount} ${escrow.currency}` });
  if (escrow.fundedAt) timeline.push({ event: 'funded', date: escrow.fundedAt, by: escrow.client, details: `Funded ${escrow.amount} ${escrow.currency}` });
  if (escrow.status === 'in_progress' || escrow.submittedAt || escrow.releasedAt || escrow.refundedAt) {
    timeline.push({ event: 'in_progress', date: escrow.updatedAt, by: escrow.freelancer, details: 'Work started' });
  }
  if (escrow.submittedAt) timeline.push({ event: 'submitted', date: escrow.submittedAt, by: escrow.freelancer, details: 'Deliverables submitted' });
  if (escrow.releasedAt) timeline.push({ event: 'released', date: escrow.releasedAt, by: escrow.releasedBy, details: `Released ${escrow.amount} ${escrow.currency}` });
  if (escrow.refundedAt) timeline.push({ event: 'refunded', date: escrow.refundedAt, by: escrow.refundedBy, details: `Refunded ${escrow.amount} ${escrow.currency}` });
  if (escrow.disputeOpenedAt) timeline.push({ event: 'disputed', date: escrow.disputeOpenedAt, by: escrow.disputeOpenedBy, details: escrow.disputeReason });
  if (escrow.disputeResolvedAt) timeline.push({ event: 'resolved', date: escrow.disputeResolvedAt, by: null, details: 'Dispute resolved' });
  if (escrow.status === 'cancelled') timeline.push({ event: 'cancelled', date: escrow.updatedAt, by: null, details: 'Escrow cancelled' });
  if (escrow.status === 'expired') timeline.push({ event: 'expired', date: escrow.expiresAt || escrow.updatedAt, by: null, details: 'Escrow reached its expiry date' });

  timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

  sendResponse(res, 200, 'Escrow timeline fetched', { escrow, timeline });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export const getAllPayments = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, type, provider, startDate, endDate, search, includeDemo: includeDemoParam } = req.query;
  const includeDemo = includeDemoParam === 'true' || type === 'deposit';

  const filter = { ...buildDateFilter(startDate, endDate) };
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (provider) filter.provider = provider;
  if (search) {
    filter.$or = [
      { reference: { $regex: search, $options: 'i' } },
      { invoiceNumber: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { providerTransactionRef: { $regex: search, $options: 'i' } },
    ];
  }

  const validIds = await getValidPaymentIds(filter, { includeDemo });
  filter._id = { $in: validIds };

  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate('payer', 'firstName lastName email role')
    .populate('payee', 'firstName lastName email role')
    .populate('project', 'title')
    .populate('milestone', 'title')
    .populate({
      path: 'serviceOrder',
      select: 'title orderNumber status budget',
      populate: [
        { path: 'service', select: 'title slug' },
        { path: 'client', select: 'firstName lastName email' },
        { path: 'freelancer', select: 'firstName lastName email' },
      ],
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Payments fetched', payments, paginationMeta(total, page, limit));
});

export const getPaymentStats = catchAsync(async (req, res) => {
  const { startDate, endDate, type, includeDemo: includeDemoParam } = req.query;
  const dateFilter = buildDateFilter(startDate, endDate);
  const typeFilter = type ? { type } : {};
  const includeDemo = includeDemoParam === 'true' || type === 'deposit';
  const validityStages = { projectOnly: false, includeDemo };

  const [byStatus, byProvider, byType] = await Promise.all([
    Payment.aggregate([
      { $match: { ...typeFilter, ...dateFilter } },
      ...buildPaymentValidityStages(validityStages),
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'completed', ...typeFilter, ...dateFilter } },
      ...buildPaymentValidityStages(validityStages),
      { $group: { _id: '$provider', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'completed', ...typeFilter, ...dateFilter } },
      ...buildPaymentValidityStages(validityStages),
      { $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
  ]);

  const statusMap = {};
  byStatus.forEach(s => { statusMap[s._id] = s.count; });

  sendResponse(res, 200, 'Payment stats fetched', {
    total: byStatus.reduce((sum, s) => sum + s.count, 0),
    completed: statusMap.completed || 0,
    pending: statusMap.pending || 0,
    processing: statusMap.processing || 0,
    failed: statusMap.failed || 0,
    refunded: statusMap.refunded || 0,
    cancelled: statusMap.cancelled || 0,
    disputed: statusMap.disputed || 0,
    byStatus,
    byProvider,
    byType,
  });
});

export const getAllWallets = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { search, sort, isActive } = req.query;

  const filter = {};
  if (isActive !== undefined && isActive !== '') {
    if (isActive === 'true' || isActive === '1') filter.isActive = true;
    else if (isActive === 'false' || isActive === '0') filter.isActive = false;
  }
  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const userIds = await User.find({
      $or: [
        { firstName: { $regex: escaped, $options: 'i' } },
        { lastName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ],
    }).select('_id').lean();
    filter.user = { $in: userIds.map(u => u._id) };
  }

  const sortMap = {
    balance: { balance: -1 },
    escrow: { escrowBalance: -1 },
    earned: { totalEarned: -1 },
    withdrawn: { totalWithdrawn: -1 },
    recent: { createdAt: -1 },
  };
  const sortOpts = sortMap[sort] || sortMap.balance;

  const [total, wallets, stats] = await Promise.all([
    Wallet.countDocuments(filter),
    Wallet.find(filter)
      .populate('user', 'firstName lastName email role isActive avatar')
      .sort(sortOpts)
      .skip(skip)
      .limit(limit),
    Wallet.aggregate([
      { $group: { _id: null, totalBalance: { $sum: '$balance' }, totalEscrow: { $sum: '$escrowBalance' }, totalPending: { $sum: '$pendingBalance' }, totalEarned: { $sum: '$totalEarned' }, totalWithdrawn: { $sum: '$totalWithdrawn' }, activeWallets: { $sum: { $cond: ['$isActive', 1, 0] } }, walletCount: { $sum: 1 } } },
    ]),
  ]);

  sendResponse(res, 200, 'Wallets fetched',
    {
      wallets,
      stats: stats[0] || { totalBalance: 0, totalEscrow: 0, totalPending: 0, totalEarned: 0, totalWithdrawn: 0, activeWallets: 0, walletCount: 0 },
    },
    paginationMeta(total, page, limit));
});

export const searchPayments = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { q, status, type, provider, startDate, endDate, includeDemo: includeDemoParam } = req.query;
  const includeDemo = includeDemoParam === 'true' || type === 'deposit';

  const filter = { ...buildDateFilter(startDate, endDate) };
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (provider) filter.provider = provider;

  const matchBase = { ...filter };

  const validIds = await getValidPaymentIds(matchBase, { includeDemo });
  filter._id = { $in: validIds };

  if (q && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const matchingIds = await Payment.aggregate([
      { $match: { ...matchBase, _id: { $in: validIds } } },
      {
        $lookup: {
          from: 'users',
          localField: 'payer',
          foreignField: '_id',
          as: 'payerData',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'payee',
          foreignField: '_id',
          as: 'payeeData',
        },
      },
      {
        $lookup: {
          from: 'projects',
          localField: 'project',
          foreignField: '_id',
          as: 'projectData',
        },
      },
      {
        $lookup: {
          from: 'serviceorders',
          localField: 'serviceOrder',
          foreignField: '_id',
          as: 'serviceOrderData',
        },
      },
      {
        $lookup: {
          from: 'catalogs',
          localField: 'serviceOrderData.service',
          foreignField: '_id',
          as: 'catalogData',
        },
      },
      {
        $match: {
          $or: [
            { reference: regex },
            { invoiceNumber: regex },
            { description: regex },
            { providerTransactionRef: regex },
            { 'payerData.firstName': regex },
            { 'payerData.lastName': regex },
            { 'payerData.email': regex },
            { 'payeeData.firstName': regex },
            { 'payeeData.lastName': regex },
            { 'payeeData.email': regex },
            { 'projectData.title': regex },
            { 'serviceOrderData.title': regex },
            { 'catalogData.title': regex },
          ],
        },
      },
      { $project: { _id: 1 } },
    ]);

    filter._id = { $in: matchingIds.map(d => d._id) };
  }

  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate('payer', 'firstName lastName email role')
    .populate('payee', 'firstName lastName email role')
    .populate('project', 'title')
    .populate('milestone', 'title')
    .populate({
      path: 'serviceOrder',
      select: 'title orderNumber status budget',
      populate: [
        { path: 'service', select: 'title slug' },
        { path: 'client', select: 'firstName lastName email' },
        { path: 'freelancer', select: 'firstName lastName email' },
      ],
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Payments fetched', payments, paginationMeta(total, page, limit));
});

// ═══════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// Withdrawal requests are recorded as Payment documents (type: 'withdrawal')
// by the freelancer withdrawal flow (payment.service createWithdrawal). When a
// Withdrawal document exists it is the canonical admin record; otherwise the
// linked Payment is used so real requests always surface in admin views.
const resolveWithdrawalRecord = async (id) => {
  const doc = await Withdrawal.findById(id);
  if (doc) return { kind: 'withdrawal', doc };
  const payment = await Payment.findById(id).populate('payer', 'firstName lastName email role');
  if (payment && payment.type === 'withdrawal') return { kind: 'payment', doc: payment };
  return null;
};

export const getAllWithdrawals = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, method, startDate, endDate, minAmount, maxAmount, q } = req.query;

  const filter = { type: 'withdrawal', ...buildDateFilter(startDate, endDate) };
  if (status) filter.status = status;
  const methodValue = method || req.query.metadata?.method;
  if (methodValue) filter['metadata.method'] = methodValue;
  if (minAmount || maxAmount) {
    filter.amount = {};
    if (minAmount) filter.amount.$gte = parseFloat(minAmount);
    if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
  }
  if (q && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const userIds = await User.find({
      $or: [
        { firstName: { $regex: regex } },
        { lastName: { $regex: regex } },
        { email: { $regex: regex } },
      ],
    }).select('_id').lean();
    filter.$or = [
      { reference: regex },
      { description: regex },
      { failureReason: regex },
      ...(userIds.length ? [{ payer: { $in: userIds.map(u => u._id) } }] : []),
    ];
  }

  const total = await Payment.countDocuments(filter);
  const withdrawals = await Payment.find(filter)
    .populate('payer', 'firstName lastName email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Withdrawals fetched', withdrawals, paginationMeta(total, page, limit));
});

export const getWithdrawalStats = catchAsync(async (req, res) => {
  const [byStatus, byMethod] = await Promise.all([
    Payment.aggregate([
      { $match: { type: 'withdrawal' } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { type: 'withdrawal', status: 'completed' } },
      { $group: { _id: '$metadata.method', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
  ]);

  sendResponse(res, 200, 'Withdrawal stats fetched', { byStatus, byMethod });
});

export const processWithdrawal = catchAsync(async (req, res) => {
  const { withdrawalId } = req.params;
  const { action, adminNotes, failureReason } = req.body;

  const resolved = await resolveWithdrawalRecord(withdrawalId);
  if (!resolved) throw new ApiError(404, 'Withdrawal not found');

  const record = resolved.doc;
  if (!['pending', 'processing'].includes(record.status)) {
    throw new ApiError(400, `Withdrawal is already ${record.status}`);
  }

  if (action === 'approve') {
    record.status = 'completed';
    record.processedAt = new Date();
    if (resolved.kind === 'withdrawal') {
      record.completedAt = new Date();
      record.reviewedBy = req.user._id;
      record.reviewedAt = new Date();
      record.adminNotes = adminNotes || '';
    } else if (record.metadata) {
      record.metadata = { ...record.metadata, adminNotes: adminNotes || '' };
    }
    if (resolved.kind === 'payment') {
      await Transaction.updateOne(
        { reference: record.reference },
        { $set: { status: 'completed', processedAt: new Date() } }
      );
    }
  } else if (action === 'reject') {
    record.status = 'failed';
    record.failureReason = failureReason || 'Rejected by admin';
    if (resolved.kind === 'withdrawal') {
      record.failedAt = new Date();
      record.reviewedBy = req.user._id;
      record.reviewedAt = new Date();
      record.adminNotes = adminNotes || '';
    } else if (record.metadata) {
      record.metadata = { ...record.metadata, adminNotes: adminNotes || '', failedAt: new Date().toISOString() };
    }

    const wallet = await Wallet.findOne({ user: resolved.kind === 'withdrawal' ? record.user : record.payer });
    if (wallet) {
      wallet.balance += record.amount;
      await wallet.save();
    }

    if (resolved.kind === 'payment') {
      await Transaction.updateOne(
        { reference: record.reference },
        { $set: { status: 'failed', failedAt: new Date(), failureReason: record.failureReason } }
      );
    }
  } else if (action === 'pause') {
    record.status = 'cancelled';
    if (resolved.kind === 'withdrawal') {
      record.adminNotes = adminNotes || 'Paused by admin';
      record.reviewedBy = req.user._id;
      record.reviewedAt = new Date();
    } else if (record.metadata) {
      record.metadata = { ...record.metadata, adminNotes: adminNotes || 'Paused by admin' };
    }
  } else {
    throw new ApiError(400, 'Invalid action. Use "approve", "reject", or "pause"');
  }

  await record.save();

  await logAudit({
    userId: req.user._id,
    action: `withdrawal_${action}`,
    category: 'withdrawal',
    resourceType: 'Withdrawal',
    resourceId: record._id,
    amount: record.amount,
    currency: record.currency,
    details: { adminNotes, failureReason },
  });

  sendResponse(res, 200, `Withdrawal ${action}d`, record);
});

export const retryFailedWithdrawal = catchAsync(async (req, res) => {
  const { withdrawalId } = req.params;

  const resolved = await resolveWithdrawalRecord(withdrawalId);
  if (!resolved) throw new ApiError(404, 'Withdrawal not found');

  const record = resolved.doc;
  if (record.status !== 'failed') throw new ApiError(400, 'Only failed withdrawals can be retried');

  record.status = 'pending';
  record.failureReason = '';
  if (resolved.kind === 'withdrawal') {
    record.failedAt = null;
    record.reviewedBy = null;
    record.reviewedAt = null;
  }
  await record.save();

  if (resolved.kind === 'payment') {
    await Transaction.updateOne(
      { reference: record.reference },
      { $set: { status: 'pending', failureReason: '' } }
    );
  }

  await logAudit({
    userId: req.user._id,
    action: 'withdrawal_retry',
    category: 'withdrawal',
    resourceType: 'Withdrawal',
    resourceId: record._id,
    amount: record.amount,
    currency: record.currency,
  });

  sendResponse(res, 200, 'Withdrawal queued for retry', record);
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMISSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export const getCommissionSettings = catchAsync(async (req, res) => {
  const stored = await getPlatformSettings();
  const rate = Number.isFinite(stored?.commissionRate) ? stored.commissionRate : getCommissionRate();

  sendResponse(res, 200, 'Commission settings fetched', {
    defaultRate: rate,
    clientFee: 0,
    withdrawalFee: config.platform?.withdrawalFee || 0,
    gatewayFees: { stripe: 0.029, chapa: 0.01, telebirr: 0.01, cbe_birr: 0.005 },
    vat: 0,
  });
});

export const updateCommissionSettings = catchAsync(async (req, res) => {
  const { defaultRate, clientFee, withdrawalFee, gatewayFees, vat } = req.body;

  let rate = getCommissionRate();
  if (defaultRate !== undefined) {
    const parsed = parseCommissionRate(defaultRate);
    const settings = await persistCommissionRate(parsed, { userId: req.user._id });
    rate = settings.commissionRate;
  }

  await logAudit({
    userId: req.user._id,
    action: 'commission_settings_updated',
    category: 'commission',
    details: { defaultRate: rate, clientFee, withdrawalFee, gatewayFees, vat },
  });

  sendResponse(res, 200, 'Commission settings updated', { defaultRate: rate, clientFee, withdrawalFee, gatewayFees, vat });
});

export const getCommissionHistory = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { startDate, endDate, source, q } = req.query;
  const dateFilter = buildDateFilter(startDate, endDate);

  const filter = { type: 'commission', ...dateFilter };

  if (q && q.trim()) {
    const term = q.trim();
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const userIds = await User.find({ $or: [{ firstName: rx }, { lastName: rx }, { email: rx }] }).distinct('_id');
    filter.$or = [{ reference: rx }, { user: { $in: userIds } }];
  }

  // Escrow records linked to a service order (used to classify the source).
  let serviceOrderEscrowIds = [];
  if (!source || source === 'service_order' || source === 'other') {
    serviceOrderEscrowIds = (await Escrow.find({ serviceOrder: { $ne: null } }).distinct('_id')).map(id => id.toString());
  }

  if (source === 'milestone') {
    filter.milestoneId = { $ne: null };
  } else if (source === 'project') {
    filter.milestoneId = null;
    filter.projectId = { $ne: null };
  } else if (source === 'service_order') {
    filter['metadata.escrowId'] = { $in: serviceOrderEscrowIds };
  } else if (source === 'other') {
    filter.milestoneId = null;
    filter.projectId = null;
    filter['metadata.escrowId'] = { $nin: serviceOrderEscrowIds };
  }

  const total = await Transaction.countDocuments(filter);
  const commissions = await Transaction.find(filter)
    .populate('user', 'firstName lastName email role')
    .populate('projectId', 'title category')
    .populate('milestoneId', 'title amount')
    .populate('paymentId', 'reference amount currency status createdAt')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Resolve escrows referenced in commission metadata so service-order
  // commissions can be attributed to the real order that generated them.
  const escrowIds = [...new Set(commissions.map(c => c.metadata?.escrowId).filter(Boolean))];
  const escrows = await Escrow.find({ _id: { $in: escrowIds } })
    .select('serviceOrder project amount currency')
    .populate('serviceOrder', 'orderNumber title')
    .populate('project', 'title')
    .lean();
  const escrowMap = new Map(escrows.map(e => [e._id.toString(), e]));

  const enriched = commissions.map(c => {
    const escrow = c.metadata?.escrowId ? escrowMap.get(c.metadata.escrowId) : null;
    const milestone = c.milestoneId;
    const project = c.projectId;
    const serviceOrder = escrow?.serviceOrder;

    let sourceType = 'other';
    let related = null;
    let originalAmount = c.metadata?.originalAmount ?? null;

    if (milestone) {
      sourceType = 'milestone';
      related = { label: 'Milestone', name: milestone.title };
      originalAmount = originalAmount ?? milestone.amount ?? null;
    } else if (project) {
      sourceType = 'project';
      related = { label: 'Project', name: project.title };
      originalAmount = originalAmount ?? c.paymentId?.amount ?? null;
    } else if (serviceOrder) {
      sourceType = 'service_order';
      related = { label: 'Service Order', name: serviceOrder.title, orderNumber: serviceOrder.orderNumber };
      originalAmount = originalAmount ?? escrow?.amount ?? null;
    } else if (escrow) {
      sourceType = 'escrow';
      related = { label: 'Escrow' };
      originalAmount = originalAmount ?? escrow.amount ?? null;
    } else if (c.metadata?.jobId) {
      sourceType = 'job';
      related = { label: 'Job' };
      originalAmount = originalAmount ?? c.paymentId?.amount ?? null;
    } else {
      originalAmount = originalAmount ?? c.paymentId?.amount ?? null;
    }

    // Commission rate: parse from the description "(10%)" when present,
    // otherwise derive it from the original amount (never mutates the record).
    let rate = null;
    const rateMatch = (c.description || '').match(/\((\d+(?:\.\d+)?)%\)/);
    if (rateMatch) rate = parseFloat(rateMatch[1]);
    else if (originalAmount && originalAmount > 0) rate = Math.round((c.amount / originalAmount) * 1000) / 10;

    return { ...c, _source: sourceType, _related: related, _originalAmount: originalAmount, _commissionRate: rate };
  });

  sendResponse(res, 200, 'Commission history fetched', enriched, paginationMeta(total, page, limit));
});

// ═══════════════════════════════════════════════════════════════════════════════
// REFUND & DISPUTE
// ═══════════════════════════════════════════════════════════════════════════════

export const getRefundDashboard = catchAsync(async (req, res) => {
  const validRefundIds = await getValidPaymentIds({ type: 'refund' });
  const [pending, approved, rejected, stats] = await Promise.all([
    Payment.find({ type: 'refund', status: { $in: ['pending', 'processing'] }, _id: { $in: validRefundIds } })
      .populate('payer', 'firstName lastName email')
      .populate('payee', 'firstName lastName email')
      .sort({ createdAt: -1 }).limit(20),
    Payment.find({ type: 'refund', status: 'completed', _id: { $in: validRefundIds } })
      .populate('payer', 'firstName lastName email')
      .sort({ createdAt: -1 }).limit(20),
    Payment.find({ type: 'refund', status: 'failed', _id: { $in: validRefundIds } })
      .populate('payer', 'firstName lastName email')
      .sort({ createdAt: -1 }).limit(20),
    Payment.aggregate([
      { $match: { type: 'refund' } },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
  ]);

  sendResponse(res, 200, 'Refund dashboard fetched', { pending, approved, rejected, stats });
});

export const getDisputeCenter = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { resolved } = req.query;

  const filter = resolved ? { disputeResolvedAt: { $ne: null } } : { status: 'disputed' };
  const total = await Escrow.countDocuments(filter);
  const disputes = await Escrow.find(filter)
    .populate('client', 'firstName lastName email')
    .populate('freelancer', 'firstName lastName email')
    .populate('project', 'title')
    .populate('serviceOrder', 'orderNumber status title')
    .populate('paymentId', 'reference invoiceNumber status provider amount currency')
    .populate('refundTransaction', 'reference type amount status createdAt')
    .populate('releaseTransaction', 'reference type amount status createdAt')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, resolved ? 'Resolved disputes fetched' : 'Dispute center fetched', disputes, paginationMeta(total, page, limit));
});

export const addAdminNote = catchAsync(async (req, res) => {
  const { escrowId } = req.params;
  const { note } = req.body;

  const escrow = await Escrow.findById(escrowId);
  if (!escrow) throw new ApiError(404, 'Escrow not found');

  if (!escrow.metadata) escrow.metadata = {};
  if (!escrow.metadata.adminNotes) escrow.metadata.adminNotes = [];
  escrow.metadata.adminNotes.push({
    note,
    addedBy: req.user._id,
    addedAt: new Date(),
  });
  await escrow.save();

  sendResponse(res, 200, 'Admin note added', escrow);
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

const generateReportData = async (type, startDate, endDate) => {
  const dateFilter = buildDateFilter(startDate, endDate);

  switch (type) {
    case 'revenue': {
      const [payments, commissions, periodRevenue] = await Promise.all([
        Payment.aggregate([
          { $match: { status: 'completed', ...dateFilter } },
          ...buildPaymentValidityStages({ projectOnly: false }),
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 }, avgAmount: { $avg: '$amount' } } },
        ]),
        Transaction.aggregate([
          { $match: { type: 'commission', status: 'completed', ...dateFilter } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Payment.aggregate([
          { $match: { status: 'completed', ...dateFilter } },
          ...buildPaymentValidityStages({ projectOnly: false }),
          { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),
      ]);
      return { payments: payments[0] || {}, commissions: commissions[0] || {}, periodRevenue };
    }
    case 'commission': {
      return Transaction.aggregate([
        { $match: { type: 'commission', status: 'completed', ...dateFilter } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
    }
    case 'escrow': {
      return Escrow.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]);
    }
    case 'payment': {
      return Payment.aggregate([
        { $match: dateFilter },
        ...buildPaymentValidityStages({ projectOnly: false }),
        { $group: { _id: { status: '$status', provider: '$provider' }, count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]);
    }
    case 'withdrawal': {
      return Withdrawal.aggregate([
        { $match: dateFilter },
        { $group: { _id: { status: '$status', method: '$method' }, count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]);
    }
    case 'refund': {
      return Payment.aggregate([
        { $match: { type: 'refund', ...dateFilter } },
        ...buildPaymentValidityStages({ projectOnly: false }),
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]);
    }
    default:
      return null;
  }
};

export const generateReport = catchAsync(async (req, res) => {
  const { type, startDate, endDate, format: reportFormat = 'json' } = req.query;

  if (!['revenue', 'commission', 'escrow', 'payment', 'withdrawal', 'refund', 'tax'].includes(type)) {
    throw new ApiError(400, 'Invalid report type');
  }

  const reportData = await generateReportData(type, startDate, endDate);

  await logAudit({
    userId: req.user._id,
    action: 'report_generated',
    category: 'admin',
    details: { reportType: type, startDate, endDate, format: reportFormat },
  });

  if (reportFormat === 'csv') {
    let csv = '';
    if (Array.isArray(reportData)) {
      if (reportData.length > 0) {
        csv = Object.keys(reportData[0]).join(',') + '\n';
        csv += reportData.map(row => Object.values(row).map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(',')).join('\n');
      }
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${new Date().toISOString().split('T')[0]}.csv"`);
    return res.send(csv);
  }

  sendResponse(res, 200, `${type} report generated`, reportData);
});

// ─── Financial Reports Center ──────────────────────────────────────────────────
// Row-level reports for the Financial Reports Center. These reuse the exact same
// collections, validity stages and aggregation formulas as the Financial Overview
// so the numbers always agree with the dashboard. Nothing here mutates records.

const REPORT_TYPES = ['revenue', 'commission', 'payment', 'escrow', 'withdrawal', 'refund'];

// When a global "Status" filter is selected it is translated per report source
// because each collection uses its own status vocabulary. A null mapping means
// the status does not apply to that source (left unfiltered).
const REPORT_STATUS_MAP = {
  completed: { payment: 'completed', commission: 'completed', escrow: 'released', withdrawal: 'completed', refund: 'completed' },
  pending: { payment: 'pending', commission: 'pending', escrow: 'pending', withdrawal: 'pending', refund: 'pending' },
  processing: { payment: 'processing', commission: 'processing', escrow: 'in_progress', withdrawal: 'processing', refund: 'processing' },
  failed: { payment: 'failed', commission: 'failed', escrow: 'expired', withdrawal: 'failed', refund: 'failed' },
  refunded: { payment: 'refunded', commission: 'refunded', escrow: 'refunded', withdrawal: null, refund: 'completed' },
  disputed: { payment: 'disputed', commission: 'disputed', escrow: 'disputed', withdrawal: null, refund: 'disputed' },
};

const WITHDRAWAL_METHODS = ['bank_transfer', 'paypal', 'stripe', 'chapa', 'telebirr', 'cbe_birr'];

const GATEWAY_FEE_RATES = { stripe: 0.029, chapa: 0.01, telebirr: 0.01, cbe_birr: 0.005, wallet: 0, manual: 0, demo: 0 };

const applyPaymentSourceFilter = (filter, source) => {
  switch (source) {
    case 'milestone': filter.milestone = { $ne: null }; break;
    case 'project': filter.project = { $ne: null }; filter.milestone = null; filter.serviceOrder = null; break;
    case 'service_order': filter.serviceOrder = { $ne: null }; break;
    case 'job': filter._id = { $in: [] }; break;
  }
};

const applyCommissionSourceFilter = (filter, source, serviceOrderEscrowIds) => {
  switch (source) {
    case 'milestone': filter.milestoneId = { $ne: null }; break;
    case 'project': filter.milestoneId = null; filter.projectId = { $ne: null }; break;
    case 'service_order': filter['metadata.escrowId'] = { $in: serviceOrderEscrowIds }; break;
    case 'job': filter['metadata.jobId'] = { $ne: null }; break;
    case 'other': filter.milestoneId = null; filter.projectId = null; filter['metadata.escrowId'] = { $nin: serviceOrderEscrowIds }; break;
  }
};

const applyEscrowSourceFilter = (filter, source) => {
  switch (source) {
    case 'milestone': filter.milestone = { $ne: null }; break;
    case 'project': filter.project = { $ne: null }; filter.serviceOrder = null; break;
    case 'service_order': filter.serviceOrder = { $ne: null }; break;
    case 'job': filter._id = { $in: [] }; break;
  }
};

const buildReportFilterContext = async (req) => {
  const { startDate, endDate, status, provider, source } = req.query;
  const dateFilter = buildDateFilter(startDate, endDate);
  const statusMap = REPORT_STATUS_MAP[status] || {};

  let serviceOrderEscrowIds = [];
  if (!source || source === 'service_order' || source === 'other') {
    serviceOrderEscrowIds = (await Escrow.find({ serviceOrder: { $ne: null } }).distinct('_id')).map(id => id.toString());
  }

  let providerPaymentIds = [];
  if (provider) {
    providerPaymentIds = await Payment.distinct('_id', { provider });
  }

  const paymentFilter = { ...dateFilter };
  const commissionFilter = { type: 'commission', ...dateFilter };
  const escrowFilter = { ...dateFilter };
  const withdrawalFilter = { type: 'withdrawal', ...dateFilter };
  const refundFilter = { type: 'refund', ...dateFilter };

  if (statusMap.payment) paymentFilter.status = statusMap.payment;
  if (statusMap.refund) refundFilter.status = statusMap.refund;
  if (statusMap.withdrawal) withdrawalFilter.status = statusMap.withdrawal;
  if (statusMap.commission) commissionFilter.status = statusMap.commission;
  if (statusMap.escrow) escrowFilter.status = statusMap.escrow;

  if (provider) {
    paymentFilter.provider = provider;
    refundFilter.provider = provider;
    if (WITHDRAWAL_METHODS.includes(provider)) withdrawalFilter['metadata.method'] = provider;
    commissionFilter.paymentId = { $in: providerPaymentIds };
    escrowFilter.paymentId = { $in: providerPaymentIds };
  }

  if (source) {
    applyPaymentSourceFilter(paymentFilter, source);
    applyPaymentSourceFilter(refundFilter, source);
    applyCommissionSourceFilter(commissionFilter, source, serviceOrderEscrowIds);
    applyEscrowSourceFilter(escrowFilter, source);
  }

  return { paymentFilter, commissionFilter, escrowFilter, withdrawalFilter, refundFilter };
};

export const getFinancialReportsSummary = catchAsync(async (req, res) => {
  const { paymentFilter, commissionFilter, escrowFilter, withdrawalFilter, refundFilter } = await buildReportFilterContext(req);
  const { status } = req.query;
  const statusMap = REPORT_STATUS_MAP[status] || {};

  // When no status filter is set, match the Financial Dashboard source of truth:
  // revenue, commission and withdrawals are reported on their completed amounts.
  const revenueMatch = { ...paymentFilter };
  const commissionMatch = { ...commissionFilter };
  const withdrawalMatch = { ...withdrawalFilter };
  if (!statusMap.payment) revenueMatch.status = 'completed';
  if (!statusMap.commission) commissionMatch.status = 'completed';
  if (!statusMap.withdrawal) withdrawalMatch.status = 'completed';

  // Transactions count covers every valid payment in scope (any status).
  const txCountMatch = { ...paymentFilter };
  delete txCountMatch.status;

  const [revenue, commission, transactions, escrow, withdrawals, refunds] = await Promise.all([
    Payment.aggregate([
      { $match: revenueMatch },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: commissionMatch },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: txCountMatch },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: null, count: { $sum: 1 } } },
    ]),
    Escrow.aggregate([
      { $match: escrowFilter },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: withdrawalMatch },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: refundFilter },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  sendResponse(res, 200, 'Financial report summary fetched', {
    revenue: revenue[0] || { total: 0, count: 0 },
    commission: commission[0] || { total: 0, count: 0 },
    transactions: transactions[0] || { count: 0 },
    escrow: escrow[0] || { total: 0, count: 0 },
    withdrawals: withdrawals[0] || { total: 0, count: 0 },
    refunds: refunds[0] || { total: 0, count: 0 },
  });
});

const NAME = (doc) => (doc && (doc.firstName || doc.lastName || doc.email)) ? `${doc.firstName || ''} ${doc.lastName || ''}`.trim() || doc.email : null;

const paymentSourceInfo = (p) => {
  if (p.milestone) return { label: 'Milestone', name: p.milestone.title || '' };
  if (p.serviceOrder) return { label: 'Service Order', name: p.serviceOrder.title || p.serviceOrder.orderNumber || '' };
  if (p.project) return { label: 'Project', name: p.project.title || '' };
  return { label: (p.type || '').replace(/_/g, ' '), name: '' };
};

const fetchReportRows = async (type, filters, { skip, limit }) => {
  const { startDate, endDate, status, provider, source } = filters;
  const ctx = await buildReportFilterContext({ query: { startDate, endDate, status, provider, source } });

  switch (type) {
    case 'revenue': {
      const filter = { ...ctx.paymentFilter };
      if (!status) filter.status = 'completed';
      const validIds = await getValidPaymentIds(filter, { projectOnly: false });
      const total = await Payment.countDocuments({ ...filter, _id: { $in: validIds } });
      const payments = await Payment.find({ ...filter, _id: { $in: validIds } })
        .populate('payer', 'firstName lastName email role')
        .populate('payee', 'firstName lastName email role')
        .populate('project', 'title')
        .populate('milestone', 'title')
        .populate('serviceOrder', 'title orderNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      const rows = payments.map(p => {
        const src = paymentSourceInfo(p);
        return {
          _id: p._id, reference: p.reference, invoiceNumber: p.invoiceNumber, date: p.createdAt, createdAt: p.createdAt,
          source: src.label, relatedLabel: src.label, relatedName: src.name,
          client: NAME(p.payer), freelancer: NAME(p.payee), type: p.type, provider: p.provider,
          amount: p.amount, currency: p.currency, commission: p.commission || 0, netAmount: p.netAmount != null ? p.netAmount : (p.amount - (p.commission || 0)),
          gatewayFee: (p.amount || 0) * (GATEWAY_FEE_RATES[p.provider] || 0), status: p.status,
        };
      });
      return { rows, total };
    }
    case 'payment': {
      const filter = { ...ctx.paymentFilter };
      const validIds = await getValidPaymentIds(filter, { projectOnly: false });
      const total = await Payment.countDocuments({ ...filter, _id: { $in: validIds } });
      const payments = await Payment.find({ ...filter, _id: { $in: validIds } })
        .populate('payer', 'firstName lastName email role')
        .populate('payee', 'firstName lastName email role')
        .populate('project', 'title')
        .populate('milestone', 'title')
        .populate('serviceOrder', 'title orderNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      const rows = payments.map(p => {
        const src = paymentSourceInfo(p);
        return {
          _id: p._id, reference: p.reference, invoiceNumber: p.invoiceNumber, date: p.createdAt, createdAt: p.createdAt,
          source: src.label, relatedLabel: src.label, relatedName: src.name,
          client: NAME(p.payer), freelancer: NAME(p.payee), type: p.type, provider: p.provider,
          amount: p.amount, currency: p.currency, commission: p.commission || 0, netAmount: p.netAmount != null ? p.netAmount : (p.amount - (p.commission || 0)),
          gatewayFee: (p.amount || 0) * (GATEWAY_FEE_RATES[p.provider] || 0), status: p.status,
        };
      });
      return { rows, total };
    }
    case 'commission': {
      const filter = { ...ctx.commissionFilter };
      const total = await Transaction.countDocuments(filter);
      const commissions = await Transaction.find(filter)
        .populate('user', 'firstName lastName email role')
        .populate('projectId', 'title')
        .populate('milestoneId', 'title amount')
        .populate('paymentId', 'reference amount currency status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const escrowIds = [...new Set(commissions.map(c => c.metadata?.escrowId).filter(Boolean))];
      const escrows = await Escrow.find({ _id: { $in: escrowIds } })
        .select('serviceOrder project amount currency')
        .populate('serviceOrder', 'orderNumber title')
        .populate('project', 'title')
        .lean();
      const escrowMap = new Map(escrows.map(e => [e._id.toString(), e]));

      const rows = commissions.map(c => {
        const escrow = c.metadata?.escrowId ? escrowMap.get(c.metadata.escrowId) : null;
        const milestone = c.milestoneId;
        const project = c.projectId;
        const serviceOrder = escrow?.serviceOrder;
        let sourceLabel = 'Other';
        let relatedName = '';
        let originalAmount = c.metadata?.originalAmount ?? null;
        if (milestone) { sourceLabel = 'Milestone'; relatedName = milestone.title; originalAmount = originalAmount ?? milestone.amount ?? null; }
        else if (project) { sourceLabel = 'Project'; relatedName = project.title; originalAmount = originalAmount ?? c.paymentId?.amount ?? null; }
        else if (serviceOrder) { sourceLabel = 'Service Order'; relatedName = serviceOrder.title || serviceOrder.orderNumber; originalAmount = originalAmount ?? escrow?.amount ?? null; }
        else if (escrow) { sourceLabel = 'Escrow'; relatedName = project?.title || ''; originalAmount = originalAmount ?? escrow.amount ?? null; }
        else if (c.metadata?.jobId) { sourceLabel = 'Job'; originalAmount = originalAmount ?? c.paymentId?.amount ?? null; }
        else { originalAmount = originalAmount ?? c.paymentId?.amount ?? null; }

        let rate = null;
        const rateMatch = (c.description || '').match(/\((\d+(?:\.\d+)?)%\)/);
        if (rateMatch) rate = parseFloat(rateMatch[1]);
        else if (originalAmount && originalAmount > 0) rate = Math.round((c.amount / originalAmount) * 1000) / 10;

        return {
          _id: c._id, reference: c.reference, date: c.createdAt, createdAt: c.createdAt,
          user: NAME(c.user), currency: c.currency,
          source: sourceLabel, relatedLabel: sourceLabel, relatedName,
          originalAmount, rate, amount: c.amount,
          transactionId: c.paymentId?.reference || null, status: c.status,
        };
      });
      return { rows, total };
    }
    case 'escrow': {
      const filter = { ...ctx.escrowFilter };
      const total = await Escrow.countDocuments(filter);
      const escrows = await Escrow.find(filter)
        .populate('client', 'firstName lastName email')
        .populate('freelancer', 'firstName lastName email')
        .populate('project', 'title')
        .populate('serviceOrder', 'title orderNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      const rows = escrows.map(e => ({
        _id: e._id, escrowId: String(e._id).slice(0, 10), date: e.createdAt, createdAt: e.createdAt,
        client: NAME(e.client), freelancer: NAME(e.freelancer),
        relatedLabel: e.serviceOrder ? 'Service Order' : e.project ? 'Project' : null,
        relatedName: e.serviceOrder ? (e.serviceOrder.title || e.serviceOrder.orderNumber) : e.project?.title || '',
        amount: e.amount, currency: e.currency, status: e.status,
        expectedRelease: e.expiresAt, resolvedAt: e.releasedAt || e.refundedAt,
      }));
      return { rows, total };
    }
    case 'withdrawal': {
      const filter = { ...ctx.withdrawalFilter };
      const validIds = await getValidPaymentIds(filter, { projectOnly: false });
      const total = await Payment.countDocuments({ ...filter, _id: { $in: validIds } });
      const withdrawals = await Payment.find({ ...filter, _id: { $in: validIds } })
        .populate('payer', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      const rows = withdrawals.map(w => ({
        _id: w._id, reference: w.reference, date: w.createdAt, createdAt: w.createdAt,
        freelancer: NAME(w.payer), amount: w.amount, currency: w.currency,
        method: w.metadata?.method || w.provider || 'manual', status: w.status,
        processedAt: w.processedAt || w.metadata?.processedAt || null,
      }));
      return { rows, total };
    }
    case 'refund': {
      const filter = { ...ctx.refundFilter };
      const validIds = await getValidPaymentIds(filter, { projectOnly: false });
      const total = await Payment.countDocuments({ ...filter, _id: { $in: validIds } });
      const refunds = await Payment.find({ ...filter, _id: { $in: validIds } })
        .populate('payer', 'firstName lastName email role')
        .populate('payee', 'firstName lastName email role')
        .populate('project', 'title')
        .populate('milestone', 'title')
        .populate('serviceOrder', 'title orderNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      const rows = refunds.map(r => {
        const src = paymentSourceInfo(r);
        return {
          _id: r._id, reference: r.reference, date: r.createdAt, createdAt: r.createdAt,
          client: NAME(r.payer), freelancer: NAME(r.payee),
          relatedLabel: src.label, relatedName: src.name,
          amount: r.amount, currency: r.currency, reason: r.refundReason || r.metadata?.reason || '',
          status: r.status, resolvedAt: r.refundedAt || r.processedAt || null,
        };
      });
      return { rows, total };
    }
    default:
      return { rows: [], total: 0 };
  }
};

// Column definitions used by the frontend table, CSV and PDF alike.
const REPORT_COLUMNS = {
  revenue: [
    { key: 'date', label: 'Date' }, { key: 'source', label: 'Source' }, { key: 'client', label: 'Client' },
    { key: 'freelancer', label: 'Freelancer' }, { key: 'relatedName', label: 'Related Job/Project/Service' },
    { key: 'reference', label: 'Transaction ID' }, { key: 'provider', label: 'Gateway' },
    { key: 'amount', label: 'Amount' }, { key: 'commission', label: 'Commission' }, { key: 'netAmount', label: 'Net Amount' }, { key: 'status', label: 'Status' },
  ],
  commission: [
    { key: 'date', label: 'Date' }, { key: 'user', label: 'User' }, { key: 'source', label: 'Source' },
    { key: 'relatedName', label: 'Related Project/Job/Service' }, { key: 'originalAmount', label: 'Original Amount' },
    { key: 'rate', label: 'Commission Rate' }, { key: 'amount', label: 'Commission Amount' },
    { key: 'reference', label: 'Commission Reference' }, { key: 'transactionId', label: 'Transaction ID' },
  ],
  payment: [
    { key: 'reference', label: 'Transaction ID' }, { key: 'client', label: 'Client' }, { key: 'freelancer', label: 'Freelancer' },
    { key: 'type', label: 'Type' }, { key: 'provider', label: 'Gateway' }, { key: 'amount', label: 'Amount' },
    { key: 'commission', label: 'Commission' }, { key: 'gatewayFee', label: 'Gateway Fee' }, { key: 'netAmount', label: 'Net Amount' },
    { key: 'status', label: 'Status' }, { key: 'date', label: 'Date' }, { key: 'invoiceNumber', label: 'Invoice/Reference' },
  ],
  escrow: [
    { key: 'escrowId', label: 'Escrow ID' }, { key: 'client', label: 'Client' }, { key: 'freelancer', label: 'Freelancer' },
    { key: 'relatedName', label: 'Project/Order' }, { key: 'amount', label: 'Amount' }, { key: 'status', label: 'Status' },
    { key: 'date', label: 'Created' }, { key: 'expectedRelease', label: 'Expected Release' }, { key: 'resolvedAt', label: 'Released/Refunded Date' },
  ],
  withdrawal: [
    { key: 'reference', label: 'Withdrawal ID' }, { key: 'freelancer', label: 'Freelancer' }, { key: 'amount', label: 'Amount' },
    { key: 'method', label: 'Method' }, { key: 'status', label: 'Status' }, { key: 'date', label: 'Requested Date' },
    { key: 'processedAt', label: 'Processed Date' },
  ],
  refund: [
    { key: 'reference', label: 'Refund/Dispute ID' }, { key: 'client', label: 'Client' }, { key: 'freelancer', label: 'Freelancer' },
    { key: 'relatedName', label: 'Related Project/Order' }, { key: 'amount', label: 'Amount' }, { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status' }, { key: 'date', label: 'Created' }, { key: 'resolvedAt', label: 'Resolved Date' },
  ],
};

const formatReportValue = (key, value) => {
  if (value == null || value === '') return '';
  if (key === 'amount' || key === 'netAmount' || key === 'commission' || key === 'gatewayFee' || key === 'originalAmount') return Number(value).toFixed(2);
  if (key === 'rate') return `${value}%`;
  if (key === 'date' || key === 'expectedRelease' || key === 'resolvedAt' || key === 'processedAt' || key === 'createdAt') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return String(value);
};

const csvFromRows = (rows, columns) => {
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map(c => esc(c.label)).join(',');
  const lines = rows.map(row => columns.map(c => esc(formatReportValue(c.key, row[c.key]))).join(','));
  return [header, ...lines].join('\r\n');
};

const truncate = (v, n = 40) => {
  const s = String(v == null ? '' : v);
  return s.length > n ? `${s.slice(0, n - 3)}...` : s;
};

const generateReportPDF = async ({ typeLabel, filtersLabel, columns, rows }) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, bufferPages: true, autoFirstPage: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const margin = 40;
      const usableW = pageW - margin * 2;

      // Header band
      doc.rect(0, 0, pageW, 96).fill('#6366f1');
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff').text('SkillHub — Financial Report', margin, 26);
      doc.fontSize(13).font('Helvetica').fillColor('#e0e7ff').text(typeLabel, margin, 58);
      doc.fontSize(9).fillColor('#c7d2fe')
        .text(`Generated ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`, pageW - margin, 26, { align: 'right' });
      doc.text(`Records: ${rows.length}`, pageW - margin, 40, { align: 'right' });

      // Filter summary
      doc.fillColor('#374151').fontSize(9).font('Helvetica')
        .text(`Filters: ${filtersLabel || 'All Time, All Gateways, All Statuses, All Sources'}`, margin, 116);

      doc.moveTo(margin, 130).lineTo(pageW - margin, 130).strokeColor('#e5e7eb').lineWidth(1).stroke();

      // Table header
      const colW = usableW / columns.length;
      let y = 142;
      doc.rect(margin, y, usableW, 24).fill('#f3f4f6');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151');
      columns.forEach((c, i) => {
        doc.text(c.label.toUpperCase(), margin + 4 + i * colW, y + 8, { width: colW - 8, lineBreak: false, ellipsis: true });
      });
      y += 24;

      doc.fontSize(7.5).font('Helvetica').fillColor('#1f2937');
      rows.forEach((row, idx) => {
        if (y > doc.page.height - 56) {
          doc.addPage();
          y = 40;
          doc.rect(margin, y, usableW, 24).fill('#f3f4f6');
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151');
          columns.forEach((c, i) => {
            doc.text(c.label.toUpperCase(), margin + 4 + i * colW, y + 8, { width: colW - 8, lineBreak: false, ellipsis: true });
          });
          y += 24;
          doc.fontSize(7.5).font('Helvetica').fillColor('#1f2937');
        }
        if (idx % 2 === 1) doc.rect(margin, y, usableW, 18).fill('#f9fafb');
        doc.fillColor('#1f2937');
        columns.forEach((c, i) => {
          doc.text(truncate(formatReportValue(c.key, row[c.key]), 38), margin + 4 + i * colW, y + 5, { width: colW - 8, lineBreak: false, ellipsis: true });
        });
        y += 18;
      });

      // Footer on all pages
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#9ca3af').font('Helvetica')
          .text(`SkillHub — Financial Report — ${typeLabel} — Page ${i + 1} of ${range.count}`, margin, doc.page.height - 30, { width: usableW, align: 'center' });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export const getFinancialReportRows = catchAsync(async (req, res) => {
  const { type, startDate, endDate, status, provider, source, format = 'json' } = req.query;

  if (!REPORT_TYPES.includes(type)) throw new ApiError(400, 'Invalid report type');

  const { page, limit, skip } = parsePagination({ ...req.query, limit: req.query.limit || (format === 'json' ? 15 : 5000) });

  const { rows, total } = await fetchReportRows(type, { startDate, endDate, status, provider, source }, { skip, limit });

  await logAudit({
    userId: req.user._id,
    action: 'report_generated',
    category: 'admin',
    resourceType: 'Report',
    details: { reportType: type, format, startDate, endDate, status, provider, source, count: rows.length },
  });

  if (format === 'csv') {
    const csv = csvFromRows(rows, REPORT_COLUMNS[type]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${new Date().toISOString().split('T')[0]}.csv"`);
    return res.send(csv);
  }

  if (format === 'pdf') {
    const filtersLabel = [
      startDate || endDate ? `${startDate || '...'} to ${endDate || '...'}` : 'All Time',
      provider || 'All Gateways',
      status || 'All Statuses',
      source || 'All Sources',
    ].filter(Boolean).join(', ');
    const pdf = await generateReportPDF({ typeLabel: REPORT_COLUMNS[type] ? type.replace(/_/g, ' ').toUpperCase() : type, filtersLabel, columns: REPORT_COLUMNS[type], rows });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${new Date().toISOString().split('T')[0]}.pdf"`);
    return res.send(pdf);
  }

  sendResponse(res, 200, `${type} report rows fetched`, rows, paginationMeta(total, page, limit));
});

// ═══════════════════════════════════════════════════════════════════════════════
// REAL-TIME DATA
// ═══════════════════════════════════════════════════════════════════════════════

export const getLiveStats = catchAsync(async (req, res) => {
  const last5min = new Date(Date.now() - 5 * 60 * 1000);
  const validLiveIds = await getValidPaymentIds({ createdAt: { $gte: last5min } });

  const [recentPayments, recentTransactions, recentDeposits, recentWithdrawals, liveRevenue] = await Promise.all([
    Payment.find({ createdAt: { $gte: last5min }, _id: { $in: validLiveIds } })
      .populate('payer', 'firstName lastName')
      .sort({ createdAt: -1 }).limit(10),
    Transaction.find({ createdAt: { $gte: last5min } })
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 }).limit(10),
    Payment.aggregate([
      { $match: { type: 'deposit', status: 'completed', createdAt: { $gte: last5min } } },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Withdrawal.aggregate([
      { $match: { createdAt: { $gte: last5min } } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: last5min } } },
      ...buildPaymentValidityStages({ projectOnly: false }),
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  sendResponse(res, 200, 'Live stats fetched', {
    recentPayments,
    recentTransactions,
    recentDeposits: recentDeposits[0] || { total: 0, count: 0 },
    recentWithdrawals,
    liveRevenue: liveRevenue[0] || { total: 0, count: 0 },
    timestamp: new Date(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

export const globalSearch = catchAsync(async (req, res) => {
  const { q, type } = req.query;
  if (!q) throw new ApiError(400, 'Search query is required');

  const regex = new RegExp(q, 'i');
  const results = {};

  if (!type || type === 'users') {
    results.users = await User.find({
      $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
    }).select('firstName lastName email role avatar').limit(10);
  }

  if (!type || type === 'transactions') {
    results.transactions = await Transaction.find({
      $or: [{ reference: regex }, { description: regex }],
    }).populate('user', 'firstName lastName').sort({ createdAt: -1 }).limit(10);
  }

  if (!type || type === 'payments') {
    const paymentSearchFilter = {
      $or: [{ reference: regex }, { invoiceNumber: regex }, { description: regex }, { providerTransactionRef: regex }],
    };
    const validSearchIds = await getValidPaymentIds(paymentSearchFilter);
    results.payments = await Payment.find({ _id: { $in: validSearchIds }, ...paymentSearchFilter })
      .populate('payer', 'firstName lastName').sort({ createdAt: -1 }).limit(10);
  }

  if (!type || type === 'escrows') {
    results.escrows = await Escrow.find({ status: regex }).populate('client', 'firstName lastName').populate('freelancer', 'firstName lastName').limit(10);
  }

  sendResponse(res, 200, 'Search results', results);
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT & SECURITY
// ═══════════════════════════════════════════════════════════════════════════════

export const getAuditLogsCtrl = catchAsync(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { category, status, startDate, endDate, userId } = req.query;

  const filter = { ...buildDateFilter(startDate, endDate) };
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (userId) filter.user = userId;

  const result = await getAuditLogs(filter, { page, limit });
  sendResponse(res, 200, 'Audit logs fetched', result.logs, result.meta);
});

export const getAuditLogsSummary = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const summary = await getAuditSummary(startDate, endDate);
  sendResponse(res, 200, 'Audit summary fetched', summary);
});

export const getSuspiciousActivity = catchAsync(async (req, res) => {
  const alerts = await AdvancedAnalytics.findOne().select('fraudAlerts').sort({ createdAt: -1 });
  const fraudAlerts = alerts?.fraudAlerts?.filter(a => ['payment_fraud', 'rapid_transactions', 'money_laundering', 'escrow_abuse'].includes(a.type)) || [];

  sendResponse(res, 200, 'Suspicious activity fetched', fraudAlerts.slice(0, 20));
});

export const getAdminActionHistory = catchAsync(async (req, res) => {
  const { page, limit } = parsePagination(req.query);

  const filter = { category: 'admin' };
  const total = await AuditLog.countDocuments(filter);
  const logs = await AuditLog.find(filter)
    .populate('user', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  sendResponse(res, 200, 'Admin action history fetched', logs, paginationMeta(total, page, limit));
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE
// ═══════════════════════════════════════════════════════════════════════════════

export const downloadInvoicePDF = catchAsync(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.paymentId,
    $or: [{ payer: req.user._id }, { payee: req.user._id }, { $expr: { $eq: [req.user.role, 'admin'] } }],
  })
    .populate('payer', 'firstName lastName email')
    .populate('payee', 'firstName lastName email')
    .populate('project', 'title')
    .populate('milestone', 'title');

  if (!payment) throw new ApiError(404, 'Invoice not found');

  const pdfBuffer = await generateInvoicePDF(payment, { frontendUrl: config.frontendUrl });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="SkillHub-Invoice-${payment.invoiceNumber || payment._id}.pdf"`);
  res.send(pdfBuffer);
});
