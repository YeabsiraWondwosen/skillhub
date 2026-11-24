import { Router } from 'express';
import * as projectController from '../controllers/project.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { handleMulterError, uploadProjectFiles, uploadDeliveryAttachments } from '../middleware/upload.middleware.js';
import { createTaskSchema, updateTaskSchema, submitDeliverySchema, updateDeliverySchema, reviewDeliverySchema, updateProjectSchema } from '../validations/project.validation.js';

const router = Router();
router.use(protect);

router.get('/', projectController.getMyProjects);
router.get('/:projectId', projectController.getProject);
router.patch('/:projectId', validate(updateProjectSchema), projectController.updateProject);
router.post('/:projectId/complete', projectController.completeProject);
router.post('/:projectId/dispute', projectController.raiseDispute);

// Tasks
router.post('/:projectId/tasks', validate(createTaskSchema), projectController.addTask);
router.put('/:projectId/tasks/:taskId', validate(updateTaskSchema), projectController.updateTask);
router.delete('/:projectId/tasks/:taskId', projectController.deleteTask);

// Files
router.post('/:projectId/files', handleMulterError(uploadProjectFiles), projectController.uploadProjectFile);

// Delivery
router.get('/:projectId/deliveries', projectController.getProjectDeliveries);
router.get('/:projectId/deliveries/:deliveryId', projectController.getProjectDelivery);
router.post('/:projectId/deliver', handleMulterError(uploadDeliveryAttachments), validate(submitDeliverySchema), projectController.submitDelivery);
router.put('/:projectId/deliveries/:deliveryId', handleMulterError(uploadDeliveryAttachments), validate(updateDeliverySchema), projectController.updateProjectDelivery);
router.post('/:projectId/deliveries/:deliveryId/review', validate(reviewDeliverySchema), projectController.reviewDelivery);

export default router;
