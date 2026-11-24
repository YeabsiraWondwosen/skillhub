import { Job, Application, User, Milestone, Payment, Wallet, Transaction, Escrow, Category, SkillTaxonomy } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination, buildSortObject, generateTxRef, calculateCommission } from '../utils/helpers.js';
import { uploadMultipleFiles, deleteMultipleFiles } from '../services/cloudinary.service.js';
import { holdEscrow, releaseEscrow, recordTransaction, generateInvoiceNumber, withTransaction } from '../services/payment.service.js';
import { emitToProject, emitToUser } from '../services/socket.service.js';
import { config } from '../config/env.js';
import { getCommissionRate } from '../services/settings.service.js';
import { recordCommissionTransaction, resolveCommissionSnapshot } from '../services/commission.service.js';

const emitJobLifecycleUpdate = (userId, job) => {
  const payload = {
    jobId: job._id,
    status: job.status,
    paymentStatus: job.paymentStatus,
    updatedAt: new Date().toISOString(),
  };

  emitToUser(userId, 'job:update', payload);
  if (job.project) {
    emitToProject(String(job.project), 'project:update', { projectId: String(job.project), ...payload });
  }
};

// ─── Create Job ───────────────────────────────────────────────────────────────
export const createJob = catchAsync(async (req, res) => {
  const attachments = req.files?.length
    ? await uploadMultipleFiles(req.files, 'jobs')
    : [];

  // Reconstruct nested objects from FormData if needed
  if (req.body['budget[type]'] && !req.body.budget) {
    req.body.budget = {
      type: req.body['budget[type]'],
      minAmount: req.body['budget[minAmount]'],
      maxAmount: req.body['budget[maxAmount]'],
      currency: req.body['budget[currency]'] || 'ETB',
    };
    delete req.body['budget[type]'];
    delete req.body['budget[minAmount]'];
    delete req.body['budget[maxAmount]'];
    delete req.body['budget[currency]'];
  }

  let { category, requiredSkills } = req.body;
  if (typeof requiredSkills === 'string') {
    requiredSkills = [requiredSkills];
  } else if (Array.isArray(requiredSkills)) {
    requiredSkills = requiredSkills.filter((s) => s && String(s).trim());
  }

  // Validate category/subcategory combination.
  if (category) {
    const cat = await Category.findById(category).lean();
    if (!cat) throw new ApiError(400, 'Selected category does not exist');
    if (!cat.parent) throw new ApiError(400, 'A main category cannot be selected for a job; select a subcategory');
    if (Array.isArray(requiredSkills) && requiredSkills.length > 0) {
      const validSkills = await SkillTaxonomy.find({ category: cat._id }).select('name').lean();
      const validNames = new Set(validSkills.map((s) => s.name.toLowerCase()));
      const invalid = requiredSkills.filter((s) => s && !validNames.has(String(s).toLowerCase()));
      if (invalid.length > 0) {
        throw new ApiError(400, `Invalid skill(s) for selected subcategory: ${invalid.join(', ')}`);
      }
    }
  }

  const job = await Job.create({
    ...req.body,
    requiredSkills,
    client: req.user._id,
    attachments,
  });

  await job.populate('client', 'firstName lastName avatar');
  emitJobLifecycleUpdate(req.user._id, job);
  sendResponse(res, 201, 'Job posted successfully', job);
});

// ─── Get All Jobs (public browse) ─────────────────────────────────────────────
export const getJobs = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const {
    search, category, subcategory, experienceLevel, budgetType, minBudget, maxBudget,
    skills, duration, isUrgent, sortBy, status = 'open',
  } = req.query;

  // Legacy jobs (pre-hierarchy) were inserted without the `isApproved` flag.
  // Use `$ne: false` so those real records still surface unless explicitly rejected.
  const filter = { isApproved: { $ne: false } };
  if (status && status !== 'all') filter.status = status;

  if (search) {
    filter.$text = { $search: search };
  }
  if (subcategory) {
    // Exact subcategory filter. In the new hierarchy the leaf id is stored
    // in the job's `category` field. Legacy jobs may hold the id as a string,
    // so match both ObjectId and its string form.
    filter.category = { $in: [subcategory, String(subcategory)] };
  } else if (category) {
    // Resolve a main category to its subcategories so browsing by a main
    // category also surfaces jobs posted under any of its subcategories.
    const found = await Category.findById(category).lean();
    if (found) {
      const ids = [found._id];
      if (!found.parent) {
        const subs = await Category.find({ parent: found._id, isActive: true }).select('_id').lean();
        ids.push(...subs.map((s) => s._id));
      }
      filter.category = { $in: ids.flatMap((id) => [id, String(id)]) };
    } else {
      // Unknown category id should not silently fall through to all jobs.
      filter.category = null;
    }
  }
  if (experienceLevel) filter.experienceLevel = experienceLevel;
  if (budgetType) filter['budget.type'] = budgetType;
  if (minBudget) filter['budget.maxAmount'] = { ...filter['budget.maxAmount'], $gte: parseFloat(minBudget) };
  if (maxBudget) filter['budget.maxAmount'] = { ...filter['budget.maxAmount'], $lte: parseFloat(maxBudget) };
  if (skills) {
    const skillList = Array.isArray(skills) ? skills : skills.split(',');
    const skillRe = skillList.map((s) => new RegExp(s.trim(), 'i'));
    // Proper jobs store skills in `requiredSkills`; legacy jobs used `skill`.
    filter.$or = [
      { requiredSkills: { $in: skillRe } },
      { skill: { $in: skillRe } },
    ];
  }
  if (duration) filter.duration = duration;
  if (isUrgent === 'true') filter.isUrgent = true;

  const sort =
    search
      ? { score: { $meta: 'textScore' } }
      : sortBy === 'best_match'
        ? { createdAt: -1 }
        : buildSortObject(sortBy);
  const total = await Job.countDocuments(filter);

  const jobs = await Job.find(filter, search ? { score: { $meta: 'textScore' } } : {})
    .populate('client', 'firstName lastName avatar stats country isOnline lastSeen')
    .populate({ path: 'category', select: 'name slug icon', populate: { path: 'parent', select: 'name slug icon' } })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  await normalizeJobs(jobs);

  sendResponse(res, 200, 'Jobs fetched', jobs, paginationMeta(total, page, limit));
});

// ─── Legacy job normalization helpers ──────────────────────────────────────────
// Jobs created before the current schema store `clientId`, a singular `skill`
// string, and a plain-string budget. These helpers map them onto the modern
// shape so the public API returns a consistent response without mutating data.
async function resolveLegacyJobClients(jobs) {
  const legacy = jobs.filter((j) => !j.client && j.clientId);
  if (!legacy.length) return;
  const ids = [...new Set(legacy.map((j) => String(j.clientId)))];
  const users = await User.find({ _id: { $in: ids } })
    .select('firstName lastName avatar stats country isOnline lastSeen')
    .lean();
  const map = new Map(users.map((u) => [u._id.toString(), u]));
  legacy.forEach((j) => {
    const client = map.get(String(j.clientId));
    if (client) j.client = client;
  });
}

function normalizeJobShape(job) {
  if (!job.requiredSkills && job.skill) {
    job.requiredSkills = Array.isArray(job.skill) ? job.skill : [job.skill];
  }
  return job;
}

async function normalizeJobs(jobs) {
  if (!Array.isArray(jobs) || !jobs.length) return jobs;
  await resolveLegacyJobClients(jobs);
  jobs.forEach(normalizeJobShape);
  return jobs;
}

// ─── Get Single Job ───────────────────────────────────────────────────────────
export const getJob = catchAsync(async (req, res) => {
  const job = await Job.findById(req.params.jobId)
    .populate('client', 'firstName lastName avatar stats country isOnline lastSeen')
    .populate('hiredFreelancer', 'firstName lastName avatar')
    .populate({ path: 'category', select: 'name slug icon', populate: { path: 'parent', select: 'name slug icon' } })
    .populate({ path: 'project', select: 'title status progress' });

  if (!job) throw new ApiError(404, 'Job not found');
  const ownerId = job.client?._id ?? job.clientId;
  if (job.status !== 'open' && ownerId?.toString() !== req.user?._id?.toString()) {
    throw new ApiError(404, 'Job not found');
  }

  // Track views
  await Job.findByIdAndUpdate(req.params.jobId, { $inc: { viewsCount: 1 } });

  // Check if current user already applied
  let hasApplied = false;
  if (req.user) {
    hasApplied = await Application.exists({ job: job._id, freelancer: req.user._id });
  }

  const plain = job.toObject();
  if (!plain.client && plain.clientId) {
    const client = await User.findById(plain.clientId)
      .select('firstName lastName avatar stats country isOnline lastSeen')
      .lean();
    if (client) plain.client = client;
  }
  normalizeJobShape(plain);

  sendResponse(res, 200, 'Job fetched', { ...plain, hasApplied: !!hasApplied });
});

// ─── Get Client's Jobs ────────────────────────────────────────────────────────
// The client dashboard groups raw DB statuses into a simpler "lifecycle" status
// (Open / In Progress / Paused / Completed / Cancelled) so the UI never exposes
// internal workflow states (e.g. `funded` must never show as a job status).
const LIFECYCLE_TO_DB = {
  open: ['open', 'proposals_received'],
  in_progress: ['freelancer_selected', 'payment_pending', 'funded', 'in_progress', 'delivery_submitted', 'client_review'],
  paused: ['paused'],
  completed: ['completed'],
  cancelled: ['cancelled'],
  draft: ['draft'],
};

const PAYMENT_LABELS = {
  none: 'Not Funded',
  pending: 'Pending Payment',
  funded: 'Funded',
  released: 'Released',
  refunded: 'Refunded',
};

function lifecycleFor(status) {
  for (const [lifecycle, statuses] of Object.entries(LIFECYCLE_TO_DB)) {
    if (statuses.includes(status)) return lifecycle;
  }
  return status || 'draft';
}

// Enrich a raw job doc with the display shape the client dashboard consumes.
function enrichMyJob(j) {
  const category = j._category?.[0] || null;
  const mainCategory = j._parentCategory?.[0] || null;
  const escrow = j._escrow?.[0] || null;
  const freelancer = j._freelancer?.[0] || null;
  const project = j._project?.[0] || null;
  const milestone = j._milestone?.[0] || null;

  const isCompleted = j.paymentStatus === 'released' || j.status === 'completed' || project?.status === 'completed';
  const lifecycleStatus = isCompleted ? 'completed' : lifecycleFor(j.status);
  const hasContract = !!(
    j.project || j.escrowId || j.hiredFreelancer ||
    ['pending', 'funded'].includes(j.paymentStatus)
  );

  const disputed = !!(escrow && escrow.status === 'disputed');

  // Truthful money picture derived from real records — an escrow is only "held"
  // while it is funded/pending; once released/refunded the funds have moved.
  const escrowHeld = escrow && ['funded', 'pending', 'pending_payment'].includes(escrow.status)
    ? (escrow.amount ?? 0) : 0;
  const escrowReleased = escrow?.status === 'released' ? (escrow.amount ?? 0) : 0;
  const agreedAmount = milestone?.amount ?? project?.budget?.agreedAmount ?? null;
  const financial = {
    currency: j.budget?.currency || 'ETB',
    budgetAmount: j.budget?.maxAmount ?? null,
    agreedAmount,
    escrow: escrowHeld,
    released: escrowReleased,
    pending: milestone?.status === 'pending' ? (milestone.amount ?? 0) : 0,
    escrowStatus: escrow?.status ?? null,
  };

  return {
    _id: j._id,
    title: j.title,
    description: j.description,
    status: j.status,
    lifecycleStatus,
    budget: j.budget,
    deadline: j.deadline,
    duration: j.duration,
    experienceLevel: j.experienceLevel,
    requiredSkills: j.requiredSkills || [],
    isUrgent: !!j.isUrgent,
    isOverdue: !!j.deadline && new Date(j.deadline) < new Date(),
    visibility: j.visibility,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
    category: category ? { _id: category._id, name: category.name, slug: category.slug } : null,
    mainCategory: mainCategory ? { _id: mainCategory._id, name: mainCategory.name, slug: mainCategory.slug } : null,
    // Real proposal count from Application records (withdrawn removed, matching
    // the stored counter semantics that decrement only on withdraw).
    proposalCount: j._proposalCount,
    applicationsCount: j.applicationsCount ?? 0,
    hiredFreelancer: freelancer
      ? { _id: freelancer._id, firstName: freelancer.firstName, lastName: freelancer.lastName, avatar: freelancer.avatar?.url || freelancer.avatar || null }
      : null,
    project: project ? { _id: project._id, status: project.status, title: project.title, progress: project.progress ?? 0 } : null,
    milestoneId: j.milestoneId,
    paymentStatus: disputed ? 'Disputed' : (isCompleted ? 'Released' : (PAYMENT_LABELS[j.paymentStatus] || 'Not Funded')),
    rawPaymentStatus: j.paymentStatus,
    escrow: escrow
      ? { _id: escrow._id, status: escrow.status, amount: escrow.amount, currency: escrow.currency, disputed }
      : null,
    financial,
    milestone: milestone
      ? {
          _id: milestone._id,
          title: milestone.title,
          status: milestone.status,
          amount: milestone.amount,
          currency: milestone.currency,
          submittedAt: milestone.submittedAt ?? null,
          approvedAt: milestone.approvedAt ?? null,
        }
      : null,
    allowedActions: {
      viewJob: true,
      viewProposals: ['open', 'proposals_received', 'paused'].includes(j.status),
      edit: ['draft', 'open', 'proposals_received', 'paused'].includes(j.status),
      pause: ['open', 'proposals_received'].includes(j.status),
      resume: j.status === 'paused',
      cancel: ['draft', 'open', 'proposals_received', 'paused'].includes(j.status) && !hasContract,
      delete: ['draft', 'open', 'proposals_received', 'paused'].includes(j.status) && !hasContract,
      viewProject: !!project,
      viewContract: !!project,
      messageFreelancer: !!freelancer && ['freelancer_selected', 'payment_pending', 'funded', 'in_progress', 'delivery_submitted', 'client_review'].includes(j.status),
      viewReview: j.status === 'completed',
    },
  };
}

export const getMyJobs = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, search, sortBy } = req.query;

  const baseMatch = { client: req.user._id };
  if (status && status !== 'all') {
    if (status === 'completed') {
      baseMatch.$or = [
        { status: 'completed' },
        { paymentStatus: 'released' },
      ];
    } else {
      const statuses = LIFECYCLE_TO_DB[status];
      if (statuses) baseMatch.status = { $in: statuses };
    }
  }

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    budget_high: { 'budget.maxAmount': -1, createdAt: -1 },
    budget_low: { 'budget.maxAmount': 1, createdAt: -1 },
    proposals: { _proposalCount: -1, createdAt: -1 },
    deadline: { deadline: 1, createdAt: -1 },
  };
  const sort = sortMap[sortBy] || sortMap.newest;

  const pipeline = [
    { $match: baseMatch },
    {
      $lookup: {
        from: 'applications',
        let: { jobId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$job', '$$jobId'] }, status: { $ne: 'withdrawn' } } },
          { $count: 'n' },
        ],
        as: '_apps',
      },
    },
    { $addFields: { _proposalCount: { $ifNull: [{ $arrayElemAt: ['$_apps.n', 0] }, 0] } } },
    { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: '_category' } },
    {
      $lookup: {
        from: 'categories',
        let: { parentId: { $arrayElemAt: ['$_category.parent', 0] } },
        pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$parentId'] } } }, { $limit: 1 }],
        as: '_parentCategory',
      },
    },
    { $lookup: { from: 'escrows', localField: 'escrowId', foreignField: '_id', as: '_escrow' } },
    { $lookup: { from: 'milestones', localField: 'milestoneId', foreignField: '_id', as: '_milestone' } },
    { $lookup: { from: 'users', localField: 'hiredFreelancer', foreignField: '_id', as: '_freelancer' } },
    // Resolve the linked project either via the job's `project` back-reference or
    // the project's `job` field (legacy rows only store one direction).
    {
      $lookup: {
        from: 'projects',
        let: { jobId: '$_id', projectId: '$project' },
        pipeline: [
          { $match: { $expr: { $or: [{ $eq: ['$job', '$$jobId'] }, { $eq: ['$_id', '$$projectId'] }] } } },
          { $limit: 1 },
        ],
        as: '_project',
      },
    },
  ];

  if (search) {
    const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    pipeline.push({
      $match: {
        $or: [
          { title: re },
          { description: re },
          { requiredSkills: { $elemMatch: { $regex: re } } },
          { '_category.name': re },
          { '_parentCategory.name': re },
        ],
      },
    });
  }

  pipeline.push(
    { $sort: sort },
    {
      $group: {
        _id: null,
        data: { $push: '$$ROOT' },
        total: { $sum: 1 },
      },
    },
    {
      $project: {
        data: { $slice: ['$data', skip, limit] },
        total: 1,
      },
    },
  );

  const [result] = await Job.aggregate(pipeline);
  const total = result?.total ?? 0;
  const jobs = (result?.data ?? []).map(enrichMyJob);

  sendResponse(res, 200, 'My jobs fetched', jobs, paginationMeta(total, page, limit));
});

// ─── Update Job ───────────────────────────────────────────────────────────────
export const updateJob = catchAsync(async (req, res) => {
  const job = await Job.findOne({ _id: req.params.jobId, client: req.user._id });
  if (!job) throw new ApiError(404, 'Job not found or not authorized');

  if (!['draft', 'open', 'proposals_received', 'paused'].includes(job.status)) {
    throw new ApiError(400, 'Job can only be edited while it is open or paused');
  }

  // Status/ownership must be changed through dedicated endpoints only.
  const data = { ...req.body };
  delete data.status;
  delete data.client;

  // Protect contract-critical fields once a contract/escrow exists so editing
  // can never break an active agreement (budget, deadline, duration, category).
  const hasContract = !!(
    job.project || job.escrowId || job.hiredFreelancer || job.paymentStatus !== 'none'
  );
  if (hasContract) {
    const protectedFields = ['budget', 'deadline', 'duration', 'category', 'subcategories'];
    const bad = protectedFields.filter((f) => {
      if (!(f in data)) return false;
      const current = job[f];
      const incoming = data[f];
      return JSON.stringify(current ?? null) !== JSON.stringify(incoming ?? null);
    });
    if (bad.length) {
      throw new ApiError(400, `Cannot change ${bad.join(', ')} while the job has an active contract`);
    }
  }

  Object.assign(job, data);
  await job.save();
  emitJobLifecycleUpdate(req.user._id, job);

  sendResponse(res, 200, 'Job updated', job);
});

// ─── Delete Job ───────────────────────────────────────────────────────────────
export const deleteJob = catchAsync(async (req, res) => {
  const job = await Job.findOne({ _id: req.params.jobId, client: req.user._id });
  if (!job) throw new ApiError(404, 'Job not found or not authorized');

  const hasActiveWork = !!(
    job.project || job.escrowId || job.hiredFreelancer ||
    ['pending', 'funded', 'payment_pending', 'released'].includes(job.paymentStatus)
  );
  if (hasActiveWork || ['freelancer_selected', 'payment_pending', 'funded', 'in_progress', 'delivery_submitted', 'client_review', 'completed'].includes(job.status)) {
    throw new ApiError(400, 'Cannot delete a job with an active contract, payment, or escrow');
  }

  // Clean up attachments
  if (job.attachments?.length) {
    await deleteMultipleFiles(job.attachments.map((a) => a.publicId)).catch(() => null);
  }

  emitJobLifecycleUpdate(req.user._id, job);
  await job.deleteOne();
  sendResponse(res, 200, 'Job deleted successfully');
});

// ─── Pause Job ────────────────────────────────────────────────────────────────
export const pauseJob = catchAsync(async (req, res) => {
  const job = await Job.findOne({ _id: req.params.jobId, client: req.user._id });
  if (!job) throw new ApiError(404, 'Job not found or not authorized');
  if (!['open', 'proposals_received'].includes(job.status)) {
    throw new ApiError(400, 'Only open jobs can be paused');
  }

  job.status = 'paused';
  await job.save();
  emitJobLifecycleUpdate(req.user._id, job);
  sendResponse(res, 200, 'Job paused', job);
});

// ─── Resume Job ───────────────────────────────────────────────────────────────
export const resumeJob = catchAsync(async (req, res) => {
  const job = await Job.findOne({ _id: req.params.jobId, client: req.user._id });
  if (!job) throw new ApiError(404, 'Job not found or not authorized');
  if (job.status !== 'paused') {
    throw new ApiError(400, 'Only paused jobs can be resumed');
  }

  job.status = 'open';
  await job.save();
  emitJobLifecycleUpdate(req.user._id, job);
  sendResponse(res, 200, 'Job resumed', job);
});

// ─── Cancel Job ───────────────────────────────────────────────────────────────
// Cancel is only allowed before a contract exists. Once a freelancer is hired,
// funds are pending, or an escrow is open, the job must be resolved through the
// project workspace / dispute flow instead of a direct cancel.
export const cancelJob = catchAsync(async (req, res) => {
  const job = await Job.findOne({ _id: req.params.jobId, client: req.user._id });
  if (!job) throw new ApiError(404, 'Job not found or not authorized');

  if (!['draft', 'open', 'proposals_received', 'paused'].includes(job.status)) {
    throw new ApiError(400, 'This job cannot be cancelled because work or payment is already in progress');
  }

  const hasActiveWork = !!(
    job.project || job.escrowId || job.hiredFreelancer ||
    ['pending', 'funded'].includes(job.paymentStatus)
  );
  if (hasActiveWork) {
    throw new ApiError(400, 'Cannot cancel this job. It has an active contract or payment. Resolve it from the project workspace or open a dispute.');
  }

  job.status = 'cancelled';
  await job.save();
  emitJobLifecycleUpdate(req.user._id, job);
  sendResponse(res, 200, 'Job cancelled', job);
});

// ─── Close / Cancel Job ───────────────────────────────────────────────────────
export const updateJobStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  const job = await Job.findOne({ _id: req.params.jobId, client: req.user._id });
  if (!job) throw new ApiError(404, 'Job not found');

  const allowed = {
    open: ['paused', 'cancelled'],
    paused: ['open', 'cancelled'],
    proposals_received: ['cancelled'],
    freelancer_selected: ['cancelled'],
    payment_pending: ['cancelled'],
    funded: ['cancelled'],
    in_progress: ['cancelled', 'client_review'],
    delivery_submitted: ['client_review'],
    client_review: ['completed'],
  };
  if (!allowed[job.status]?.includes(status)) {
    throw new ApiError(400, `Cannot transition job from "${job.status}" to "${status}"`);
  }

  // Guard: never allow cancelling a job that has an active contract/payment.
  if (status === 'cancelled') {
    const hasActiveWork = !!(
      job.project || job.escrowId || job.hiredFreelancer ||
      ['pending', 'funded'].includes(job.paymentStatus)
    );
    if (hasActiveWork) {
      throw new ApiError(400, 'Cannot cancel this job. It has an active contract or payment. Resolve it from the project workspace or open a dispute.');
    }
  }

  job.status = status;
  await job.save();
  sendResponse(res, 200, 'Job status updated', job);
});

// ─── Invite Freelancer ────────────────────────────────────────────────────────
export const inviteFreelancer = catchAsync(async (req, res) => {
  const { freelancerId } = req.body;
  const job = await Job.findOne({ _id: req.params.jobId, client: req.user._id, status: 'open' });
  if (!job) throw new ApiError(404, 'Job not found');

  const freelancer = await User.findOne({ _id: freelancerId, role: 'freelancer', isActive: true });
  if (!freelancer) throw new ApiError(404, 'Freelancer not found');

  await Job.findByIdAndUpdate(job._id, { $addToSet: { invitedFreelancers: freelancerId } });

  try {
    const { notifyJobInvitation } = await import('../services/notification.service.js');
    await notifyJobInvitation(freelancerId, req.user, job);
  } catch (_) {}

  sendResponse(res, 200, 'Freelancer invited');
});

// ─── Get Recommended Jobs (for freelancer) ────────────────────────────────────
export const getRecommendedJobs = catchAsync(async (req, res) => {
  const { recommendJobsForFreelancer } = await import('../services/ai.service.js');
  const { Profile } = await import('../models/index.js');

  const profile = await Profile.findOne({ user: req.user._id });
  if (!profile) return sendResponse(res, 200, 'Recommendations', []);

  const recommendations = await recommendJobsForFreelancer(profile, 10);
  sendResponse(res, 200, 'Recommended jobs', recommendations);
});

// ─── Fund Job Payment (Client pays into escrow) ──────────────────────────────
export const fundJobPayment = catchAsync(async (req, res) => {
  const job = await Job.findOne({
    _id: req.params.jobId,
    client: req.user._id,
    status: 'payment_pending',
  }).populate('milestoneId');

  if (!job) throw new ApiError(404, 'Job not found or not in payment_pending status');
  if (!job.milestoneId) throw new ApiError(400, 'No milestone found for this job. Please contact support.');

  const milestone = job.milestoneId;
  if (milestone.status !== 'pending') {
    throw new ApiError(400, `Payment for this job is already ${milestone.status}`);
  }

  // Fund the AGREED amount (the accepted proposal / milestone), never the
  // client's budget range max — they can differ (e.g. budget 5000, bid 3972).
  const amount = milestone.amount || job.budget.maxAmount;

  if (amount <= 0) throw new ApiError(400, 'Invalid payment amount');

  const result = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // Check wallet balance
    const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
    if (!wallet || wallet.balance - wallet.escrowBalance < amount) {
      throw new ApiError(400, `Insufficient wallet balance. Required: ${amount} ETB. Available: ${(wallet.balance - wallet.escrowBalance).toFixed(2)} ETB`);
    }

    // Hold in escrow
    await holdEscrow(req.user._id, amount, session);

    const commissionRate = getCommissionRate();

    // Create payment record
    const reference = generateTxRef('JOB');
    const invoiceNumber = await generateInvoiceNumber();
    const payment = await Payment.create([{
      payer: req.user._id,
      payee: job.hiredFreelancer,
      project: job.project,
      milestone: milestone._id,
      type: 'escrow',
      amount,
      currency: job.budget.currency || 'ETB',
      commission: 0,
      commissionRate,
      netAmount: amount,
      status: 'completed',
      provider: 'wallet',
      reference,
      invoiceNumber,
      description: `Escrow for job: ${job.title}`,
      isEscrow: true,
      escrowHeldAt: new Date(),
      processedAt: new Date(),
    }], opts);

    // Record transaction
    const updatedWallet = await Wallet.findOne({ user: req.user._id }).session(session);
    const holdTx = await recordTransaction({
      userId: req.user._id,
      walletId: wallet._id,
      type: 'escrow_hold',
      amount,
      netAmount: amount,
      status: 'completed',
      reference: generateTxRef('TX'),
      description: `Escrow hold for job: ${job.title}`,
      paymentId: payment[0]._id,
      projectId: job.project,
      milestoneId: milestone._id,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance,
    });

    // Update milestone
    milestone.status = 'funded';
    milestone.paymentId = payment[0]._id;
    await milestone.save(opts);

    // Canonical Escrow record so the escrow engine (admin release/refund,
    // escrow APIs) can see and operate on job-backed contracts too.
    const { commission: escrowCommission, netAmount: escrowNet } =
      calculateCommission(amount, commissionRate);
    let escrow = await Escrow.findOne({ milestone: milestone._id }).session(session);
    if (escrow) {
      escrow.status = 'funded';
      escrow.fundedAt = new Date();
      escrow.paymentId = payment[0]._id;
      if (holdTx?._id) escrow.fundingTransaction = holdTx._id;
      escrow.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (!escrow.client) escrow.client = req.user._id;
      if (!escrow.freelancer) escrow.freelancer = job.hiredFreelancer;
      await escrow.save(opts);
    } else {
      [escrow] = await Escrow.create([{
        client: req.user._id,
        freelancer: job.hiredFreelancer,
        project: job.project,
        milestone: milestone._id,
        amount,
        currency: job.budget.currency || 'ETB',
        commissionRate,
        commissionAmount: escrowCommission,
        freelancerAmount: escrowNet,
        status: 'funded',
        fundedAt: new Date(),
        fundingTransaction: holdTx?._id || null,
        paymentId: payment[0]._id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: `Escrow for job: ${job.title}`,
      }], opts);
    }
    job.escrowId = escrow._id;

    // Update job
    job.status = 'funded';
    job.paymentStatus = 'funded';
    job.paymentId = payment[0]._id;
    await job.save(opts);

    // Update project status + link the funding Payment
    if (job.project) {
      const { Project } = await import('../models/index.js');
      await Project.updateOne(
        { _id: job.project },
        { $set: { status: 'active', escrowPaymentId: payment[0]._id } },
        opts
      );
    }

    return { job, payment: payment[0], milestone, escrow };
  });

  emitJobLifecycleUpdate(req.user._id, job);
  sendResponse(res, 200, 'Payment funded successfully. Freelancer can now start work.', result);
});

// ─── Start Job Work (Freelancer begins working) ──────────────────────────────
export const startJobWork = catchAsync(async (req, res) => {
  const job = await Job.findOne({
    _id: req.params.jobId,
    hiredFreelancer: req.user._id,
    status: 'funded',
  });

  if (!job) throw new ApiError(404, 'Job not found or not eligible to start work');

  job.status = 'in_progress';
  await job.save();
  emitJobLifecycleUpdate(req.user._id, job);

  // Also update milestone
  if (job.milestoneId) {
    await Milestone.findByIdAndUpdate(job.milestoneId, { status: 'in_progress' });
  }

  sendResponse(res, 200, 'Work started on job', job);
});

// ─── Submit Job Delivery (Freelancer delivers) ────────────────────────────────
export const submitJobDelivery = catchAsync(async (req, res) => {
  const job = await Job.findOne({
    _id: req.params.jobId,
    hiredFreelancer: req.user._id,
    status: 'in_progress',
  });

  if (!job) throw new ApiError(404, 'Job not found or not in progress');

  const files = req.files?.length
    ? await uploadMultipleFiles(req.files, 'deliveries')
    : [];

  job.status = 'delivery_submitted';
  await job.save();
  emitJobLifecycleUpdate(req.user._id, job);

  // Update milestone
  if (job.milestoneId) {
    await Milestone.findByIdAndUpdate(job.milestoneId, {
      status: 'submitted',
      deliveryFiles: files,
      deliveryNote: req.body.note || '',
      submittedAt: new Date(),
    });
  }

  // Update project
  if (job.project) {
    const { Project } = await import('../models/index.js');
    await Project.findByIdAndUpdate(job.project, { status: 'pending_delivery' });
  }

  sendResponse(res, 200, 'Delivery submitted. Awaiting client review.', job);
});

// ─── Approve Job Delivery (Client approves + releases payment) ────────────────
export const approveJobDelivery = catchAsync(async (req, res) => {
  const job = await Job.findOne({
    _id: req.params.jobId,
    client: req.user._id,
    status: 'delivery_submitted',
  });

  if (!job) throw new ApiError(404, 'Job not found or not in delivery_submitted status');

  // ENFORCE PAYMENT CHECK
  if (job.paymentStatus !== 'funded') {
    throw new ApiError(400, 'Payment not funded. Please complete payment before approving delivery.');
  }

  const result = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // Release escrow to freelancer — use the AGREED milestone amount so the
    // payout matches what was actually funded (never the budget range max).
    let amount = job.budget.maxAmount;
    if (job.milestoneId) {
      const ms = await Milestone.findById(job.milestoneId).session(session);
      if (ms && ms.amount > 0) amount = ms.amount;
    }
    const escrowForRelease = job.escrowId
      ? await Escrow.findById(job.escrowId).session(session)
      : await Escrow.findOne({ milestone: job.milestoneId }).session(session);
    const { commission, netAmount, commissionRate } = resolveCommissionSnapshot(
      escrowForRelease,
      amount,
      getCommissionRate()
    );

    // Debit escrow from client
    const clientWallet = await Wallet.findOne({ user: req.user._id }).session(session);
    if (!clientWallet) throw new ApiError(400, 'Client wallet not found');
    clientWallet.escrowBalance -= amount;
    clientWallet.balance -= amount;
    clientWallet.totalSpent += amount;
    await clientWallet.save(opts);

    // Credit freelancer
    let freelancerWallet = await Wallet.findOne({ user: job.hiredFreelancer }).session(session);
    if (!freelancerWallet) {
      freelancerWallet = (await Wallet.create([{ user: job.hiredFreelancer }], opts))[0];
    }
    freelancerWallet.balance += netAmount;
    freelancerWallet.totalEarned += netAmount;
    await freelancerWallet.save(opts);

    // Record transactions
    const clientTx = await Transaction.create([{
      user: req.user._id,
      wallet: clientWallet._id,
      type: 'escrow_release',
      amount,
      fee: 0,
      netAmount: amount,
      status: 'completed',
      reference: generateTxRef('ESCR'),
      description: `Payment released for job: ${job.title}`,
      metadata: { jobId: job._id.toString(), freelancerId: job.hiredFreelancer.toString() },
      paymentId: job.paymentId,
      projectId: job.project,
      milestoneId: job.milestoneId,
      balanceBefore: clientWallet.balance + amount,
      balanceAfter: clientWallet.balance,
      processedAt: new Date(),
    }], opts);

    const freelancerTx = await Transaction.create([{
      user: job.hiredFreelancer,
      wallet: freelancerWallet._id,
      type: 'escrow_release',
      amount,
      fee: commission,
      netAmount,
      status: 'completed',
      reference: generateTxRef('ESCP'),
      description: `Payment received for job: ${job.title}`,
      metadata: { jobId: job._id.toString(), clientId: req.user._id.toString() },
      paymentId: job.paymentId,
      projectId: job.project,
      milestoneId: job.milestoneId,
      balanceBefore: freelancerWallet.balance - netAmount,
      balanceAfter: freelancerWallet.balance,
      processedAt: new Date(),
    }], opts);

    // Record platform commission (idempotent per job)
    if (commission > 0) {
      await recordCommissionTransaction({
        scopeKey: `J-${job._id}`,
        fields: {
          user: job.hiredFreelancer,
          wallet: freelancerWallet._id,
          type: 'commission',
          amount: commission,
          fee: 0,
          netAmount: commission,
          status: 'completed',
          description: `Platform commission (${(commissionRate * 100).toFixed(0)}%)`,
          metadata: { jobId: job._id.toString() },
          paymentId: job.paymentId,
          projectId: job.project,
          milestoneId: job.milestoneId,
          balanceBefore: freelancerWallet.balance,
          balanceAfter: freelancerWallet.balance,
          processedAt: new Date(),
        },
      }, opts);
    }

    // Update job
    job.status = 'completed';
    job.paymentStatus = 'released';
    await job.save(opts);

    // Update milestone
    if (job.milestoneId) {
      await Milestone.findByIdAndUpdate(job.milestoneId, {
        status: 'released',
        approvedAt: new Date(),
        approvedBy: req.user._id,
        escrowReleasedAt: new Date(),
      }, opts);
    }

    // Mark the funding Payment as released + sync the Escrow record (previously
    // neither was updated on delivery approval, so the Payment stayed "in
    // escrow" and Payment/PaymentStatus disagreed).
    if (job.paymentId) {
      await Payment.updateOne(
        { _id: job.paymentId },
        { $set: { isEscrow: true, escrowReleasedAt: new Date(), processedAt: new Date() } },
        opts
      );
    }
    if (job.escrowId) {
      await Escrow.updateOne(
        { _id: job.escrowId },
        { $set: { status: 'released', releasedAt: new Date(), releaseTransaction: clientTx[0]._id } },
        opts
      );
    }

    // Update project (complete it and record the amount actually paid).
    if (job.project) {
      const { Project } = await import('../models/index.js');
      await Project.updateOne(
        { _id: job.project },
        {
          $set: { status: 'completed', 'timeline.completedAt': new Date(), progress: 100 },
          $inc: { 'budget.paidAmount': amount },
        },
        opts
      );
    }

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.completedProjects': 1, 'stats.activeProjects': -1 },
    }, opts);
    await User.findByIdAndUpdate(job.hiredFreelancer, {
      $inc: { 'stats.completedProjects': 1, 'stats.activeProjects': -1 },
    }, opts);

    return { job, commission, netAmount, clientTx: clientTx[0], freelancerTx: freelancerTx[0] };
  });

  emitJobLifecycleUpdate(req.user._id, job);

  // Notifications (fire-and-forget)
  try {
    const { notifyPaymentReceived } = await import('../services/notification.service.js');
    await notifyPaymentReceived(job.hiredFreelancer, result.netAmount, job.budget.currency, `Job: ${job.title}`);
  } catch (_) {}

  sendResponse(res, 200, 'Delivery approved. Payment released to freelancer.', result);
});
