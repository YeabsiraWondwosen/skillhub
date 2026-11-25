import api from './api';

export const reputationService = {
  getMyReputation: () => api.get('/reputation/my'),

  getUserReputation: (userId) => api.get(`/reputation/user/${userId}`),

  recalculateMyReputation: () => api.post('/reputation/recalculate'),

  getLeaderboard: (params) => api.get('/reputation/leaderboard', { params }),

  getReputationConfig: () => api.get('/reputation/config'),
};
