import { logger } from '../utils/logger.js';
import {
  AdvancedAnalytics, User, Transaction, Payment, Job, Project,
  Review, Profile, ReputationScore, Wallet, Escrow,
} from '../models/index.js';
import { chatJSON, isAIAvailable } from './aiClient.js';

const AI_AVAILABLE = isAIAvailable();

const safeAI = async (fn, fallback) => {
  if (!AI_AVAILABLE) return fallback;
  try { return await fn(); } catch (err) {
    logger.error(`AdvancedAnalytics AI error: ${err.message}`);
    return fallback;
  }
};

const getDoc = async () => {
  let doc = await AdvancedAnalytics.findOne();
  if (!doc) doc = await AdvancedAnalytics.create({});
  return doc;
};

// ─── Revenue Reports ─────────────────────────────────────────────────────────
export const getRevenueReport = async (filters = {}) => {
  const { period = 'daily', startDate, endDate, page = 1, limit = 50 } = filters;
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const matchStage = { createdAt: { $gte: start, $lte: end }, status: 'completed' };

  const groupBy = period === 'daily' ? {
    year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' },
  } : period === 'weekly' ? {
    year: { $year: '$createdAt' }, week: { $week: '$createdAt' },
  } : {
    year: { $year: '$createdAt' }, month: { $month: '$createdAt' },
  };

  const [revenueByPeriod, revenueByType, revenueByProvider, summary] = await Promise.all([
    Transaction.aggregate([
      { $match: { ...matchStage, type: { $in: ['escrow_release', 'commission', 'deposit'] } } },
      { $group: {
        _id: groupBy,
        totalRevenue: { $sum: '$amount' },
        commissions: { $sum: { $cond: [{ $eq: ['$type', 'commission'] }, '$amount', 0] } },
        deposits: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] } },
        escrowReleased: { $sum: { $cond: [{ $eq: ['$type', 'escrow_release'] }, '$amount', 0] } },
        transactionCount: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]),
    Transaction.aggregate([
      { $match: matchStage },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Transaction.aggregate([
      { $match: { ...matchStage, type: 'deposit' } },
      { $group: { _id: '$metadata?.provider', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Transaction.aggregate([
      { $match: matchStage },
      { $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalFees: { $sum: '$fee' },
        avgAmount: { $avg: '$amount' },
        totalTransactions: { $sum: 1 },
        completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        failedCount: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
      }},
    ]),
  ]);

  const totalRevenue = summary[0]?.totalAmount || 0;
  const totalCommissions = await Transaction.aggregate([
    { $match: { ...matchStage, type: 'commission' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  return {
    period,
    dateRange: { start, end },
    summary: {
      totalRevenue,
      totalCommissions: totalCommissions[0]?.total || 0,
      totalFees: summary[0]?.totalFees || 0,
      avgTransaction: summary[0]?.avgAmount || 0,
      totalTransactions: summary[0]?.totalTransactions || 0,
      successRate: summary[0]?.totalTransactions
        ? ((summary[0].completedCount / summary[0].totalTransactions) * 100).toFixed(1) : 0,
    },
    revenueByPeriod,
    revenueByType,
    revenueByProvider,
  };
};

// ─── Platform Statistics ─────────────────────────────────────────────────────
export const getPlatformStats = async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, newUsers30d, activeUsers7d,
    usersByRole, totalJobs, activeJobs, completedProjects,
    totalTransactions, avgProjectValue, avgRating,
    suspendedUsers, verifiedFreelancers,
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ updatedAt: { $gte: sevenDaysAgo }, isActive: true }),
    User.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    Job.countDocuments(),
    Job.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    Project.countDocuments({ status: 'completed' }),
    Transaction.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Project.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, avg: { $avg: '$budget' } } },
    ]),
    Review.aggregate([
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
    User.countDocuments({ isBanned: true }),
    User.countDocuments({ isVerifiedFreelancer: true }),
  ]);

  const roleMap = {};
  usersByRole.forEach(r => { roleMap[r._id] = r.count; });

  return {
    users: {
      total: totalUsers,
      newLast30Days: newUsers30d,
      activeLast7Days: activeUsers7d,
      freelancers: roleMap.freelancer || 0,
      clients: roleMap.client || 0,
      admins: roleMap.admin || 0,
      suspended: suspendedUsers,
      verifiedFreelancers,
    },
    jobs: { total: totalJobs, active: activeJobs },
    projects: { completed: completedProjects, avgValue: avgProjectValue[0]?.avg || 0 },
    transactions: { last30Days: totalTransactions },
    reviews: { total: avgRating[0]?.count || 0, average: avgRating[0]?.avg?.toFixed(2) || 0 },
    healthScore: calculateHealthScore(totalUsers, activeUsers7d, completedProjects, avgRating[0]?.avg),
  };
};

function calculateHealthScore(totalUsers, activeUsers, completedProjects, avgRating) {
  const activityRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
  const ratingScore = avgRating ? (avgRating / 5) * 100 : 50;
  const completionScore = completedProjects > 0 ? Math.min(completedProjects / 10, 100) : 0;
  return Math.round((activityRate * 0.3 + ratingScore * 0.4 + completionScore * 0.3));
}

// ─── AI Fraud Detection ──────────────────────────────────────────────────────
export const detectFraud = async (params = {}) => {
  const doc = await getDoc();
  const { type, status, severity, page = 1, limit = 20 } = params;
  let alerts = doc.fraudAlerts || [];

  if (type) alerts = alerts.filter(a => a.type === type);
  if (status) alerts = alerts.filter(a => a.status === status);
  if (severity) alerts = alerts.filter(a => a.severity === severity);

  alerts.sort((a, b) => b.createdAt - a.createdAt);
  const total = alerts.length;
  const paginated = alerts.slice((page - 1) * limit, page * limit);

  return { alerts: paginated, total, page: Number(page), limit: Number(limit) };
};

export const runFraudDetection = async () => {
  return safeAI(async () => {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [recentTransactions, suspiciousUsers, duplicateAccounts, rapidWithdrawals] = await Promise.all([
      Transaction.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo }, status: { $in: ['completed', 'failed'] } } },
        { $group: {
          _id: '$user',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          types: { $addToSet: '$type' },
          failedCount: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        }},
        { $match: { $or: [{ count: { $gte: 20 } }, { totalAmount: { $gte: 10000 } }, { failedCount: { $gte: 5 } }] } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo }, isActive: true } },
        { $lookup: { from: 'profiles', localField: '_id', foreignField: 'user', as: 'profile' } },
        { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
        { $match: {
          $or: [
            { 'profile.hourlyRate': { $gte: 500 } },
            { $expr: { $gt: [{ $size: { $ifNull: ['$profile.skills', []] } }, 20] } },
          ],
        }}],
      ),
      User.aggregate([
        { $group: {
          _id: { $toLower: { $concat: ['$firstName', '$lastName'] } },
          users: { $push: { id: '$_id', email: '$email', name: { $concat: ['$firstName', ' ', '$lastName'] } } },
          count: { $sum: 1 },
        }},
        { $match: { count: { $gte: 2 } } },
      ]),
      Transaction.aggregate([
        { $match: { type: 'withdrawal', createdAt: { $gte: oneDayAgo }, status: 'completed' } },
        { $group: { _id: '$user', totalWithdrawn: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $match: { count: { $gte: 5 } } },
      ]),
    ]);

    const alerts = [];

    recentTransactions.forEach(u => {
      const severity = u.failedCount >= 10 ? 'critical' : u.totalAmount >= 50000 ? 'high' : 'medium';
      alerts.push({
        type: u.failedCount >= 5 ? 'payment_fraud' : 'rapid_transactions',
        severity,
        confidence: Math.min(0.6 + (u.count / 50) * 0.4, 0.99),
        user: u.user._id,
        description: `User ${u.user.firstName} ${u.user.lastName} has ${u.count} transactions totaling ${u.totalAmount.toFixed(2)} ETB in 7 days with ${u.failedCount} failures.`,
        evidence: [{ type: 'transaction_pattern', data: { count: u.count, total: u.totalAmount, failed: u.failedCount } }],
        aiReasoning: `Unusual transaction volume detected. ${u.count} transactions in 7 days with ${u.failedCount} failures suggests automated or fraudulent activity.`,
      });
    });

    rapidWithdrawals.forEach(u => {
      alerts.push({
        type: 'money_laundering',
        severity: 'high',
        confidence: 0.75,
        user: u._id,
        description: `User made ${u.count} withdrawals totaling ${u.totalWithdrawn.toFixed(2)} ETB in 24 hours.`,
        evidence: [{ type: 'withdrawal_pattern', data: { count: u.count, total: u.totalWithdrawn } }],
        aiReasoning: `Rapid withdrawal pattern is consistent with money laundering behavior.`,
      });
    });

    duplicateAccounts.forEach(d => {
      alerts.push({
        type: 'multi_account',
        severity: 'medium',
        confidence: 0.7,
        user: d.users[0].id,
        description: `Possible duplicate accounts detected with similar names: ${d.users.map(u => u.name).join(', ')}`,
        evidence: [{ type: 'name_match', data: { users: d.users.map(u => ({ id: u.id, email: u.email })) } }],
        aiReasoning: `Multiple accounts share very similar names, suggesting potential multi-accounting.`,
      });
    });

    const doc = await getDoc();
    alerts.forEach(alert => {
      alert.status = 'detected';
      alert.aiModel = 'gemini-flash-latest';
      doc.fraudAlerts.push(alert);
    });
    await doc.save();

    return { newAlerts: alerts.length, alerts };
  }, { newAlerts: 0, alerts: [] });
};

export const resolveFraudAlert = async (alertId, data) => {
  const doc = await getDoc();
  const alert = doc.fraudAlerts.id(alertId);
  if (!alert) throw new Error('Alert not found');
  Object.assign(alert, data, { resolvedAt: new Date() });
  await doc.save();
  return alert;
};

// ─── AI Spam Detection ───────────────────────────────────────────────────────
export const detectSpam = async (params = {}) => {
  const doc = await getDoc();
  const { contentType, status, severity, page = 1, limit = 20 } = params;
  let flags = doc.spamFlags || [];

  if (contentType) flags = flags.filter(f => f.contentType === contentType);
  if (status) flags = flags.filter(f => f.status === status);
  if (severity) flags = flags.filter(f => f.severity === severity);

  flags.sort((a, b) => b.createdAt - a.createdAt);
  return { flags: flags.slice((page - 1) * limit, page * limit), total: flags.length, page: Number(page) };
};

export const analyzeContentForSpam = async (contentType, contentId, content, authorId) => {
  return safeAI(async () => {
    const analysis = await chatJSON(
      `You are a spam detection AI. Analyze content for spam, fake reviews, scams, or inappropriate material. Return JSON: { isSpam: boolean, severity: "low"|"medium"|"high", confidence: 0-1, reason: string, patterns: string[], suggestions: string[] }`,
      `Content type: ${contentType}\nContent: ${content.substring(0, 2000)}`,
      0.3,
      500
    );

    if (analysis.isSpam) {
      const doc = await getDoc();
      doc.spamFlags.push({
        contentType,
        contentId,
        author: authorId,
        content,
        reason: analysis.reason?.substring(0, 100) || 'ai_detected',
        severity: analysis.severity,
        confidence: analysis.confidence,
        aiAnalysis: {
          reasoning: analysis.reason,
          patterns: analysis.patterns || [],
          suggestions: analysis.suggestions || [],
          isSpam: analysis.isSpam,
        },
        status: 'pending',
      });
      await doc.save();
    }

    return analysis;
  }, { isSpam: false, severity: 'low', confidence: 0, reason: 'AI unavailable', patterns: [], suggestions: [] });
};

export const resolveSpamFlag = async (flagId, data) => {
  const doc = await getDoc();
  const flag = doc.spamFlags.id(flagId);
  if (!flag) throw new Error('Spam flag not found');
  Object.assign(flag, data, { reviewedAt: new Date() });
  await doc.save();
  return flag;
};

// ─── User Growth Analytics ───────────────────────────────────────────────────
export const getUserGrowthAnalytics = async (filters = {}) => {
  const { period = 'daily', startDate, endDate } = filters;
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const [userGrowth, cohortData, roleGrowth, activeByDay] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: period === 'daily' ? { $dayOfMonth: '$createdAt' } : null,
        },
        total: { $sum: 1 },
        freelancers: { $sum: { $cond: [{ $eq: ['$role', 'freelancer'] }, 1, 0] } },
        clients: { $sum: { $cond: [{ $eq: ['$role', 'client'] }, 1, 0] } },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        users: { $push: '$_id' },
        count: { $sum: 1 },
      }},
      { $limit: 12 },
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, role: '$role' },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    User.aggregate([
      { $match: { updatedAt: { $gte: start, $lte: end }, isActive: true } },
      { $group: {
        _id: { $dayOfWeek: '$updatedAt' },
        count: { $sum: 1 },
      }},
      { $sort: { '_id': 1 } },
    ]),
  ]);

  const totalUsers = await User.countDocuments({ createdAt: { $lte: end } });
  const churnedUsers = await User.countDocuments({ isActive: false, updatedAt: { $gte: start, $lte: end } });
  const retentionRate = totalUsers > 0 ? (((totalUsers - churnedUsers) / totalUsers) * 100).toFixed(1) : 100;

  const mau = await User.countDocuments({ updatedAt: { $gte: new Date(end - 30 * 24 * 60 * 60 * 1000) }, isActive: true });
  const dau = await User.countDocuments({ updatedAt: { $gte: new Date(end - 24 * 60 * 60 * 1000) }, isActive: true });

  return {
    growth: userGrowth,
    cohortData,
    roleGrowth,
    activeByDay,
    summary: {
      totalUsers,
      newUsers: userGrowth.reduce((s, g) => s + g.total, 0),
      churnedUsers,
      retentionRate: Number(retentionRate),
      mau,
      dau,
      dauMauRatio: mau > 0 ? ((dau / mau) * 100).toFixed(1) : 0,
    },
  };
};

// ─── Business Insights ───────────────────────────────────────────────────────
export const getBusinessInsights = async (params = {}) => {
  const doc = await getDoc();
  const { type, impact, page = 1, limit = 20 } = params;
  let insights = doc.businessInsights.filter(i => i.isActive);

  if (type) insights = insights.filter(i => i.type === type);
  if (impact) insights = insights.filter(i => i.impact === impact);

  insights.sort((a, b) => b.generatedAt - a.generatedAt);
  return { insights: insights.slice((page - 1) * limit, page * limit), total: insights.length };
};

export const generateBusinessInsights = async () => {
  return safeAI(async () => {
    const stats = await getPlatformStats();
    const revenue = await getRevenueReport({ period: 'monthly', startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() });

    const data = await chatJSON(
      `You are a business intelligence AI for a freelance marketplace. Analyze platform data and generate actionable insights. Return JSON: { insights: [{ type: string, title: string, summary: string, details: string, impact: "low"|"medium"|"high"|"critical", confidence: 0-1, metrics: {}, recommendations: string[] }] }`,
      `Platform Stats: ${JSON.stringify(stats)}
Revenue Summary: ${JSON.stringify(revenue.summary)}
Generate 5-8 business insights covering revenue, growth, user engagement, and risk factors.`,
      0.7,
      3000
    );
    const doc = await getDoc();

    (data.insights || []).forEach(insight => {
      insight.generatedAt = new Date();
      insight.isActive = true;
      doc.businessInsights.push(insight);
    });
    await doc.save();

    return data.insights || [];
  }, []);
};

export const markInsightViewed = async (insightId, userId) => {
  const doc = await getDoc();
  const insight = doc.businessInsights.id(insightId);
  if (!insight) throw new Error('Insight not found');
  if (!insight.viewedBy.includes(userId)) insight.viewedBy.push(userId);
  await doc.save();
  return insight;
};

// ─── Dashboard Overview ──────────────────────────────────────────────────────
export const getDashboardOverview = async () => {
  const [stats, recentFraud, recentSpam] = await Promise.all([
    getPlatformStats(),
    detectFraud({ status: 'detected', limit: 5 }),
    detectSpam({ status: 'pending', limit: 5 }),
  ]);

  return {
    platformStats: stats,
    recentFraudAlerts: recentFraud.alerts,
    recentSpamFlags: recentSpam.flags,
    alertsSummary: {
      fraudDetected: recentFraud.total,
      spamPending: recentSpam.total,
    },
  };
};
