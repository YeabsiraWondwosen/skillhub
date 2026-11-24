import { User, Profile, Review, Follow, ReputationScore, Project, Application } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { notifyFollow } from '../services/notification.service.js';

// ─── Follow / Unfollow ───────────────────────────────────────────────────────
export const followUser = catchAsync(async (req, res) => {
  const { userId } = req.params;
  if (userId === req.user._id.toString()) throw new ApiError(400, 'Cannot follow yourself');

  const target = await User.findById(userId);
  if (!target) throw new ApiError(404, 'User not found');

  const existing = await Follow.findOne({ follower: req.user._id, following: userId });
  if (existing) throw new ApiError(400, 'Already following');

  await Follow.create({ follower: req.user._id, following: userId });

  await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: 1 } });
  await User.findByIdAndUpdate(userId, { $inc: { followersCount: 1 } });

  await notifyFollow(userId, req.user).catch(() => null);

  sendResponse(res, 200, 'Followed successfully');
});

export const unfollowUser = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const removed = await Follow.findOneAndDelete({ follower: req.user._id, following: userId });
  if (!removed) throw new ApiError(404, 'Not following this user');

  await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: -1 } });
  await User.findByIdAndUpdate(userId, { $inc: { followersCount: -1 } });

  sendResponse(res, 200, 'Unfollowed successfully');
});

export const getFollowers = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { page, limit, skip } = parsePagination(req.query);
  const total = await Follow.countDocuments({ following: userId });
  const follows = await Follow.find({ following: userId })
    .populate('follower', 'firstName lastName avatar role isOnline lastSeen country')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  sendResponse(res, 200, 'Followers fetched', follows.map(f => f.follower), paginationMeta(total, page, limit));
});

export const getFollowing = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { page, limit, skip } = parsePagination(req.query);
  const total = await Follow.countDocuments({ follower: userId });
  const follows = await Follow.find({ follower: userId })
    .populate('following', 'firstName lastName avatar role isOnline lastSeen country')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  sendResponse(res, 200, 'Following fetched', follows.map(f => f.following), paginationMeta(total, page, limit));
});

export const isFollowing = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const follow = await Follow.findOne({ follower: req.user._id, following: userId });
  sendResponse(res, 200, 'Follow status', { isFollowing: !!follow });
});

export const getFollowersCount = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId).select('followersCount');
  sendResponse(res, 200, 'Count', { count: user?.followersCount || 0 });
});

export const getFollowingCount = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId).select('followingCount');
  sendResponse(res, 200, 'Count', { count: user?.followingCount || 0 });
});

// ─── Analytics ───────────────────────────────────────────────────────────────
export const getProfileAnalytics = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId).select('stats').lean();
  if (!user) throw new ApiError(404, 'User not found');

  const [completedProjects, activeProjects, avgProjectValue, repeatClients] = await Promise.all([
    Project.countDocuments({ freelancer: userId, status: 'completed' }),
    Project.countDocuments({ freelancer: userId, status: { $in: ['active', 'in_progress'] } }),
    Project.aggregate([
      { $match: { freelancer: user._id, status: 'completed' } },
      { $group: { _id: null, avg: { $avg: '$budget' } } },
    ]),
    Project.aggregate([
      { $match: { freelancer: user._id, status: 'completed' } },
      { $group: { _id: '$client' } },
      { $group: { _id: null, uniqueClients: { $sum: 1 }, totalProjects: { $sum: 1 } } },
    ]),
  ]);

  const appCount = await Application.countDocuments({ freelancer: userId, status: 'accepted' });
  const onTimeProjects = await Project.countDocuments({ freelancer: userId, status: 'completed', deliveredOnTime: true });

  sendResponse(res, 200, 'Analytics fetched', {
    totalProjects: user.stats?.completedProjects || completedProjects,
    completedProjects,
    activeProjects,
    totalEarnings: user.stats?.totalEarnings || 0,
    averageRating: user.stats?.averageRating || 0,
    totalReviews: user.stats?.totalReviews || 0,
    successRate: user.stats?.successRate || 0,
    responseTime: user.stats?.responseTime || 0,
    avgProjectValue: avgProjectValue[0]?.avg || 0,
    repeatClients: repeatClients[0] ? Math.max(0, repeatClients[0].totalProjects - repeatClients[0].uniqueClients) : 0,
    onTimeDelivery: completedProjects > 0 ? Math.round((onTimeProjects / completedProjects) * 100) : 0,
    totalApplications: appCount,
  });
});

// ─── AI Trust Score ──────────────────────────────────────────────────────────
export const getAIMTrustScore = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId).select('isEmailVerified isVerifiedFreelancer stats badges createdAt').lean();
  if (!user) throw new ApiError(404, 'User not found');

  const profile = await Profile.findOne({ user: userId }).lean();
  const reputation = await ReputationScore.findOne({ user: userId }).lean();

  let score = 0;
  if (user.isEmailVerified) score += 15;
  if (user.isVerifiedFreelancer) score += 15;
  if (user.stats?.averageRating) score += Math.min(15, (user.stats.averageRating / 5) * 15);
  if (user.stats?.completedProjects) score += Math.min(20, user.stats.completedProjects * 2);
  if (profile?.bio && profile.bio.length > 50) score += 5;
  if (profile?.portfolio?.length > 0) score += 10;
  if (profile?.skills?.length > 0) score += 5;
  if (reputation?.trustScore) score += Math.round((reputation.trustScore / 100) * 15);

  score = Math.min(100, Math.round(score));

  let level = 'Needs Improvement';
  if (score >= 90) level = 'Excellent';
  else if (score >= 70) level = 'Good';
  else if (score >= 50) level = 'Average';

  sendResponse(res, 200, 'Trust score calculated', { score, level });
});

// ─── AI Summary ──────────────────────────────────────────────────────────────
export const getAISummary = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId).select('firstName lastName role stats badges freelancerLevel createdAt').lean();
  if (!user) throw new ApiError(404, 'User not found');

  const profile = await Profile.findOne({ user: userId }).lean();
  const reviews = await Review.find({ reviewee: userId, isPublic: true }).sort({ createdAt: -1 }).limit(5).lean();

  const parts = [];
  parts.push(`${user.firstName} ${user.lastName} is a ${user.freelancerLevel || 'skilled'} ${user.role || 'freelancer'} on SkillHub.`);

  if (profile?.skills?.length) {
    const topSkills = profile.skills.slice(0, 5).map(s => s.name);
    parts.push(`Specializing in ${topSkills.join(', ')}.`);
  }

  if (user.stats?.completedProjects > 0) {
    parts.push(`Has completed ${user.stats.completedProjects} projects with a ${user.stats.averageRating?.toFixed(1) || 'N/A'} star rating.`);
  }

  if (reviews.length > 0) {
    const recentPraise = reviews.filter(r => r.rating?.overall >= 4).length;
    parts.push(`${recentPraise} of ${reviews.length} recent reviews rated 4 stars or above.`);
  }

  if (profile?.bio && profile.bio.length > 50) {
    parts.push(profile.bio.slice(0, 200) + (profile.bio.length > 200 ? '...' : ''));
  }

  sendResponse(res, 200, 'AI summary generated', { summary: parts.join(' ') });
});

// ─── Intro Video ─────────────────────────────────────────────────────────────
export const updateIntroVideo = catchAsync(async (req, res) => {
  const { url, thumbnail, duration } = req.body;
  const user = await User.findByIdAndUpdate(req.user._id, {
    introVideo: { url: url || '', thumbnail: thumbnail || '', duration: duration || 0 },
  }, { new: true });
  sendResponse(res, 200, 'Intro video updated', user.introVideo);
});

// ─── Resume Download ─────────────────────────────────────────────────────────
export const downloadResume = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const profile = await Profile.findOne({ user: userId }).select('resume').lean();
  if (!profile?.resume?.url) throw new ApiError(404, 'No resume found');
  sendResponse(res, 200, 'Resume found', { url: profile.resume.url, name: profile.resume.originalName || 'resume' });
});
