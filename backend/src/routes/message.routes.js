import { Router } from 'express';
import * as messageController from '../controllers/message.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { messageLimiter } from '../middleware/rateLimiter.js';
import { handleMulterError, uploadMessageFiles } from '../middleware/upload.middleware.js';
import { sendMessageSchema, createConversationSchema } from '../validations/message.validation.js';

const router = Router();
router.use(protect);

router.get('/conversations', messageController.getMyConversations);
router.get('/conversations/eligible-contacts', messageController.getEligibleContactList);
router.post('/conversations', validate(createConversationSchema), messageController.getOrCreateConversation);
router.post('/conversations/start', messageController.startConversation);
router.get('/conversations/:conversationId/messages', messageController.getMessages);
router.post('/conversations/:conversationId/messages', messageLimiter, handleMulterError(uploadMessageFiles), validate(sendMessageSchema), messageController.sendMessage);
router.patch('/messages/:messageId', messageController.editMessage);
router.delete('/messages/:messageId', messageController.deleteMessage);
router.post('/messages/:messageId/forward', messageController.forwardMessage);
router.get('/unread-count', messageController.getUnreadCount);

export default router;
