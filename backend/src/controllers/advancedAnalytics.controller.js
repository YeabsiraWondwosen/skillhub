import * as analyticsService from '../services/advancedAnalytics.service.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const getDashboardOverview = catchAsync(async (req, res) => {
  const data = await analyticsService.getDashboardOverview();
  sendResponse(res, 200, 'Dashboard overview', data);
});

// ─── Revenue ─────────────────────────────────────────────────────────────────
export const getRevenueReport = catchAsync(async (req, res) => {
  const data = await analyticsService.getRevenueReport(req.query);
  sendResponse(res, 200, 'Revenue report', data);
});

// ─── Platform Stats ──────────────────────────────────────────────────────────
export const getPlatformStats = catchAsync(async (req, res) => {
  const data = await analyticsService.getPlatformStats();
  sendResponse(res, 200, 'Platform statistics', data);
});

// ─── Fraud Detection ─────────────────────────────────────────────────────────
export const detectFraud = catchAsync(async (req, res) => {
  const data = await analyticsService.detectFraud(req.query);
  sendResponse(res, 200, 'Fraud alerts', data.alerts, paginationMeta(data));
});

export const runFraudDetection = catchAsync(async (req, res) => {
  const data = await analyticsService.runFraudDetection();
  sendResponse(res, 200, 'Fraud detection completed', data);
});

export const resolveFraudAlert = catchAsync(async (req, res) => {
  const alert = await analyticsService.resolveFraudAlert(req.params.alertId, req.body);
  sendResponse(res, 200, 'Alert resolved', alert);
});

// ─── Spam Detection ──────────────────────────────────────────────────────────
export const detectSpam = catchAsync(async (req, res) => {
  const data = await analyticsService.detectSpam(req.query);
  sendResponse(res, 200, 'Spam flags', data.flags, paginationMeta(data));
});

export const analyzeContent = catchAsync(async (req, res) => {
  const { contentType, contentId, content, authorId } = req.body;
  const result = await analyticsService.analyzeContentForSpam(contentType, contentId, content, authorId);
  sendResponse(res, 200, 'Content analyzed', result);
});

export const resolveSpamFlag = catchAsync(async (req, res) => {
  const flag = await analyticsService.resolveSpamFlag(req.params.flagId, req.body);
  sendResponse(res, 200, 'Spam flag resolved', flag);
});

// ─── User Growth ─────────────────────────────────────────────────────────────
export const getUserGrowth = catchAsync(async (req, res) => {
  const data = await analyticsService.getUserGrowthAnalytics(req.query);
  sendResponse(res, 200, 'User growth analytics', data);
});

// ─── Business Insights ───────────────────────────────────────────────────────
export const getBusinessInsights = catchAsync(async (req, res) => {
  const data = await analyticsService.getBusinessInsights(req.query);
  sendResponse(res, 200, 'Business insights', data.insights, paginationMeta(data));
});

export const generateInsights = catchAsync(async (req, res) => {
  const insights = await analyticsService.generateBusinessInsights();
  sendResponse(res, 200, 'Insights generated', insights);
});

export const markInsightViewed = catchAsync(async (req, res) => {
  const insight = await analyticsService.markInsightViewed(req.params.insightId, req.user._id);
  sendResponse(res, 200, 'Insight marked as viewed', insight);
});
