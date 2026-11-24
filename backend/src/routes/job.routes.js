import { Router } from 'express';
import * as jobController from '../controllers/job.controller.js';
import { protect, optionalAuth, requireVerifiedEmail } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { uploadLimiter, paymentLimiter } from '../middleware/rateLimiter.js';
import { handleMulterError, uploadJobAttachments } from '../middleware/upload.middleware.js';
import { createJobSchema, updateJobSchema, jobQuerySchema, myJobsQuerySchema, inviteFreelancerSchema } from '../validations/job.validation.js';

const router = Router();

// ── Static paths FIRST — must come before /:jobId ────────────────

// Public list + create
router.get('/', optionalAuth, validate(jobQuerySchema, 'query'), jobController.getJobs);
router.post('/', protect, requireVerifiedEmail, authorize('client'), uploadLimiter, handleMulterError(uploadJobAttachments), validate(createJobSchema), jobController.createJob);

// Protected static paths (no param) — before /:jobId
router.get('/my/jobs', protect, authorize('client'), validate(myJobsQuerySchema, 'query'), jobController.getMyJobs);
router.get('/recommended/for-me', protect, authorize('freelancer'), jobController.getRecommendedJobs);

// ── Param routes AFTER static paths ──────────────────────────────
router.get('/:jobId', optionalAuth, jobController.getJob);
router.put('/:jobId', protect, authorize('client'), validate(updateJobSchema), jobController.updateJob);
router.patch('/:jobId/status', protect, authorize('client'), jobController.updateJobStatus);
router.delete('/:jobId', protect, authorize('client'), jobController.deleteJob);
router.post('/:jobId/invite', protect, authorize('client'), validate(inviteFreelancerSchema), jobController.inviteFreelancer);
router.patch('/:jobId/pause', protect, authorize('client'), jobController.pauseJob);
router.patch('/:jobId/resume', protect, authorize('client'), jobController.resumeJob);
router.post('/:jobId/cancel', protect, authorize('client'), jobController.cancelJob);

// ── Payment workflow routes ──────────────────────────────────────
router.post('/:jobId/fund', protect, authorize('client'), paymentLimiter, jobController.fundJobPayment);
router.post('/:jobId/start-work', protect, authorize('freelancer'), jobController.startJobWork);
router.post('/:jobId/submit-delivery', protect, authorize('freelancer'), handleMulterError(uploadJobAttachments), jobController.submitJobDelivery);
router.post('/:jobId/approve-delivery', protect, authorize('client'), jobController.approveJobDelivery);

export default router;
