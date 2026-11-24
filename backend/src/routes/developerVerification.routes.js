import { Router } from 'express';
import * as verificationController from '../controllers/developerVerification.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { freelancerOnly, adminOnly } from '../middleware/rbac.middleware.js';
import { validate, validateMultiple } from '../middleware/validate.middleware.js';
import { handleMulterError, uploadGeneral, uploadIdentityDocs } from '../middleware/upload.middleware.js';
import {
  submitIdentitySchema,
  submitGithubSchema,
  submitPortfolioSchema,
  reviewVerificationSchema,
  verificationQuerySchema,
} from '../validations/developerVerification.validation.js';

const router = Router();

// ─── Freelancer routes ───────────────────────────────────────────────────────
router.get('/my', protect, freelancerOnly, verificationController.getMyVerifications);
router.get('/my/score', protect, freelancerOnly, verificationController.getVerificationScoreByUser);

// Public verification score (must be before /:id)
router.get('/score/:userId', verificationController.getVerificationScoreByUser);

router.get('/:id', protect, verificationController.getVerification);

// Identity verification
router.post('/identity', protect, freelancerOnly, validate(submitIdentitySchema), verificationController.submitIdentity);
router.post('/identity/documents', protect, freelancerOnly, handleMulterError(
  uploadIdentityDocs
), verificationController.uploadIdentityDocuments);

// GitHub verification
router.post('/github', protect, freelancerOnly, validate(submitGithubSchema), verificationController.submitGithub);

// Portfolio verification
router.post('/portfolio', protect, freelancerOnly, validate(submitPortfolioSchema), handleMulterError(
  uploadGeneral
), verificationController.submitPortfolio);

// Resubmit rejected
router.post('/:id/resubmit', protect, freelancerOnly, verificationController.resubmitVerification);

// Public verification score
router.get('/score/:userId', verificationController.getVerificationScoreByUser);

// ─── Admin routes ────────────────────────────────────────────────────────────
router.get('/admin/all', protect, adminOnly, validate(verificationQuerySchema, 'query'), verificationController.adminGetAllVerifications);
router.get('/admin/pending', protect, adminOnly, validate(verificationQuerySchema, 'query'), verificationController.adminGetPendingVerifications);
router.get('/admin/stats', protect, adminOnly, verificationController.adminGetVerificationStats);
router.patch('/admin/:id/review', protect, adminOnly, validate(reviewVerificationSchema), verificationController.adminReviewVerification);

export default router;
