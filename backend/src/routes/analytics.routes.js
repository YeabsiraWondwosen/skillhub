import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { adminOnly, authorize } from '../middleware/rbac.middleware.js';

const router = Router();

// Public — no auth needed
router.get('/public', analyticsController.getPublicStats);

// Protected
router.use(protect);
router.get('/platform', adminOnly, analyticsController.getPlatformAnalytics);
router.get('/freelancer', authorize('freelancer'), analyticsController.getFreelancerAnalytics);
router.get('/client', authorize('client'), analyticsController.getClientAnalytics);

export default router;
