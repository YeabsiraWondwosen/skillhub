import { Router } from 'express';
import * as projectPlannerController from '../controllers/projectPlanner.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createProjectPlanSchema } from '../validations/projectPlanner.validation.js';

const router = Router();
router.use(protect);

router.post('/', validate(createProjectPlanSchema), projectPlannerController.createPlan);
router.get('/', projectPlannerController.getMyPlans);
router.get('/projects', projectPlannerController.getUserProjects);
router.get('/:planId', projectPlannerController.getPlanById);
router.delete('/:planId', projectPlannerController.deletePlan);
router.post('/:planId/convert', projectPlannerController.convertToProject);

export default router;
