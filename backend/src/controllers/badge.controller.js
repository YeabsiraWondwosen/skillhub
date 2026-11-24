import { catchAsync } from '../utils/catchAsync.js';
import { sendResponse } from '../utils/apiResponse.js';
import { recalculateUserBadges, getAllBadgeTypes } from '../services/badge.service.js';
import { User, Profile } from '../models/index.js';

// ─── Get My Badges & Level ────────────────────────────────────────────────────
export const getMyBadges = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select('badges freelancerLevel levelProgress stats');
  sendResponse(res, 200, 'Badges fetched', {
    badges: user.badges,
    level: user.freelancerLevel,
    levelProgress: user.levelProgress,
    stats: user.stats,
  });
});

// ─── Get User's Badges ────────────────────────────────────────────────────────
export const getUserBadges = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId).select('badges freelancerLevel levelProgress stats firstName lastName avatar');
  if (!user) throw new ApiError(404, 'User not found');

  sendResponse(res, 200, 'User badges fetched', {
    badges: user.badges,
    level: user.freelancerLevel,
    levelProgress: user.levelProgress,
    stats: user.stats,
    user: { firstName: user.firstName, lastName: user.lastName, avatar: user.avatar },
  });
});

// ─── Refresh My Badges ────────────────────────────────────────────────────────
export const refreshMyBadges = catchAsync(async (req, res) => {
  const result = await recalculateUserBadges(req.user._id);
  sendResponse(res, 200, 'Badges refreshed', result);
});

// ─── Get All Badge Types ──────────────────────────────────────────────────────
export const getBadgeTypes = catchAsync(async (req, res) => {
  const badgeTypes = getAllBadgeTypes();
  sendResponse(res, 200, 'Badge types', badgeTypes);
});

// ─── Get Leaderboard ──────────────────────────────────────────────────────────
export const getLeaderboard = catchAsync(async (req, res) => {
  const { type = 'earnings', limit = 10 } = req.query;

  // Only freelancers with real, measurable activity qualify for a leaderboard.
  // A user with zero reviews/earnings/projects is NOT "top rated" just because
  // they exist — otherwise every newcomer shows up as a top professional.
  const baseFilter = { role: 'freelancer', isActive: true };

  let sortField = 'stats.totalEarnings';
  const filter = { ...baseFilter, 'stats.totalEarnings': { $gt: 0 } };
  if (type === 'rating') {
    sortField = 'stats.averageRating';
    filter['stats.averageRating'] = { $gt: 0 };
    filter['stats.totalReviews'] = { $gt: 0 };
  }
  if (type === 'projects') {
    sortField = 'stats.completedProjects';
    filter['stats.completedProjects'] = { $gt: 0 };
  }
  if (type === 'level') {
    sortField = 'freelancerLevel';
    delete filter['stats.totalEarnings'];
  }

  const levelOrder = { top_rated_plus: 5, expert: 4, experienced: 3, intermediate: 2, newcomer: 1 };

  let users;
  if (type === 'level') {
    users = await User.find(baseFilter)
      .select('firstName lastName avatar badges freelancerLevel stats')
      .lean();

    users.sort((a, b) => (levelOrder[b.freelancerLevel] || 0) - (levelOrder[a.freelancerLevel] || 0));
    users = users.slice(0, parseInt(limit, 10));
  } else {
    users = await User.find(filter)
      .select('firstName lastName avatar badges freelancerLevel stats')
      .sort({ [sortField]: -1 })
      .limit(parseInt(limit, 10))
      .lean();
  }

  sendResponse(res, 200, 'Leaderboard fetched', users);
});
