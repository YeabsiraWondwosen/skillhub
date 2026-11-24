import { Profile, Job } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse } from '../utils/apiResponse.js';
import {
  matchFreelancersToJob,
  recommendJobsForFreelancer,
  generateProposalDraft,
  generateFullProposal,
  detectSkillGaps,
} from '../services/ai.service.js';

export const getFreelancerMatches = catchAsync(async (req, res) => {
  const job = await Job.findById(req.params.jobId);
  if (!job) throw new ApiError(404, 'Job not found');
  if (job.client.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }

  const matches = await matchFreelancersToJob(job, 10);
  sendResponse(res, 200, 'Freelancer matches', matches);
});

export const getJobRecommendations = catchAsync(async (req, res) => {
  const profile = await Profile.findOne({ user: req.user._id });
  if (!profile) throw new ApiError(404, 'Profile not found');

  const recommendations = await recommendJobsForFreelancer(profile, 10);
  sendResponse(res, 200, 'Job recommendations', recommendations);
});

export const generateProposal = catchAsync(async (req, res) => {
  const { jobId } = req.params;
  const profile = await Profile.findOne({ user: req.user._id }).populate('user', 'stats');
  const job = await Job.findById(jobId);

  if (!profile) throw new ApiError(404, 'Profile not found');
  if (!job) throw new ApiError(404, 'Job not found');

  const draft = await generateProposalDraft(profile, job);
  sendResponse(res, 200, 'Proposal draft generated', { draft });
});

export const getSkillGaps = catchAsync(async (req, res) => {
  const { jobId } = req.params;
  const profile = await Profile.findOne({ user: req.user._id });
  const job = await Job.findById(jobId);

  if (!profile) throw new ApiError(404, 'Profile not found');
  if (!job) throw new ApiError(404, 'Job not found');

  const gaps = await detectSkillGaps(profile, job);
  sendResponse(res, 200, 'Skill gap analysis', gaps);
});

export const generateFullProposalData = catchAsync(async (req, res) => {
  const { jobId } = req.params;
  const profile = await Profile.findOne({ user: req.user._id })
    .populate('user', 'firstName lastName stats');
  const job = await Job.findById(jobId)
    .populate('client', 'firstName lastName avatar stats');

  if (!profile) throw new ApiError(404, 'Profile not found. Please complete your profile first.');
  if (!job) throw new ApiError(404, 'Job not found');
  if (job.status !== 'open') throw new ApiError(400, 'This job is no longer accepting applications');

  const existing = await import('../models/index.js').then(m =>
    m.Application.findOne({ job: jobId, freelancer: req.user._id })
  );
  if (existing) throw new ApiError(409, 'You have already applied for this job');

  const [proposal, skillGaps] = await Promise.all([
    generateFullProposal(profile, job),
    detectSkillGaps(profile, job),
  ]);

  sendResponse(res, 200, 'Full proposal data generated', {
    job,
    profile: {
      skills: profile.skills,
      bio: profile.bio,
      hourlyRate: profile.hourlyRate,
      portfolio: profile.portfolio || [],
      experience: profile.experience || [],
      education: profile.education || [],
    },
    proposal,
    skillGaps,
  });
});
