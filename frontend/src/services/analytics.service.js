import api from './api';

export const analyticsService = {
  getPlatform: () => api.get('/analytics/platform'),
  getFreelancer: () => api.get('/analytics/freelancer'),
  getClient: () => api.get('/analytics/client'),
  getPublic: () => api.get('/analytics/public'),
};
