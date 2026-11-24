import { Router } from 'express';
import * as costEstimatorController from '../controllers/costEstimator.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { estimateCostSchema } from '../validations/costEstimator.validation.js';

const router = Router();
router.use(protect);

router.post('/', validate(estimateCostSchema), costEstimatorController.createEstimate);
router.get('/', costEstimatorController.getMyEstimates);
router.get('/:estimateId', costEstimatorController.getEstimateById);
router.delete('/:estimateId', costEstimatorController.deleteEstimate);

export default router;
