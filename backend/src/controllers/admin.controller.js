import mongoose from 'mongoose';
import { User, Job, Payment, Transaction, Review, Report, Project, Application, Category, Catalog, Escrow, ServiceOrder, Message } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination, buildSortObject } from '../utils/helpers.js';
import {
  evaluateJobHideRestriction,
  assertJobCanBeHidden,
  ACCEPTED_APPLICATION_STATUS,
} from '../utils/jobModeration.js';
import { invalidateCache } from '../utils/cache.js';
import { config } from '../config/env.js';
import { createNotification } from '../services/notification.service.js';
import { logAudit } from '../services/audit.service.js';
import { recomputeUserReviewStats } from '../services/review.service.js';
import {
  getPlatformSettings as loadPlatformSettingsDoc,
  savePlatformSettings,
  getInfrastructureStatus,
  persistCommissionRate,
} from '../services/settings.service.js';
import { uploadFile, deleteFile } from '../services/cloudinary.service.js';
import {
  normalizePlatformName,
  normalizeOptionalText,
  normalizeCurrency,
  normalizeLanguage,
  normalizeTimeZone,
  normalizeLogo,
  parseCommissionRate,
  toCommissionPercent,
  PLATFORM_TAGLINE_MAX,
  PLATFORM_DESCRIPTION_MAX,
} from '../utils/settings.validation.js';

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export const getDashboardStats = catchAsync(async (req, res) => {
  const [users, jobs, projects, revenue, reports, newUsersThisMonth] = await Promise.all([
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    Job.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Project.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'commission', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Report.countDocuments({ status: 'pending' }),
    User.countDocuments({
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    }),
  ]);

  sendResponse(res, 200, 'Admin dashboard stats', {
    users: users.reduce((acc, u) => ({ ...acc, [u._id]: u.count }), {}),
    jobs: jobs.reduce((acc, j) => ({ ...acc, [j._id]: j.count }), {}),
    projects: projects.reduce((acc, p) => ({ ...acc, [p._id]: p.count }), {}),
    totalRevenue: revenue[0]?.total || 0,
    pendingReports: reports,
    newUsersThisMonth,
  });
});

// ─── Manage Users ─────────────────────────────────────────────────────────────
export const getUsers = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { role, search, isActive, isBanned, sortBy, newThisMonth, period } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (isBanned !== undefined) filter.isBanned = isBanned === 'true';
  if (period) {
    const now = new Date();
    let start;
    if (period === 'day') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    }
    if (start) filter.createdAt = { $gte: start };
  }
  if (newThisMonth === 'true') {
    filter.createdAt = { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) };
  }
  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
    .sort(buildSortObject(sortBy))
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Users fetched', users, paginationMeta(total, page, limit));
});

export const getUserRegistrationStats = catchAsync(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [today, week, month, year, total] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: startOfToday } }),
    User.countDocuments({ createdAt: { $gte: startOfWeek } }),
    User.countDocuments({ createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ createdAt: { $gte: startOfYear } }),
    User.countDocuments(),
  ]);

  sendResponse(res, 200, 'User registration stats', { today, week, month, year, total });
});

export const getUserDetail = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId)
    .select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
    .populate('profile')
    .populate('wallet');

  if (!user) throw new ApiError(404, 'User not found');
  sendResponse(res, 200, 'User detail fetched', user);
});

export const updateUser = catchAsync(async (req, res) => {
  const { isActive, isBanned, banReason, isVerifiedFreelancer, role } = req.body;

  const user = await User.findById(req.params.userId);
  if (!user) throw new ApiError(404, 'User not found');

  if (isActive !== undefined) user.isActive = isActive;
  if (isBanned !== undefined) {
    user.isBanned = isBanned;
    user.banReason = isBanned ? banReason : '';
    if (isBanned) {
      user.refreshTokens = [];
      await createNotification({
        recipient: user._id,
        type: 'account_banned',
        title: 'Account Suspended',
        message: `Your account has been suspended. Reason: ${banReason || 'Terms violation'}`,
        actionUrl: '/support',
      });
    }
  }
  if (isVerifiedFreelancer !== undefined) {
    user.isVerifiedFreelancer = isVerifiedFreelancer;
    if (isVerifiedFreelancer) {
      await createNotification({
        recipient: user._id,
        type: 'account_verified',
        title: 'Profile Verified! ✅',
        message: 'Congratulations! Your freelancer profile has been verified.',
        actionUrl: '/freelancer/profile',
      });
    }
  }
  if (role && req.user._id.toString() !== user._id.toString()) user.role = role;

  await user.save({ validateBeforeSave: false });
  // Status/verification changes are visible in the public freelancer directory.
  invalidateCache('freelancers:search');
  invalidateCache('analytics:public');
  sendResponse(res, 200, 'User updated', user.toSafeObject());
});

export const deleteUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role === 'admin') throw new ApiError(403, 'Cannot delete admin users');

  user.isActive = false;
  user.email = `deleted_${Date.now()}_${user.email}`;
  await user.save({ validateBeforeSave: false });

  sendResponse(res, 200, 'User deactivated');
});

// ─── Manage Jobs ──────────────────────────────────────────────────────────────

/**
 * Attach `canHide` / `hideRestrictionReason` to one or more admin job payloads.
 * Accepted applications and related projects are fetched in a single batch so
 * the list view stays cheap regardless of page size.
 */
const decorateJobsWithHideRestriction = async (jobs) => {
  const isArray = Array.isArray(jobs);
  const list = isArray ? jobs : [jobs];
  if (list.length === 0) return isArray ? [] : jobs;

  const jobIds = list.map((job) => job._id);
  const [acceptedCounts, projects] = await Promise.all([
    Application.aggregate([
      { $match: { job: { $in: jobIds }, status: ACCEPTED_APPLICATION_STATUS } },
      { $group: { _id: '$job', count: { $sum: 1 } } },
    ]),
    Project.find({ job: { $in: jobIds } })
      .select('job status budget.paidAmount escrowPaymentId')
      .lean(),
  ]);

  const acceptedByJob = new Map(acceptedCounts.map((row) => [String(row._id), row.count]));
  const projectsByJob = new Map();
  for (const project of projects) {
    const key = String(project.job);
    if (!projectsByJob.has(key)) projectsByJob.set(key, []);
    projectsByJob.get(key).push(project);
  }

  const decorated = list.map((job) => {
    const key = String(job._id);
    const { restricted, reason } = evaluateJobHideRestriction({
      job,
      acceptedApplications: acceptedByJob.get(key) || 0,
      projects: projectsByJob.get(key) || [],
    });
    const plain = typeof job.toObject === 'function' ? job.toObject({ virtuals: true }) : { ...job };
    plain.canHide = !restricted;
    plain.hideRestrictionReason = reason;
    return plain;
  });

  return isArray ? decorated : decorated[0];
};

export const getAdminJobs = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, search, isApproved } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
  if (search) filter.$text = { $search: search };

  const total = await Job.countDocuments(filter);
  const jobs = await Job.find(filter)
    .populate('client', 'firstName lastName email')
    .populate({ path: 'milestoneId', select: 'title amount currency status dueDate' })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const payload = await decorateJobsWithHideRestriction(jobs);

  sendResponse(res, 200, 'Jobs fetched', payload, paginationMeta(total, page, limit));
});

export const getAdminJob = catchAsync(async (req, res) => {
  const job = await Job.findById(req.params.jobId)
    .populate('client', 'firstName lastName email avatar stats country isOnline lastSeen')
    .populate('hiredFreelancer', 'firstName lastName email avatar')
    .populate({ path: 'milestoneId', select: 'title amount currency status dueDate' });

  if (!job) throw new ApiError(404, 'Job not found');

  const plain = job.toObject();
  if (!plain.client && plain.clientId) {
    const client = await User.findById(plain.clientId)
      .select('firstName lastName email avatar stats country isOnline lastSeen')
      .lean();
    if (client) plain.client = client;
  }
  if (!plain.requiredSkills && plain.skill) {
    plain.requiredSkills = Array.isArray(plain.skill) ? plain.skill : [plain.skill];
  }

  const decorated = await decorateJobsWithHideRestriction(job);
  plain.canHide = decorated.canHide;
  plain.hideRestrictionReason = decorated.hideRestrictionReason;

  sendResponse(res, 200, 'Job fetched', plain);
});

export const moderateJob = catchAsync(async (req, res) => {
  const { isApproved, rejectionReason } = req.body;
  const job = await Job.findById(req.params.jobId);
  if (!job) throw new ApiError(404, 'Job not found');

  const unpublishing = isApproved === false || isApproved === 'false';

  // Hiding / unpublishing is only blocked when leaving the marketplace. A job
  // with an accepted application, funded/in-progress/completed project, or that
  // is itself in progress or completed must not be pulled down. The guard runs
  // BEFORE any mutation, so a restricted job is never updated (HTTP 409).
  if (unpublishing) {
    const [acceptedApplications, projects] = await Promise.all([
      Application.countDocuments({ job: job._id, status: ACCEPTED_APPLICATION_STATUS }),
      Project.find({ job: job._id })
        .select('status budget.paidAmount escrowPaymentId')
        .lean(),
    ]);

    assertJobCanBeHidden({ job, acceptedApplications, projects });
  }

  if (isApproved !== undefined) {
    job.isApproved = !unpublishing;
    job.rejectionReason = unpublishing ? (rejectionReason || '') : '';
  }
  await job.save();

  const decorated = await decorateJobsWithHideRestriction(job);
  sendResponse(res, 200, `Job ${job.isApproved ? 'approved' : 'rejected'}`, {
    ...job.toObject({ virtuals: true }),
    canHide: decorated.canHide,
    hideRestrictionReason: decorated.hideRestrictionReason,
  });
});

// ─── Manage Projects ──────────────────────────────────────────────────────────
export const getAdminProjects = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, search } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [{ title: regex }, { description: regex }];
  }

  const total = await Project.countDocuments(filter);
  const projects = await Project.find(filter)
    .populate('client', 'firstName lastName email avatar')
    .populate('freelancer', 'firstName lastName email avatar')
    .populate('job', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Projects fetched', projects, paginationMeta(total, page, limit));
});

// ─── Manage Reviews ───────────────────────────────────────────────────────────
export const getAdminReviews = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { isFlagged } = req.query;

  const filter = {};
  if (isFlagged === 'true') filter.isFlagged = true;

  const total = await Review.countDocuments(filter);
  const reviews = await Review.find(filter)
    .populate('reviewer', 'firstName lastName')
    .populate('reviewee', 'firstName lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Reviews fetched', reviews, paginationMeta(total, page, limit));
});

export const moderateReview = catchAsync(async (req, res) => {
  const { isPublic, isFlagged, flagReason } = req.body;
  const review = await Review.findByIdAndUpdate(
    req.params.reviewId,
    { isPublic, isFlagged, flagReason },
    { new: true }
  );
  if (!review) throw new ApiError(404, 'Review not found');

  // Recompute the denormalized User.stats so the reviewee's public profile
  // (average rating, review count, reputation) stays in sync after hide/unhide.
  if (isPublic !== undefined) {
    try {
      await recomputeUserReviewStats(review.reviewee);
    } catch (statsErr) {
      console.error('Stats recompute after moderation failed:', statsErr.message);
    }
  }

  sendResponse(res, 200, 'Review moderated', review);
});

// ─── Reports (Moderation Center) ──────────────────────────────────────────────
const REPORT_STATUSES = ['pending', 'under_review', 'resolved', 'dismissed'];
const REPORT_USER_SELECT = 'firstName lastName email avatar role isActive isBanned isVerifiedFreelancer isOnline lastSeen createdAt banReason';

const reportShortId = (id) => (id ? `REP-${String(id).slice(-6).toUpperCase()}` : '—');

export const getReportStats = catchAsync(async (req, res) => {
  const [statusGroup, priorityGroup, typeGroup] = await Promise.all([
    Report.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Report.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Report.aggregate([{ $group: { _id: '$resourceType', count: { $sum: 1 } } }]),
  ]);

  const byStatus = Object.fromEntries(statusGroup.map((s) => [s._id, s.count]));
  const byPriority = Object.fromEntries(priorityGroup.map((p) => [p._id, p.count]));
  const byType = Object.fromEntries(typeGroup.map((t) => [t._id, t.count]));
  const urgent = (byPriority.urgent || 0) + (byPriority.critical || 0);

  sendResponse(res, 200, 'Report stats fetched', {
    total: Object.values(byStatus).reduce((sum, n) => sum + n, 0),
    pending: byStatus.pending || 0,
    under_review: byStatus.under_review || 0,
    resolved: byStatus.resolved || 0,
    dismissed: byStatus.dismissed || 0,
    urgent,
    byStatus,
    byPriority,
    byType,
  });
});

export const getReports = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, priority, resourceType, search, from, to } = req.query;

  const match = {};
  if (status) match.status = status;
  if (resourceType) match.resourceType = resourceType;
  if (priority) {
    if (priority === 'urgent') match.priority = { $in: ['urgent', 'critical'] };
    else match.priority = priority;
  }
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }
  if (search) {
    const rx = new RegExp(search, 'i');
    match.$or = [
      { reason: rx },
      { description: rx },
      { 'reporter.firstName': rx },
      { 'reporter.lastName': rx },
      { 'reporter.email': rx },
      { 'reportedUser.firstName': rx },
      { 'reportedUser.lastName': rx },
      { 'reportedUser.email': rx },
    ];
    if (mongoose.isValidObjectId(search)) match.$or.push({ _id: search });
  }

  const pipeline = [
    {
      $lookup: {
        from: 'users',
        let: { rid: '$reporter' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$rid'] } } },
          { $project: { password: 0, refreshTokens: 0, emailVerificationToken: 0, emailVerificationExpires: 0, passwordResetToken: 0, passwordResetExpires: 0, emailChangeToken: 0, emailChangeExpires: 0 } },
        ],
        as: 'reporter',
      },
    },
    { $addFields: { reporter: { $arrayElemAt: ['$reporter', 0] } } },
    {
      $lookup: {
        from: 'users',
        let: { rid: '$reportedUser' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$rid'] } } },
          { $project: { password: 0, refreshTokens: 0, emailVerificationToken: 0, emailVerificationExpires: 0, passwordResetToken: 0, passwordResetExpires: 0, emailChangeToken: 0, emailChangeExpires: 0 } },
        ],
        as: 'reportedUser',
      },
    },
    { $addFields: { reportedUser: { $arrayElemAt: ['$reportedUser', 0] } } },
    { $match: match },
    {
      $facet: {
        data: [{ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await Report.aggregate(pipeline);
  const reports = (result?.data || []).map((r) => ({
    ...r,
    displayId: reportShortId(r._id),
  }));
  const total = result?.total?.[0]?.count || 0;

  sendResponse(res, 200, 'Reports fetched', reports, paginationMeta(total, page, limit));
});

const loadReportResource = async (report) => {
  const { resourceType, resourceId } = report;
  try {
    if (resourceType === 'catalog') {
      const resource = await Catalog.findById(resourceId)
        .populate('freelancer', REPORT_USER_SELECT)
        .populate('category', 'name slug icon color');
      return { type: 'catalog', data: resource ? resource.toObject() : null };
    }
    if (resourceType === 'user') {
      const resource = await User.findById(resourceId)
        .select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
        .populate('profile')
        .populate('wallet');
      return { type: 'user', data: resource ? resource.toObject({ virtuals: true }) : null };
    }
    if (resourceType === 'job') {
      const resource = await Job.findById(resourceId)
        .populate('client', REPORT_USER_SELECT)
        .populate('hiredFreelancer', REPORT_USER_SELECT)
        .populate('category', 'name slug');
      return { type: 'job', data: resource ? resource.toObject({ virtuals: true }) : null };
    }
    if (resourceType === 'project') {
      const resource = await Project.findById(resourceId)
        .populate('client', REPORT_USER_SELECT)
        .populate('freelancer', REPORT_USER_SELECT)
        .populate('job', 'title slug');
      return { type: 'project', data: resource ? resource.toObject({ virtuals: true }) : null };
    }
    if (resourceType === 'message') {
      const resource = await Message.findById(resourceId)
        .populate('sender', REPORT_USER_SELECT)
        .populate('conversation');
      return { type: 'message', data: resource ? resource.toObject() : null };
    }
    if (resourceType === 'review') {
      const resource = await Review.findById(resourceId)
        .populate('reviewer', REPORT_USER_SELECT)
        .populate('reviewee', REPORT_USER_SELECT);
      return { type: 'review', data: resource ? resource.toObject() : null };
    }
  } catch (error) {
    // resource may have been deleted — return null so the detail still renders
  }
  return { type: resourceType, data: null };
};

const loadFinancialContext = async (report) => {
  const { resourceType, resourceId } = report;
  const out = { escrows: [], transactions: [], payments: [], serviceOrders: [] };
  try {
    if (resourceType === 'catalog') {
      const serviceOrders = await ServiceOrder.find({ service: resourceId })
        .populate('client', 'firstName lastName email')
        .populate('freelancer', 'firstName lastName email')
        .sort({ createdAt: -1 }).limit(20).lean();
      const orderIds = serviceOrders.map((o) => o._id);
      const projectIds = serviceOrders.map((o) => o.project).filter(Boolean);
      const [escrows, payments, transactions] = await Promise.all([
        Escrow.find({ $or: [{ serviceOrder: { $in: orderIds } }, { project: { $in: projectIds } }] })
          .populate('client', 'firstName lastName email')
          .populate('freelancer', 'firstName lastName email')
          .sort({ createdAt: -1 }).limit(20).lean(),
        Payment.find({ $or: [{ serviceOrder: { $in: orderIds } }, { project: { $in: projectIds } }] })
          .populate('payer', 'firstName lastName email')
          .populate('payee', 'firstName lastName email')
          .sort({ createdAt: -1 }).limit(20).lean(),
        Transaction.find({
          $or: [
            { paymentId: { $in: serviceOrders.map((o) => o.payment).filter(Boolean) } },
            { projectId: { $in: projectIds } },
          ],
        }).populate('user', 'firstName lastName email').sort({ createdAt: -1 }).limit(20).lean(),
      ]);
      out.serviceOrders = serviceOrders;
      out.escrows = escrows;
      out.payments = payments;
      out.transactions = transactions;
    } else if (resourceType === 'project') {
      const [escrows, transactions, payments] = await Promise.all([
        Escrow.find({ project: resourceId }).populate('client', 'firstName lastName email').populate('freelancer', 'firstName lastName email').sort({ createdAt: -1 }).limit(20).lean(),
        Transaction.find({ projectId: resourceId }).populate('user', 'firstName lastName email').sort({ createdAt: -1 }).limit(20).lean(),
        Payment.find({ project: resourceId }).populate('payer', 'firstName lastName email').populate('payee', 'firstName lastName email').sort({ createdAt: -1 }).limit(20).lean(),
      ]);
      out.escrows = escrows;
      out.transactions = transactions;
      out.payments = payments;
    } else if (resourceType === 'job') {
      const job = await Job.findById(resourceId).select('paymentId escrowId').lean();
      if (job) {
        const [escrows, payments, transactions] = await Promise.all([
          job.escrowId ? Escrow.find({ _id: job.escrowId }).populate('client', 'firstName lastName email').populate('freelancer', 'firstName lastName email').lean() : [],
          job.paymentId ? Payment.find({ _id: job.paymentId }).populate('payer', 'firstName lastName email').populate('payee', 'firstName lastName email').lean() : [],
          job.paymentId ? Transaction.find({ paymentId: job.paymentId }).populate('user', 'firstName lastName email').sort({ createdAt: -1 }).limit(20).lean() : [],
        ]);
        out.escrows = escrows;
        out.payments = payments;
        out.transactions = transactions;
      }
    } else if (resourceType === 'user') {
      const [transactions, payments] = await Promise.all([
        Transaction.find({ user: resourceId }).populate('user', 'firstName lastName email').sort({ createdAt: -1 }).limit(20).lean(),
        Payment.find({ $or: [{ payer: resourceId }, { payee: resourceId }] }).populate('payer', 'firstName lastName email').populate('payee', 'firstName lastName email').sort({ createdAt: -1 }).limit(20).lean(),
      ]);
      out.transactions = transactions;
      out.payments = payments;
    }
  } catch (error) {
    // financial context is non-critical — keep it empty on failure
  }
  return out;
};

const loadReportedUser = async (report) => {
  const { reportedUser, resourceType, resourceId } = report;
  let userId = reportedUser;
  if (!userId) {
    // Derive the owner from the reported resource when it was not set at submit time.
    if (resourceType === 'catalog') {
      const catalog = await Catalog.findById(resourceId).select('freelancer').lean();
      userId = catalog?.freelancer || null;
    } else if (resourceType === 'job') {
      const job = await Job.findById(resourceId).select('client').lean();
      userId = job?.client || null;
    } else if (resourceType === 'project') {
      const project = await Project.findById(resourceId).select('freelancer client').lean();
      userId = project?.freelancer || project?.client || null;
    } else if (resourceType === 'message') {
      const message = await Message.findById(resourceId).select('sender').lean();
      userId = message?.sender || null;
    } else if (resourceType === 'review') {
      const review = await Review.findById(resourceId).select('reviewee').lean();
      userId = review?.reviewee || null;
    } else if (resourceType === 'user') {
      userId = resourceId;
    }
  }
  if (!userId) return null;
  return User.findById(userId)
    .select(REPORT_USER_SELECT)
    .populate('profile')
    .populate('wallet')
    .lean();
};

export const getReportDetail = catchAsync(async (req, res) => {
  const report = await Report.findById(req.params.reportId)
    .populate('reporter', REPORT_USER_SELECT)
    .populate('assignedTo', 'firstName lastName email avatar')
    .populate('adminNotes.author', 'firstName lastName email avatar')
    .populate('reportHistory.admin', 'firstName lastName email avatar')
    .populate('resolution.resolvedBy', 'firstName lastName email avatar')
    .populate('investigation.updatedBy', 'firstName lastName email avatar');

  if (!report) throw new ApiError(404, 'Report not found');

  const [reportedUser, resource, financial, reporterReportCount, reportedUserReportCount] = await Promise.all([
    loadReportedUser(report),
    loadReportResource(report),
    loadFinancialContext(report),
    report.reporter ? Report.countDocuments({ reporter: report.reporter._id }) : Promise.resolve(0),
    report.reportedUser
      ? Report.countDocuments({ $or: [{ reportedUser: report.reportedUser }, { resourceType: 'user', resourceId: report.reportedUser }] })
      : Promise.resolve(0),
  ]);

  const detail = report.toObject();
  detail.displayId = reportShortId(detail._id);
  detail.reporterReportCount = reporterReportCount;
  detail.reportedUserReportCount = reportedUserReportCount;
  detail.reportedUser = reportedUser;
  detail.resource = resource;
  detail.financial = financial;

  sendResponse(res, 200, 'Report detail fetched', detail);
});

export const updateReportStatus = catchAsync(async (req, res) => {
  const { status, priority, assignedTo, resolutionReason, action, note, notifyReporter } = req.body;

  if (!REPORT_STATUSES.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${REPORT_STATUSES.join(', ')}`);
  }

  const report = await Report.findById(req.params.reportId).populate('reporter', 'email firstName lastName');
  if (!report) throw new ApiError(404, 'Report not found');

  const prev = report.status;
  const isClosing = ['resolved', 'dismissed'].includes(status);
  const reason = String(resolutionReason || note || '').trim();

  if (isClosing && !reason) {
    throw new ApiError(400, 'A resolution reason is required when closing a report');
  }

  report.status = status;
  if (isClosing) {
    report.resolution = {
      action: action || (status === 'dismissed' ? 'no_action' : report.resolution?.action || 'no_action'),
      note: reason,
      resolvedBy: req.user._id,
      resolvedAt: new Date(),
    };
    report.resolutionReason = reason;
  } else if (status !== prev && ['resolved', 'dismissed'].includes(prev)) {
    // Reopened — clear the stale closure
    report.resolution = { action: null, note: '', resolvedBy: null, resolvedAt: null };
    report.resolutionReason = '';
  }

  if (priority !== undefined) {
    if (!['low', 'medium', 'high', 'urgent', 'critical'].includes(priority)) {
      throw new ApiError(400, 'Invalid priority');
    }
    if (priority !== report.priority) {
      const oldPriority = report.priority;
      report.priority = priority;
      report.reportHistory = report.reportHistory || [];
      report.reportHistory.push({
        action: 'priority_changed',
        admin: req.user._id,
        details: { from: oldPriority, to: priority },
        createdAt: new Date(),
      });
    }
  }

  if (assignedTo !== undefined) {
    if (assignedTo !== null && !mongoose.isValidObjectId(assignedTo)) {
      throw new ApiError(400, 'Invalid assignee');
    }
    if (String(assignedTo || '') !== String(report.assignedTo || '')) {
      const oldAssignee = report.assignedTo;
      report.assignedTo = assignedTo || null;
      report.reportHistory = report.reportHistory || [];
      report.reportHistory.push({
        action: 'assigned',
        admin: req.user._id,
        details: { from: oldAssignee, to: report.assignedTo },
        createdAt: new Date(),
      });
    }
  }

  if (!Array.isArray(report.reportHistory)) report.reportHistory = [];
  report.reportHistory.push({
    action: isClosing ? (status === 'resolved' ? 'resolved' : 'dismissed') : 'status_changed',
    admin: req.user._id,
    details: { from: prev, to: status, note: reason },
    createdAt: new Date(),
  });

  await report.save();

  await logAudit({
    userId: req.user._id,
    action: `report_${status}`,
    category: 'admin',
    resourceType: 'Report',
    resourceId: report._id,
    details: { from: prev, to: status, note: reason },
  });

  if (isClosing && report.reporter && notifyReporter !== false) {
    await createNotification({
      recipient: report.reporter._id,
      type: status === 'resolved' ? 'report_resolved' : 'report_dismissed',
      title: status === 'resolved' ? 'Your report was resolved' : 'Your report was reviewed',
      message: `Report ${reportShortId(report._id)} — ${reason}`,
      actionUrl: '/support',
      resourceType: 'report',
      resourceId: report._id,
    });
  }

  sendResponse(res, 200, `Report marked as ${status.replace('_', ' ')}`, report);
});

export const addReportNote = catchAsync(async (req, res) => {
  const text = String(req.body.note || '').trim();
  if (!text) throw new ApiError(400, 'Note cannot be empty');
  if (text.length > 2000) throw new ApiError(400, 'Note cannot exceed 2000 characters');

  const report = await Report.findById(req.params.reportId);
  if (!report) throw new ApiError(404, 'Report not found');

  if (!Array.isArray(report.adminNotes)) report.adminNotes = [];
  if (!Array.isArray(report.reportHistory)) report.reportHistory = [];

  report.adminNotes.push({ author: req.user._id, note: text, createdAt: new Date() });
  report.reportHistory.push({ action: 'note_added', admin: req.user._id, details: { note: text }, createdAt: new Date() });
  await report.save();

  const updated = await Report.findById(report._id)
    .populate('adminNotes.author', 'firstName lastName email avatar')
    .populate('reportHistory.admin', 'firstName lastName email avatar');

  await logAudit({
    userId: req.user._id,
    action: 'report_note_added',
    category: 'admin',
    resourceType: 'Report',
    resourceId: report._id,
    details: { note: text },
  });

  sendResponse(res, 200, 'Internal note added', updated);
});

export const updateReportInvestigation = catchAsync(async (req, res) => {
  const { rootCause, notes, recommendedResolution } = req.body;

  const report = await Report.findById(req.params.reportId);
  if (!report) throw new ApiError(404, 'Report not found');

  report.investigation = report.investigation || {};
  if (rootCause !== undefined) report.investigation.rootCause = String(rootCause || '').trim();
  if (notes !== undefined) report.investigation.notes = String(notes || '').trim();
  if (recommendedResolution !== undefined) report.investigation.recommendedResolution = String(recommendedResolution || '').trim();
  report.investigation.updatedBy = req.user._id;
  report.investigation.updatedAt = new Date();

  if (!Array.isArray(report.reportHistory)) report.reportHistory = [];
  report.reportHistory.push({
    action: 'investigation_updated',
    admin: req.user._id,
    details: { rootCause, notes, recommendedResolution },
    createdAt: new Date(),
  });

  await report.save();

  await logAudit({
    userId: req.user._id,
    action: 'report_investigation_updated',
    category: 'admin',
    resourceType: 'Report',
    resourceId: report._id,
    details: { rootCause, notes, recommendedResolution },
  });

  sendResponse(res, 200, 'Investigation updated', report);
});

// Backward-compatible alias used by the pre-moderation-center UI.
export const resolveReport = catchAsync(async (req, res) => {
  const { status = 'resolved', action, note } = req.body;
  req.body = { status, action, resolutionReason: note || '' };
  return updateReportStatus(req, res);
});

// ─── Platform Settings ────────────────────────────────────────────────────────
const buildPlatformSettingsPayload = (stored) => {
  const storedRate = Number.isFinite(stored?.commissionRate)
    ? stored.commissionRate
    : (Number.isFinite(config.platform?.commissionRate) ? config.platform.commissionRate : 0.10);

  return {
    settings: {
      name: stored?.name || config.platform?.name || 'SkillHub',
      tagline: stored?.tagline || '',
      description: stored?.description || '',
      focus: stored?.focus?._id
        ? { _id: stored.focus._id, name: stored.focus.name, slug: stored.focus.slug }
        : null,
      logo: stored?.logo?.url
        ? { url: stored.logo.url, publicId: stored.logo.publicId || '' }
        : null,
      currency: stored?.currency || 'ETB',
      language: stored?.language || 'en',
      timeZone: stored?.timeZone || 'Africa/Addis_Ababa',
      commissionRate: storedRate,
      commissionPercent: toCommissionPercent(storedRate),
    },
    info: getInfrastructureStatus(),
  };
};

export const getPlatformSettings = catchAsync(async (req, res) => {
  const stored = await loadPlatformSettingsDoc();
  sendResponse(res, 200, 'Platform settings fetched', buildPlatformSettingsPayload(stored));
});

export const updatePlatformSettings = catchAsync(async (req, res) => {
  const { name, tagline, description, focus, logo, currency, language, timeZone } = req.body;

  const update = {};
  if (name !== undefined) update.name = normalizePlatformName(name);
  if (tagline !== undefined) {
    update.tagline = normalizeOptionalText(tagline, { max: PLATFORM_TAGLINE_MAX, label: 'Tagline' });
  }
  if (description !== undefined) {
    update.description = normalizeOptionalText(description, { max: PLATFORM_DESCRIPTION_MAX, label: 'Description' });
  }
  if (currency !== undefined) update.currency = normalizeCurrency(currency);
  if (language !== undefined) update.language = normalizeLanguage(language);
  if (timeZone !== undefined) update.timeZone = normalizeTimeZone(timeZone);
  if (logo !== undefined) update.logo = normalizeLogo(logo);
  if (focus !== undefined) {
    if (focus === null || focus === '') {
      update.focus = null;
    } else {
      const category = await Category.findById(focus).lean();
      if (!category) throw new ApiError(400, 'Selected category does not exist');
      update.focus = category._id;
    }
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, 'Nothing to update');
  }

  const settings = await savePlatformSettings(update, { userId: req.user._id });

  await logAudit({
    userId: req.user._id,
    action: 'platform_settings_updated',
    category: 'admin',
    details: update,
  });

  sendResponse(res, 200, 'Platform settings updated', buildPlatformSettingsPayload(settings));
});

export const uploadPlatformSettingsLogo = catchAsync(async (req, res) => {
  if (!req.file?.buffer) throw new ApiError(400, 'Logo image is required');

  const current = await loadPlatformSettingsDoc();
  const previousPublicId = current?.logo?.publicId || '';

  const uploaded = await uploadFile(req.file.buffer, 'branding', { publicId: `branding_${Date.now()}` });

  const settings = await savePlatformSettings(
    { logo: { url: uploaded.url, publicId: uploaded.publicId } },
    { userId: req.user._id }
  );

  if (previousPublicId) {
    await deleteFile(previousPublicId).catch(() => null);
  }

  await logAudit({
    userId: req.user._id,
    action: 'platform_logo_updated',
    category: 'admin',
    details: { logoUrl: uploaded.url },
  });

  sendResponse(res, 200, 'Platform logo updated', buildPlatformSettingsPayload(settings));
});

export const updateCommissionSettings = catchAsync(async (req, res) => {
  const { commissionRate } = req.body;
  const parsed = parseCommissionRate(commissionRate);

  const settings = await persistCommissionRate(parsed, { userId: req.user._id });

  await logAudit({
    userId: req.user._id,
    action: 'commission_settings_updated',
    category: 'commission',
    details: { commissionRate: parsed },
  });

  sendResponse(res, 200, 'Commission rate updated', {
    commissionRate: settings.commissionRate,
    commissionPercent: toCommissionPercent(settings.commissionRate),
  });
});

// ─── Payments overview ────────────────────────────────────────────────────────
export const getAdminPayments = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const total = await Payment.countDocuments();
  const payments = await Payment.find()
    .populate('payer', 'firstName lastName email')
    .populate('payee', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Payments fetched', payments, paginationMeta(total, page, limit));
});
