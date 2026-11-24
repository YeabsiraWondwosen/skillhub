import { Router } from 'express';
import * as appController from '../controllers/application.controller.js';
import { protect, requireVerifiedEmail } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { handleMulterError, uploadJobAttachments } from '../middleware/upload.middleware.js';
import { createApplicationSchema, updateApplicationStatusSchema } from '../validations/application.validation.js';

const router = Router();
router.use(protect);

// Freelancer
router.post('/jobs/:jobId', requireVerifiedEmail, authorize('freelancer'), handleMulterError(uploadJobAttachments), validate(createApplicationSchema), appController.submitApplication);
router.get('/my', authorize('freelancer'), appController.getMyApplications);
router.delete('/:appId/withdraw', authorize('freelancer'), appController.withdrawApplication);

// Client
router.get('/jobs/:jobId', authorize('client'), appController.getJobApplications);
router.get('/:appId', appController.getApplication);
router.patch('/:appId/status', authorize('client'), validate(updateApplicationStatusSchema), appController.updateApplicationStatus);
router.post('/:appId/hire', authorize('client'), appController.hireFreelancer);

export default router;
