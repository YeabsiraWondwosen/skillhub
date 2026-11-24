import { Router } from 'express';
import * as milestoneController from '../controllers/milestone.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';
import { handleMulterError, uploadDeliveryFiles } from '../middleware/upload.middleware.js';
import { createMilestoneSchema, updateMilestoneSchema } from '../validations/project.validation.js';

const router = Router();
router.use(protect);

router.get('/projects/:projectId', milestoneController.getProjectMilestones);
router.post('/projects/:projectId', validate(createMilestoneSchema), milestoneController.createMilestone);
router.put('/:milestoneId', validate(updateMilestoneSchema), milestoneController.updateMilestone);
router.delete('/:milestoneId', milestoneController.deleteMilestone);
router.post('/:milestoneId/fund', paymentLimiter, milestoneController.fundMilestone);
router.post('/:milestoneId/submit', handleMulterError(uploadDeliveryFiles), milestoneController.submitMilestone);
router.post('/:milestoneId/approve', paymentLimiter, milestoneController.approveMilestone);
router.post('/:milestoneId/revision', milestoneController.requestMilestoneRevision);

export default router;
