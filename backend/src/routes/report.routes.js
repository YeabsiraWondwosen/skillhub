import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { reportSchema } from '../validations/user.validation.js';

const router = Router();
router.use(protect);
router.post('/', validate(reportSchema), reportController.submitReport);

export default router;
