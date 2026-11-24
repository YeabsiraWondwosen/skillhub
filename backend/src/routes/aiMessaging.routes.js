import { Router } from 'express';
import * as aiMessagingController from '../controllers/aiMessaging.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

// ─── AI Smart Replies ────────────────────────────────────────────────────────
router.post('/smart-reply', aiMessagingController.getSmartReplies);
router.post('/quick-replies', aiMessagingController.getQuickReplies);

// ─── AI Grammar & Rewriting ──────────────────────────────────────────────────
router.post('/grammar', aiMessagingController.getGrammarCorrection);
router.post('/rewrite', aiMessagingController.getRewrittenMessage);

// ─── AI Translation ──────────────────────────────────────────────────────────
router.post('/translate', aiMessagingController.getTranslation);

// ─── AI Summarization ────────────────────────────────────────────────────────
router.get('/summary/:conversationId', aiMessagingController.getConversationSummary);

// ─── AI Sentiment ────────────────────────────────────────────────────────────
router.post('/sentiment', aiMessagingController.getSentimentAnalysis);

// ─── AI Smart Search ─────────────────────────────────────────────────────────
router.post('/search', aiMessagingController.searchMessages);

// ─── Message Reactions ───────────────────────────────────────────────────────
router.post('/messages/:messageId/reactions', aiMessagingController.toggleReaction);

// ─── Pin / Star / Forward ────────────────────────────────────────────────────
router.post('/messages/:messageId/pin', aiMessagingController.togglePin);
router.post('/messages/:messageId/star', aiMessagingController.toggleStar);
router.post('/messages/:messageId/forward', aiMessagingController.forwardMessage);
router.get('/messages/:conversationId/starred', aiMessagingController.getStarredMessages);
router.get('/messages/:conversationId/pinned', aiMessagingController.getPinnedMessages);

// ─── Conversation Settings (pin, star, mute, archive, block) ─────────────────
router.post('/conversations/:conversationId/settings', aiMessagingController.updateConversationSettings);

export default router;
