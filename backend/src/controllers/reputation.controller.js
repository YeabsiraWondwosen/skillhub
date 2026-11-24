import { catchAsync } from '../utils/catchAsync.js';
import { sendResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiResponse.js';
import {
  calculateReputationScore,
  getReputationScore,
  getReputationLeaderboard,
  recalculateAllFreelancers,
  COMPONENT_WEIGHTS_CONFIG,
  TRUST_TIERS_CONFIG,
} from '../services/reputation.service.js';
import { User } from '../models/index.js';

// ─── Get My Reputation Score ──────────────────────────────────────────────────
export const getMyReputation = catchAsync(async (req, res) => {
  const reputation = await getReputationScore(req.user._id);
  sendResponse(res, 200, 'Reputation score fetched', reputation);
});

// ─── Get User's Reputation Score ──────────────────────────────────────────────
export const getUserReputation = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select('firstName lastName avatar role');
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role !== 'freelancer') throw new ApiError(400, 'Reputation is only available for freelancers');

  const reputation = await getReputationScore(userId);
  sendResponse(res, 200, 'User reputation fetched', {
    ...reputation,
    user: { firstName: user.firstName, lastName: user.lastName, avatar: user.avatar },
  });
});

// ─── Recalculate My Reputation ────────────────────────────────────────────────
export const recalculateMyReputation = catchAsync(async (req, res) => {
  const result = await calculateReputationScore(req.user._id, 'manual');
  if (!result) throw new ApiError(500, 'Failed to calculate reputation');
  sendResponse(res, 200, 'Reputation recalculated', result);
});

// ─── Get Reputation Leaderboard ───────────────────────────────────────────────
export const getLeaderboard = catchAsync(async (req, res) => {
  const { limit = 20, tier } = req.query;

  const leaderboard = await getReputationLeaderboard(parseInt(limit, 10), tier);
  sendResponse(res, 200, 'Leaderboard fetched', leaderboard);
});

// ─── Get Reputation Config ────────────────────────────────────────────────────
export const getReputationConfig = catchAsync(async (req, res) => {
  sendResponse(res, 200, 'Reputation config', {
    weights: COMPONENT_WEIGHTS_CONFIG,
    tiers: TRUST_TIERS_CONFIG,
  });
});

// ─── Admin: Recalculate All ───────────────────────────────────────────────────
export const adminRecalculateAll = catchAsync(async (req, res) => {
  const result = await recalculateAllFreelancers();
  sendResponse(res, 200, 'Bulk recalculation complete', result);
});
