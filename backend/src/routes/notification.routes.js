import { Router } from 'express';
import * as notifController from '../controllers/notification.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateNotificationPreferencesSchema } from '../validations/notification.validation.js';

const router = Router();
router.use(protect);

router.get('/', notifController.getNotifications);
router.get('/unread-count', notifController.getUnreadCount);
router.get('/ai-recommendations', notifController.getAiRecommendations);
router.get('/preferences', notifController.getPreferences);
router.get('/ai-stats', authorize('admin'), notifController.getAiStats);

router.patch('/read-all', notifController.markAllAsRead);
router.patch('/preferences', validate(updateNotificationPreferencesSchema), notifController.updatePreferences);
router.patch('/:notificationId/read', notifController.markAsRead);
router.patch('/:notificationId/dismiss', notifController.dismissNotification);
router.delete('/:notificationId', notifController.deleteNotification);

router.post('/trigger-ai', authorize('admin'), notifController.triggerAiNotifications);
router.post('/trigger-ai/:type', authorize('admin'), notifController.triggerSpecificAi);
router.post('/reset-ai-counts', authorize('admin'), notifController.resetDailyCounts);

export default router;
