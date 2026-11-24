import { logger } from '../utils/logger.js';
import {
  User, Profile, RecruiterPipeline, Job, Application, Review, ReputationScore, Category,
} from '../models/index.js';
import { chatJSON, isAIAvailable } from './aiClient.js';

const AI_AVAILABLE = isAIAvailable();

const safeAI = async (fn, fallback) => {
  if (!AI_AVAILABLE) return fallback;
  try { return await fn(); } catch (err) {
    logger.error(`Recruiter AI error: ${err.message}`);
    return fallback;
  }
};

// ─── Freelancer Search ───────────────────────────────────────────────────────

export const searchFreelancers = async (filters = {}) => {
  const {
    query, skills, minRate, maxRate, availability, experienceLevel,
    location, minRating, minReputation, freelancerLevel, language,
    category, subcategory,
    sortBy = 'reputationScore', sortOrder = 'desc', page = 1, limit = 20,
  } = filters;

  const skip = (page - 1) * limit;

  const userMatch = {
    role: 'freelancer',
    isActive: true,
    isBanned: false,
  };

  const profileMatch = { isPublic: true };

  if (availability) profileMatch.availability = availability;
  if (minRate || maxRate) {
    profileMatch.hourlyRate = {};
    if (minRate) profileMatch.hourlyRate.$gte = Number(minRate);
    if (maxRate) profileMatch.hourlyRate.$lte = Number(maxRate);
  }
  if (location) {
    profileMatch['location.country'] = new RegExp(location, 'i');
  }
  if (language) {
    profileMatch['languages.name'] = new RegExp(language, 'i');
  }
  if (skills) {
    const skillArray = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim());
    profileMatch['skills.name'] = { $in: skillArray.map(s => new RegExp(s, 'i')) };
  }
  if (experienceLevel) {
    const levelMap = { beginner: ['newcomer'], intermediate: ['intermediate', 'experienced'], expert: ['expert', 'top_rated_plus'] };
    const levels = levelMap[experienceLevel] || [experienceLevel];
    userMatch.freelancerLevel = { $in: levels };
  }
  if (freelancerLevel) userMatch.freelancerLevel = freelancerLevel;
  if (minRating) userMatch['stats.averageRating'] = { $gte: Number(minRating) };
  if (minReputation) userMatch['stats.reputationScore'] = { $gte: Number(minReputation) };

  // Category filter: resolve a main category to its subcategories so matching
  // covers both main-tagged and subcategory-tagged freelancers.
  if (category || subcategory) {
    const targets = [];
    if (subcategory) targets.push(subcategory);
    if (category) {
      const main = await Category.findById(category).lean();
      if (main) {
        if (!main.parent) {
          const subs = await Category.find({ parent: main._id, isActive: true }).select('_id').lean();
          targets.push(...subs.map((s) => s._id));
        } else {
          targets.push(main._id);
        }
      }
    }
    if (targets.length) {
      profileMatch.$or = [
        { categories: { $in: targets } },
        { subcategories: { $in: targets } },
      ];
    }
  }

  const sortField = {
    reputationScore: 'stats.reputationScore',
    rating: 'stats.averageRating',
    rate: 'profile.hourlyRate',
    projects: 'stats.completedProjects',
    newest: 'createdAt',
  }[sortBy] || 'stats.reputationScore';

  const sortDir = sortOrder === 'asc' ? 1 : -1;

  const [results, total] = await Promise.all([
    User.aggregate([
      { $match: userMatch },
      {
        $lookup: {
          from: 'profiles',
          localField: '_id',
          foreignField: 'user',
          as: 'profileData',
        },
      },
      { $unwind: { path: '$profileData', preserveNullAndEmptyArrays: true } },
      { $match: { ...profileMatch, 'profileData._id': { $exists: true } } },
      {
        $lookup: {
          from: 'reputationscores',
          localField: '_id',
          foreignField: 'user',
          as: 'reputationData',
        },
      },
      { $unwind: { path: '$reputationData', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          profile: '$profileData',
          reputation: '$reputationData',
          matchScore: {
            $min: [
              { $add: ['$stats.reputationScore', { $multiply: ['$stats.averageRating', 10] }] },
              100,
            ],
          },
        },
      },
      {
        $project: {
          password: 0, refreshTokens: 0, emailVerificationToken: 0,
          passwordResetToken: 0, profileData: 0, reputationData: 0,
        },
      },
      { $sort: { [sortField]: sortDir } },
      { $skip: skip },
      { $limit: Number(limit) },
    ]),
    User.aggregate([
      { $match: userMatch },
      {
        $lookup: {
          from: 'profiles',
          localField: '_id',
          foreignField: 'user',
          as: 'profileData',
        },
      },
      { $unwind: { path: '$profileData', preserveNullAndEmptyArrays: true } },
      { $match: { ...profileMatch, 'profileData._id': { $exists: true } } },
      { $count: 'total' },
    ]),
  ]);

  return {
    results,
    total: total[0]?.total || 0,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil((total[0]?.total || 0) / limit),
  };
};

// ─── Get Freelancer Detail ───────────────────────────────────────────────────

export const getFreelancerDetail = async (freelancerId) => {
  const [user, profile, reputation, recentReviews, completedProjects] = await Promise.all([
    User.findById(freelancerId)
      .select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
      .lean(),
    Profile.findOne({ user: freelancerId }).lean(),
    ReputationScore.findOne({ user: freelancerId }).lean(),
    Review.find({ reviewee: freelancerId })
      .populate('reviewer', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Application.find({ freelancer: freelancerId, status: 'accepted' })
      .populate('job', 'title category budget')
      .limit(5)
      .lean(),
  ]);

  if (!user || user.role !== 'freelancer') return null;

  return {
    ...user,
    profile,
    reputation,
    recentReviews,
    completedProjects,
  };
};

// ─── Compare Candidates ──────────────────────────────────────────────────────

export const compareCandidates = async (freelancerIds) => {
  if (!freelancerIds || freelancerIds.length < 2 || freelancerIds.length > 5) {
    return null;
  }

  const candidates = await Promise.all(
    freelancerIds.map(id => getFreelancerDetail(id))
  );

  const validCandidates = candidates.filter(Boolean);
  if (validCandidates.length < 2) return null;

  const comparison = validCandidates.map(c => ({
    _id: c._id,
    name: `${c.firstName} ${c.lastName}`,
    avatar: c.avatar,
    freelancerLevel: c.freelancerLevel,
    hourlyRate: c.profile?.hourlyRate || 0,
    availability: c.profile?.availability || 'not_available',
    skills: (c.profile?.skills || []).map(s => ({ name: s.name, level: s.level, years: s.yearsOfExperience })),
    rating: c.stats?.averageRating || 0,
    totalReviews: c.stats?.totalReviews || 0,
    completedProjects: c.stats?.completedProjects || 0,
    reputationScore: c.reputation?.trustScore || 0,
    trustTier: c.reputation?.trustTier || 'unrated',
    responseTime: c.stats?.responseTime || 0,
    successRate: c.stats?.successRate || 0,
    badges: c.badges || [],
    location: c.profile?.location || {},
    languages: c.profile?.languages || [],
    portfolio: (c.profile?.portfolio || []).slice(0, 3),
    githubStats: c.profile?.githubData?.stats || null,
    componentScores: c.reputation?.components || null,
  }));

  const aiInsight = await safeAI(async () => {
    const summary = comparison.map(c =>
      `${c.name}: level=${c.freelancerLevel}, rating=${c.rating}/5, reputation=${c.reputationScore}/100, rate=${c.hourlyRate} ETB/hr, projects=${c.completedProjects}, skills=${c.skills.map(s => s.name).join(',')}`
    ).join('\n');

    const prompt = `Compare these freelance developers and recommend the best fit for a web development project.

${summary}

Return JSON: {
  "ranking": [{"id":"...","score":92,"strengths":["..."],"weaknesses":["..."],"fit":"Best fit for..."}],
  "recommendation": "Which developer to hire and why",
  "keyDifferentiators": ["factor1", "factor2"]
}`;

    const result = await chatJSON(
      'You are a hiring advisor. Return only valid JSON.',
      prompt,
      0.3,
      1000
    );

    return result || null;
  }, null);

  return { candidates: comparison, aiInsight };
};

// ─── Pipeline Management ─────────────────────────────────────────────────────

export const getPipelines = async (userId, filters = {}) => {
  const { status = 'active' } = filters;
  return RecruiterPipeline.find({ user: userId, status })
    .populate('job', 'title status')
    .populate('candidates.freelancer', 'firstName lastName avatar stats freelancerLevel')
    .sort({ createdAt: -1 });
};

export const getPipeline = async (userId, pipelineId) => {
  return RecruiterPipeline.findOne({ _id: pipelineId, user: userId })
    .populate('job', 'title status budget')
    .populate('candidates.freelancer', 'firstName lastName avatar stats freelancerLevel socialLinks')
    .populate('candidates.addedBy', 'firstName lastName')
    .populate('candidates.notes.author', 'firstName lastName')
    .populate('invitations.freelancer', 'firstName lastName avatar')
    .populate('invitations.sentBy', 'firstName lastName');
};

export const createPipeline = async (userId, data) => {
  return RecruiterPipeline.create({ ...data, user: userId });
};

export const updatePipeline = async (userId, pipelineId, data) => {
  return RecruiterPipeline.findOneAndUpdate(
    { _id: pipelineId, user: userId },
    { $set: data },
    { new: true }
  );
};

export const deletePipeline = async (userId, pipelineId) => {
  return RecruiterPipeline.findOneAndDelete({ _id: pipelineId, user: userId });
};

// ─── Candidate Management ────────────────────────────────────────────────────

export const addCandidate = async (userId, pipelineId, freelancerId, data = {}) => {
  const pipeline = await RecruiterPipeline.findOne({ _id: pipelineId, user: userId });
  if (!pipeline) return null;

  const exists = pipeline.candidates.find(
    c => c.freelancer.toString() === freelancerId
  );
  if (exists) return { error: 'Candidate already in pipeline' };

  pipeline.candidates.push({
    freelancer: freelancerId,
    addedBy: userId,
    stage: data.stage || 'sourcing',
    matchScore: data.matchScore || 0,
    notes: data.note ? [{ author: userId, content: data.note }] : [],
    stageHistory: [{ to: data.stage || 'sourcing', movedBy: userId }],
  });

  await pipeline.save();
  return pipeline;
};

export const moveCandidate = async (userId, pipelineId, candidateId, newStage, reason) => {
  const pipeline = await RecruiterPipeline.findOne({ _id: pipelineId, user: userId });
  if (!pipeline) return null;

  const candidate = pipeline.candidates.id(candidateId);
  if (!candidate) return null;

  const oldStage = candidate.stage;
  candidate.stage = newStage;
  candidate.stageHistory.push({ from: oldStage, to: newStage, movedBy: userId });

  if (newStage === 'rejected') candidate.rejectionReason = reason || '';
  if (newStage === 'interview') candidate.shortlistedAt = new Date();

  await pipeline.save();
  return pipeline;
};

export const rateCandidate = async (userId, pipelineId, candidateId, rating) => {
  const pipeline = await RecruiterPipeline.findOne({ _id: pipelineId, user: userId });
  if (!pipeline) return null;

  const candidate = pipeline.candidates.id(candidateId);
  if (!candidate) return null;

  candidate.rating = rating;
  await pipeline.save();
  return pipeline;
};

export const addCandidateNote = async (userId, pipelineId, candidateId, content) => {
  const pipeline = await RecruiterPipeline.findOne({ _id: pipelineId, user: userId });
  if (!pipeline) return null;

  const candidate = pipeline.candidates.id(candidateId);
  if (!candidate) return null;

  candidate.notes.push({ author: userId, content });
  await pipeline.save();
  return pipeline;
};

export const removeCandidate = async (userId, pipelineId, candidateId) => {
  const pipeline = await RecruiterPipeline.findOne({ _id: pipelineId, user: userId });
  if (!pipeline) return null;

  pipeline.candidates = pipeline.candidates.filter(
    c => c._id.toString() !== candidateId
  );
  await pipeline.save();
  return pipeline;
};

// ─── Invitations ─────────────────────────────────────────────────────────────

export const sendInvitation = async (userId, pipelineId, freelancerId, data = {}) => {
  const pipeline = await RecruiterPipeline.findOne({ _id: pipelineId, user: userId });
  if (!pipeline) return null;

  const existing = pipeline.invitations.find(
    i => i.freelancer.toString() === freelancerId && i.status === 'pending'
  );
  if (existing) return { error: 'Invitation already pending' };

  pipeline.invitations.push({
    freelancer: freelancerId,
    job: data.jobId || pipeline.job,
    sentBy: userId,
    message: data.message || '',
  });

  await pipeline.save();
  return pipeline;
};

export const getInvitations = async (userId, pipelineId) => {
  const pipeline = await RecruiterPipeline.findOne({ _id: pipelineId, user: userId })
    .populate('invitations.freelancer', 'firstName lastName avatar stats')
    .populate('invitations.job', 'title');
  if (!pipeline) return null;
  return pipeline.invitations;
};

export const cancelInvitation = async (userId, pipelineId, invitationId) => {
  const pipeline = await RecruiterPipeline.findOne({ _id: pipelineId, user: userId });
  if (!pipeline) return null;

  const invitation = pipeline.invitations.id(invitationId);
  if (!invitation || invitation.status !== 'pending') return null;

  invitation.status = 'expired';
  invitation.respondedAt = new Date();
  await pipeline.save();
  return pipeline;
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export const getRecruiterAnalytics = async (userId) => {
  const [pipelines, applicationStats, recentActivity] = await Promise.all([
    RecruiterPipeline.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCandidates: { $sum: { $size: '$candidates' } },
        },
      },
    ]),
    Application.aggregate([
      { $lookup: { from: 'jobs', localField: 'job', foreignField: '_id', as: 'jobData' } },
      { $unwind: '$jobData' },
      { $match: { 'jobData.client': userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    RecruiterPipeline.aggregate([
      { $match: { user: userId } },
      { $unwind: '$candidates' },
      { $unwind: '$candidates.stageHistory' },
      { $match: { 'candidates.stageHistory.movedAt': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: '$candidates.stageHistory.to',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const pipelineSummary = {
    activePipelines: 0,
    totalCandidates: 0,
    byStage: {},
  };

  pipelines.forEach(p => {
    if (p._id === 'active') pipelineSummary.activePipelines = p.count;
    pipelineSummary.totalCandidates += p.totalCandidates;
  });

  const applicationSummary = {};
  applicationStats.forEach(a => { applicationSummary[a._id] = a.count; });

  const stageMovements = {};
  recentActivity.forEach(a => { stageMovements[a._id] = a.count; });

  const allPipelines = await RecruiterPipeline.find({ user: userId });
  const stageBreakdown = { sourcing: 0, screening: 0, interview: 0, offer: 0, hired: 0, rejected: 0, withdrawn: 0 };
  allPipelines.forEach(p => {
    p.candidates.forEach(c => {
      stageBreakdown[c.stage] = (stageBreakdown[c.stage] || 0) + 1;
    });
  });

  const avgMatchScore = allPipelines.reduce((sum, p) => {
    const scores = p.candidates.map(c => c.matchScore).filter(s => s > 0);
    return sum + (scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0);
  }, 0);
  const avgScore = allPipelines.length > 0 ? Math.round(avgMatchScore / allPipelines.length) : 0;

  return {
    pipelineSummary,
    applicationSummary,
    stageMovements,
    stageBreakdown,
    avgMatchScore: avgScore,
    totalPipelines: allPipelines.length,
  };
};
