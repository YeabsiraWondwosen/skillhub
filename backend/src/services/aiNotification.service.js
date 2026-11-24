import { logger } from '../utils/logger.js';
import { Notification, NotificationPreferences, User, Profile, Job, Project, Transaction } from '../models/index.js';
import { emitToUser } from './socket.service.js';
import { chatJSON, isAIAvailable } from './aiClient.js';
import { shouldDeliverNotification } from '../utils/notificationPreference.js';

const AI_AVAILABLE = isAIAvailable();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const safeAICall = async (fn, fallback) => {
  if (!AI_AVAILABLE) return fallback;
  try { return await fn(); } catch (err) {
    logger.error(`AI notification error: ${err.message}`);
    return fallback;
  }
};

const isQuietHours = (prefs) => {
  const hour = new Date().getHours();
  const start = prefs?.aiPreferences?.quietHoursStart ?? 22;
  const end = prefs?.aiPreferences?.quietHoursEnd ?? 8;
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
};

const canSendAiNotification = async (userId) => {
  const prefs = await NotificationPreferences.findOne({ user: userId });
  if (!prefs) return { allowed: true, prefs: null };
  if (!prefs.categories.aiRecommendations) return { allowed: false, prefs };
  if (isQuietHours(prefs)) return { allowed: false, prefs };
  const maxDaily = prefs.aiPreferences.maxDailyAiNotifications ?? 5;
  if (prefs.aiNotificationCountToday >= maxDaily) return { allowed: false, prefs };
  return { allowed: true, prefs };
};

const incrementAiCount = async (userId) => {
  await NotificationPreferences.findOneAndUpdate(
    { user: userId },
    { $inc: { aiNotificationCountToday: 1 }, $set: { lastAiNotificationAt: new Date() } }
  );
};

const createAiNotification = async ({ recipient, type, title, message, priority, category, data, actionUrl, actions, aiConfidence, aiReasoning, expiresAt }) => {
  // Respect the recipient's saved preferences for this specific AI category
  // (e.g. weeklyDigest / jobMatches), not just the umbrella aiRecommendations.
  const prefs = await NotificationPreferences.findOne({ user: recipient })
    .select('channels categories')
    .lean();
  if (!shouldDeliverNotification({ prefs, type, category })) return null;

  const notification = await Notification.create({
    recipient,
    type,
    title,
    message,
    priority: priority || 'medium',
    category: category || 'ai',
    data: data || {},
    actionUrl: actionUrl || '',
    actions: actions || [],
    isAiGenerated: true,
    aiConfidence,
    aiReasoning,
    expiresAt,
  });

  emitToUser(recipient.toString(), 'notification:new', {
    _id: notification._id,
    type,
    title,
    message,
    actionUrl,
    priority: notification.priority,
    category: notification.category,
    isAiGenerated: true,
    actions: notification.actions,
    createdAt: notification.createdAt,
  });

  return notification;
};

// ─── Job Match Notifications ─────────────────────────────────────────────────

export const generateJobMatchNotifications = async () => {
  if (!AI_AVAILABLE) return generateFallbackJobMatches();

  const freelancers = await Profile.find({ skills: { $exists: true, $not: { $size: 0 } } })
    .populate('user', 'firstName lastName stats isActive isBanned role notificationPreferences')
    .limit(50);

  const openJobs = await Job.find({ status: 'open' }).limit(20).lean();
  if (openJobs.length === 0) return;

  const activeFreelancers = freelancers.filter(p =>
    p.user?.isActive && !p.user?.isBanned && p.user?.role === 'freelancer'
  );

  for (const profile of activeFreelancers) {
    const { allowed } = await canSendAiNotification(profile.user._id);
    if (!allowed) continue;

    const profileSkills = (profile.skills || []).map(s => s.name.toLowerCase());

    try {
      const result = await safeAICall(async () => {
        const jobSummaries = openJobs.map(j => ({
          id: j._id.toString(),
          title: j.title,
          skills: (j.requiredSkills || []).join(', '),
          budget: j.budget?.maxAmount,
          experienceLevel: j.experienceLevel,
        }));

        const prompt = `Match jobs to a freelancer.

Freelancer skills: ${(profile.skills || []).map(s => `${s.name} (${s.level})`).join(', ')}
Hourly rate: ${profile.hourlyRate} ETB
Completed projects: ${profile.user?.stats?.completedProjects || 0}
Rating: ${profile.user?.stats?.averageRating || 0}/5

Jobs:
${JSON.stringify(jobSummaries, null, 2)}

Return JSON array of top 3 matches: [{"id":"...","score":85,"reason":"Why this job is a great match — be specific about skill overlap","title":"Job title"}]
Only return valid JSON.`;

        const parsed = await chatJSON(
          'You are a freelance job matching engine. Return only valid JSON.',
          prompt,
          0.3,
          800
        );
        return Array.isArray(parsed) ? parsed : (parsed.matches || []);
      }, []);

      for (const match of result) {
        const job = openJobs.find(j => j._id.toString() === match.id);
        if (!job || match.score < 60) continue;

        const alreadyNotified = await Notification.findOne({
          recipient: profile.user._id,
          type: 'ai_job_match',
          'data.jobId': job._id.toString(),
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        });
        if (alreadyNotified) continue;

        await createAiNotification({
          recipient: profile.user._id,
          type: 'ai_job_match',
          title: `New Job Match: ${job.title}`,
          message: match.reason || `This job matches ${match.score}% of your skills`,
          priority: match.score >= 85 ? 'high' : 'medium',
          category: 'job',
          data: { jobId: job._id.toString(), score: match.score },
          actionUrl: `/jobs/${job._id}`,
          actions: [
            { label: 'View Job', url: `/jobs/${job._id}`, style: 'primary' },
            { label: 'Apply Now', url: `/jobs/${job._id}/apply`, method: 'GET', style: 'secondary' },
          ],
          aiConfidence: match.score / 100,
          aiReasoning: match.reason,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        await incrementAiCount(profile.user._id);
      }
    } catch (err) {
      logger.error(`Job match AI failed for ${profile.user._id}: ${err.message}`);
    }
  }
};

const generateFallbackJobMatches = async () => {
  const freelancers = await Profile.find({ skills: { $exists: true, $not: { $size: 0 } } })
    .populate('user', 'firstName lastName stats isActive isBanned role')
    .limit(30);

  const openJobs = await Job.find({ status: 'open' }).limit(20).lean();
  if (openJobs.length === 0) return;

  for (const profile of freelancers) {
    if (!profile.user?.isActive || profile.user?.isBanned) continue;
    const { allowed } = await canSendAiNotification(profile.user._id);
    if (!allowed) continue;

    const profileSkills = (profile.skills || []).map(s => s.name.toLowerCase());
    const matches = openJobs.map(job => {
      const required = (job.requiredSkills || []).map(s => s.toLowerCase());
      const matched = required.filter(s => profileSkills.includes(s)).length;
      const score = Math.round((matched / Math.max(required.length, 1)) * 100);
      return { job, score };
    }).filter(m => m.score >= 60).sort((a, b) => b.score - a.score).slice(0, 3);

    for (const match of matches) {
      const alreadyNotified = await Notification.findOne({
        recipient: profile.user._id,
        type: 'ai_job_match',
        'data.jobId': match.job._id.toString(),
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      });
      if (alreadyNotified) continue;

      await createAiNotification({
        recipient: profile.user._id,
        type: 'ai_job_match',
        title: `Job Match: ${match.job.title}`,
        message: `Matches ${match.score}% of your skills: ${(match.job.requiredSkills || []).slice(0, 3).join(', ')}`,
        priority: match.score >= 85 ? 'high' : 'medium',
        category: 'job',
        data: { jobId: match.job._id.toString(), score: match.score },
        actionUrl: `/jobs/${match.job._id}`,
        actions: [
          { label: 'View Job', url: `/jobs/${match.job._id}`, style: 'primary' },
          { label: 'Apply Now', url: `/jobs/${match.job._id}/apply`, style: 'secondary' },
        ],
        aiConfidence: match.score / 100,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }
  }
};

// ─── Skill Recommendations ───────────────────────────────────────────────────

export const generateSkillRecommendations = async () => {
  const freelancers = await Profile.find({ skills: { $exists: true, $not: { $size: 0 } } })
    .populate('user', 'firstName lastName stats isActive isBanned role')
    .limit(20);

  const openJobs = await Job.find({ status: 'open' }).limit(30).lean();
  const demandedSkills = {};
  openJobs.forEach(job => {
    (job.requiredSkills || []).forEach(skill => {
      const key = skill.toLowerCase();
      demandedSkills[key] = (demandedSkills[key] || 0) + 1;
    });
  });

  const topDemanded = Object.entries(demandedSkills)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  for (const profile of freelancers) {
    if (!profile.user?.isActive || profile.user?.isBanned) continue;
    const { allowed } = await canSendAiNotification(profile.user._id);
    if (!allowed) continue;

    const profileSkills = (profile.skills || []).map(s => s.name.toLowerCase());
    const missingHighDemand = topDemanded
      .filter(([skill]) => !profileSkills.includes(skill))
      .slice(0, 3);

    if (missingHighDemand.length === 0) continue;

    const alreadyNotified = await Notification.findOne({
      recipient: profile.user._id,
      type: 'ai_skill_recommendation',
      createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    });
    if (alreadyNotified) continue;

    const skillList = missingHighDemand.map(([s, c]) => `${s} (${c} open jobs)`).join(', ');

    await createAiNotification({
      recipient: profile.user._id,
      type: 'ai_skill_recommendation',
      title: 'Skills In High Demand',
      message: `Learn ${skillList} to unlock more job opportunities`,
      priority: 'medium',
      category: 'ai',
      data: { skills: missingHighDemand.map(([s, c]) => ({ name: s, demand: c })) },
      actionUrl: '/learning-hub',
      actions: [
        { label: 'Explore Learning Hub', url: '/learning-hub', style: 'primary' },
      ],
      aiConfidence: 0.8,
      aiReasoning: `These skills appear in ${missingHighDemand.map(([, c]) => c).join(', ')} open jobs respectively`,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
  }
};

// ─── Earning Insights ────────────────────────────────────────────────────────

export const generateEarningInsights = async () => {
  const freelancers = await User.find({ role: 'freelancer', isActive: true })
    .limit(30);

  for (const user of freelancers) {
    const { allowed } = await canSendAiNotification(user._id);
    if (!allowed) continue;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTx = await Transaction.find({
      user: user._id,
      type: 'escrow_release',
      status: 'completed',
      createdAt: { $gte: thirtyDaysAgo },
    }).lean();

    if (recentTx.length === 0) continue;

    const totalEarned = recentTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const avgPerProject = totalEarned / recentTx.length;

    const alreadyNotified = await Notification.findOne({
      recipient: user._id,
      type: 'ai_earning_insight',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });
    if (alreadyNotified) continue;

    await createAiNotification({
      recipient: user._id,
      type: 'ai_earning_insight',
      title: 'Weekly Earning Summary',
      message: `You earned ${totalEarned.toFixed(2)} ETB from ${recentTx.length} projects this month (avg ${avgPerProject.toFixed(2)} ETB/project)`,
      priority: 'low',
      category: 'payment',
      data: { totalEarned, projectCount: recentTx.length, avgPerProject },
      actionUrl: '/payments/wallet',
      actions: [{ label: 'View Wallet', url: '/payments/wallet', style: 'primary' }],
      aiConfidence: 1.0,
    });
  }
};

// ─── Profile Optimization Tips ───────────────────────────────────────────────

export const generateProfileTips = async () => {
  const profiles = await Profile.find({})
    .populate('user', 'firstName lastName stats isActive isBanned role freelancerLevel')
    .limit(30);

  for (const profile of profiles) {
    if (!profile.user?.isActive || profile.user?.isBanned || profile.user?.role !== 'freelancer') continue;
    const { allowed } = await canSendAiNotification(profile.user._id);
    if (!allowed) continue;

    const tips = [];
    if (!profile.bio || profile.bio.length < 50) tips.push('Add a compelling bio (50+ characters)');
    if (!profile.tagline) tips.push('Add a professional tagline');
    if (profile.portfolio.length < 3) tips.push('Add more portfolio projects (aim for 3+)');
    if (profile.skills.length < 5) tips.push('Add more skills to appear in more searches');
    if (!profile.experience.length) tips.push('Add work experience to build credibility');
    if (!profile.hourlyRate) tips.push('Set your hourly rate so clients can find you');
    if (!profile.githubData?.username) tips.push('Connect your GitHub to showcase code');
    if (!profile.resume?.url) tips.push('Upload your resume for a complete profile');

    if (tips.length === 0) continue;

    const alreadyNotified = await Notification.findOne({
      recipient: profile.user._id,
      type: 'ai_profile_tip',
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });
    if (alreadyNotified) continue;

    const completionPct = profile.completionScore || 0;

    await createAiNotification({
      recipient: profile.user._id,
      type: 'ai_profile_tip',
      title: 'Boost Your Profile Visibility',
      message: `Your profile is ${completionPct}% complete. ${tips[0]}`,
      priority: completionPct < 50 ? 'high' : 'medium',
      category: 'ai',
      data: { completionPct, tips },
      actionUrl: '/freelancer/profile/edit',
      actions: [{ label: 'Edit Profile', url: '/freelancer/profile/edit', style: 'primary' }],
      aiConfidence: 0.9,
      aiReasoning: `${tips.length} profile improvements available`,
    });
  }
};

// ─── Deadline Reminders ──────────────────────────────────────────────────────

export const generateDeadlineReminders = async () => {
  const upcomingDeadlines = await Project.find({
    status: { $in: ['in_progress', 'active'] },
    deadline: {
      $gte: new Date(),
      $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  }).populate('client freelancer', 'firstName lastName');

  for (const project of upcomingDeadlines) {
    const daysLeft = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24));

    for (const userId of [project.client?._id, project.freelancer?._id]) {
      if (!userId) continue;

      const alreadyNotified = await Notification.findOne({
        recipient: userId,
        type: 'ai_deadline_reminder',
        'data.projectId': project._id.toString(),
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });
      if (alreadyNotified) continue;

      await createAiNotification({
        recipient: userId,
        type: 'ai_deadline_reminder',
        title: `Deadline in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
        message: `Project "${project.title}" deadline is approaching`,
        priority: daysLeft <= 1 ? 'urgent' : daysLeft <= 2 ? 'high' : 'medium',
        category: 'project',
        data: { projectId: project._id.toString(), deadline: project.deadline, daysLeft },
        actionUrl: `/projects/${project._id}`,
        actions: [{ label: 'View Project', url: `/projects/${project._id}`, style: 'primary' }],
        expiresAt: new Date(project.deadline),
      });
    }
  }
};

// ─── Trend Alerts ────────────────────────────────────────────────────────────

export const generateTrendAlerts = async () => {
  if (!AI_AVAILABLE) return;

  const recentJobs = await Job.find({ status: 'open', createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }).lean();
  if (recentJobs.length < 10) return;

  const skillCounts = {};
  recentJobs.forEach(job => {
    (job.requiredSkills || []).forEach(skill => {
      const key = skill.toLowerCase();
      skillCounts[key] = (skillCounts[key] || 0) + 1;
    });
  });

  const trending = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (trending.length === 0) return;

  const alreadyNotified = await Notification.findOne({
    type: 'ai_trend_alert',
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  });
  if (alreadyNotified) return;

  const trendList = trending.map(([s, c]) => `${s} (${c} jobs)`).join(', ');

  const activeFreelancers = await User.find({ role: 'freelancer', isActive: true }).limit(100);
  const userIds = activeFreelancers.map(u => u._id);

  const notifications = userIds.map(userId => ({
    recipient: userId,
    type: 'ai_trend_alert',
    title: 'Skills Trending This Week',
    message: `Hot skills: ${trendList}. Consider adding these to your profile.`,
    priority: 'low',
    category: 'ai',
    data: { trending: trending.map(([s, c]) => ({ skill: s, count: c })) },
    actionUrl: '/jobs',
    actions: [{ label: 'Browse Jobs', url: '/jobs', style: 'primary' }],
    isAiGenerated: true,
    aiConfidence: 0.7,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }));

  await Notification.insertMany(notifications, { ordered: false });
  notifications.forEach(n => {
    emitToUser(n.recipient.toString(), 'notification:new', {
      _id: n._id, type: n.type, title: n.title, message: n.message,
      priority: n.priority, category: n.category, isAiGenerated: true,
      createdAt: n.createdAt,
    });
  });
};

// ─── Weekly Digest ───────────────────────────────────────────────────────────

export const generateWeeklyDigest = async () => {
  const users = await User.find({ isActive: true }).limit(100);

  for (const user of users) {
    const { allowed, prefs } = await canSendAiNotification(user._id);
    if (!allowed || !prefs?.categories.weeklyDigest) continue;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [unreadNotifs, recentProjects, recentTransactions] = await Promise.all([
      Notification.countDocuments({ recipient: user._id, isRead: false }),
      Project.countDocuments({ $or: [{ client: user._id }, { freelancer: user._id }], updatedAt: { $gte: sevenDaysAgo } }),
      Transaction.countDocuments({ user: user._id, createdAt: { $gte: sevenDaysAgo }, status: 'completed' }),
    ]);

    const weeklyEarnings = await Transaction.aggregate([
      { $match: { user: user._id, type: 'escrow_release', status: 'completed', createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const earned = weeklyEarnings[0]?.total || 0;

    const alreadyNotified = await Notification.findOne({
      recipient: user._id,
      type: 'ai_weekly_digest',
      createdAt: { $gte: sevenDaysAgo },
    });
    if (alreadyNotified) continue;

    const parts = [];
    if (unreadNotifs > 0) parts.push(`${unreadNotifs} unread notifications`);
    if (recentProjects > 0) parts.push(`${recentProjects} active projects`);
    if (earned > 0) parts.push(`${earned.toFixed(2)} ETB earned`);

    if (parts.length === 0) continue;

    await createAiNotification({
      recipient: user._id,
      type: 'ai_weekly_digest',
      title: 'Your Weekly Summary',
      message: `This week: ${parts.join(', ')}.`,
      priority: 'low',
      category: 'ai',
      data: { unreadNotifs, recentProjects, weeklyEarnings: earned, transactionCount: recentTransactions },
      actionUrl: '/dashboard',
      actions: [{ label: 'View Dashboard', url: '/dashboard', style: 'primary' }],
      aiConfidence: 1.0,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await NotificationPreferences.findOneAndUpdate(
      { user: user._id },
      { $set: { lastDigestSentAt: new Date() } }
    );
  }
};

// ─── Cleanup stale AI daily counts (run at midnight) ─────────────────────────

export const resetDailyAiCounts = async () => {
  await NotificationPreferences.updateMany(
    { aiNotificationCountToday: { $gt: 0 } },
    { $set: { aiNotificationCountToday: 0 } }
  );
};

// ─── Run All AI Notifications ────────────────────────────────────────────────

export const runAllAiNotifications = async () => {
  logger.info('Running AI notification engine...');
  try {
    await generateJobMatchNotifications();
    await generateSkillRecommendations();
    await generateEarningInsights();
    await generateProfileTips();
    await generateDeadlineReminders();
    await generateTrendAlerts();
    logger.info('AI notification engine completed');
  } catch (err) {
    logger.error(`AI notification engine error: ${err.message}`);
  }
};
