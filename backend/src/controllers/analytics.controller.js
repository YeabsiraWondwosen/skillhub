import mongoose from 'mongoose';
import { User, Job, Project, Payment, Review, Application, Category, SkillTaxonomy } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendResponse } from '../utils/apiResponse.js';
import { cacheThrough } from '../utils/cache.js';

const { Types: { ObjectId } } = mongoose;

// Payment types that represent money a client spent funding work
const SPEND_TYPES = ['escrow', 'milestone_payment', 'project_payment', 'service_order_payment'];

// Landing-page counters — 7 countDocuments on every public page view. They move
// slowly, so serve a 60s cached snapshot.
const PUBLIC_STATS_NS = 'analytics:public';
const PUBLIC_STATS_TTL_MS = 60 * 1000;

// ─── Public Stats (no auth — for landing page) ───────────────────────────────
export const getPublicStats = catchAsync(async (req, res) => {
  const stats = await cacheThrough(PUBLIC_STATS_NS, 'v1', PUBLIC_STATS_TTL_MS, async () => {
  const [freelancers, clients, completedProjects, openJobs, categories, subcategories, skills] = await Promise.all([
    User.countDocuments({ role: 'freelancer', isActive: true, isBanned: false }),
    User.countDocuments({ role: 'client', isActive: true, isBanned: false }),
    Project.countDocuments({ status: 'completed' }),
    Job.countDocuments({ status: 'open' }),
    Category.countDocuments({ parent: null, isActive: true, isHidden: false }),
    Category.countDocuments({ parent: { $ne: null }, isActive: true, isHidden: false }),
    SkillTaxonomy.countDocuments({ isActive: true }),
  ]);

  return {
      freelancers,
      clients,
      completedProjects,
      openJobs,
      categories,
      subcategories,
      skills,
    };
  });

  sendResponse(res, 200, 'Public stats', stats);
});

// ─── Platform Analytics (Admin) ───────────────────────────────────────────────
export const getPlatformAnalytics = catchAsync(async (req, res) => {
  const [
    totalUsers, totalFreelancers, totalClients,
    totalJobs, openJobs, totalProjects, completedProjects,
    totalRevenue, monthlyData, topFreelancers, topClients,
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'freelancer', isActive: true }),
    User.countDocuments({ role: 'client', isActive: true }),
    Job.countDocuments(),
    Job.countDocuments({ status: 'open' }),
    Project.countDocuments(),
    Project.countDocuments({ status: 'completed' }),

    Payment.aggregate([
      { $match: { type: 'commission', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    // Monthly revenue last 12 months
    Payment.aggregate([
      { $match: { type: 'commission', status: 'completed', createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),

    // Top freelancers by actual earnings (sum of netAmount from completed payments)
    Payment.aggregate([
      { $match: { status: 'completed', payee: { $exists: true, $ne: null } } },
      { $group: { _id: '$payee', totalEarnings: { $sum: '$netAmount' }, earningsCount: { $sum: 1 } } },
      { $sort: { totalEarnings: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: {
        _id: 1, firstName: '$user.firstName', lastName: '$user.lastName',
        avatar: '$user.avatar', stats: '$user.stats', totalEarnings: 1, earningsCount: 1,
      } },
    ]),

    // Top clients by actual spending (sum of amount from completed payments on work)
    Payment.aggregate([
      { $match: { status: 'completed', payer: { $exists: true, $ne: null }, type: { $in: SPEND_TYPES } } },
      { $group: { _id: '$payer', totalSpent: { $sum: '$amount' }, spendCount: { $sum: 1 } } },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: {
        _id: 1, firstName: '$user.firstName', lastName: '$user.lastName',
        avatar: '$user.avatar', stats: '$user.stats', totalSpent: 1, spendCount: 1,
      } },
    ]),
  ]);

  sendResponse(res, 200, 'Platform analytics', {
    overview: {
      totalUsers,
      totalFreelancers,
      totalClients,
      totalJobs,
      openJobs,
      totalProjects,
      completedProjects,
      totalRevenue: totalRevenue[0]?.total || 0,
    },
    monthlyRevenue: monthlyData,
    topFreelancers,
    topClients,
  });
});

// ─── Freelancer Dashboard Analytics ──────────────────────────────────────────
export const getFreelancerAnalytics = catchAsync(async (req, res) => {
  const userId = new ObjectId(req.user._id);

  const [
    activeProjects, completedProjects, pendingApplications,
    totalEarnings, monthlyEarnings, recentReviews, averageRating,
  ] = await Promise.all([
    Project.countDocuments({ freelancer: userId, status: 'active' }),
    Project.countDocuments({ freelancer: userId, status: 'completed' }),
    Application.countDocuments({ freelancer: userId, status: { $in: ['pending', 'viewed', 'shortlisted'] } }),

    Payment.aggregate([
      { $match: { payee: userId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$netAmount' } } },
    ]),

    Payment.aggregate([
      {
        $match: {
          payee: userId,
          status: 'completed',
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          earnings: { $sum: '$netAmount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),

    Review.find({ reviewee: userId }).sort({ createdAt: -1 }).limit(5)
      .populate('reviewer', 'firstName lastName avatar'),

    Review.aggregate([
      { $match: { reviewee: userId } },
      { $group: { _id: null, avg: { $avg: '$rating.overall' }, count: { $sum: 1 } } },
    ]),
  ]);

  sendResponse(res, 200, 'Freelancer analytics', {
    activeProjects,
    completedProjects,
    pendingApplications,
    totalEarnings: totalEarnings[0]?.total || 0,
    monthlyEarnings,
    recentReviews,
    averageRating: averageRating[0]?.avg || 0,
    totalReviews: averageRating[0]?.count || 0,
  });
});

// ─── Client Dashboard Analytics ───────────────────────────────────────────────
export const getClientAnalytics = catchAsync(async (req, res) => {
  const userId = new ObjectId(req.user._id);

  const [
    activeJobs, postedJobs, activeProjects, completedProjects,
    totalSpent, monthlySpending, pendingApplicationsCount,
  ] = await Promise.all([
    Job.countDocuments({ client: userId, status: 'open' }),
    Job.countDocuments({ client: userId }),
    Project.countDocuments({ client: userId, status: 'active' }),
    Project.countDocuments({ client: userId, status: 'completed' }),

    Payment.aggregate([
      { $match: { payer: userId, status: 'completed', type: { $in: ['escrow', 'milestone_payment', 'project_payment'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    Payment.aggregate([
      {
        $match: {
          payer: userId,
          status: 'completed',
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          spent: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),

    Application.countDocuments({ client: userId, status: 'pending' }),
  ]);

  sendResponse(res, 200, 'Client analytics', {
    activeJobs,
    postedJobs,
    activeProjects,
    completedProjects,
    totalSpent: totalSpent[0]?.total || 0,
    monthlySpending,
    pendingApplicationsCount,
  });
});
