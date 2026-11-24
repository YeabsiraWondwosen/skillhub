import { CostEstimate, Job } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse } from '../utils/apiResponse.js';
import { estimateProjectCost, estimateCostFromJob } from '../services/costEstimator.service.js';

export const createEstimate = catchAsync(async (req, res) => {
  const { projectDescription, projectName } = req.body;

  const estimateData = await estimateProjectCost(projectDescription, projectName);

  const estimate = await CostEstimate.create({
    user: req.user._id,
    projectDescription,
    projectName: projectName || 'Untitled Project',
    ...estimateData,
    status: 'completed',
    estimatedAt: new Date(),
  });

  sendResponse(res, 201, 'Cost estimate generated successfully', estimate);
});

export const estimateFromJob = catchAsync(async (req, res) => {
  const { jobId } = req.params;

  const job = await Job.findById(jobId);
  if (!job) throw new ApiError(404, 'Job not found');

  const estimateData = await estimateCostFromJob(job);

  const estimate = await CostEstimate.create({
    user: req.user._id,
    projectDescription: `Job: ${job.title}\n${job.description}`,
    projectName: job.title,
    ...estimateData,
    status: 'completed',
    estimatedAt: new Date(),
  });

  sendResponse(res, 201, 'Cost estimate generated from job', estimate);
});

export const getMyEstimates = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const [estimates, total] = await Promise.all([
    CostEstimate.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CostEstimate.countDocuments({ user: req.user._id }),
  ]);

  sendResponse(res, 200, 'Your cost estimates', estimates, {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  });
});

export const getEstimateById = catchAsync(async (req, res) => {
  const estimate = await CostEstimate.findById(req.params.estimateId)
    .populate('user', 'firstName lastName');

  if (!estimate) throw new ApiError(404, 'Cost estimate not found');
  if (estimate.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to view this estimate');
  }

  sendResponse(res, 200, 'Cost estimate retrieved', estimate);
});

export const deleteEstimate = catchAsync(async (req, res) => {
  const estimate = await CostEstimate.findById(req.params.estimateId);

  if (!estimate) throw new ApiError(404, 'Cost estimate not found');
  if (estimate.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to delete this estimate');
  }

  await CostEstimate.findByIdAndDelete(req.params.estimateId);
  sendResponse(res, 200, 'Cost estimate deleted successfully');
});
