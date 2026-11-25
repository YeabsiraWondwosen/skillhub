import api from './api';

export const notificationService = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: (params) => api.get('/notifications/unread-count', { params }),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),

  // AI notifications
  getAiRecommendations: (params) => api.get('/notifications/ai-recommendations', { params }),
  dismissNotification: (id) => api.patch(`/notifications/${id}/dismiss`),
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (data) => api.patch('/notifications/preferences', data),
  triggerAiNotifications: () => api.post('/notifications/trigger-ai'),
  triggerSpecificAi: (type) => api.post(`/notifications/trigger-ai/${type}`),
  getAiStats: (params) => api.get('/notifications/ai-stats', { params }),
  resetAiCounts: () => api.post('/notifications/reset-ai-counts'),
};
