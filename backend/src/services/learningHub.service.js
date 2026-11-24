import { logger } from '../utils/logger.js';
import {
  LearningPlan, Profile, Job,
} from '../models/index.js';
import { chatJSON, isAIAvailable } from './aiClient.js';

const AI_AVAILABLE = isAIAvailable();

const LEVEL_ORDER = ['none', 'beginner', 'intermediate', 'advanced', 'expert'];

const levelIndex = (level) => {
  const i = LEVEL_ORDER.indexOf(level);
  return i >= 0 ? i : 0;
};

const gapSize = (current, target) => {
  const diff = levelIndex(target) - levelIndex(current);
  if (diff >= 3) return 'critical';
  if (diff === 2) return 'significant';
  if (diff === 1) return 'moderate';
  return 'minor';
};

const safeAI = async (fn, fallback) => {
  if (!AI_AVAILABLE) return fallback;
  try { return await fn(); } catch (err) {
    logger.error(`Learning Hub AI error: ${err.message}`);
    return fallback;
  }
};

// ─── Skill Gap Analysis ──────────────────────────────────────────────────────

export const analyzeSkillGaps = async (userId, targetRole = null) => {
  const profile = await Profile.findOne({ user: userId }).populate('user', 'firstName lastName role freelancerLevel');

  if (!profile) return null;

  const userSkills = (profile.skills || []).map(s => ({
    name: s.name,
    level: s.level,
    years: s.yearsOfExperience || 0,
  }));

  const verifiedSkills = [];

  const assessmentWeaknesses = [];
  const assessmentSkills = [];

  const demandedSkills = await getDemandedSkills();
  const skillDemandMap = {};
  demandedSkills.forEach(s => { skillDemandMap[s.name.toLowerCase()] = s.demand; });

  const skillLevels = {};
  userSkills.forEach(s => { skillLevels[s.name.toLowerCase()] = s.level; });

  const targetLevel = targetRole ? getTargetLevelForRole(targetRole) : 'intermediate';

  const skillGaps = [];
  const demandedNames = demandedSkills.map(s => s.name.toLowerCase());

  for (const skillName of demandedNames) {
    const currentLevel = skillLevels[skillName] || 'none';
    const target = targetLevel;
    if (levelIndex(currentLevel) < levelIndex(target)) {
      skillGaps.push({
        skill: demandedSkills.find(s => s.name.toLowerCase() === skillName)?.name || skillName,
        currentLevel,
        targetLevel: target,
        gapSize: gapSize(currentLevel, target),
        demandScore: skillDemandMap[skillName] || 50,
        priority: getPriority(currentLevel, target, skillDemandMap[skillName] || 50),
        reason: generateGapReason(skillName, currentLevel, target, skillDemandMap[skillName]),
        estimatedWeeks: estimateWeeks(currentLevel, target),
      });
    }
  }

  skillGaps.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
  });

  const strengths = userSkills
    .filter(s => levelIndex(s.level) >= 3)
    .map(s => s.name);

  return {
    userId,
    skills: userSkills,
    verifiedSkills,
    assessmentSkills,
    skillGaps,
    strengths,
    weaknesses: assessmentWeaknesses,
    demandedSkills: demandedSkills.slice(0, 20),
    targetRole,
  };
};

// ─── Course Recommendations ──────────────────────────────────────────────────

export const getCourseRecommendations = async (userId, targetRole = null) => {
  const gaps = await analyzeSkillGaps(userId, targetRole);
  if (!gaps || gaps.skillGaps.length === 0) return [];

  const courses = await safeAI(async () => {
    const gapSummary = gaps.skillGaps.slice(0, 8).map(g =>
      `${g.skill}: ${g.currentLevel} → ${g.targetLevel} (demand: ${g.demandScore}%, gap: ${g.gapSize})`
    ).join('\n');

    const prompt = `Recommend 15 online courses/certifications for a freelance developer to close their skill gaps.

Skill gaps (sorted by priority):
${gapSummary}

Current skills (highest): ${gaps.verifiedSkills.length > 0 ? gaps.verifiedSkills.map(v => v.skill).join(', ') : 'no verified skill levels recorded'}

Return JSON: [{
  "title": "Course Name",
  "provider": "Udemy/Coursery/etc",
  "url": "https://...",
  "duration": "4 weeks",
  "level": "intermediate",
  "rating": 4.7,
  "price": "2500 ETB",
  "skills": ["skill1", "skill2"],
  "description": "What this course covers",
  "category": "course|certification"
}]
Focus on high-quality, real courses. Include both free and paid options.`;

    const parsed = await chatJSON(
      'You are a tech education expert recommending courses for freelance developers. Return only valid JSON.',
      prompt,
      0.4,
      2500
    );
    return Array.isArray(parsed) ? parsed : (parsed.courses || []);
  }, generateFallbackCourses(gaps));

  return courses;
};

const generateFallbackCourses = (gaps) => {
  const courses = [];
  const providers = ['Udemy', 'Coursera', 'freeCodeCamp', 'Pluralsight', 'edX', 'LinkedIn Learning'];

  for (const gap of gaps.skillGaps.slice(0, 6)) {
    courses.push({
      title: `Mastering ${gap.skill}: ${gap.targetLevel} Level`,
      provider: providers[Math.floor(Math.random() * providers.length)],
      url: '',
      duration: `${gap.estimatedWeeks || 4} weeks`,
      level: gap.targetLevel,
      rating: 4.5,
      price: 'Varies',
      skills: [gap.skill],
      description: `Build ${gap.targetLevel}-level proficiency in ${gap.skill} through hands-on projects and exercises.`,
      category: 'course',
    });
  }

  return courses;
};

// ─── Certification Recommendations ───────────────────────────────────────────

export const getCertificationRecommendations = async (userId, targetRole = null) => {
  const gaps = await analyzeSkillGaps(userId, targetRole);
  if (!gaps) return [];

  const certs = await safeAI(async () => {
    const skillList = gaps.skillGaps.slice(0, 6).map(g => g.skill).join(', ');
    const currentCerts = [];

    const prompt = `Recommend 8 professional certifications for a freelance web developer.

Target role: ${targetRole || 'Full-Stack Web Developer'}
Skills to certify: ${skillList}
Current certifications: ${currentCerts.length > 0 ? currentCerts.join(', ') : 'None yet'}

Return JSON: [{
  "name": "Certification Name",
  "issuingOrg": "Organization",
  "url": "https://...",
  "validityPeriod": "3 years",
  "difficulty": "intermediate",
  "estimatedHours": 120,
  "skills": ["skill1"],
  "description": "What this cert covers",
  "prerequisites": ["prereq1"],
  "priority": "high"
}]
Focus on industry-recognized certifications.`;

    const parsed = await chatJSON(
      'You are a career advisor specializing in tech certifications. Return only valid JSON.',
      prompt,
      0.3,
      1500
    );
    return Array.isArray(parsed) ? parsed : (parsed.certifications || []);
  }, generateFallbackCerts(gaps));

  return certs;
};

const generateFallbackCerts = (gaps) => {
  const certMap = {
    javascript: { name: 'JavaScript Algorithms and Data Structures', org: 'freeCodeCamp', difficulty: 'intermediate' },
    react: { name: 'React Developer Certification', org: 'Meta', difficulty: 'intermediate' },
    node: { name: 'Node.js Application Developer', org: 'OpenJS Foundation', difficulty: 'intermediate' },
    python: { name: 'PCEP – Certified Entry-Level Python Programmer', org: 'Python Institute', difficulty: 'beginner' },
    typescript: { name: 'TypeScript Certification', org: 'W3Schools', difficulty: 'intermediate' },
    aws: { name: 'AWS Certified Cloud Practitioner', org: 'Amazon Web Services', difficulty: 'beginner' },
    docker: { name: 'Docker Certified Associate', org: 'Docker', difficulty: 'intermediate' },
  };

  return gaps.skillGaps.slice(0, 4).map(g => {
    const match = certMap[g.skill.toLowerCase()];
    return {
      name: match?.name || `${g.skill} Professional Certification`,
      issuingOrg: match?.org || 'Industry Standards Board',
      url: '',
      validityPeriod: '2-3 years',
      difficulty: match?.difficulty || g.targetLevel,
      estimatedHours: 100,
      skills: [g.skill],
      description: `Validate your ${g.skill} skills with an industry-recognized certification.`,
      prerequisites: [],
      priority: g.priority,
    };
  });
};

// ─── Learning Resources ──────────────────────────────────────────────────────

export const getLearningResources = async (userId, skill = null) => {
  const gaps = await analyzeSkillGaps(userId);
  if (!gaps) return [];

  const targetSkills = skill
    ? [skill]
    : gaps.skillGaps.slice(0, 5).map(g => g.skill);

  const resources = await safeAI(async () => {
    const prompt = `Recommend learning resources for a freelance developer.

Skills to learn: ${targetSkills.join(', ')}
User level context: Mostly ${gaps.skillGaps[0]?.currentLevel || 'beginner'} level

Return JSON: [{
  "title": "Resource Title",
  "type": "article|video|tutorial|book|documentation|podcast|tool|practice",
  "url": "https://...",
  "source": "Website/Platform",
  "duration": "30 min",
  "skills": ["skill1"],
  "description": "What this resource covers",
  "isFree": true,
  "rating": 4.5
}]
Include a mix of types: articles, videos, interactive tutorials, documentation, and practice platforms. Prioritize free resources.`;

    const parsed = await chatJSON(
      'You are a developer education expert. Return only valid JSON with curated learning resources.',
      prompt,
      0.4,
      2000
    );
    return Array.isArray(parsed) ? parsed : (parsed.resources || []);
  }, generateFallbackResources(targetSkills));

  return resources;
};

const generateFallbackResources = (skills) => {
  const resourceTemplates = {
    default: [
      { type: 'documentation', source: 'MDN Web Docs', isFree: true },
      { type: 'tutorial', source: 'freeCodeCamp', isFree: true },
      { type: 'video', source: 'YouTube', isFree: true },
      { type: 'practice', source: 'CodeWars', isFree: true },
    ],
  };

  const resources = [];
  for (const skill of skills) {
    const templates = resourceTemplates.default;
    for (const tmpl of templates) {
      resources.push({
        title: `Learn ${skill} - ${tmpl.source}`,
        type: tmpl.type,
        url: '',
        source: tmpl.source,
        duration: tmpl.type === 'video' ? '15-30 min' : 'Self-paced',
        skills: [skill],
        description: `${tmpl.type === 'documentation' ? 'Official docs' : tmpl.type === 'video' ? 'Video walkthrough' : 'Hands-on practice'} for ${skill}.`,
        isFree: tmpl.isFree,
        rating: 4.3,
      });
    }
  }
  return resources;
};

// ─── Generate Full Learning Plan ─────────────────────────────────────────────

export const generateLearningPlan = async (userId, { targetRole, goal, title }) => {
  const [gaps, courses, certs, resources] = await Promise.all([
    analyzeSkillGaps(userId, targetRole),
    getCourseRecommendations(userId, targetRole),
    getCertificationRecommendations(userId, targetRole),
    getLearningResources(userId),
  ]);

  if (!gaps) return null;

  const aiAnalysis = await safeAI(async () => {
    const prompt = `Analyze this developer's skill profile and generate career advice.

Current skills: ${gaps.skills.map(s => `${s.name} (${s.level})`).join(', ')}
Weaknesses: ${gaps.weaknesses.join(', ')}
Target role: ${targetRole || 'Full-Stack Developer'}
Skill gaps: ${gaps.skillGaps.length} gaps identified

Return JSON: {
  "overallReadiness": 65,
  "estimatedCompletionWeeks": 12,
  "focusAreas": ["Frontend Architecture", "System Design"],
  "careerAdvice": "Detailed advice paragraph...",
  "marketDemand": "high"
}`;

    const parsed = await chatJSON(
      'You are a senior tech career advisor. Return only valid JSON.',
      prompt,
      0.5,
      800
    );
    return parsed || null;
  }, {
    overallReadiness: calculateReadiness(gaps),
    estimatedCompletionWeeks: gaps.skillGaps.reduce((sum, g) => sum + (g.estimatedWeeks || 4), 0),
    focusAreas: gaps.skillGaps.slice(0, 3).map(g => g.skill),
    strengths: gaps.strengths,
    weaknesses: gaps.weaknesses,
    careerAdvice: `Focus on closing ${gaps.skillGaps.length} skill gaps, starting with ${gaps.skillGaps[0]?.skill || 'core skills'}.`,
    marketDemand: 'high',
  });

  const totalItems = (courses?.length || 0) + (certs?.length || 0) + (resources?.length || 0);

  const plan = await LearningPlan.create({
    user: userId,
    title: title || `Learning Plan: ${targetRole || 'Skill Growth'}`,
    description: goal || `Personalized learning plan to ${targetRole ? `become a ${targetRole}` : 'improve your skills'}`,
    goal: goal || '',
    targetRole: targetRole || '',
    skillGaps: gaps.skillGaps,
    courses: (courses || []).map(c => ({
      ...c,
      isCompleted: false,
      progress: 0,
    })),
    certifications: (certs || []).map(c => ({
      ...c,
      isCompleted: false,
    })),
    resources: (resources || []).map(r => ({
      ...r,
      isCompleted: false,
      isBookmarked: false,
    })),
    aiAnalysis: {
      overallReadiness: aiAnalysis.overallReadiness,
      estimatedCompletionWeeks: aiAnalysis.estimatedCompletionWeeks,
      focusAreas: aiAnalysis.focusAreas,
      strengths: aiAnalysis.strengths || gaps.strengths,
      weaknesses: aiAnalysis.weaknesses || gaps.weaknesses,
      careerAdvice: aiAnalysis.careerAdvice,
      marketDemand: aiAnalysis.marketDemand,
    },
    progress: {
      totalItems,
      completedItems: 0,
      percentage: 0,
    },
    generatedFrom: 'ai_analysis',
  });

  return plan;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getDemandedSkills = async () => {
  const jobs = await Job.find({ status: 'open' }).limit(100).lean();
  const counts = {};
  jobs.forEach(job => {
    (job.requiredSkills || []).forEach(skill => {
      const key = skill.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
  });

  const maxCount = Math.max(...Object.values(counts), 1);
  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      demand: Math.round((count / maxCount) * 100),
      count,
    }))
    .sort((a, b) => b.demand - a.demand);
};

const getTargetLevelForRole = (role) => {
  const roleLevels = {
    'junior developer': 'beginner',
    'mid-level developer': 'intermediate',
    'senior developer': 'advanced',
    'lead developer': 'expert',
    'full-stack developer': 'intermediate',
    'frontend developer': 'intermediate',
    'backend developer': 'intermediate',
    'devops engineer': 'intermediate',
    'mobile developer': 'intermediate',
  };
  return roleLevels[role.toLowerCase()] || 'intermediate';
};

const getPriority = (current, target, demand) => {
  const gap = levelIndex(target) - levelIndex(current);
  if (gap >= 3 || demand >= 80) return 'urgent';
  if (gap === 2 || demand >= 60) return 'high';
  if (gap === 1 || demand >= 40) return 'medium';
  return 'low';
};

const generateGapReason = (skill, current, target, demand) => {
  if (current === 'none') return `${skill} is not in your skillset but is in ${demand}% of open jobs`;
  return `Your ${current} level in ${skill} needs to reach ${target} to be competitive (${demand}% market demand)`;
};

const estimateWeeks = (current, target) => {
  const diff = levelIndex(target) - levelIndex(current);
  return Math.max(diff * 3, 2);
};

const calculateReadiness = (gaps) => {
  if (gaps.skillGaps.length === 0) return 95;
  const totalDemand = gaps.skillGaps.reduce((sum, g) => sum + g.demandScore, 0);
  const avgDemand = totalDemand / gaps.skillGaps.length;
  return Math.max(10, Math.round(100 - avgDemand * 0.7));
};

// ─── Progress Tracking ───────────────────────────────────────────────────────

export const updateItemProgress = async (userId, planId, itemType, itemId, updates) => {
  const plan = await LearningPlan.findOne({ _id: planId, user: userId });
  if (!plan) return null;

  const arrayField = {
    course: 'courses',
    certification: 'certifications',
    resource: 'resources',
  }[itemType];

  if (!arrayField) return null;

  const item = plan[arrayField].id(itemId);
  if (!item) return null;

  Object.assign(item, updates);
  if (updates.isCompleted && !item.completedAt) {
    item.completedAt = new Date();
  }

  const allItems = [
    ...plan.courses,
    ...plan.certifications,
    ...plan.resources,
  ];
  const completed = allItems.filter(i => i.isCompleted).length;
  plan.progress = {
    totalItems: allItems.length,
    completedItems: completed,
    percentage: allItems.length > 0 ? Math.round((completed / allItems.length) * 100) : 0,
  };

  if (plan.progress.percentage === 100) {
    plan.status = 'completed';
    plan.completedAt = new Date();
  }

  await plan.save();
  return plan;
};
