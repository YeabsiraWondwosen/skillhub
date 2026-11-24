import { Router } from 'express';
import * as contractController from '../controllers/contract.controller.js';
import * as projectController from '../controllers/project.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';
import { handleMulterError, uploadDeliveryAttachments } from '../middleware/upload.middleware.js';
import { submitDeliverySchema, updateDeliverySchema, reviewDeliverySchema } from '../validations/project.validation.js';

const router = Router();
router.use(protect);

router.get('/', contractController.getMyContracts);
router.get('/:contractId', contractController.getContract);
router.post('/:contractId/fund', paymentLimiter, contractController.fundContract);

// Delivery / review / dispute share the project flow (real escrow release).
router.get(
  '/:contractId/deliveries',
  contractController.remapToProjectHandler(projectController.getProjectDeliveries, 'projectId')
);
router.get(
  '/:contractId/deliveries/:deliveryId',
  contractController.remapToProjectHandler(projectController.getProjectDelivery, 'projectId')
);
router.post(
  '/:contractId/deliver',
  handleMulterError(uploadDeliveryAttachments),
  validate(submitDeliverySchema),
  contractController.remapToProjectHandler(projectController.submitDelivery, 'projectId')
);
router.put(
  '/:contractId/deliveries/:deliveryId',
  handleMulterError(uploadDeliveryAttachments),
  validate(updateDeliverySchema),
  contractController.remapToProjectHandler(projectController.updateProjectDelivery, 'projectId')
);
router.post(
  '/:contractId/deliveries/:deliveryId/review',
  validate(reviewDeliverySchema),
  contractController.remapToProjectHandler(projectController.reviewDelivery, 'projectId')
);
router.post(
  '/:contractId/dispute',
  contractController.remapToProjectHandler(projectController.raiseDispute, 'projectId')
);

export default router;
