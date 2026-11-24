import { Router } from 'express';
import * as reputationController from '../controllers/reputation.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { adminOnly } from '../middleware/rbac.middleware.js';

const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────
router.get('/user/:userId', reputationController.getUserReputation);
router.get('/leaderboard', reputationController.getLeaderboard);
router.get('/config', reputationController.getReputationConfig);

// ─── Protected routes ─────────────────────────────────────────────────────────
router.use(protect);
router.get('/my', reputationController.getMyReputation);
router.post('/recalculate', reputationController.recalculateMyReputation);

// ─── Admin routes ─────────────────────────────────────────────────────────────
router.post('/admin/recalculate-all', protect, adminOnly, reputationController.adminRecalculateAll);

export default router;
