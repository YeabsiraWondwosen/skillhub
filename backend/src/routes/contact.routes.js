import { Router } from 'express';
import * as contactController from '../controllers/contact.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public route to submit contact message
router.post('/', optionalAuth, apiLimiter, contactController.submitContactMessage);

// Admin routes (protected and authorized)
router.use(protect);
router.use(authorize('admin'));

router.get('/admin', contactController.getAdminMessages);
router.get('/admin/stats', contactController.getAdminMessageStats);
router.get('/admin/:id', contactController.getAdminMessage);
router.patch('/admin/:id/status', contactController.updateMessageStatus);
router.patch('/admin/:id/priority', contactController.updateMessagePriority);
router.post('/admin/:id/reply', contactController.replyToContactMessage);
router.delete('/admin/:id', contactController.deleteContactMessage);

export default router;
