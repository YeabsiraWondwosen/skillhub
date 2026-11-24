import { RecruiterPipeline } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import * as recruiterService from '../services/recruiter.service.js';

// ─── Freelancer Search ───────────────────────────────────────────────────────
export const searchFreelancers = catchAsync(async (req, res) => {
  const result = await recruiterService.searchFreelancers(req.query);
  sendResponse(res, 200, 'Freelancers fetched', result.results, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

// ─── Get Freelancer Detail ───────────────────────────────────────────────────
export const getFreelancer = catchAsync(async (req, res) => {
  const freelancer = await recruiterService.getFreelancerDetail(req.params.freelancerId);
  if (!freelancer) throw new ApiError(404, 'Freelancer not found');
  sendResponse(res, 200, 'Freelancer fetched', freelancer);
});

// ─── Compare Candidates ──────────────────────────────────────────────────────
export const compareCandidates = catchAsync(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length < 2) {
    throw new ApiError(400, 'Provide 2-5 freelancer IDs to compare');
  }
  const result = await recruiterService.compareCandidates(ids);
  if (!result) throw new ApiError(400, 'Could not compare candidates');
  sendResponse(res, 200, 'Candidates compared', result);
});

// ─── Pipelines ───────────────────────────────────────────────────────────────
export const getPipelines = catchAsync(async (req, res) => {
  const pipelines = await recruiterService.getPipelines(req.user._id, req.query);
  sendResponse(res, 200, 'Pipelines fetched', pipelines);
});

export const getPipeline = catchAsync(async (req, res) => {
  const pipeline = await recruiterService.getPipeline(req.user._id, req.params.pipelineId);
  if (!pipeline) throw new ApiError(404, 'Pipeline not found');
  sendResponse(res, 200, 'Pipeline fetched', pipeline);
});

export const createPipeline = catchAsync(async (req, res) => {
  const pipeline = await recruiterService.createPipeline(req.user._id, req.body);
  sendResponse(res, 201, 'Pipeline created', pipeline);
});

export const updatePipeline = catchAsync(async (req, res) => {
  const pipeline = await recruiterService.updatePipeline(req.user._id, req.params.pipelineId, req.body);
  if (!pipeline) throw new ApiError(404, 'Pipeline not found');
  sendResponse(res, 200, 'Pipeline updated', pipeline);
});

export const deletePipeline = catchAsync(async (req, res) => {
  const pipeline = await recruiterService.deletePipeline(req.user._id, req.params.pipelineId);
  if (!pipeline) throw new ApiError(404, 'Pipeline not found');
  sendResponse(res, 200, 'Pipeline deleted');
});

// ─── Candidates ──────────────────────────────────────────────────────────────
export const addCandidate = catchAsync(async (req, res) => {
  const result = await recruiterService.addCandidate(req.user._id, req.params.pipelineId, req.body.freelancerId, req.body);
  if (!result) throw new ApiError(404, 'Pipeline not found');
  if (result.error) throw new ApiError(400, result.error);
  sendResponse(res, 201, 'Candidate added', result);
});

export const moveCandidate = catchAsync(async (req, res) => {
  const result = await recruiterService.moveCandidate(
    req.user._id, req.params.pipelineId, req.params.candidateId, req.body.stage, req.body.reason
  );
  if (!result) throw new ApiError(404, 'Pipeline or candidate not found');
  sendResponse(res, 200, 'Candidate moved', result);
});

export const rateCandidate = catchAsync(async (req, res) => {
  const result = await recruiterService.rateCandidate(
    req.user._id, req.params.pipelineId, req.params.candidateId, req.body.rating
  );
  if (!result) throw new ApiError(404, 'Pipeline or candidate not found');
  sendResponse(res, 200, 'Candidate rated', result);
});

export const addCandidateNote = catchAsync(async (req, res) => {
  const result = await recruiterService.addCandidateNote(
    req.user._id, req.params.pipelineId, req.params.candidateId, req.body.content
  );
  if (!result) throw new ApiError(404, 'Pipeline or candidate not found');
  sendResponse(res, 201, 'Note added', result);
});

export const removeCandidate = catchAsync(async (req, res) => {
  const result = await recruiterService.removeCandidate(
    req.user._id, req.params.pipelineId, req.params.candidateId
  );
  if (!result) throw new ApiError(404, 'Pipeline or candidate not found');
  sendResponse(res, 200, 'Candidate removed');
});

// ─── Invitations ─────────────────────────────────────────────────────────────
export const sendInvitation = catchAsync(async (req, res) => {
  const result = await recruiterService.sendInvitation(
    req.user._id, req.params.pipelineId, req.body.freelancerId, req.body
  );
  if (!result) throw new ApiError(404, 'Pipeline not found');
  if (result.error) throw new ApiError(400, result.error);
  sendResponse(res, 201, 'Invitation sent', result);
});

export const getInvitations = catchAsync(async (req, res) => {
  const invitations = await recruiterService.getInvitations(req.user._id, req.params.pipelineId);
  if (!invitations) throw new ApiError(404, 'Pipeline not found');
  sendResponse(res, 200, 'Invitations fetched', invitations);
});

export const cancelInvitation = catchAsync(async (req, res) => {
  const result = await recruiterService.cancelInvitation(
    req.user._id, req.params.pipelineId, req.params.invitationId
  );
  if (!result) throw new ApiError(404, 'Pipeline or invitation not found');
  sendResponse(res, 200, 'Invitation cancelled');
});

// ─── Analytics ───────────────────────────────────────────────────────────────
export const getAnalytics = catchAsync(async (req, res) => {
  const analytics = await recruiterService.getRecruiterAnalytics(req.user._id);
  sendResponse(res, 200, 'Analytics fetched', analytics);
});
