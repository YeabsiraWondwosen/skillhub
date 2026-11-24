import { logger } from '../utils/logger.js';
import { InterviewSession } from '../models/index.js';
import { chatJSON, isAIAvailable } from './aiClient.js';

const AI_AVAILABLE = isAIAvailable();

const safeAI = async (fn, fallback) => {
  if (!AI_AVAILABLE) return fallback;
  try { return await fn(); } catch (err) {
    logger.error(`Interview AI error: ${err.message}`);
    return fallback;
  }
};

const generateId = () => Math.random().toString(36).substring(2, 10);

// ─── Generate Interview Questions ────────────────────────────────────────────

export const generateQuestions = async ({
  skills, interviewType, difficulty, count = 5, jobDescription, focusAreas,
}) => {
  const questionCount = Math.min(Math.max(count, 1), 20);

  const questions = await safeAI(async () => {
    const prompt = `Generate ${questionCount} interview questions for a ${difficulty}-level ${interviewType} interview.

${skills?.length ? `Skills to assess: ${skills.join(', ')}` : ''}
${jobDescription ? `Job context: ${jobDescription.substring(0, 500)}` : ''}
${focusAreas?.length ? `Focus areas: ${focusAreas.join(', ')}` : ''}

Return JSON: [{
  "text": "The question text",
  "type": "behavioral|technical|situational|problem_solving|system_design|culture_fit",
  "difficulty": "easy|medium|hard",
  "expectedAnswer": "What a good answer should include (2-3 sentences)",
  "followUp": "A follow-up question to probe deeper",
  "scoringCriteria": ["criteria1", "criteria2", "criteria3"]
}]

Mix question types appropriately for ${interviewType} interviews. Be specific and role-relevant.`;

    const parsed = await chatJSON(
      'You are an expert technical interviewer. Return only valid JSON.',
      prompt,
      0.5,
      3000
    );
    return (Array.isArray(parsed) ? parsed : (parsed.questions || [])).map(q => ({
      ...q,
      id: generateId(),
      score: null,
      candidateAnswer: '',
      scoreReasoning: '',
    }));
  }, generateFallbackQuestions(skills, interviewType, difficulty, questionCount));

  return questions;
};

const generateFallbackQuestions = (skills, type, difficulty, count) => {
  const templates = {
    behavioral: [
      { text: 'Tell me about a time you had to resolve a conflict with a team member.', type: 'behavioral', expectedAnswer: 'Look for STAR method usage, specific examples, and constructive resolution.', scoringCriteria: ['Uses STAR method', 'Shows empathy', 'Positive outcome'] },
      { text: 'Describe a project where you had to learn a new technology quickly.', type: 'behavioral', expectedAnswer: 'Assess learning approach, resourcefulness, and application.', scoringCriteria: ['Self-directed learning', 'Applied to project', 'Result achieved'] },
      { text: 'How do you handle tight deadlines and competing priorities?', type: 'behavioral', expectedAnswer: 'Look for prioritization skills, communication, and stress management.', scoringCriteria: ['Clear prioritization', 'Stakeholder communication', 'Quality maintenance'] },
      { text: 'Tell me about your greatest professional achievement.', type: 'behavioral', expectedAnswer: 'Should demonstrate impact, technical skill, and teamwork.', scoringCriteria: ['Clear impact', 'Technical depth', 'Team contribution'] },
      { text: 'Describe a time you made a mistake at work. How did you handle it?', type: 'behavioral', expectedAnswer: 'Look for accountability, learning, and prevention measures.', scoringCriteria: ['Ownership', 'Learning from mistake', 'Prevention'] },
    ],
    technical: [
      { text: `Explain the difference between ${skills?.[0] || 'REST'} and GraphQL. When would you use each?`, type: 'technical', expectedAnswer: 'Should cover trade-offs, use cases, and real experience.', scoringCriteria: ['Technical accuracy', 'Practical experience', 'Trade-off awareness'] },
      { text: 'How do you ensure code quality in your projects?', type: 'technical', expectedAnswer: 'Look for testing, linting, code review, and CI/CD practices.', scoringCriteria: ['Testing strategy', 'Code review', 'Automation'] },
      { text: 'Explain how you would design a scalable API for a social media platform.', type: 'system_design', expectedAnswer: 'Should discuss architecture, caching, database design, and scaling strategies.', scoringCriteria: ['Architecture thinking', 'Scalability awareness', 'Trade-off discussion'] },
      { text: 'What is your approach to debugging a complex issue in production?', type: 'technical', expectedAnswer: 'Should mention logging, monitoring, reproduction, and root cause analysis.', scoringCriteria: ['Systematic approach', 'Tool knowledge', 'Communication'] },
      { text: 'How do you approach performance optimization in web applications?', type: 'technical', expectedAnswer: 'Should discuss profiling, metrics, lazy loading, caching, etc.', scoringCriteria: ['Measurement first', 'Optimization techniques', 'Impact assessment'] },
    ],
    mixed: [
      { text: 'Walk me through your development process for a new feature.', type: 'problem_solving', expectedAnswer: 'Should cover requirements, design, implementation, testing, deployment.', scoringCriteria: ['Process thinking', 'Quality focus', 'Collaboration'] },
      { text: `What is the most challenging ${skills?.[0] || 'technical'} problem you have solved recently?`, type: 'technical', expectedAnswer: 'Look for depth of understanding and problem-solving approach.', scoringCriteria: ['Technical depth', 'Problem decomposition', 'Solution quality'] },
      { text: 'How do you stay up-to-date with new technologies?', type: 'culture_fit', expectedAnswer: 'Should show genuine curiosity and learning habits.', scoringCriteria: ['Continuous learning', 'Community involvement', 'Application'] },
      { text: 'Describe your ideal work environment.', type: 'culture_fit', expectedAnswer: 'Look for alignment with team culture and self-awareness.', scoringCriteria: ['Self-awareness', 'Team orientation', 'Growth mindset'] },
      { text: 'Tell me about a time you disagreed with a technical decision. What did you do?', type: 'behavioral', expectedAnswer: 'Should demonstrate constructive disagreement and respect.', scoringCriteria: ['Constructive approach', 'Data-driven', 'Respectful resolution'] },
    ],
  };

  const pool = templates[type] || templates.mixed;
  return pool.slice(0, count).map(q => ({
    ...q,
    id: generateId(),
    difficulty: difficulty === 'junior' ? 'easy' : difficulty === 'senior' ? 'hard' : 'medium',
    followUp: '',
    score: null,
    candidateAnswer: '',
    scoreReasoning: '',
  }));
};

// ─── Generate Coding Challenge ───────────────────────────────────────────────

export const generateCodingChallenge = async ({
  skills, difficulty, type = 'algorithm', language = 'javascript', jobDescription,
}) => {
  const challenge = await safeAI(async () => {
    const prompt = `Generate a ${difficulty}-level ${type} coding challenge.

${skills?.length ? `Related skills: ${skills.join(', ')}` : ''}
${jobDescription ? `Job context: ${jobDescription.substring(0, 500)}` : ''}
Language: ${language}

Return JSON: {
  "title": "Challenge Title",
  "description": "Clear problem statement with examples (2-3 paragraphs)",
  "type": "algorithm|data_structure|debugging|code_review|system_design|api_design|refactoring",
  "difficulty": "easy|medium|hard",
  "language": "${language}",
  "starterCode": "Starting code template if applicable",
  "solution": "Reference solution",
  "testCases": [{"input": "...", "expectedOutput": "...", "isHidden": false}],
  "hints": ["hint1", "hint2"],
  "scoringCriteria": ["criteria1", "criteria2"]
}

Make the challenge practical and relevant to real-world ${skills?.[0] || 'web development'} work.`;

    const parsed = await chatJSON(
      'You are an expert coding challenge designer. Return only valid JSON.',
      prompt,
      0.4,
      2000
    );
    return {
      ...parsed,
      id: generateId(),
      candidateSolution: '',
      passedTests: 0,
      totalTests: parsed.testCases?.length || 0,
      score: null,
      scoreReasoning: '',
      codeQualityScore: null,
      efficiencyScore: null,
      feedback: '',
    };
  }, generateFallbackChallenge(skills, difficulty, type, language));

  return challenge;
};

const generateFallbackChallenge = (skills, difficulty, type, language) => {
  const challenges = {
    algorithm: {
      title: 'Array Two Sum',
      description: 'Given an array of integers and a target sum, find two numbers that add up to the target. Return their indices.\n\nExample: nums = [2, 7, 11, 15], target = 9 → [0, 1]\n\nConstraints: Each input has exactly one solution. You may not use the same element twice.',
      starterCode: `function twoSum(nums, target) {\n  // Your solution here\n}`,
      testCases: [
        { input: '[2,7,11,15], 9', expectedOutput: '[0,1]', isHidden: false },
        { input: '[3,2,4], 6', expectedOutput: '[1,2]', isHidden: false },
        { input: '[3,3], 6', expectedOutput: '[0,1]', isHidden: true },
      ],
      hints: ['Consider using a hash map for O(n) solution', 'Think about what you need to look up'],
    },
    data_structure: {
      title: 'Implement a Stack',
      description: 'Implement a stack data structure with push, pop, top, and getMin operations, all in O(1) time.',
      starterCode: `class MinStack {\n  constructor() {\n    // Initialize here\n  }\n  push(val) {}\n  pop() {}\n  top() {}\n  getMin() {}\n}`,
      testCases: [
        { input: 'push(3), push(5), getMin()', expectedOutput: '3', isHidden: false },
        { input: 'push(2), push(1), getMin(), pop()', expectedOutput: '1', isHidden: false },
      ],
      hints: ['Use two stacks: one for values, one for minimums', 'Track the minimum at each level'],
    },
  };

  const base = challenges[type] || challenges.algorithm;
  return {
    ...base,
    id: generateId(),
    type,
    difficulty: difficulty || 'medium',
    language: language || 'javascript',
    solution: '',
    candidateSolution: '',
    passedTests: 0,
    totalTests: base.testCases?.length || 0,
    score: null,
    scoreReasoning: '',
    codeQualityScore: null,
    efficiencyScore: null,
    feedback: '',
  };
};

// ─── Evaluate Answer ─────────────────────────────────────────────────────────

export const evaluateAnswer = async ({ question, candidateAnswer, scoringCriteria }) => {
  return safeAI(async () => {
    const prompt = `Evaluate this interview answer.

Question: ${question}
Candidate Answer: ${candidateAnswer}
Scoring Criteria: ${scoringCriteria?.join(', ') || 'Technical accuracy, Communication, Depth of understanding'}

Return JSON: {
  "score": 7,
  "reasoning": "Detailed explanation of strengths and areas for improvement",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1"]
}`;

    return chatJSON(
      'You are an expert interviewer evaluating candidates. Return only valid JSON with score 0-10.',
      prompt,
      0.3,
      500
    ).catch(() => ({ score: 5, reasoning: 'Unable to evaluate', strengths: [], improvements: [] }));
  }, { score: 5, reasoning: 'AI evaluation unavailable', strengths: [], improvements: [] });
};

// ─── Evaluate Code Submission ────────────────────────────────────────────────

export const evaluateCode = async ({ challenge, candidateSolution }) => {
  return safeAI(async () => {
    const prompt = `Evaluate this coding challenge solution.

Challenge: ${challenge.title}
Description: ${challenge.description}
Language: ${challenge.language}
Candidate Solution:\n${candidateSolution}
Test Cases: ${JSON.stringify(challenge.testCases)}

Return JSON: {
  "score": 8,
  "passedTests": 4,
  "totalTests": 5,
  "codeQualityScore": 7,
  "efficiencyScore": 8,
  "feedback": "Detailed code review",
  "strengths": ["strength1"],
  "improvements": ["improvement1"],
  "timeComplexity": "O(n)",
  "spaceComplexity": "O(1)"
}`;

    return chatJSON(
      'You are an expert code reviewer. Return only valid JSON.',
      prompt,
      0.3,
      800
    ).catch(() => ({ score: 5, feedback: 'Unable to evaluate' }));
  }, { score: 5, feedback: 'AI evaluation unavailable', passedTests: 0, totalTests: challenge.testCases?.length || 0 });
};

// ─── Generate Scorecard ──────────────────────────────────────────────────────

export const generateScorecard = async (sessionId) => {
  const session = await InterviewSession.findById(sessionId);
  if (!session) return null;

  const answeredQuestions = session.questions.filter(q => q.candidateAnswer);
  const solvedChallenges = session.codingChallenges.filter(c => c.candidateSolution);

  const avgQuestionScore = answeredQuestions.length > 0
    ? answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0) / answeredQuestions.length
    : 0;

  const avgChallengeScore = solvedChallenges.length > 0
    ? solvedChallenges.reduce((sum, c) => sum + (c.score || 0), 0) / solvedChallenges.length
    : 0;

  return safeAI(async () => {
    const qSummary = answeredQuestions.map(q =>
      `Q: ${q.text}\nA: ${q.candidateAnswer?.substring(0, 200)}\nScore: ${q.score}/10\nReasoning: ${q.scoreReasoning}`
    ).join('\n\n');

    const cSummary = solvedChallenges.map(c =>
      `Challenge: ${c.title}\nSolution:\n${c.candidateSolution?.substring(0, 300)}\nScore: ${c.score}/10\nTests: ${c.passedTests}/${c.totalTests}`
    ).join('\n\n');

    const prompt = `Generate an interview scorecard based on these results.

Interview: ${session.title}
Type: ${session.interviewType}
Difficulty: ${session.difficulty}
Skills assessed: ${session.skills.join(', ')}

Questions answered: ${answeredQuestions.length}
${qSummary || 'No questions answered'}

Coding challenges attempted: ${solvedChallenges.length}
${cSummary || 'No challenges attempted'}

Generate a comprehensive scorecard:

Return JSON: {
  "technicalSkills": 7,
  "problemSolving": 8,
  "communication": 7,
  "codeQuality": 6,
  "systemDesign": 5,
  "cultureFit": 7,
  "learningAbility": 8,
  "timeManagement": 6,
  "overallScore": 7,
  "recommendation": "hire",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1"],
  "evaluatorNotes": "Detailed evaluator notes..."
}`;

    const parsed = await chatJSON(
      'You are an expert hiring advisor creating interview scorecards. Return only valid JSON.',
      prompt,
      0.3,
      1000
    );

    session.scorecard = {
      ...parsed,
      recommendation: parsed.recommendation || 'maybe',
    };
    await session.save();
    return session.scorecard;
  }, {
    technicalSkills: Math.round(avgQuestionScore || avgChallengeScore || 5),
    problemSolving: Math.round(avgChallengeScore || avgQuestionScore || 5),
    communication: Math.round(avgQuestionScore || 5),
    codeQuality: Math.round(avgChallengeScore || 5),
    systemDesign: 5,
    cultureFit: 6,
    learningAbility: 6,
    timeManagement: 6,
    overallScore: Math.round((avgQuestionScore + avgChallengeScore) / 2 || 5),
    recommendation: 'maybe',
    strengths: [],
    weaknesses: [],
    evaluatorNotes: 'Auto-generated scorecard',
  });
};

// ─── Generate Interview Summary ──────────────────────────────────────────────

export const generateSummary = async (sessionId) => {
  const session = await InterviewSession.findById(sessionId);
  if (!session) return null;

  const answered = session.questions.filter(q => q.candidateAnswer);
  const challenges = session.codingChallenges.filter(c => c.candidateSolution);

  return safeAI(async () => {
    const qText = answered.map(q =>
      `Q: ${q.text}\nScore: ${q.score}/10`
    ).join('\n');

    const cText = challenges.map(c =>
      `${c.title}: Score ${c.score}/10, Tests ${c.passedTests}/${c.totalTests}`
    ).join('\n');

    const prompt = `Generate an interview summary.

Interview: ${session.title}
Type: ${session.interviewType} | Difficulty: ${session.difficulty}
Candidate: ${session.candidateName || 'N/A'}
Duration: ${session.duration || 'N/A'} minutes
Skills: ${session.skills.join(', ')}

Questions (${answered.length} answered):
${qText || 'None'}

Challenges (${challenges.length} attempted):
${cText || 'None'}

Scorecard:
Overall: ${session.scorecard?.overallScore || 'N/A'}/10
Recommendation: ${session.scorecard?.recommendation || 'N/A'}

Return JSON: {
  "overview": "2-3 paragraph executive summary of the interview",
  "highlights": ["highlight1", "highlight2"],
  "concerns": ["concern1"],
  "recommendation": "Detailed hiring recommendation with reasoning",
  "nextSteps": ["step1", "step2"]
}`;

    const parsed = await chatJSON(
      'You are an expert interviewer writing professional interview summaries. Return only valid JSON.',
      prompt,
      0.4,
      1000
    );

    session.summary = {
      ...parsed,
      generatedAt: new Date(),
    };
    session.status = 'completed';
    session.completedAt = new Date();
    await session.save();
    return session.summary;
  }, {
    overview: `Interview for ${session.title} completed. ${answered.length} questions answered, ${challenges.length} challenges attempted.`,
    highlights: [],
    concerns: [],
    recommendation: 'Review scorecard for detailed assessment.',
    nextSteps: ['Review scorecard', 'Schedule follow-up if needed'],
    generatedAt: new Date(),
  });
};

// ─── Session CRUD ────────────────────────────────────────────────────────────

export const createSession = async (userId, data) => {
  return InterviewSession.create({ ...data, interviewer: userId });
};

export const getSessions = async (userId, filters = {}) => {
  const { status, interviewType, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;
  const filter = { interviewer: userId };
  if (status) filter.status = status;
  if (interviewType) filter.interviewType = interviewType;

  const [sessions, total] = await Promise.all([
    InterviewSession.find(filter)
      .populate('candidate', 'firstName lastName avatar')
      .populate('job', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    InterviewSession.countDocuments(filter),
  ]);

  return { sessions, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
};

export const getSession = async (userId, sessionId) => {
  return InterviewSession.findOne({ _id: sessionId, interviewer: userId })
    .populate('candidate', 'firstName lastName avatar')
    .populate('job', 'title description');
};

export const updateSession = async (userId, sessionId, data) => {
  return InterviewSession.findOneAndUpdate(
    { _id: sessionId, interviewer: userId },
    { $set: data },
    { new: true }
  );
};

export const deleteSession = async (userId, sessionId) => {
  return InterviewSession.findOneAndDelete({ _id: sessionId, interviewer: userId });
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export const getAnalytics = async (userId) => {
  const [totalSessions, completedSessions, avgScore, byType, byRecommendation] = await Promise.all([
    InterviewSession.countDocuments({ interviewer: userId }),
    InterviewSession.countDocuments({ interviewer: userId, status: 'completed' }),
    InterviewSession.aggregate([
      { $match: { interviewer: userId, 'scorecard.overallScore': { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$scorecard.overallScore' } } },
    ]),
    InterviewSession.aggregate([
      { $match: { interviewer: userId } },
      { $group: { _id: '$interviewType', count: { $sum: 1 } } },
    ]),
    InterviewSession.aggregate([
      { $match: { interviewer: userId, status: 'completed' } },
      { $group: { _id: '$scorecard.recommendation', count: { $sum: 1 } } },
    ]),
  ]);

  return {
    totalSessions,
    completedSessions,
    avgScore: Math.round(avgScore[0]?.avg || 0),
    byType: byType.reduce((acc, t) => { acc[t._id] = t.count; return acc; }, {}),
    byRecommendation: byRecommendation.reduce((acc, r) => { acc[r._id] = r.count; return acc; }, {}),
  };
};
