import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import * as iaService from '../services/interviewAssistant.service.js';

// ─── Generate Questions ──────────────────────────────────────────────────────
export const generateQuestions = catchAsync(async (req, res) => {
  const { skills, interviewType, difficulty, count, jobDescription, focusAreas } = req.body;
  const questions = await iaService.generateQuestions({
    skills, interviewType, difficulty, count, jobDescription, focusAreas,
  });
  sendResponse(res, 200, 'Questions generated', questions);
});

// ─── Generate Coding Challenge ───────────────────────────────────────────────
export const generateCodingChallenge = catchAsync(async (req, res) => {
  const { skills, difficulty, type, language, jobDescription } = req.body;
  const challenge = await iaService.generateCodingChallenge({
    skills, difficulty, type, language, jobDescription,
  });
  sendResponse(res, 200, 'Challenge generated', challenge);
});

// ─── Evaluate Answer ─────────────────────────────────────────────────────────
export const evaluateAnswer = catchAsync(async (req, res) => {
  const { question, candidateAnswer, scoringCriteria } = req.body;
  if (!question || !candidateAnswer) throw new ApiError(400, 'Question and answer required');
  const result = await iaService.evaluateAnswer({ question, candidateAnswer, scoringCriteria });
  sendResponse(res, 200, 'Answer evaluated', result);
});

// ─── Evaluate Code ───────────────────────────────────────────────────────────
export const evaluateCode = catchAsync(async (req, res) => {
  const { challenge, candidateSolution } = req.body;
  if (!challenge || !candidateSolution) throw new ApiError(400, 'Challenge and solution required');
  const result = await iaService.evaluateCode({ challenge, candidateSolution });
  sendResponse(res, 200, 'Code evaluated', result);
});

// ─── Generate Scorecard ──────────────────────────────────────────────────────
export const generateScorecard = catchAsync(async (req, res) => {
  const scorecard = await iaService.generateScorecard(req.params.sessionId);
  if (!scorecard) throw new ApiError(404, 'Session not found');
  sendResponse(res, 200, 'Scorecard generated', scorecard);
});

// ─── Generate Summary ────────────────────────────────────────────────────────
export const generateSummary = catchAsync(async (req, res) => {
  const summary = await iaService.generateSummary(req.params.sessionId);
  if (!summary) throw new ApiError(404, 'Session not found');
  sendResponse(res, 200, 'Summary generated', summary);
});

// ─── Session CRUD ────────────────────────────────────────────────────────────
export const createSession = catchAsync(async (req, res) => {
  const session = await iaService.createSession(req.user._id, req.body);
  sendResponse(res, 201, 'Session created', session);
});

export const getSessions = catchAsync(async (req, res) => {
  const result = await iaService.getSessions(req.user._id, req.query);
  sendResponse(res, 200, 'Sessions fetched', result.sessions, paginationMeta(result.total, result.page, result.limit));
});

export const getSession = catchAsync(async (req, res) => {
  const session = await iaService.getSession(req.user._id, req.params.sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  sendResponse(res, 200, 'Session fetched', session);
});

export const updateSession = catchAsync(async (req, res) => {
  const session = await iaService.updateSession(req.user._id, req.params.sessionId, req.body);
  if (!session) throw new ApiError(404, 'Session not found');
  sendResponse(res, 200, 'Session updated', session);
});

export const deleteSession = catchAsync(async (req, res) => {
  const session = await iaService.deleteSession(req.user._id, req.params.sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  sendResponse(res, 200, 'Session deleted');
});

// ─── Update Question Answer ──────────────────────────────────────────────────
export const updateQuestionAnswer = catchAsync(async (req, res) => {
  const { sessionId, questionId } = req.params;
  const { candidateAnswer, score, scoreReasoning, timeSpentSeconds } = req.body;

  const session = await iaService.getSession(req.user._id, sessionId);
  if (!session) throw new ApiError(404, 'Session not found');

  const question = session.questions.find(q => q.id === questionId);
  if (!question) throw new ApiError(404, 'Question not found');

  if (candidateAnswer !== undefined) question.candidateAnswer = candidateAnswer;
  if (score !== undefined) question.score = score;
  if (scoreReasoning !== undefined) question.scoreReasoning = scoreReasoning;
  if (timeSpentSeconds !== undefined) question.timeSpentSeconds = timeSpentSeconds;

  await session.save();
  sendResponse(res, 200, 'Question updated', session);
});

// ─── Update Challenge Solution ───────────────────────────────────────────────
export const updateChallengeSolution = catchAsync(async (req, res) => {
  const { sessionId, challengeId } = req.params;
  const { candidateSolution, score, scoreReasoning, timeSpentSeconds, passedTests, feedback } = req.body;

  const session = await iaService.getSession(req.user._id, sessionId);
  if (!session) throw new ApiError(404, 'Session not found');

  const challenge = session.codingChallenges.find(c => c.id === challengeId);
  if (!challenge) throw new ApiError(404, 'Challenge not found');

  if (candidateSolution !== undefined) challenge.candidateSolution = candidateSolution;
  if (score !== undefined) challenge.score = score;
  if (scoreReasoning !== undefined) challenge.scoreReasoning = scoreReasoning;
  if (timeSpentSeconds !== undefined) challenge.timeSpentSeconds = timeSpentSeconds;
  if (passedTests !== undefined) challenge.passedTests = passedTests;
  if (feedback !== undefined) challenge.feedback = feedback;

  await session.save();
  sendResponse(res, 200, 'Challenge updated', session);
});

// ─── Analytics ───────────────────────────────────────────────────────────────
export const getAnalytics = catchAsync(async (req, res) => {
  const analytics = await iaService.getAnalytics(req.user._id);
  sendResponse(res, 200, 'Analytics fetched', analytics);
});
