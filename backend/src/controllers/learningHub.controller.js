import { LearningPlan } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import {
  analyzeSkillGaps,
  getCourseRecommendations,
  getCertificationRecommendations,
  getLearningResources,
  generateLearningPlan,
  updateItemProgress,
} from '../services/learningHub.service.js';

// ─── Get Skill Gap Analysis ──────────────────────────────────────────────────
export const getSkillGapAnalysis = catchAsync(async (req, res) => {
  const { targetRole } = req.query;
  const analysis = await analyzeSkillGaps(req.user._id, targetRole);
  if (!analysis) throw new ApiError(404, 'Complete your profile first to get skill gap analysis');
  sendResponse(res, 200, 'Skill gap analysis fetched', analysis);
});

// ─── Get Course Recommendations ──────────────────────────────────────────────
export const getCourses = catchAsync(async (req, res) => {
  const { targetRole } = req.query;
  const courses = await getCourseRecommendations(req.user._id, targetRole);
  sendResponse(res, 200, 'Course recommendations fetched', courses);
});

// ─── Get Certification Recommendations ───────────────────────────────────────
export const getCertifications = catchAsync(async (req, res) => {
  const { targetRole } = req.query;
  const certs = await getCertificationRecommendations(req.user._id, targetRole);
  sendResponse(res, 200, 'Certification recommendations fetched', certs);
});

// ─── Get Learning Resources ──────────────────────────────────────────────────
export const getResources = catchAsync(async (req, res) => {
  const { skill } = req.query;
  const resources = await getLearningResources(req.user._id, skill);
  sendResponse(res, 200, 'Learning resources fetched', resources);
});

// ─── Generate Full Learning Plan ─────────────────────────────────────────────
export const createPlan = catchAsync(async (req, res) => {
  const { targetRole, goal, title } = req.body;
  const plan = await generateLearningPlan(req.user._id, { targetRole, goal, title });
  if (!plan) throw new ApiError(400, 'Could not generate plan. Ensure your profile is complete.');
  sendResponse(res, 201, 'Learning plan created', plan);
});

// ─── Get All Plans ───────────────────────────────────────────────────────────
export const getPlans = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;

  const filter = { user: req.user._id };
  if (status) filter.status = status;

  const total = await LearningPlan.countDocuments(filter);
  const plans = await LearningPlan.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Learning plans fetched', plans, paginationMeta(total, page, limit));
});

// ─── Get Single Plan ─────────────────────────────────────────────────────────
export const getPlan = catchAsync(async (req, res) => {
  const plan = await LearningPlan.findOne({ _id: req.params.planId, user: req.user._id });
  if (!plan) throw new ApiError(404, 'Learning plan not found');
  sendResponse(res, 200, 'Learning plan fetched', plan);
});

// ─── Update Plan Status ──────────────────────────────────────────────────────
export const updatePlanStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  const plan = await LearningPlan.findOneAndUpdate(
    { _id: req.params.planId, user: req.user._id },
    { status },
    { new: true }
  );
  if (!plan) throw new ApiError(404, 'Learning plan not found');
  sendResponse(res, 200, 'Plan status updated', plan);
});

// ─── Update Item Progress ────────────────────────────────────────────────────
export const updateCourseProgress = catchAsync(async (req, res) => {
  const { planId, courseId } = req.params;
  const plan = await updateItemProgress(req.user._id, planId, 'course', courseId, req.body);
  if (!plan) throw new ApiError(404, 'Plan or course not found');
  sendResponse(res, 200, 'Course progress updated', plan);
});

export const updateCertProgress = catchAsync(async (req, res) => {
  const { planId, certId } = req.params;
  const plan = await updateItemProgress(req.user._id, planId, 'certification', certId, req.body);
  if (!plan) throw new ApiError(404, 'Plan or certification not found');
  sendResponse(res, 200, 'Certification progress updated', plan);
});

export const updateResourceProgress = catchAsync(async (req, res) => {
  const { planId, resourceId } = req.params;
  const plan = await updateItemProgress(req.user._id, planId, 'resource', resourceId, req.body);
  if (!plan) throw new ApiError(404, 'Plan or resource not found');
  sendResponse(res, 200, 'Resource progress updated', plan);
});

// ─── Toggle Bookmark ─────────────────────────────────────────────────────────
export const toggleBookmark = catchAsync(async (req, res) => {
  const { planId, resourceId } = req.params;
  const plan = await LearningPlan.findOne({ _id: planId, user: req.user._id });
  if (!plan) throw new ApiError(404, 'Plan not found');

  const resource = plan.resources.id(resourceId);
  if (!resource) throw new ApiError(404, 'Resource not found');

  resource.isBookmarked = !resource.isBookmarked;
  await plan.save();

  sendResponse(res, 200, resource.isBookmarked ? 'Resource bookmarked' : 'Bookmark removed', plan);
});

// ─── Delete Plan ─────────────────────────────────────────────────────────────
export const deletePlan = catchAsync(async (req, res) => {
  const plan = await LearningPlan.findOneAndDelete({ _id: req.params.planId, user: req.user._id });
  if (!plan) throw new ApiError(404, 'Learning plan not found');
  sendResponse(res, 200, 'Learning plan deleted');
});

// ─── Dashboard Stats ─────────────────────────────────────────────────────────
export const getDashboardStats = catchAsync(async (req, res) => {
  const [activePlans, completedPlans, totalCourses, completedCourses, bookmarkedResources] = await Promise.all([
    LearningPlan.countDocuments({ user: req.user._id, status: 'active' }),
    LearningPlan.countDocuments({ user: req.user._id, status: 'completed' }),
    LearningPlan.aggregate([
      { $match: { user: req.user._id } },
      { $project: { courseCount: { $size: '$courses' } } },
      { $group: { _id: null, total: { $sum: '$courseCount' } } },
    ]),
    LearningPlan.aggregate([
      { $match: { user: req.user._id } },
      { $unwind: '$courses' },
      { $match: { 'courses.isCompleted': true } },
      { $count: 'total' },
    ]),
    LearningPlan.aggregate([
      { $match: { user: req.user._id } },
      { $unwind: '$resources' },
      { $match: { 'resources.isBookmarked': true } },
      { $count: 'total' },
    ]),
  ]);

  const overallProgress = await LearningPlan.aggregate([
    { $match: { user: req.user._id, status: 'active' } },
    { $group: { _id: null, avgProgress: { $avg: '$progress.percentage' } } },
  ]);

  sendResponse(res, 200, 'Dashboard stats fetched', {
    activePlans,
    completedPlans,
    totalCourses: totalCourses[0]?.total || 0,
    completedCourses: completedCourses[0]?.total || 0,
    bookmarkedResources: bookmarkedResources[0]?.total || 0,
    averageProgress: Math.round(overallProgress[0]?.avgProgress || 0),
  });
});
