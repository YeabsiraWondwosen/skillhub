import { Router } from 'express';
import * as reviewController from '../controllers/review.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createReviewSchema, replyToReviewSchema, updateReviewSchema } from '../validations/review.validation.js';

const router = Router();

router.get('/users/:userId', reviewController.getUserReviews);

router.use(protect);
router.post('/projects/:projectId', validate(createReviewSchema), reviewController.createReview);
router.post('/:reviewId/reply', validate(replyToReviewSchema), reviewController.replyToReview);
router.get('/my-written', reviewController.getMyWrittenReviews);
router.patch('/:reviewId', validate(updateReviewSchema), reviewController.updateReview);
router.delete('/:reviewId', reviewController.deleteReview);

export default router;
