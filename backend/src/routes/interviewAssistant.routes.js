import { Router } from 'express';
import * as iaController from '../controllers/interviewAssistant.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

router.post('/generate-questions', iaController.generateQuestions);
router.post('/generate-challenge', iaController.generateCodingChallenge);
router.post('/evaluate-answer', iaController.evaluateAnswer);
router.post('/evaluate-code', iaController.evaluateCode);
router.get('/analytics', iaController.getAnalytics);

router.get('/sessions', iaController.getSessions);
router.get('/sessions/:sessionId', iaController.getSession);
router.post('/sessions', iaController.createSession);
router.patch('/sessions/:sessionId', iaController.updateSession);
router.delete('/sessions/:sessionId', iaController.deleteSession);

router.patch('/sessions/:sessionId/questions/:questionId', iaController.updateQuestionAnswer);
router.patch('/sessions/:sessionId/challenges/:challengeId', iaController.updateChallengeSolution);

router.post('/sessions/:sessionId/generate-scorecard', iaController.generateScorecard);
router.post('/sessions/:sessionId/generate-summary', iaController.generateSummary);

export default router;
