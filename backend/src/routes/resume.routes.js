import { Router } from 'express';
import * as resumeController from '../controllers/resume.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────
router.get('/templates', resumeController.getTemplates);

// ─── Protected routes (freelancers only) ──────────────────────────────────────
router.use(protect);
router.use(authorize('freelancer'));

router.post('/generate', apiLimiter, resumeController.generateResume);
router.get('/my', resumeController.getMyResumes);
router.get('/stats', resumeController.getResumeStats);
router.get('/:resumeId', resumeController.getResume);
router.get('/:resumeId/preview', resumeController.previewResume);
router.get('/:resumeId/download', resumeController.downloadResume);
router.delete('/:resumeId', resumeController.deleteResume);

export default router;
