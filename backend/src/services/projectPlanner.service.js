import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { chatCompletion, isAIAvailable } from './aiClient.js';

const AI_AVAILABLE = isAIAvailable();

const safeAICall = async (fn, fallback) => {
  if (!AI_AVAILABLE) return fallback;
  try {
    return await fn();
  } catch (err) {
    logger.error(`Project planner AI error: ${err.message}`);
    return fallback;
  }
};

function generateFallbackPlan(description, projectName, budget, deadline) {
  const wordCount = description.split(/\s+/).length;
  const complexity = wordCount > 300 ? 'high' : wordCount > 100 ? 'medium' : 'low';

  const milestones = complexity === 'high'
    ? [
        {
          title: 'Discovery & Planning',
          description: 'Requirements gathering, technical research, and project setup',
          order: 0,
          estimatedDuration: 1,
          durationUnit: 'weeks',
          tasks: [
            { title: 'Gather and document requirements', description: 'Collect all project requirements', priority: 'high', estimatedHours: 8, dependencies: [], tags: ['planning'] },
            { title: 'Technical architecture design', description: 'Design system architecture', priority: 'high', estimatedHours: 12, dependencies: ['Gather and document requirements'], tags: ['planning'] },
            { title: 'Project setup and scaffolding', description: 'Initialize project structure', priority: 'medium', estimatedHours: 4, dependencies: [], tags: ['setup'] },
          ],
          totalEstimatedHours: 24,
          keyDeliverables: ['Requirements document', 'Technical architecture', 'Project scaffold'],
        },
        {
          title: 'Design Phase',
          description: 'UI/UX design and prototyping',
          order: 1,
          estimatedDuration: 2,
          durationUnit: 'weeks',
          tasks: [
            { title: 'Create wireframes', description: 'Design wireframes for all pages', priority: 'high', estimatedHours: 16, dependencies: [], tags: ['design'] },
            { title: 'Design UI mockups', description: 'Create high-fidelity mockups', priority: 'high', estimatedHours: 20, dependencies: ['Create wireframes'], tags: ['design'] },
            { title: 'Design review and iteration', description: 'Review and refine designs', priority: 'medium', estimatedHours: 8, dependencies: ['Design UI mockups'], tags: ['design'] },
          ],
          totalEstimatedHours: 44,
          keyDeliverables: ['Wireframes', 'UI mockups', 'Design system'],
        },
        {
          title: 'Core Development',
          description: 'Main feature implementation',
          order: 2,
          estimatedDuration: 3,
          durationUnit: 'weeks',
          tasks: [
            { title: 'Backend API development', description: 'Build core API endpoints', priority: 'high', estimatedHours: 30, dependencies: [], tags: ['backend'] },
            { title: 'Frontend implementation', description: 'Build UI components and pages', priority: 'high', estimatedHours: 30, dependencies: ['Backend API development'], tags: ['frontend'] },
            { title: 'Database design and implementation', description: 'Set up database schemas', priority: 'high', estimatedHours: 10, dependencies: [], tags: ['backend'] },
            { title: 'Authentication and authorization', description: 'Implement auth system', priority: 'medium', estimatedHours: 10, dependencies: ['Backend API development'], tags: ['backend'] },
          ],
          totalEstimatedHours: 80,
          keyDeliverables: ['Working API', 'Frontend application', 'Database'],
        },
        {
          title: 'Testing & QA',
          description: 'Quality assurance and bug fixes',
          order: 3,
          estimatedDuration: 1,
          durationUnit: 'weeks',
          tasks: [
            { title: 'Write unit tests', description: 'Create unit test suite', priority: 'medium', estimatedHours: 12, dependencies: [], tags: ['testing'] },
            { title: 'Integration testing', description: 'Test all integrations', priority: 'high', estimatedHours: 8, dependencies: ['Write unit tests'], tags: ['testing'] },
            { title: 'Bug fixes and polish', description: 'Fix identified issues', priority: 'high', estimatedHours: 8, dependencies: ['Integration testing'], tags: ['testing'] },
          ],
          totalEstimatedHours: 28,
          keyDeliverables: ['Test suite', 'Bug-free application'],
        },
        {
          title: 'Deployment & Launch',
          description: 'Production deployment and go-live',
          order: 4,
          estimatedDuration: 1,
          durationUnit: 'weeks',
          tasks: [
            { title: 'Production environment setup', description: 'Configure production servers', priority: 'high', estimatedHours: 6, dependencies: [], tags: ['devops'] },
            { title: 'Deploy to production', description: 'Deploy application', priority: 'high', estimatedHours: 4, dependencies: ['Production environment setup'], tags: ['devops'] },
            { title: 'Post-launch monitoring', description: 'Monitor and fix issues', priority: 'medium', estimatedHours: 4, dependencies: ['Deploy to production'], tags: ['devops'] },
          ],
          totalEstimatedHours: 14,
          keyDeliverables: ['Production deployment', 'Monitoring setup'],
        },
      ]
    : complexity === 'medium'
      ? [
          {
            title: 'Planning & Design',
            description: 'Requirements and UI design',
            order: 0,
            estimatedDuration: 1,
            durationUnit: 'weeks',
            tasks: [
              { title: 'Define requirements', description: 'Document all requirements', priority: 'high', estimatedHours: 6, dependencies: [], tags: ['planning'] },
              { title: 'Create wireframes', description: 'Design page layouts', priority: 'medium', estimatedHours: 8, dependencies: [], tags: ['design'] },
              { title: 'Set up project', description: 'Initialize codebase', priority: 'medium', estimatedHours: 3, dependencies: [], tags: ['setup'] },
            ],
            totalEstimatedHours: 17,
            keyDeliverables: ['Requirements', 'Wireframes', 'Project setup'],
          },
          {
            title: 'Development',
            description: 'Core feature implementation',
            order: 1,
            estimatedDuration: 2,
            durationUnit: 'weeks',
            tasks: [
              { title: 'Build backend', description: 'Implement API and database', priority: 'high', estimatedHours: 20, dependencies: [], tags: ['backend'] },
              { title: 'Build frontend', description: 'Implement UI', priority: 'high', estimatedHours: 20, dependencies: ['Build backend'], tags: ['frontend'] },
              { title: 'Integration', description: 'Connect frontend and backend', priority: 'medium', estimatedHours: 6, dependencies: ['Build backend', 'Build frontend'], tags: ['integration'] },
            ],
            totalEstimatedHours: 46,
            keyDeliverables: ['Working application'],
          },
          {
            title: 'Testing & Launch',
            description: 'QA and deployment',
            order: 2,
            estimatedDuration: 1,
            durationUnit: 'weeks',
            tasks: [
              { title: 'Testing and bug fixes', description: 'QA and fixes', priority: 'high', estimatedHours: 8, dependencies: [], tags: ['testing'] },
              { title: 'Deploy to production', description: 'Go live', priority: 'high', estimatedHours: 4, dependencies: ['Testing and bug fixes'], tags: ['devops'] },
            ],
            totalEstimatedHours: 12,
            keyDeliverables: ['Tested app', 'Production deployment'],
          },
        ]
      : [
          {
            title: 'Setup & Design',
            description: 'Quick setup and design',
            order: 0,
            estimatedDuration: 3,
            durationUnit: 'days',
            tasks: [
              { title: 'Requirements and design', description: 'Define what to build', priority: 'high', estimatedHours: 4, dependencies: [], tags: ['planning'] },
              { title: 'Project setup', description: 'Initialize project', priority: 'medium', estimatedHours: 2, dependencies: [], tags: ['setup'] },
            ],
            totalEstimatedHours: 6,
            keyDeliverables: ['Project plan', 'Scaffolded project'],
          },
          {
            title: 'Development',
            description: 'Build the application',
            order: 1,
            estimatedDuration: 1,
            durationUnit: 'weeks',
            tasks: [
              { title: 'Implement features', description: 'Build all features', priority: 'high', estimatedHours: 16, dependencies: [], tags: ['development'] },
              { title: 'Basic testing', description: 'Test the application', priority: 'medium', estimatedHours: 4, dependencies: ['Implement features'], tags: ['testing'] },
            ],
            totalEstimatedHours: 20,
            keyDeliverables: ['Working application'],
          },
          {
            title: 'Launch',
            description: 'Deploy and go live',
            order: 2,
            estimatedDuration: 1,
            durationUnit: 'days',
            tasks: [
              { title: 'Deploy', description: 'Deploy to production', priority: 'high', estimatedHours: 3, dependencies: [], tags: ['devops'] },
            ],
            totalEstimatedHours: 3,
            keyDeliverables: ['Live application'],
          },
        ];

  const totalHours = milestones.reduce((sum, m) => sum + m.totalEstimatedHours, 0);
  const totalWeeks = milestones.reduce((sum, m) => {
    const dur = m.durationUnit === 'weeks' ? m.estimatedDuration : m.durationUnit === 'days' ? m.estimatedDuration / 5 : m.estimatedDuration / 20;
    return sum + dur;
  }, 0);

  return {
    milestones,
    totalEstimatedHours: totalHours,
    totalMilestones: milestones.length,
    totalTasks: milestones.reduce((sum, m) => sum + m.tasks.length, 0),
    effortBreakdown: {
      planning: Math.round(totalHours * 0.1),
      design: Math.round(totalHours * 0.15),
      development: Math.round(totalHours * 0.5),
      testing: Math.round(totalHours * 0.15),
      deployment: Math.round(totalHours * 0.1),
      total: totalHours,
    },
    estimatedTimelineWeeks: Math.ceil(totalWeeks),
    reasoning: ['Generated using heuristic analysis (AI unavailable)'],
    assumptions: ['Standard web development project', 'Single developer'],
    criticalPath: milestones.map(m => m.title),
    riskFactors: ['Scope changes may extend timeline', 'Complex integrations may require additional time'],
  };
}

export const generateProjectPlan = async (description, options = {}) => {
  const { projectName, budget, deadline, teamSize } = options;

  const fallback = generateFallbackPlan(description, projectName, budget, deadline);

  return safeAICall(async () => {
    const constraints = [];
    if (budget) constraints.push(`Budget: ${budget.toLocaleString()} ETB`);
    if (deadline) constraints.push(`Deadline: ${new Date(deadline).toLocaleDateString()}`);
    if (teamSize) constraints.push(`Team Size: ${teamSize} people`);

    const prompt = `
You are an expert software project manager. Break down the following project into a detailed execution plan with milestones, tasks, timelines, and effort estimates.

PROJECT DESCRIPTION:
"${description.substring(0, 3000)}"
${projectName ? `Project Name: "${projectName}"` : ''}
${constraints.length > 0 ? `Constraints:\n${constraints.map(c => `- ${c}`).join('\n')}` : ''}

Analyze this project and return a JSON object with EXACTLY these fields:

{
  "milestones": [
    {
      "title": "<milestone name>",
      "description": "<what this milestone achieves>",
      "order": <0-based sequence>,
      "estimatedDuration": <number>,
      "durationUnit": "<hours|days|weeks>",
      "tasks": [
        {
          "title": "<task name>",
          "description": "<what this task involves>",
          "priority": "<low|medium|high|urgent>",
          "estimatedHours": <number>,
          "dependencies": [<array of task titles this depends on>],
          "tags": [<relevant tags like frontend, backend, design, testing, devops>]
        }
      ],
      "totalEstimatedHours": <sum of task hours in this milestone>,
      "keyDeliverables": [<array of 2-4 key outputs>]
    }
  ],
  "totalEstimatedHours": <sum across all milestones>,
  "totalMilestones": <count>,
  "totalTasks": <count across all milestones>,
  "effortBreakdown": {
    "planning": <hours>,
    "design": <hours>,
    "development": <hours>,
    "testing": <hours>,
    "deployment": <hours>,
    "total": <sum of above>
  },
  "estimatedTimelineWeeks": <total duration in weeks>,
  "reasoning": [<array of 2-4 strings explaining your plan decisions>],
  "assumptions": [<array of assumptions made>],
  "criticalPath": [<array of milestone titles in critical path order>],
  "riskFactors": [<array of 2-4 risk factors to be aware of>]
}

IMPORTANT RULES:
- Break the project into 3-7 logical milestones
- Each milestone should have 2-6 actionable tasks
- Tasks should have realistic hour estimates (not just round numbers)
- Dependencies should reference actual task titles from the same or earlier milestones
- The effort breakdown should sum to approximately totalEstimatedHours
- Timeline should be realistic for the team size and complexity
- Tasks should be specific and actionable, not vague
- Prioritize tasks: critical path tasks should be high priority
- Only return valid JSON, nothing else`;

    const result = await chatCompletion(
      'You are an expert software project manager and technical lead. Return only valid JSON.',
      prompt,
      0.3,
      3000
    );

    const parsed = JSON.parse(result);

    const milestones = Array.isArray(parsed.milestones)
      ? parsed.milestones.map((m, i) => ({
          title: m.title || `Milestone ${i + 1}`,
          description: m.description || '',
          order: m.order ?? i,
          estimatedDuration: Math.max(m.estimatedDuration || 1, 1),
          durationUnit: ['hours', 'days', 'weeks'].includes(m.durationUnit) ? m.durationUnit : 'days',
          tasks: Array.isArray(m.tasks)
            ? m.tasks.map(t => ({
                title: t.title || 'Task',
                description: t.description || '',
                priority: ['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium',
                estimatedHours: Math.max(t.estimatedHours || 0, 0),
                dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
                tags: Array.isArray(t.tags) ? t.tags : [],
              }))
            : [],
          totalEstimatedHours: m.totalEstimatedHours || 0,
          keyDeliverables: Array.isArray(m.keyDeliverables) ? m.keyDeliverables : [],
        }))
      : fallback.milestones;

    const totalHours = parsed.totalEstimatedHours || milestones.reduce((s, m) => s + m.totalEstimatedHours, 0);

    return {
      milestones,
      totalEstimatedHours: totalHours,
      totalMilestones: milestones.length,
      totalTasks: milestones.reduce((s, m) => s + m.tasks.length, 0),
      effortBreakdown: {
        planning: parsed.effortBreakdown?.planning || Math.round(totalHours * 0.1),
        design: parsed.effortBreakdown?.design || Math.round(totalHours * 0.15),
        development: parsed.effortBreakdown?.development || Math.round(totalHours * 0.5),
        testing: parsed.effortBreakdown?.testing || Math.round(totalHours * 0.15),
        deployment: parsed.effortBreakdown?.deployment || Math.round(totalHours * 0.1),
        total: totalHours,
      },
      estimatedTimelineWeeks: parsed.estimatedTimelineWeeks || Math.ceil(totalHours / 20),
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : fallback.reasoning,
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : fallback.assumptions,
      criticalPath: Array.isArray(parsed.criticalPath) ? parsed.criticalPath : fallback.criticalPath,
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : fallback.riskFactors,
    };
  }, fallback);
};
