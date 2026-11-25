import api from './api';

export const badgeService = {
  getBadgeTypes: () => api.get('/badges/types'),

  getMyBadges: () => api.get('/badges/my'),

  getUserBadges: (userId) => api.get(`/badges/user/${userId}`),

  refreshMyBadges: () => api.post('/badges/refresh'),

  getLeaderboard: (params) => api.get('/badges/leaderboard', { params }),
};
