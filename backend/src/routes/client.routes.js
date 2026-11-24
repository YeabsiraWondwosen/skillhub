import { Router } from 'express';
import * as clientController from '../controllers/client.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(protect);
router.get('/dashboard', authorize('client'), clientController.getClientDashboard);

export default router;
