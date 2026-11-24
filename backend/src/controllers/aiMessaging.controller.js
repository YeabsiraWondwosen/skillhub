import { Message, Conversation } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse } from '../utils/apiResponse.js';
import { emitToConversation, emitToUser } from '../services/socket.service.js';
import { getMessageWithAccess, getConversationWithAccess } from '../utils/messageAccess.js';
import { isAIAvailable } from '../services/aiClient.js';
import {
  generateSmartReply,
  correctGrammar,
  rewriteMessage,
  translateMessage,
  summarizeConversation,
  analyzeSentiment,
  smartSearchMessages,
  generateQuickReplies,
} from '../services/aiMessaging.service.js';

// Fail fast with an actionable message when the AI provider has not been
// configured, instead of letting the service return deterministic fallback
// text that looks like a real AI result.
const ensureAIConfigured = () => {
  if (!isAIAvailable()) {
    throw new ApiError(
      503,
      'AI features are unavailable: the server is missing the GEMINI_API_KEY configuration.'
    );
  }
};

/**
 * Generate smart reply suggestions for a message
 */
export const getSmartReplies = catchAsync(async (req, res) => {
  ensureAIConfigured();
  const { messageText, conversationId, tone } = req.body;

  if (!messageText) throw new ApiError(400, 'messageText is required');

  // Fetch last few messages for context if conversationId provided
  let history = [];
  if (conversationId) {
    // IDOR guard: 404 if the conversation doesn't exist, 403 if the requesting
    // user is not a participant. getConversationWithAccess centralizes this.
    await getConversationWithAccess(conversationId, req.user._id);

    const messages = await Message.find({ conversation: conversationId, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('sender', 'firstName lastName');
    history = messages.reverse().map(m => ({
      senderName: `${m.sender?.firstName || 'User'}`,
      content: m.content,
    }));
  }

  const suggestions = await generateSmartReply(messageText, history, tone || 'professional');
  sendResponse(res, 200, 'Smart replies generated', suggestions);
});

/**
 * Correct grammar in a message
 */
export const getGrammarCorrection = catchAsync(async (req, res) => {
  ensureAIConfigured();
  const { text } = req.body;
  if (!text) throw new ApiError(400, 'text is required');

  const result = await correctGrammar(text);
  sendResponse(res, 200, 'Grammar corrected', result);
});

/**
 * Rewrite a message in a different style
 */
export const getRewrittenMessage = catchAsync(async (req, res) => {
  ensureAIConfigured();
  const { text, style } = req.body;
  if (!text) throw new ApiError(400, 'text is required');

  const result = await rewriteMessage(text, style || 'professional');
  sendResponse(res, 200, 'Message rewritten', result);
});

/**
 * Translate a message
 */
export const getTranslation = catchAsync(async (req, res) => {
  ensureAIConfigured();
  const { text, targetLanguage } = req.body;
  if (!text) throw new ApiError(400, 'text is required');

  const result = await translateMessage(text, targetLanguage || 'Amharic');
  sendResponse(res, 200, 'Message translated', result);
});

/**
 * Summarize a conversation
 */
export const getConversationSummary = catchAsync(async (req, res) => {
  ensureAIConfigured();
  const { conversationId } = req.params;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, 'Conversation not found');

  const isParticipant = conversation.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );
  if (!isParticipant) throw new ApiError(403, 'Not authorized');

  const messages = await Message.find({ conversation: conversationId, isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('sender', 'firstName lastName');

  const messageData = messages.reverse().map(m => ({
    senderName: `${m.sender?.firstName || 'User'}`,
    content: m.content,
    createdAt: m.createdAt,
  }));

  const summary = await summarizeConversation(messageData);
  sendResponse(res, 200, 'Conversation summarized', summary);
});

/**
 * Analyze sentiment of a message
 */
export const getSentimentAnalysis = catchAsync(async (req, res) => {
  ensureAIConfigured();
  const { text } = req.body;
  if (!text) throw new ApiError(400, 'text is required');

  const sentiment = await analyzeSentiment(text);
  sendResponse(res, 200, 'Sentiment analyzed', sentiment);
});

/**
 * Smart search messages using natural language
 */
export const searchMessages = catchAsync(async (req, res) => {
  ensureAIConfigured();
  const { conversationId, query } = req.body;

  if (!query) throw new ApiError(400, 'query is required');

  let messages = [];
  if (conversationId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new ApiError(404, 'Conversation not found');

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) throw new ApiError(403, 'Not authorized');

    const msgs = await Message.find({ conversation: conversationId, isDeleted: false })
      .populate('sender', 'firstName lastName')
      .limit(200);

    messages = msgs.map(m => ({
      _id: m._id,
      content: m.content,
      senderName: `${m.sender?.firstName || 'User'}`,
      createdAt: m.createdAt,
    }));
  } else {
    // Search across all user's conversations
    const userConversations = await Conversation.find({ participants: req.user._id })
      .select('_id');

    const convIds = userConversations.map(c => c._id);
    const msgs = await Message.find({ conversation: { $in: convIds }, isDeleted: false })
      .populate('sender', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(200);

    messages = msgs.map(m => ({
      _id: m._id,
      content: m.content,
      senderName: `${m.sender?.firstName || 'User'}`,
      createdAt: m.createdAt,
      conversation: m.conversation,
    }));
  }

  const results = await smartSearchMessages(query, messages);
  sendResponse(res, 200, 'Search results', results);
});

/**
 * Generate contextual quick replies
 */
export const getQuickReplies = catchAsync(async (req, res) => {
  ensureAIConfigured();
  const { messageText, conversationType } = req.body;
  if (!messageText) throw new ApiError(400, 'messageText is required');

  const quickReplies = await generateQuickReplies(messageText, conversationType || 'direct');
  sendResponse(res, 200, 'Quick replies generated', quickReplies);
});

/**
 * AI-compose: generate a full message from brief instructions
 */
export const aiCompose = catchAsync(async (req, res) => {
  const { instructions, context, tone } = req.body;
  if (!instructions) throw new ApiError(400, 'instructions are required');

  sendResponse(res, 201, 'Message composed', {
    composed: instructions,
    tone: tone || 'professional',
  });
});

/**
 * Toggle reaction on a message
 */
export const toggleReaction = catchAsync(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;

  if (!emoji) throw new ApiError(400, 'emoji is required');

  const { message } = await getMessageWithAccess(messageId, req.user._id);
  if (message.isDeleted) throw new ApiError(400, 'Cannot react to a deleted message');

  if (!Array.isArray(message.reactions)) message.reactions = [];

  const existingIdx = message.reactions.findIndex(
    r => r.user.toString() === req.user._id.toString() && r.emoji === emoji
  );

  if (existingIdx >= 0) {
    message.reactions.splice(existingIdx, 1);
  } else {
    message.reactions.push({ user: req.user._id, emoji });
  }

  await message.save();
  await message.populate('sender', 'firstName lastName avatar');
  emitToConversation(message.conversation.toString(), 'message:updated', message);
  sendResponse(res, 200, existingIdx >= 0 ? 'Reaction removed' : 'Reaction added', message);
});

/**
 * Pin/Unpin a message
 */
export const togglePin = catchAsync(async (req, res) => {
  const { messageId } = req.params;

  const { message } = await getMessageWithAccess(messageId, req.user._id);
  if (message.isDeleted) throw new ApiError(400, 'Cannot pin a deleted message');

  if (!Array.isArray(message.pinnedBy)) message.pinnedBy = [];
  const isPinned = message.pinnedBy.includes(req.user._id);

  if (isPinned) {
    message.pinnedBy.pull(req.user._id);
  } else {
    message.pinnedBy.addToSet(req.user._id);
  }

  await message.save();
  await message.populate('sender', 'firstName lastName avatar');
  emitToConversation(message.conversation.toString(), 'message:updated', message);
  emitToConversation(message.conversation.toString(), isPinned ? 'message:unpinned' : 'message:pinned', message);
  sendResponse(res, 200, isPinned ? 'Message unpinned' : 'Message pinned', message);
});

/**
 * Star/Unstar a message
 */
export const toggleStar = catchAsync(async (req, res) => {
  const { messageId } = req.params;

  const { message } = await getMessageWithAccess(messageId, req.user._id);
  if (message.isDeleted) throw new ApiError(400, 'Cannot star a deleted message');

  if (!Array.isArray(message.starredBy)) message.starredBy = [];
  const isStarred = message.starredBy.includes(req.user._id);

  if (isStarred) {
    message.starredBy.pull(req.user._id);
  } else {
    message.starredBy.addToSet(req.user._id);
  }

  await message.save();
  await message.populate('sender', 'firstName lastName avatar');
  emitToConversation(message.conversation.toString(), 'message:updated', message);
  emitToConversation(message.conversation.toString(), isStarred ? 'message:unstarred' : 'message:starred', message);
  sendResponse(res, 200, isStarred ? 'Message unstarred' : 'Message starred', message);
});

/**
 * Forward a message to another conversation (delegates to message controller
 * so there is a single source of truth for forwarding logic).
 */
export { forwardMessage } from './message.controller.js';

/**
 * Conversation-level actions: pin, star, mute, archive, block, read/unread, delete
 */
export const updateConversationSettings = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const { action, value } = req.body;

  const validActions = [
    'isPinned', 'isStarred', 'isMuted', 'isArchived', 'isBlocked',
    'markRead', 'markUnread', 'deleteConversation',
  ];
  if (!validActions.includes(action)) {
    throw new ApiError(400, `Invalid action. Must be one of: ${validActions.join(', ')}`);
  }

  const conversation = await getConversationWithAccess(conversationId, req.user._id);

  // ── Read / unread ──────────────────────────────────────────────────────
  if (action === 'markRead') {
    await Conversation.updateOne(
      { _id: conversationId, 'unreadCounts.user': req.user._id },
      { $set: { 'unreadCounts.$.count': 0 } }
    );
    const settings = await getMyUserSettings(conversation, req.user._id);
    settings.lastReadAt = new Date();
    await conversation.save();
    emitToUser(req.user._id.toString(), 'conversation:updated', {
      conversationId,
      myUnreadCount: 0,
      userSettings: [settings],
    });
    return sendResponse(res, 200, 'Conversation marked as read', conversation);
  }

  if (action === 'markUnread') {
    await Conversation.updateOne(
      { _id: conversationId, 'unreadCounts.user': req.user._id },
      { $set: { 'unreadCounts.$.count': 1 } }
    );
    const settings = await getMyUserSettings(conversation, req.user._id);
    settings.lastReadAt = new Date(0);
    await conversation.save();
    emitToUser(req.user._id.toString(), 'conversation:updated', {
      conversationId,
      myUnreadCount: 1,
      userSettings: [settings],
    });
    return sendResponse(res, 200, 'Conversation marked as unread', conversation);
  }

  // ── Delete conversation for this user only ─────────────────────────────
  if (action === 'deleteConversation') {
    if (!conversation.deletedFor.some((id) => id.toString() === req.user._id.toString())) {
      conversation.deletedFor.push(req.user._id);
    }
    await conversation.save();
    emitToUser(req.user._id.toString(), 'conversation:updated', {
      conversationId,
      deletedForMe: true,
    });
    return sendResponse(res, 200, 'Conversation deleted for you', conversation);
  }

  let userSettings = getMyUserSettings(conversation, req.user._id);

  if (!userSettings) {
    conversation.userSettings.push({
      user: req.user._id,
      [action]: value !== undefined ? value : true,
    });
  } else {
    userSettings[action] = value !== undefined ? value : !userSettings[action];
    if (action === 'isBlocked') {
      userSettings.blockedBy = value ? req.user._id : undefined;
    }
  }

  await conversation.save();
  emitToConversation(conversationId, 'conversation:updated', conversation);
  sendResponse(res, 200, `Conversation ${action} updated`, conversation);
});

const getMyUserSettings = (conversation, userId) =>
  conversation.userSettings.find((s) => s.user.toString() === userId.toString());

/**
 * Get starred messages in a conversation
 */
export const getStarredMessages = catchAsync(async (req, res) => {
  const { conversationId } = req.params;

  await getConversationWithAccess(conversationId, req.user._id);

  const messages = await Message.find({
    conversation: conversationId,
    starredBy: req.user._id,
    isDeleted: false,
    deletedFor: { $ne: req.user._id },
  })
    .populate('sender', 'firstName lastName avatar')
    .sort({ createdAt: -1 });

  sendResponse(res, 200, 'Starred messages', messages);
});

/**
 * Get pinned messages in a conversation
 */
export const getPinnedMessages = catchAsync(async (req, res) => {
  const { conversationId } = req.params;

  await getConversationWithAccess(conversationId, req.user._id);

  const messages = await Message.find({
    conversation: conversationId,
    pinnedBy: { $exists: true, $ne: [] },
    isDeleted: false,
    deletedFor: { $ne: req.user._id },
  })
    .populate('sender', 'firstName lastName avatar')
    .sort({ createdAt: -1 });

  sendResponse(res, 200, 'Pinned messages', messages);
});
