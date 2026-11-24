import { User, Review, Project, ReputationScore, DeveloperVerification } from '../models/index.js';
import { logger } from '../utils/logger.js';

// ─── Component Weights ────────────────────────────────────────────────────────
const COMPONENT_WEIGHTS = {
  ratings: 0.25,
  projectSuccess: 0.20,
  completionRate: 0.20,
  communication: 0.15,
  verification: 0.20,
};

const TRUST_TIERS = {
  unrated: { min: 0, max: 19, label: 'Unrated', description: 'No reputation data yet' },
  emerging: { min: 20, max: 49, label: 'Emerging', description: 'Building reputation' },
  reliable: { min: 50, max: 69, label: 'Reliable', description: 'Consistent performer' },
  trusted: { min: 70, max: 89, label: 'Trusted', description: 'Highly dependable' },
  elite: { min: 90, max: 100, label: 'Elite', description: 'Top-tier professional' },
};

const VERIFICATION_TYPES = ['identity', 'github', 'portfolio', 'skill'];

// The ReputationScore schema requires every component to carry `score`,
// `weight` and `weightedScore`. The raw component calculators above only
// return `{ score, dataPoints, details }`, so we enrich them before saving —
// otherwise validation rejects the whole document and reputation never
// persists (it silently errored on every review update/delete).
const withWeights = (comp, weight) => ({
  score: comp?.score ?? 0,
  weight,
  weightedScore: Math.round((comp?.score ?? 0) * weight),
  dataPoints: comp?.dataPoints ?? 0,
  details: comp?.details ?? {},
});

const buildComponents = ({ ratings, projectSuccess, completionRate, communication, verification }) => ({
  ratings: withWeights(ratings, COMPONENT_WEIGHTS.ratings),
  projectSuccess: withWeights(projectSuccess, COMPONENT_WEIGHTS.projectSuccess),
  completionRate: withWeights(completionRate, COMPONENT_WEIGHTS.completionRate),
  communication: withWeights(communication, COMPONENT_WEIGHTS.communication),
  verification: withWeights(verification, COMPONENT_WEIGHTS.verification),
});

// ─── Ratings Component ────────────────────────────────────────────────────────
const calculateRatingsComponent = (reviews) => {
  if (!reviews || reviews.length === 0) {
    return { score: 0, dataPoints: 0, details: {} };
  }

  const now = Date.now();
  const SIX_MONTHS = 180 * 24 * 60 * 60 * 1000;
  const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const review of reviews) {
    const age = now - new Date(review.createdAt).getTime();
    let timeWeight = 1.0;

    if (age <= SIX_MONTHS) {
      timeWeight = 1.0;
    } else if (age <= ONE_YEAR) {
      timeWeight = 0.8;
    } else {
      timeWeight = 0.6;
    }

    const rating = review.rating?.overall || 0;
    weightedSum += rating * timeWeight;
    totalWeight += timeWeight;
  }

  const weightedAverage = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const score = (weightedAverage / 5) * 100;

  const avgOverall = reviews.reduce((sum, r) => sum + (r.rating?.overall || 0), 0) / reviews.length;
  const avgQuality = reviews.filter(r => r.rating?.quality).reduce((sum, r) => sum + r.rating.quality, 0) / (reviews.filter(r => r.rating?.quality).length || 1);
  const avgExpertise = reviews.filter(r => r.rating?.expertise).reduce((sum, r) => sum + r.rating.expertise, 0) / (reviews.filter(r => r.rating?.expertise).length || 1);
  const avgProfessionalism = reviews.filter(r => r.rating?.professionalism).reduce((sum, r) => sum + r.rating.professionalism, 0) / (reviews.filter(r => r.rating?.professionalism).length || 1);
  const avgDeadline = reviews.filter(r => r.rating?.deadlineAdherence).reduce((sum, r) => sum + r.rating.deadlineAdherence, 0) / (reviews.filter(r => r.rating?.deadlineAdherence).length || 1);

  return {
    score: Math.round(Math.min(score, 100)),
    dataPoints: reviews.length,
    details: {
      timeDecayedAverage: Math.round(weightedAverage * 10) / 10,
      averageOverall: Math.round(avgOverall * 10) / 10,
      averageQuality: Math.round(avgQuality * 10) / 10,
      averageExpertise: Math.round(avgExpertise * 10) / 10,
      averageProfessionalism: Math.round(avgProfessionalism * 10) / 10,
      averageDeadlineAdherence: Math.round(avgDeadline * 10) / 10,
    },
  };
};

// ─── Project Success Component ────────────────────────────────────────────────
const calculateProjectSuccessComponent = (completedProjects, totalProjects, disputeCount) => {
  if (totalProjects === 0) {
    return { score: 0, dataPoints: 0, details: {} };
  }

  const successRate = (completedProjects / totalProjects) * 100;
  const disputePenalty = Math.min(disputeCount * 5, 30);
  const score = Math.max(0, successRate - disputePenalty);

  return {
    score: Math.round(Math.min(score, 100)),
    dataPoints: totalProjects,
    details: {
      completedProjects,
      totalProjects,
      rawSuccessRate: Math.round(successRate * 10) / 10,
      disputePenalty,
    },
  };
};

// ─── Completion Rate Component ────────────────────────────────────────────────
const calculateCompletionRateComponent = (onTimeCompletions, totalCompleted, cancellationCount) => {
  if (totalCompleted === 0) {
    return { score: 0, dataPoints: 0, details: {} };
  }

  const onTimeRate = (onTimeCompletions / totalCompleted) * 100;
  const cancellationPenalty = Math.min(cancellationCount * 8, 40);
  const score = Math.max(0, onTimeRate - cancellationPenalty);

  return {
    score: Math.round(Math.min(score, 100)),
    dataPoints: totalCompleted,
    details: {
      onTimeCompletions,
      totalCompleted,
      rawOnTimeRate: Math.round(onTimeRate * 10) / 10,
      cancellationPenalty,
    },
  };
};

// ─── Communication Component ──────────────────────────────────────────────────
const calculateCommunicationComponent = (reviews) => {
  const communicationReviews = reviews.filter(r => r.rating?.communication);
  if (communicationReviews.length === 0) {
    return { score: 0, dataPoints: 0, details: {} };
  }

  const avgCommunication = communicationReviews.reduce(
    (sum, r) => sum + r.rating.communication, 0
  ) / communicationReviews.length;

  const score = (avgCommunication / 5) * 100;

  return {
    score: Math.round(Math.min(score, 100)),
    dataPoints: communicationReviews.length,
    details: {
      averageCommunicationRating: Math.round(avgCommunication * 10) / 10,
      totalCommunicationReviews: communicationReviews.length,
    },
  };
};

// ─── Verification Component ───────────────────────────────────────────────────
const calculateVerificationComponent = (verifications) => {
  const approvedVerifications = verifications.filter(v => v.status === 'approved');
  const verifiedTypes = [...new Set(approvedVerifications.map(v => v.type))];
  const score = (verifiedTypes.length / VERIFICATION_TYPES.length) * 100;

  return {
    score: Math.round(Math.min(score, 100)),
    dataPoints: verifiedTypes.length,
    details: {
      verifiedTypes,
      totalPossible: VERIFICATION_TYPES.length,
      verificationRate: Math.round((verifiedTypes.length / VERIFICATION_TYPES.length) * 100),
    },
  };
};

// ─── Account Age Factor ───────────────────────────────────────────────────────
const getAccountAgeFactor = (createdAt) => {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);

  if (ageDays <= 30) return 0.7;
  if (ageDays <= 90) return 0.8;
  if (ageDays <= 180) return 0.9;
  if (ageDays <= 365) return 0.95;
  return 1.0;
};

// ─── Main Calculation ─────────────────────────────────────────────────────────
export const calculateReputationScore = async (userId, triggeredBy = 'manual', referenceId = null) => {
  try {
    const user = await User.findById(userId);
    if (!user || user.role !== 'freelancer') return null;

    const profile = await (await import('../models/index.js')).Profile.findOne({ user: userId });

    const reviews = await Review.find({ reviewee: userId, isPublic: true }).sort({ createdAt: -1 });

    const projects = await Project.find({
      $or: [{ client: userId }, { freelancer: userId }],
    });

    const completedProjects = projects.filter(p => p.status === 'completed');
    const disputedProjects = projects.filter(p => p.dispute?.isDisputed);
    const cancelledProjects = projects.filter(p => p.status === 'cancelled');

    let onTimeCompletions = 0;
    for (const project of completedProjects) {
      if (project.timeline?.completedAt && project.timeline?.deadline) {
        if (new Date(project.timeline.completedAt) <= new Date(project.timeline.deadline)) {
          onTimeCompletions++;
        }
      }
    }

    const verifications = await DeveloperVerification.find({ user: userId });

    const ratings = calculateRatingsComponent(reviews);
    const projectSuccess = calculateProjectSuccessComponent(
      completedProjects.length,
      projects.length,
      disputedProjects.length
    );
    const completionRate = calculateCompletionRateComponent(
      onTimeCompletions,
      completedProjects.length,
      cancelledProjects.length
    );
    const communication = calculateCommunicationComponent(reviews);
    const verification = calculateVerificationComponent(verifications);

    let rawTrustScore =
      ratings.score * COMPONENT_WEIGHTS.ratings +
      projectSuccess.score * COMPONENT_WEIGHTS.projectSuccess +
      completionRate.score * COMPONENT_WEIGHTS.completionRate +
      communication.score * COMPONENT_WEIGHTS.communication +
      verification.score * COMPONENT_WEIGHTS.verification;

    const accountAgeFactor = getAccountAgeFactor(user.createdAt);
    rawTrustScore = rawTrustScore * accountAgeFactor;

    const trustScore = Math.round(Math.min(Math.max(rawTrustScore, 0), 100));
    const trustTier = ReputationScore.getTierFromScore(trustScore);

    const rawMetrics = {
      averageRating: reviews.length > 0
        ? Math.round((reviews.reduce((s, r) => s + (r.rating?.overall || 0), 0) / reviews.length) * 10) / 10
        : 0,
      totalReviews: reviews.length,
      completedProjects: completedProjects.length,
      totalProjects: projects.length,
      onTimeCompletions,
      onTimeRate: completedProjects.length > 0
        ? Math.round((onTimeCompletions / completedProjects.length) * 1000) / 10
        : 0,
      avgCommunicationRating: communication.details?.averageCommunicationRating || 0,
      disputeCount: disputedProjects.length,
      cancellationCount: cancelledProjects.length,
      verificationCount: verifications.filter(v => v.status === 'approved').length,
      accountAgeDays: Math.round((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    };

    const historyEntry = {
      trustScore,
      components: {
        ratings: ratings.score,
        projectSuccess: projectSuccess.score,
        completionRate: completionRate.score,
        communication: communication.score,
        verification: verification.score,
      },
      triggeredBy,
      referenceId,
      calculatedAt: new Date(),
    };

    let reputationDoc = await ReputationScore.findOne({ user: userId });

    if (reputationDoc) {
      reputationDoc.trustScore = trustScore;
      reputationDoc.trustTier = trustTier;
      reputationDoc.components = buildComponents({ ratings, projectSuccess, completionRate, communication, verification });
      reputationDoc.rawMetrics = rawMetrics;
      reputationDoc.lastCalculatedAt = new Date();
      reputationDoc.history.push(historyEntry);

      if (reputationDoc.history.length > 100) {
        reputationDoc.history = reputationDoc.history.slice(-100);
      }

      await reputationDoc.save();
    } else {
      reputationDoc = await ReputationScore.create({
        user: userId,
        trustScore,
        trustTier,
        components: buildComponents({ ratings, projectSuccess, completionRate, communication, verification }),
        rawMetrics,
        history: [historyEntry],
        lastCalculatedAt: new Date(),
      });
    }

    await User.findByIdAndUpdate(userId, {
      'stats.successRate': completedProjects.length > 0
        ? Math.round((completedProjects.length / projects.length) * 100)
        : 0,
    });

    return {
      trustScore,
      trustTier,
      components: buildComponents({ ratings, projectSuccess, completionRate, communication, verification }),
      rawMetrics,
    };
  } catch (error) {
    logger.error(`Reputation calculation error for user ${userId}: ${error.message}`);
    return null;
  }
};

// ─── Get Reputation ───────────────────────────────────────────────────────────
export const getReputationScore = async (userId) => {
  const reputation = await ReputationScore.findOne({ user: userId }).lean();
  if (!reputation) {
    const user = await User.findById(userId).lean();
    if (!user || user.role !== 'freelancer') return null;

    return {
      user: userId,
      trustScore: 0,
      trustTier: 'unrated',
      components: {
        ratings: { score: 0, weight: COMPONENT_WEIGHTS.ratings, weightedScore: 0, dataPoints: 0 },
        projectSuccess: { score: 0, weight: COMPONENT_WEIGHTS.projectSuccess, weightedScore: 0, dataPoints: 0 },
        completionRate: { score: 0, weight: COMPONENT_WEIGHTS.completionRate, weightedScore: 0, dataPoints: 0 },
        communication: { score: 0, weight: COMPONENT_WEIGHTS.communication, weightedScore: 0, dataPoints: 0 },
        verification: { score: 0, weight: COMPONENT_WEIGHTS.verification, weightedScore: 0, dataPoints: 0 },
      },
      rawMetrics: {},
      lastCalculatedAt: null,
    };
  }

  reputation.components.ratings.weight = COMPONENT_WEIGHTS.ratings;
  reputation.components.ratings.weightedScore = Math.round(reputation.components.ratings.score * COMPONENT_WEIGHTS.ratings);
  reputation.components.projectSuccess.weight = COMPONENT_WEIGHTS.projectSuccess;
  reputation.components.projectSuccess.weightedScore = Math.round(reputation.components.projectSuccess.score * COMPONENT_WEIGHTS.projectSuccess);
  reputation.components.completionRate.weight = COMPONENT_WEIGHTS.completionRate;
  reputation.components.completionRate.weightedScore = Math.round(reputation.components.completionRate.score * COMPONENT_WEIGHTS.completionRate);
  reputation.components.communication.weight = COMPONENT_WEIGHTS.communication;
  reputation.components.communication.weightedScore = Math.round(reputation.components.communication.score * COMPONENT_WEIGHTS.communication);
  reputation.components.verification.weight = COMPONENT_WEIGHTS.verification;
  reputation.components.verification.weightedScore = Math.round(reputation.components.verification.score * COMPONENT_WEIGHTS.verification);

  return reputation;
};

// ─── Bulk Leaderboard ─────────────────────────────────────────────────────────
export const getReputationLeaderboard = async (limit = 20, tier = null) => {
  const query = {};
  if (tier) query.trustTier = tier;

  const leaderboard = await ReputationScore.find(query)
    .populate('user', 'firstName lastName avatar freelancerLevel')
    .sort({ trustScore: -1 })
    .limit(limit)
    .lean();

  return leaderboard;
};

// ─── Recalculate All (periodic job) ───────────────────────────────────────────
export const recalculateAllFreelancers = async () => {
  const freelancers = await User.find({ role: 'freelancer', isActive: true }).select('_id');
  let successCount = 0;
  let failCount = 0;

  for (const freelancer of freelancers) {
    const result = await calculateReputationScore(freelancer._id, 'periodic');
    if (result) successCount++;
    else failCount++;
  }

  logger.info(`Reputation recalculation complete: ${successCount} succeeded, ${failCount} failed`);
  return { successCount, failCount, total: freelancers.length };
};

export const COMPONENT_WEIGHTS_CONFIG = COMPONENT_WEIGHTS;
export const TRUST_TIERS_CONFIG = TRUST_TIERS;
