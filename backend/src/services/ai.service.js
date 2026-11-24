import { logger } from '../utils/logger.js';
import { Job, Profile, User, Application, Category } from '../models/index.js';
import { chatCompletion, chatJSON, isAIAvailable, AIUnavailableError } from './aiClient.js';

const AI_AVAILABLE = isAIAvailable();

// ─── Helper ───────────────────────────────────────────────────────────────────
const resolveFallback = (fallback) => (typeof fallback === 'function' ? fallback() : fallback);

const safeAICall = async (fn, fallback) => {
  if (!AI_AVAILABLE) return resolveFallback(fallback);
  try {
    return await fn();
  } catch (err) {
    // Quota exhaustion is an expected, already-logged state (aiClient pauses
    // further calls), so don't re-log it as an error on every request.
    if (err instanceof AIUnavailableError) {
      logger.debug('AI service unavailable — using fallback response');
    } else {
      logger.error(`AI service error: ${err.message}`);
    }
    return resolveFallback(fallback);
  }
};

// ─── AI Features ─────────────────────────────────────────────────────────────

/**
 * Match freelancers to a job based on skills, profile, and job requirements
 */
export const matchFreelancersToJob = async (job, limit = 10) => {
  const freelancers = await Profile.find({})
    .populate('user', 'firstName lastName stats isActive isBanned role')
    .limit(100);

  const activeFreelancers = freelancers.filter(
    (p) => p.user && p.user.isActive && !p.user.isBanned && p.user.role === 'freelancer'
  );

  const deterministicMatch = () => {
    const scored = activeFreelancers.map((profile) => {
      const profileSkillNames = (profile.skills || []).map((s) => s.name.toLowerCase());
      const requiredSkills = (job.requiredSkills || []).map((s) => s.toLowerCase());
      const matchCount = requiredSkills.filter((s) => profileSkillNames.includes(s)).length;
      const score = Math.round((matchCount / Math.max(requiredSkills.length, 1)) * 100);
      return { profile, score, reasons: [`Matches ${matchCount}/${requiredSkills.length} required skills`] };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  };

  if (!AI_AVAILABLE) {
    return deterministicMatch();
  }

  return safeAICall(async () => {
    const profileSummaries = activeFreelancers.slice(0, 30).map((p) => ({
      id: p.user._id.toString(),
      skills: (p.skills || []).map((s) => s.name).join(', '),
      hourlyRate: p.hourlyRate,
      rating: p.user.stats?.averageRating || 0,
      completedProjects: p.user.stats?.completedProjects || 0,
    }));

    const prompt = `
Job: "${job.title}"
Required Skills: ${(job.requiredSkills || []).join(', ')}
Experience Level: ${job.experienceLevel}
Budget: ${job.budget.type} ${job.budget.maxAmount} ETB

Freelancers:
${JSON.stringify(profileSummaries, null, 2)}

Return a JSON array of up to ${limit} best matches: [{"id":"...", "score":85, "reasons":["reason1"]}]
Only return valid JSON, nothing else.`;

    const result = await chatCompletion(
      'You are an expert freelance marketplace matching algorithm. Return only valid JSON.',
      prompt,
      0.3
    );

    const matches = JSON.parse(result);
    return matches.map((m) => ({
      profile: activeFreelancers.find((p) => p.user._id.toString() === m.id),
      score: m.score,
      reasons: m.reasons,
    })).filter((m) => m.profile);
  }, deterministicMatch);
};

/**
 * Recommend jobs for a freelancer based on their profile
 */
export const recommendJobsForFreelancer = async (freelancerProfile, limit = 10) => {
  const openJobs = await Job.find({ status: 'open' }).limit(50).lean();

  const deterministicRecommendation = () => {
    const profileSkills = (freelancerProfile.skills || []).map((s) => s.name.toLowerCase());
    const scored = openJobs.map((job) => {
      const required = (job.requiredSkills || []).map((s) => s.toLowerCase());
      const matches = required.filter((s) => profileSkills.includes(s)).length;
      const score = Math.round((matches / Math.max(required.length, 1)) * 100);
      return { job, score };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  };

  if (!AI_AVAILABLE || openJobs.length === 0) {
    return deterministicRecommendation();
  }

  return safeAICall(async () => {
    const jobSummaries = openJobs.map((j) => ({
      id: j._id.toString(),
      title: j.title,
      skills: (j.requiredSkills || []).join(', '),
      budget: `${j.budget.maxAmount} ETB`,
      experienceLevel: j.experienceLevel,
    }));

    const prompt = `
    Freelancer Skills: ${(freelancerProfile.skills || []).map((s) => s.name).join(', ')}
Hourly Rate: ${freelancerProfile.hourlyRate} ETB

Jobs:
${JSON.stringify(jobSummaries, null, 2)}

Return JSON array of top ${limit} jobs: [{"id":"...", "score":90, "reason":"..."}]
Only return valid JSON.`;

    const result = await chatCompletion(
      'You are a job recommendation engine. Return only valid JSON.',
      prompt,
      0.3
    );

    const recommendations = JSON.parse(result);
    return recommendations.map((r) => ({
      job: openJobs.find((j) => j._id.toString() === r.id),
      score: r.score,
      reason: r.reason,
    })).filter((r) => r.job);
  }, deterministicRecommendation);
};

/**
 * AI Proposal assistant — generate a cover letter draft
 */
export const generateProposalDraft = async (freelancerProfile, job) => {
  const fallback = `I am writing to express my interest in the "${job.title}" position.
  
Based on my experience with ${(freelancerProfile.skills || []).slice(0, 3).map((s) => s.name).join(', ')}, I am confident I can deliver excellent results for this project.

I would be happy to discuss this opportunity further.`;

  return safeAICall(async () => {
    const prompt = `
Write a professional, concise freelance proposal cover letter (150-250 words) for:

Job: "${job.title}"
Description: ${job.description.substring(0, 500)}
Required Skills: ${(job.requiredSkills || []).join(', ')}
Budget: ${job.budget.type} ${job.budget.maxAmount} ETB

Freelancer Background:
- Skills: ${(freelancerProfile.skills || []).map((s) => `${s.name} (${s.level})`).join(', ')}
- Bio: ${freelancerProfile.bio?.substring(0, 300) || 'Experienced web developer'}
- Completed Projects: ${freelancerProfile.user?.stats?.completedProjects || 0}

Write in first person. Be specific, professional, and compelling. Do NOT use generic filler phrases.`;

    return chatCompletion(
      'You are a professional freelance writing assistant specializing in web development proposals.',
      prompt,
      0.8
    );
  }, fallback);
};

/**
 * Detect skill gaps between freelancer profile and job requirements
 */
export const detectSkillGaps = async (freelancerProfile, job) => {
  const profileSkills = (freelancerProfile.skills || []).map((s) => s.name.toLowerCase());
  const requiredSkills = (job.requiredSkills || []).map((s) => s.toLowerCase());
  const missingSkills = requiredSkills.filter((s) => !profileSkills.includes(s));

  if (!AI_AVAILABLE || missingSkills.length === 0) {
    return {
      gaps: missingSkills,
      recommendations: missingSkills.map((skill) => ({
        skill,
        resources: [`Search for "${skill}" courses on freeCodeCamp, Udemy, or YouTube`],
        estimatedTime: '2-4 weeks',
      })),
    };
  }

  return safeAICall(async () => {
    const prompt = `
A web developer wants to apply for a job requiring: ${(job.requiredSkills || []).join(', ')}
They currently know: ${(freelancerProfile.skills || []).map((s) => s.name).join(', ')}
Missing skills: ${missingSkills.join(', ')}

Return JSON: {"gaps":[{"skill":"...","importance":"high/medium/low","estimatedTimeToLearn":"...","freeResources":["url1","url2"],"paidResources":["..."],"reason":"why this skill matters for this job"}]}
Only return valid JSON.`;

    const result = await chatCompletion(
      'You are a web development career coach. Return only valid JSON.',
      prompt,
      0.5
    );

    return JSON.parse(result);
  }, { gaps: missingSkills.map((s) => ({ skill: s, importance: 'medium', estimatedTimeToLearn: '2-4 weeks', freeResources: [], paidResources: [], reason: 'Required for this job' })) });
};

/**
 * Generate a full structured proposal with cover letter, pricing, delivery, and match score
 */
export const generateFullProposal = async (freelancerProfile, job) => {
    const skillMatch = (() => {
    const profileSkills = (freelancerProfile.skills || []).map((s) => s.name.toLowerCase());
    const required = (job.requiredSkills || []).map((s) => s.toLowerCase());
    const matched = required.filter((s) => profileSkills.includes(s));
    return { matched: matched.length, total: required.length };
  })();

  const fallbackCoverLetter = `Dear Hiring Manager,

I am excited to apply for the "${job.title}" position. With my expertise in ${(freelancerProfile.skills || []).slice(0, 3).map((s) => s.name).join(', ')}, I am well-equipped to deliver high-quality results for this project.

${freelancerProfile.bio?.substring(0, 200) || 'As an experienced web developer, I bring a strong track record of delivering successful projects.'}

I have completed ${freelancerProfile.user?.stats?.completedProjects || 0} projects and maintain a ${freelancerProfile.user?.stats?.averageRating?.toFixed(1) || '5.0'} rating. I am confident in my ability to exceed your expectations.

I look forward to discussing how I can contribute to your project's success.

Best regards`;

  const fallbackProposal = {
    coverLetter: fallbackCoverLetter,
    suggestedPrice: {
      amount: Math.round(job.budget.maxAmount * 0.8),
      type: job.budget.type,
      currency: job.budget.currency || 'ETB',
    },
    suggestedDelivery: { value: 14, unit: 'days' },
    matchScore: Math.round((skillMatch.matched / Math.max(skillMatch.total, 1)) * 100),
    reasoning: [`Matches ${skillMatch.matched}/${skillMatch.total} required skills`],
    relevantPortfolio: freelancerProfile.portfolio?.slice(0, 3).map((p) => ({
      title: p.title,
      technologies: p.technologies,
      projectUrl: p.projectUrl,
    })) || [],
  };

  return safeAICall(async () => {
    const portfolioContext = freelancerProfile.portfolio?.length
      ? `\nPortfolio Projects:\n${(freelancerProfile.portfolio || []).slice(0, 5).map((p) => `- "${p.title}" (${p.technologies?.join(', ') || 'N/A'})${p.projectUrl ? ` [${p.projectUrl}]` : ''}`).join('\n')}`
      : '';

    const experienceContext = (freelancerProfile.experience || []).length
      ? `\nWork Experience:\n${freelancerProfile.experience.slice(0, 3).map((e) => `- ${e.title} at ${e.company}${e.description ? `: ${e.description.substring(0, 150)}` : ''}`).join('\n')}`
      : '';

    const prompt = `
You are an expert freelance proposal writer. Generate a complete, professional proposal for this job.

JOB DETAILS:
Title: "${job.title}"
Description: ${job.description.substring(0, 800)}
Required Skills: ${(job.requiredSkills || []).join(', ')}
Budget: ${job.budget.type} $${job.budget.minAmount || 0} - $${job.budget.maxAmount}
Experience Level: ${job.experienceLevel}
Duration: ${job.duration || 'Not specified'}
Deadline: ${job.deadline ? new Date(job.deadline).toLocaleDateString() : 'Flexible'}

FREELANCER PROFILE:
Name: ${freelancerProfile.user?.firstName || ''} ${freelancerProfile.user?.lastName || ''}
Skills: ${(freelancerProfile.skills || []).map((s) => `${s.name} (${s.level}, ${s.yearsOfExperience || 0}yr)`).join(', ')}
Bio: ${freelancerProfile.bio?.substring(0, 400) || 'Experienced web developer'}
Hourly Rate: ${freelancerProfile.hourlyRate || 0} ETB/hr
Completed Projects: ${freelancerProfile.user?.stats?.completedProjects || 0}
Average Rating: ${freelancerProfile.user?.stats?.averageRating?.toFixed(1) || 'N/A'}
${portfolioContext}${experienceContext}

Return a JSON object with exactly these fields:
{
  "coverLetter": "The full proposal cover letter (250-400 words, professional, specific to this job, first person, compelling)",
  "suggestedPrice": {
    "amount": <number suggesting a competitive price within the job budget>,
    "type": "${job.budget.type}",
    "currency": "ETB"
  },
  "suggestedDelivery": {
    "value": <realistic delivery estimate>,
    "unit": "days" | "weeks"
  },
  "matchScore": <0-100 score based on skill match, experience, and portfolio relevance>,
  "reasoning": [<array of 2-4 strings explaining why this freelancer is a good match>],
  "relevantPortfolio": [<array of up to 3 most relevant portfolio items with title, technologies, projectUrl>]
}

IMPORTANT RULES:
- The cover letter must be 250-400 words, specific to this exact job
- Reference specific skills from the freelancer's profile that match the job
- Reference relevant portfolio projects when applicable
- Be professional but personable, avoid generic templates
- The suggested price should be competitive but within the job's budget range
- The matchScore should honestly reflect how well the freelancer's skills align
- Only return valid JSON, nothing else`;

    const result = await chatCompletion(
      'You are an expert freelance proposal writer and career consultant. Return only valid JSON.',
      prompt,
      0.7
    );

    const parsed = JSON.parse(result);

    return {
      coverLetter: parsed.coverLetter || fallbackProposal.coverLetter,
      suggestedPrice: {
        amount: parsed.suggestedPrice?.amount || fallbackProposal.suggestedPrice.amount,
        type: parsed.suggestedPrice?.type || job.budget.type,
        currency: parsed.suggestedPrice?.currency || 'ETB',
      },
      suggestedDelivery: {
        value: parsed.suggestedDelivery?.value || 14,
        unit: parsed.suggestedDelivery?.unit || 'days',
      },
      matchScore: Math.min(Math.max(parsed.matchScore || 0, 0), 100),
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : fallbackProposal.reasoning,
      relevantPortfolio: Array.isArray(parsed.relevantPortfolio) ? parsed.relevantPortfolio : fallbackProposal.relevantPortfolio,
    };
  }, fallbackProposal);
};

/**
 * Basic fraud/anomaly detection flag
 */
export const detectFraudSignals = async (user, action, metadata = {}) => {
  const signals = [];

  // Simple heuristic rules — no AI needed for basics
  if (action === 'payment' && metadata.amount > 10000) {
    signals.push({ type: 'high_value_transaction', severity: 'medium', message: 'Unusually high payment amount' });
  }

  if (action === 'registration' && metadata.ipCount > 5) {
    signals.push({ type: 'multiple_accounts', severity: 'high', message: 'Multiple registrations from same IP' });
  }

  if (action === 'withdrawal' && metadata.recentWithdrawals > 3) {
    signals.push({ type: 'rapid_withdrawal', severity: 'high', message: 'Multiple rapid withdrawals detected' });
  }

  return {
    isFlagged: signals.length > 0,
    signals,
    riskScore: Math.min(signals.length * 25, 100),
  };
};
