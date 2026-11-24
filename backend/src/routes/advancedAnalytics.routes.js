import { Router } from 'express';
import * as analyticsController from '../controllers/advancedAnalytics.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';

const router = Router();
router.use(protect);

// ─── Dashboard ───────────────────────────────────────────────────────────────
router.get('/dashboard', authorize('admin'), analyticsController.getDashboardOverview);

// ─── Revenue ─────────────────────────────────────────────────────────────────
router.get('/revenue', authorize('admin'), analyticsController.getRevenueReport);

// ─── Platform Stats ──────────────────────────────────────────────────────────
router.get('/platform-stats', authorize('admin'), analyticsController.getPlatformStats);

// ─── Fraud Detection ─────────────────────────────────────────────────────────
router.get('/fraud', authorize('admin'), analyticsController.detectFraud);
router.post('/fraud/run', authorize('admin'), analyticsController.runFraudDetection);
router.patch('/fraud/:alertId/resolve', authorize('admin'), analyticsController.resolveFraudAlert);

// ─── Spam Detection ──────────────────────────────────────────────────────────
router.get('/spam', authorize('admin'), analyticsController.detectSpam);
router.post('/spam/analyze', authorize('admin'), analyticsController.analyzeContent);
router.patch('/spam/:flagId/resolve', authorize('admin'), analyticsController.resolveSpamFlag);

// ─── User Growth ─────────────────────────────────────────────────────────────
router.get('/user-growth', authorize('admin'), analyticsController.getUserGrowth);

// ─── Business Insights ───────────────────────────────────────────────────────
router.get('/insights', authorize('admin'), analyticsController.getBusinessInsights);
router.post('/insights/generate', authorize('admin'), analyticsController.generateInsights);
router.patch('/insights/:insightId/viewed', authorize('admin'), analyticsController.markInsightViewed);

export default router;
