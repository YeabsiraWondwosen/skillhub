import { Router } from 'express';
import * as codeReviewController from '../controllers/codeReview.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { uploadCodeFiles, handleMulterError } from '../middleware/upload.middleware.js';

const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────
// optionalAuth so the owner (with token) can view their own private review(s);
// anonymous users only ever see reviews explicitly marked public.
router.get('/public/:reviewId', apiLimiter, optionalAuth, codeReviewController.getPublicReview);

// ─── Protected routes ─────────────────────────────────────────────────────────
router.use(protect);

router.post('/upload', apiLimiter, handleMulterError(uploadCodeFiles), codeReviewController.submitFileReview);
router.post('/paste', apiLimiter, codeReviewController.submitPasteReview);
router.get('/my', codeReviewController.getMyReviews);
router.get('/my/stats', codeReviewController.getMyReviewStats);
router.get('/:reviewId', codeReviewController.getReview);
router.delete('/:reviewId', codeReviewController.deleteReview);
router.patch('/:reviewId/public', codeReviewController.setReviewPublic);

export default router;
