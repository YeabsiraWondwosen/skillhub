import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { chatCompletion, isAIAvailable } from './aiClient.js';

const AI_AVAILABLE = isAIAvailable();

const safeAICall = async (fn, fallback) => {
  if (!AI_AVAILABLE) return fallback;
  try {
    return await fn();
  } catch (err) {
    logger.error(`Cost estimator AI error: ${err.message}`);
    return fallback;
  }
};

const COMPLEXITY_KEYWORDS = {
  high: ['blockchain', 'ai', 'ml', 'machine learning', 'real-time', 'video', 'streaming', 'payment', 'enterprise', 'microservices', 'distributed', 'iot', 'ar', 'vr', '3d'],
  medium: ['api', 'database', 'authentication', 'search', 'analytics', 'notification', 'email', 'upload', 'dashboard', 'admin', 'e-commerce', 'cart', 'checkout'],
  low: ['landing', 'blog', 'portfolio', 'static', 'form', 'cms', 'content', 'page', 'display', 'ui'],
};

function estimateComplexity(description) {
  const lower = description.toLowerCase();
  let score = 5;

  for (const keywords of Object.values(COMPLEXITY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
  }

  const wordCount = description.split(/\s+/).length;
  if (wordCount > 200) score += 1;
  if (wordCount > 500) score += 1;
  if (lower.includes('full-stack') || lower.includes('fullstack')) score += 2;

  return Math.min(Math.max(score, 1), 10);
}

function generateFallbackEstimate(description) {
  const complexity = estimateComplexity(description);
  const baseBudget = complexity * 500;
  const baseWeeks = Math.max(complexity * 0.8, 1);

  return {
    budget: {
      min: Math.round(baseBudget * 0.7),
      max: Math.round(baseBudget * 1.5),
      recommended: Math.round(baseBudget),
      currency: 'ETB',
      confidence: 40,
    },
    technologies: [
      { name: 'React', category: 'frontend', purpose: 'Frontend UI framework', essential: true },
      { name: 'Node.js', category: 'backend', purpose: 'Backend runtime', essential: true },
      { name: 'MongoDB', category: 'database', purpose: 'Data storage', essential: true },
    ],
    timeline: {
      optimistic: Math.round(baseWeeks * 0.7),
      realistic: Math.round(baseWeeks),
      pessimistic: Math.round(baseWeeks * 1.5),
      unit: 'weeks',
      phases: [
        { name: 'Planning & Design', duration: Math.max(1, Math.round(baseWeeks * 0.15)), unit: 'weeks', description: 'Requirements gathering and design' },
        { name: 'Development', duration: Math.max(2, Math.round(baseWeeks * 0.6)), unit: 'weeks', description: 'Core development work' },
        { name: 'Testing & QA', duration: Math.max(1, Math.round(baseWeeks * 0.15)), unit: 'weeks', description: 'Quality assurance and bug fixes' },
        { name: 'Deployment', duration: Math.max(1, Math.round(baseWeeks * 0.1)), unit: 'weeks', description: 'Production deployment and launch' },
      ],
    },
    team: {
      size: complexity > 7 ? 4 : complexity > 4 ? 2 : 1,
      composition: complexity > 7 ? 'Full team with frontend, backend, designer, and PM' : complexity > 4 ? 'Small team with frontend and backend developers' : 'Solo developer',
      roles: complexity > 7
        ? [
            { role: 'Frontend Developer', count: 1, skillLevel: 'senior', hourlyRateRange: { min: 50, max: 120 } },
            { role: 'Backend Developer', count: 1, skillLevel: 'senior', hourlyRateRange: { min: 60, max: 130 } },
            { role: 'UI/UX Designer', count: 1, skillLevel: 'mid', hourlyRateRange: { min: 40, max: 90 } },
            { role: 'Project Manager', count: 1, skillLevel: 'mid', hourlyRateRange: { min: 35, max: 70 } },
          ]
        : complexity > 4
          ? [
              { role: 'Full-Stack Developer', count: 1, skillLevel: 'senior', hourlyRateRange: { min: 50, max: 120 } },
              { role: 'Frontend Developer', count: 1, skillLevel: 'mid', hourlyRateRange: { min: 35, max: 80 } },
            ]
          : [
              { role: 'Full-Stack Developer', count: 1, skillLevel: 'mid', hourlyRateRange: { min: 30, max: 70 } },
            ],
    },
    costBreakdown: {
      development: Math.round(baseBudget * 0.55),
      design: Math.round(baseBudget * 0.15),
      testing: Math.round(baseBudget * 0.12),
      projectManagement: Math.round(baseBudget * 0.08),
      infrastructure: Math.round(baseBudget * 0.05),
      thirdPartyServices: Math.round(baseBudget * 0.03),
      contingency: Math.round(baseBudget * 0.1),
      total: Math.round(baseBudget * 1.08),
    },
    risks: [
      {
        title: 'Scope Creep',
        description: 'Project requirements may expand beyond initial scope',
        impact: 'medium',
        probability: 'high',
        mitigation: 'Define clear requirements and use change management process',
      },
    ],
    reasoning: ['Generated using heuristic complexity analysis (AI unavailable)'],
    assumptions: ['Standard web development project', 'US-based team rates'],
    suggestions: ['Consider starting with an MVP to reduce initial cost'],
    complexityScore: complexity,
  };
}

export const estimateProjectCost = async (description, projectName) => {
  const complexity = estimateComplexity(description);

  const fallback = generateFallbackEstimate(description);

  return safeAICall(async () => {
    const prompt = `
You are an expert software project estimator and technical architect. Analyze the following project description and provide a detailed cost estimate.

PROJECT DESCRIPTION:
"${description.substring(0, 2000)}"
${projectName ? `Project Name: "${projectName}"` : ''}

Analyze this project thoroughly and return a JSON object with EXACTLY these fields:

{
  "budget": {
    "min": <minimum realistic budget in ETB>,
    "max": <maximum realistic budget in ETB>,
    "recommended": <recommended budget in ETB>,
    "currency": "ETB",
    "confidence": <0-100 confidence score>
  },
  "technologies": [
    {
      "name": "<technology name>",
      "category": "<frontend|backend|database|devops|mobile|ai_ml|other>",
      "purpose": "<why this technology is needed>",
      "essential": <true/false>
    }
  ],
  "timeline": {
    "optimistic": <best case duration>,
    "realistic": <most likely duration>,
    "pessimistic": <worst case duration>,
    "unit": "<hours|days|weeks|months>",
    "phases": [
      {
        "name": "<phase name>",
        "duration": <duration number>,
        "unit": "<hours|days|weeks|months>",
        "description": "<what happens in this phase>"
      }
    ]
  },
  "team": {
    "size": <recommended team size>,
    "composition": "<brief description of team makeup>",
    "roles": [
      {
        "role": "<role title>",
        "count": <number of people>,
        "skillLevel": "<junior|mid|senior|lead>",
        "hourlyRateRange": {
          "min": <minimum hourly rate in ETB>,
          "max": <maximum hourly rate in ETB>
        }
      }
    ]
  },
  "costBreakdown": {
    "development": <cost>,
    "design": <cost>,
    "testing": <cost>,
    "projectManagement": <cost>,
    "infrastructure": <cost>,
    "thirdPartyServices": <cost>,
    "contingency": <cost>,
    "total": <sum of all above>
  },
  "risks": [
    {
      "title": "<risk title>",
      "description": "<risk description>",
      "impact": "<low|medium|high|critical>",
      "probability": "<low|medium|high>",
      "mitigation": "<how to mitigate>"
    }
  ],
  "reasoning": [<array of 2-4 strings explaining your analysis>],
  "assumptions": [<array of assumptions made>],
  "suggestions": [<array of 2-4 actionable suggestions>]
}

IMPORTANT RULES:
- Budget estimates should be realistic for US market rates (2024-2025)
- Technologies should be specific and relevant to the project type
- Timeline phases should sum to approximately the realistic timeline
- Team size should match the complexity and timeline
- Cost breakdown items should sum to approximately the total budget
- Include at least 2 risks with mitigations
- Be specific about technologies: mention specific frameworks, tools, and services
- Only return valid JSON, nothing else`;

    const result = await chatCompletion(
      'You are an expert software project estimator specializing in web and mobile development. Return only valid JSON.',
      prompt,
      0.4,
      2500
    );

    const parsed = JSON.parse(result);

    return {
      budget: {
        min: Math.max(parsed.budget?.min || 0, 0),
        max: Math.max(parsed.budget?.max || 0, 0),
        recommended: Math.max(parsed.budget?.recommended || 0, 0),
        currency: parsed.budget?.currency || 'ETB',
        confidence: Math.min(Math.max(parsed.budget?.confidence || 50, 0), 100),
      },
      technologies: Array.isArray(parsed.technologies) ? parsed.technologies.map(t => ({
        name: t.name || 'Unknown',
        category: ['frontend', 'backend', 'database', 'devops', 'mobile', 'ai_ml', 'other'].includes(t.category) ? t.category : 'other',
        purpose: t.purpose || '',
        essential: Boolean(t.essential),
      })) : fallback.technologies,
      timeline: {
        optimistic: Math.max(parsed.timeline?.optimistic || 1, 1),
        realistic: Math.max(parsed.timeline?.realistic || 1, 1),
        pessimistic: Math.max(parsed.timeline?.pessimistic || 1, 1),
        unit: ['hours', 'days', 'weeks', 'months'].includes(parsed.timeline?.unit) ? parsed.timeline.unit : 'weeks',
        phases: Array.isArray(parsed.timeline?.phases) ? parsed.timeline.phases.map(p => ({
          name: p.name || 'Phase',
          duration: Math.max(p.duration || 1, 0),
          unit: ['hours', 'days', 'weeks', 'months'].includes(p.unit) ? p.unit : 'weeks',
          description: p.description || '',
        })) : fallback.timeline.phases,
      },
      team: {
        size: Math.max(parsed.team?.size || 1, 1),
        composition: parsed.team?.composition || 'Development team',
        roles: Array.isArray(parsed.team?.roles) ? parsed.team.roles.map(r => ({
          role: r.role || 'Developer',
          count: Math.max(r.count || 1, 1),
          skillLevel: ['junior', 'mid', 'senior', 'lead'].includes(r.skillLevel) ? r.skillLevel : 'mid',
          hourlyRateRange: {
            min: r.hourlyRateRange?.min || 30,
            max: r.hourlyRateRange?.max || 80,
          },
        })) : fallback.team.roles,
      },
      costBreakdown: {
        development: parsed.costBreakdown?.development || 0,
        design: parsed.costBreakdown?.design || 0,
        testing: parsed.costBreakdown?.testing || 0,
        projectManagement: parsed.costBreakdown?.projectManagement || 0,
        infrastructure: parsed.costBreakdown?.infrastructure || 0,
        thirdPartyServices: parsed.costBreakdown?.thirdPartyServices || 0,
        contingency: parsed.costBreakdown?.contingency || 0,
        total: parsed.costBreakdown?.total || parsed.budget?.recommended || 0,
      },
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5).map(r => ({
        title: r.title || 'Unknown Risk',
        description: r.description || '',
        impact: ['low', 'medium', 'high', 'critical'].includes(r.impact) ? r.impact : 'medium',
        probability: ['low', 'medium', 'high'].includes(r.probability) ? r.probability : 'medium',
        mitigation: r.mitigation || '',
      })) : fallback.risks,
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : fallback.reasoning,
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : fallback.assumptions,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : fallback.suggestions,
      complexityScore: complexity,
    };
  }, fallback);
};

export const estimateCostFromJob = async (job) => {
  const description = `Job: ${job.title}\n\nDescription: ${job.description}\n\nRequired Skills: ${job.requiredSkills?.join(', ') || 'N/A'}\nBudget: ${job.budget?.type || 'fixed'} ${job.budget?.maxAmount || 0} ETB\nExperience Level: ${job.experienceLevel || 'intermediate'}\nDuration: ${job.duration || 'Not specified'}`;

  return estimateProjectCost(description, job.title);
};
