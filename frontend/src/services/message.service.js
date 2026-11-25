import api from './api';

export const messageService = {
  // ─── Conversations ────────────────────────────────────────────────────────
  getConversations: () => api.get('/messages/conversations'),
  getOrCreateConversation: (data) => api.post('/messages/conversations', data),
  startConversation: (participantId) => api.post('/messages/conversations/start', { participantId }),
  getEligibleContacts: () => api.get('/messages/conversations/eligible-contacts'),
  getMessages: (conversationId, params) => api.get(`/messages/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId, formData) => api.post(`/messages/conversations/${conversationId}/messages`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  editMessage: (messageId, content) => api.patch(`/messages/messages/${messageId}`, { content }),
  deleteMessage: (messageId, scope = 'everyone') =>
    api.delete(`/messages/messages/${messageId}`, { params: { scope } }),
  getUnreadCount: () => api.get('/messages/unread-count'),

  // ─── User Search ─────────────────────────────────────────────────────────
  searchUsers: (params) => api.get('/users/search', { params }),

  // ─── AI Messaging ────────────────────────────────────────────────────────
  getSmartReplies: (data) => api.post('/ai-messaging/smart-reply', data),
  getQuickReplies: (data) => api.post('/ai-messaging/quick-replies', data),
  correctGrammar: (text) => api.post('/ai-messaging/grammar', { text }),
  rewriteMessage: (text, style) => api.post('/ai-messaging/rewrite', { text, style }),
  translateMessage: (text, targetLanguage) => api.post('/ai-messaging/translate', { text, targetLanguage }),
  getConversationSummary: (conversationId) => api.get(`/ai-messaging/summary/${conversationId}`),
  analyzeSentiment: (text) => api.post('/ai-messaging/sentiment', { text }),
  searchMessages: ({ conversationId, query } = {}) =>
    api.post('/ai-messaging/search', { conversationId, query }),

  // ─── Reactions / Pin / Star / Forward ────────────────────────────────────
  toggleReaction: (messageId, emoji) => api.post(`/ai-messaging/messages/${messageId}/reactions`, { emoji }),
  togglePin: (messageId) => api.post(`/ai-messaging/messages/${messageId}/pin`),
  toggleStar: (messageId) => api.post(`/ai-messaging/messages/${messageId}/star`),
  forwardMessage: (messageId, targetConversationIds) =>
    api.post(`/messages/messages/${messageId}/forward`, {
      targetConversationIds: Array.isArray(targetConversationIds) ? targetConversationIds : [targetConversationIds],
    }),
  getStarredMessages: (conversationId) => api.get(`/ai-messaging/messages/${conversationId}/starred`),
  getPinnedMessages: (conversationId) => api.get(`/ai-messaging/messages/${conversationId}/pinned`),
  updateConversationSettings: (conversationId, action, value) =>
    api.post(`/ai-messaging/conversations/${conversationId}/settings`, { action, value }),
};
