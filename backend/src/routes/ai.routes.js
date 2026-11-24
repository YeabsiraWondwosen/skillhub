import { Router } from 'express';
import * as aiController from '../controllers/ai.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';

const router = Router();
router.use(protect);

router.get('/match/:jobId', authorize('client', 'admin'), aiController.getFreelancerMatches);
router.get('/recommend-jobs', authorize('freelancer'), aiController.getJobRecommendations);
router.get('/proposal/:jobId', authorize('freelancer'), aiController.generateProposal);
router.get('/full-proposal/:jobId', authorize('freelancer'), aiController.generateFullProposalData);
router.get('/skill-gaps/:jobId', authorize('freelancer'), aiController.getSkillGaps);

export default router;
