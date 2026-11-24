import { Router } from 'express';
import * as githubController from '../controllers/github.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ── Own GitHub management (protected) ─────────────────────────────
router.use(protect);
router.post('/link', apiLimiter, githubController.linkGitHub);
router.post('/unlink', githubController.unlinkGitHub);
router.get('/me', githubController.getMyGitHubData);
router.post('/refresh', apiLimiter, githubController.refreshGitHubData);

// ── Public GitHub data for any user ───────────────────────────────
router.get('/:userId', apiLimiter, githubController.getUserGitHubData);
router.get('/:userId/repos', apiLimiter, githubController.getGitHubRepos);
router.get('/:userId/languages', apiLimiter, githubController.getGitHubLanguages);
router.get('/:userId/contributions', apiLimiter, githubController.getGitHubContributions);
router.get('/:userId/commits', apiLimiter, githubController.getGitHubCommitActivity);

export default router;
