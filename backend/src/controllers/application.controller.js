import { Application, Job, User, Project, Milestone } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { uploadMultipleFiles } from '../services/cloudinary.service.js';
import { notifyJobApplication, notifyApplicationStatus } from '../services/notification.service.js';
import { sendApplicationReceivedEmail, sendApplicationStatusEmail } from '../services/email.service.js';

// ─── Submit Application ───────────────────────────────────────────────────────
export const submitApplication = catchAsync(async (req, res) => {
  const { jobId } = req.params;

  const job = await Job.findById(jobId).populate('client', 'firstName lastName email');
  if (!job) throw new ApiError(404, 'Job not found');
  if (job.status !== 'open') throw new ApiError(400, 'This job is no longer accepting applications');
  if (!job.client) throw new ApiError(400, 'This job has no client assigned');
  if (job.client._id.toString() === req.user._id.toString()) {
    throw new ApiError(400, 'You cannot apply to your own job');
  }

  // Duplicate check
  const existing = await Application.findOne({ job: jobId, freelancer: req.user._id });
  if (existing) throw new ApiError(409, 'You have already applied for this job');

  const attachments = req.files?.length
    ? await uploadMultipleFiles(req.files, 'jobs')
    : [];

  const application = await Application.create({
    job: jobId,
    freelancer: req.user._id,
    client: job.client._id,
    ...req.body,
    attachments,
  });

  // Update job application count
  await Job.findByIdAndUpdate(jobId, { $inc: { applicationsCount: 1 } });

  // Populate for response
  await application.populate([
    { path: 'freelancer', select: 'firstName lastName avatar stats' },
    { path: 'job', select: 'title budget' },
  ]);

  // Notifications
  await notifyJobApplication(job.client._id, req.user, job).catch(() => null);
  await sendApplicationReceivedEmail(job.client, job, `${req.user.firstName} ${req.user.lastName}`).catch(() => null);

  sendResponse(res, 201, 'Application submitted successfully', application);
});

// ─── Get Applications for a Job (client view) ─────────────────────────────────
export const getJobApplications = catchAsync(async (req, res) => {
  const { jobId } = req.params;
  const { page, limit, skip } = parsePagination(req.query);
  const { status, sortBy } = req.query;

  const job = await Job.findOne({ _id: jobId, client: req.user._id });
  if (!job) throw new ApiError(404, 'Job not found or not authorized');

  const filter = { job: jobId };
  if (status) filter.status = status;

  const total = await Application.countDocuments(filter);
  const applications = await Application.find(filter)
    .populate('freelancer', 'firstName lastName avatar stats isOnline lastSeen')
    .populate({ path: 'freelancer', populate: { path: 'profile' } })
    .populate('job', 'title budget status deadline client')
    .sort(sortBy === 'rating' ? { 'freelancer.stats.averageRating': -1 } : { createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Applications fetched', applications, paginationMeta(total, page, limit));
});

// ─── Get My Applications (freelancer view) ────────────────────────────────────
export const getMyApplications = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;

  const filter = { freelancer: req.user._id };
  if (status) filter.status = status;

  const total = await Application.countDocuments(filter);
  const applications = await Application.find(filter)
    .populate('job', 'title budget deadline status client category')
    .populate({ path: 'job', populate: { path: 'client', select: 'firstName lastName avatar' } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'My applications fetched', applications, paginationMeta(total, page, limit));
});

// ─── Get Single Application ───────────────────────────────────────────────────
export const getApplication = catchAsync(async (req, res) => {
  const application = await Application.findById(req.params.appId)
    .populate('freelancer', 'firstName lastName avatar stats')
    .populate('job', 'title budget deadline client');

  if (!application) throw new ApiError(404, 'Application not found');

  const isOwner =
    application.freelancer._id.toString() === req.user._id.toString() ||
    application.client.toString() === req.user._id.toString() ||
    req.user.role === 'admin';

  if (!isOwner) throw new ApiError(403, 'Not authorized');

  // Mark as viewed if client viewing
  if (application.client.toString() === req.user._id.toString() && !application.isRead) {
    await Application.findByIdAndUpdate(req.params.appId, { isRead: true, readAt: new Date() });
    if (application.status === 'pending') {
      await Application.findByIdAndUpdate(req.params.appId, { status: 'viewed' });
    }
  }

  sendResponse(res, 200, 'Application fetched', application);
});

// ─── Update Application Status (client action) ───────────────────────────────
// Allowed status transitions enforce a realistic hiring workflow:
//   pending → viewed → shortlisted → accepted
//   Any pre-accept status → rejected (cannot un-reject)
//   Already-accepted applications cannot be changed.
const ALLOWED_APP_TRANSITIONS = {
  pending:    ['viewed', 'shortlisted', 'rejected'],
  viewed:     ['shortlisted', 'rejected'],
  shortlisted: ['accepted', 'rejected'],
  // rejected and withdrawn are terminal — the only way back is the freelancer
  // withdrawing and re-applying on a new application.
};

export const updateApplicationStatus = catchAsync(async (req, res) => {
  const { status, rejectionReason, clientNote } = req.body;
  const application = await Application.findOne({
    _id: req.params.appId,
    client: req.user._id,
  }).populate('freelancer', 'firstName lastName email').populate('job', 'title');

  if (!application) throw new ApiError(404, 'Application not found');
  if (application.status === 'accepted') throw new ApiError(400, 'Application is already accepted');
  if (application.status === 'rejected') throw new ApiError(400, 'Cannot change a rejected application');

  const allowed = ALLOWED_APP_TRANSITIONS[application.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Cannot transition application from '${application.status}' to '${status}'`);
  }

  application.status = status;
  if (rejectionReason) application.rejectionReason = rejectionReason;
  if (clientNote) application.clientNote = clientNote;
  await application.save();

  // Notify freelancer
  await notifyApplicationStatus(application.freelancer._id, req.user, application.job, status, application._id);
  await sendApplicationStatusEmail(application.freelancer, application.job, status, rejectionReason).catch(() => null);

  sendResponse(res, 200, `Application ${status}`, application);
});

// ─── Withdraw Application ─────────────────────────────────────────────────────
export const withdrawApplication = catchAsync(async (req, res) => {
  const application = await Application.findOne({
    _id: req.params.appId,
    freelancer: req.user._id,
  });

  if (!application) throw new ApiError(404, 'Application not found');
  if (application.status === 'accepted') throw new ApiError(400, 'Cannot withdraw an accepted application');

  application.status = 'withdrawn';
  await application.save();

  await Job.findByIdAndUpdate(application.job, { $inc: { applicationsCount: -1 } });

  sendResponse(res, 200, 'Application withdrawn');
});

// ─── Hire Freelancer (creates project + milestone, requires payment) ─────────
export const hireFreelancer = catchAsync(async (req, res) => {
  const application = await Application.findOne({
    _id: req.params.appId,
    client: req.user._id,
  })
    .populate('freelancer', 'firstName lastName email')
    .populate('job');

  if (!application) throw new ApiError(404, 'Application not found');
  if (application.status !== 'pending' && application.status !== 'shortlisted' && application.status !== 'viewed') {
    throw new ApiError(400, 'Can only hire from pending/shortlisted applications');
  }

  // Accept application
  application.status = 'accepted';
  await application.save();

  // Reject all other applications for this job
  await Application.updateMany(
    { job: application.job._id, _id: { $ne: application._id }, status: { $nin: ['accepted', 'rejected', 'withdrawn'] } },
    { status: 'rejected', rejectionReason: 'Another freelancer was selected for this job' }
  );

  // Update job status to payment_pending (NOT in_progress)
  await Job.findByIdAndUpdate(application.job._id, {
    status: 'payment_pending',
    hiredFreelancer: application.freelancer._id,
    paymentStatus: 'pending',
  });

  // Create project with pending_payment status
  const deadline = new Date();
  const { value, unit } = application.deliveryTime;
  const days = unit === 'hours' ? value / 24 : unit === 'weeks' ? value * 7 : unit === 'months' ? value * 30 : value;
  deadline.setDate(deadline.getDate() + Math.ceil(days));

  const project = await Project.create({
    job: application.job._id,
    application: application._id,
    client: req.user._id,
    freelancer: application.freelancer._id,
    title: application.job.title,
    description: application.job.description,
    status: 'pending_payment',
    budget: {
      agreedAmount: application.priceOffer.amount,
      currency: application.priceOffer.currency,
    },
    timeline: { deadline, estimatedDuration: Math.ceil(days) },
  });

  // Create milestone for this job payment
  const milestone = await Milestone.create({
    project: project._id,
    client: req.user._id,
    freelancer: application.freelancer._id,
    title: application.job.title,
    description: `Payment for: ${application.job.title}`,
    amount: application.priceOffer.amount,
    currency: application.priceOffer.currency,
    dueDate: deadline,
    status: 'pending',
  });

  // Link milestone + project back to the job so funding/release can activate
  // the project and stamp `projectId` on payment/transaction records.
  await Job.findByIdAndUpdate(application.job._id, {
    milestoneId: milestone._id,
    project: project._id,
  });

  // Update user active projects count
  await User.findByIdAndUpdate(req.user._id, { $inc: { 'stats.activeProjects': 1 } });
  await User.findByIdAndUpdate(application.freelancer._id, { $inc: { 'stats.activeProjects': 1 } });

  sendResponse(res, 201, 'Freelancer hired. Please fund the milestone to start work.', { application, project, milestone });
});
