import { Router } from 'express';
import * as badgeController from '../controllers/badge.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────
router.get('/types', badgeController.getBadgeTypes);
router.get('/user/:userId', badgeController.getUserBadges);
router.get('/leaderboard', badgeController.getLeaderboard);

// ─── Protected routes ─────────────────────────────────────────────────────────
router.use(protect);
router.get('/my', badgeController.getMyBadges);
router.post('/refresh', badgeController.refreshMyBadges);

export default router;
