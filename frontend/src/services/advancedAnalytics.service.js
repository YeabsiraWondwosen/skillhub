import api from './api';

export const advancedAnalyticsService = {
  // Dashboard
  getDashboard: () => api.get('/advanced-analytics/dashboard'),

  // Revenue
  getRevenueReport: (params) => api.get('/advanced-analytics/revenue', { params }),

  // Platform Stats
  getPlatformStats: () => api.get('/advanced-analytics/platform-stats'),

  // Fraud Detection
  getFraudAlerts: (params) => api.get('/advanced-analytics/fraud', { params }),
  runFraudDetection: () => api.post('/advanced-analytics/fraud/run'),
  resolveFraudAlert: (alertId, data) => api.patch(`/advanced-analytics/fraud/${alertId}/resolve`, data),

  // Spam Detection
  getSpamFlags: (params) => api.get('/advanced-analytics/spam', { params }),
  analyzeContent: (data) => api.post('/advanced-analytics/spam/analyze', data),
  resolveSpamFlag: (flagId, data) => api.patch(`/advanced-analytics/spam/${flagId}/resolve`, data),

  // User Growth
  getUserGrowth: (params) => api.get('/advanced-analytics/user-growth', { params }),

  // Business Insights
  getInsights: (params) => api.get('/advanced-analytics/insights', { params }),
  generateInsights: () => api.post('/advanced-analytics/insights/generate'),
  markInsightViewed: (insightId) => api.patch(`/advanced-analytics/insights/${insightId}/viewed`),
};
