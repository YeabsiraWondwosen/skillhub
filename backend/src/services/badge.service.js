import { User, Profile, Review, Application, Project } from '../models/index.js';
import { logger } from '../utils/logger.js';

const BADGE_CRITERIA = {
  top_rated: {
    minRating: 4.8,
    minReviews: 10,
    minCompletedProjects: 10,
    minSuccessRate: 90,
  },
  rising_talent: {
    minRating: 4.5,
    minReviews: 5,
    minCompletedProjects: 3,
    accountAgeDays: 90,
  },
  expert_vetted: {
    minRating: 4.9,
    minReviews: 20,
    minCompletedProjects: 20,
    minSuccessRate: 95,
  },
  top_earner: {
    minEarnings: 5000,
    minCompletedProjects: 10,
  },
  fast_responder: {
    avgResponseTimeHours: 2,
    minReviews: 5,
  },
  client_favorite: {
    minRating: 4.7,
    minRepeatClients: 3,
  },
};

const LEVEL_THRESHOLDS = {
  newcomer: { minProjects: 0, minRating: 0 },
  intermediate: { minProjects: 3, minRating: 4.0 },
  experienced: { minProjects: 10, minRating: 4.2 },
  expert: { minProjects: 25, minRating: 4.5 },
  top_rated_plus: { minProjects: 50, minRating: 4.8 },
};

export const calculateBadges = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user || user.role !== 'freelancer') return [];

    const profile = await Profile.findOne({ user: userId });
    const stats = user.stats || {};
    const badges = [];

    // Check Top Rated
    const criteria = BADGE_CRITERIA.top_rated;
    if (
      stats.averageRating >= criteria.minRating &&
      stats.totalReviews >= criteria.minReviews &&
      stats.completedProjects >= criteria.minCompletedProjects &&
      stats.successRate >= criteria.minSuccessRate
    ) {
      badges.push({ type: 'top_rated', earnedAt: new Date() });
    }

    // Check Rising Talent (newer freelancers doing well)
    const accountAge = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const risingCriteria = BADGE_CRITERIA.rising_talent;
    if (
      accountAge <= risingCriteria.accountAgeDays &&
      stats.averageRating >= risingCriteria.minRating &&
      stats.totalReviews >= risingCriteria.minReviews &&
      stats.completedProjects >= risingCriteria.minCompletedProjects
    ) {
      badges.push({ type: 'rising_talent', earnedAt: new Date() });
    }

    // Check Expert Vetted
    const expertCriteria = BADGE_CRITERIA.expert_vetted;
    if (
      stats.averageRating >= expertCriteria.minRating &&
      stats.totalReviews >= expertCriteria.minReviews &&
      stats.completedProjects >= expertCriteria.minCompletedProjects &&
      stats.successRate >= expertCriteria.minSuccessRate
    ) {
      badges.push({ type: 'expert_vetted', earnedAt: new Date() });
    }

    // Check Top Earner
    const earnerCriteria = BADGE_CRITERIA.top_earner;
    if (
      stats.totalEarnings >= earnerCriteria.minEarnings &&
      stats.completedProjects >= earnerCriteria.minCompletedProjects
    ) {
      badges.push({ type: 'top_earner', earnedAt: new Date() });
    }

    // Check Fast Responder
    if (
      stats.responseTime > 0 &&
      stats.responseTime <= BADGE_CRITERIA.fast_responder.avgResponseTimeHours &&
      stats.totalReviews >= BADGE_CRITERIA.fast_responder.minReviews
    ) {
      badges.push({ type: 'fast_responder', earnedAt: new Date() });
    }

    // Check Client Favorite (repeat clients)
    const repeatClients = await Project.aggregate([
      { $match: { freelancer: userId, status: 'completed' } },
      { $group: { _id: '$client' } },
      { $count: 'total' },
    ]);

    const repeatClientCount = repeatClients[0]?.total || 0;
    if (
      stats.averageRating >= BADGE_CRITERIA.client_favorite.minRating &&
      repeatClientCount >= BADGE_CRITERIA.client_favorite.minRepeatClients
    ) {
      badges.push({ type: 'client_favorite', earnedAt: new Date() });
    }

    return badges;
  } catch (error) {
    logger.error(`Badge calculation error for user ${userId}: ${error.message}`);
    return [];
  }
};

export const calculateLevel = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user || user.role !== 'freelancer') return 'newcomer';

    const stats = user.stats || {};
    const projects = stats.completedProjects || 0;
    const rating = stats.averageRating || 0;

    let level = 'newcomer';
    let progress = 0;

    if (projects >= LEVEL_THRESHOLDS.top_rated_plus.minProjects && rating >= LEVEL_THRESHOLDS.top_rated_plus.minRating) {
      level = 'top_rated_plus';
      progress = 100;
    } else if (projects >= LEVEL_THRESHOLDS.expert.minProjects && rating >= LEVEL_THRESHOLDS.expert.minRating) {
      level = 'expert';
      const nextThreshold = LEVEL_THRESHOLDS.top_rated_plus;
      const projectProgress = Math.min(projects / nextThreshold.minProjects, 1) * 50;
      const ratingProgress = Math.min(rating / nextThreshold.minRating, 1) * 50;
      progress = Math.round(projectProgress + ratingProgress);
    } else if (projects >= LEVEL_THRESHOLDS.experienced.minProjects && rating >= LEVEL_THRESHOLDS.experienced.minRating) {
      level = 'experienced';
      const nextThreshold = LEVEL_THRESHOLDS.expert;
      const projectProgress = Math.min(projects / nextThreshold.minProjects, 1) * 50;
      const ratingProgress = Math.min(rating / nextThreshold.minRating, 1) * 50;
      progress = Math.round(projectProgress + ratingProgress);
    } else if (projects >= LEVEL_THRESHOLDS.intermediate.minProjects && rating >= LEVEL_THRESHOLDS.intermediate.minRating) {
      level = 'intermediate';
      const nextThreshold = LEVEL_THRESHOLDS.experienced;
      const projectProgress = Math.min(projects / nextThreshold.minProjects, 1) * 50;
      const ratingProgress = Math.min(rating / nextThreshold.minRating, 1) * 50;
      progress = Math.round(projectProgress + ratingProgress);
    } else {
      const nextThreshold = LEVEL_THRESHOLDS.intermediate;
      const projectProgress = Math.min(projects / nextThreshold.minProjects, 1) * 50;
      const ratingProgress = rating > 0 ? Math.min(rating / nextThreshold.minRating, 1) * 50 : 0;
      progress = Math.round(projectProgress + ratingProgress);
    }

    return { level, progress: Math.min(progress, 99) };
  } catch (error) {
    logger.error(`Level calculation error for user ${userId}: ${error.message}`);
    return { level: 'newcomer', progress: 0 };
  }
};

export const recalculateUserBadges = async (userId) => {
  try {
    const badges = await calculateBadges(userId);
    const levelData = await calculateLevel(userId);

    await User.findByIdAndUpdate(userId, {
      badges: badges.map((b) => ({
        type: b.type,
        earnedAt: b.earnedAt,
        skill: b.skill,
      })),
      freelancerLevel: levelData.level,
      levelProgress: levelData.progress,
    });

    return { badges, level: levelData };
  } catch (error) {
    logger.error(`Badge recalculation error: ${error.message}`);
    return { badges: [], level: { level: 'newcomer', progress: 0 } };
  }
};

export const getAllBadgeTypes = () => {
  return [
    { type: 'top_rated', label: 'Top Rated', icon: '⭐', color: 'text-yellow-500', description: 'Consistently excellent work with high ratings' },
    { type: 'rising_talent', label: 'Rising Talent', icon: '🚀', color: 'text-blue-500', description: 'New freelancer making a great impression' },
    { type: 'expert_vetted', label: 'Expert Vetted', icon: '💎', color: 'text-purple-500', description: 'Verified expert with outstanding track record' },
    { type: 'skill_verified', label: 'Skill Verified', icon: '✅', color: 'text-green-500', description: 'Verified skills through platform assessments' },
    { type: 'top_earner', label: 'Top Earner', icon: '💰', color: 'text-emerald-500', description: 'High earnings on the platform' },
    { type: 'fast_responder', label: 'Fast Responder', icon: '⚡', color: 'text-orange-500', description: 'Quick response time to messages' },
    { type: 'client_favorite', label: 'Client Favorite', icon: '❤️', color: 'text-red-500', description: 'Highly rated with repeat clients' },
  ];
};
