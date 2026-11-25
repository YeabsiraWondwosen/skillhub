import api from './api';

export const reviewService = {
  create: (projectId, data) => api.post(`/reviews/projects/${projectId}`, data),
  getUserReviews: (userId, params) => api.get(`/reviews/users/${userId}`, { params }),
  reply: (reviewId, content) => api.post(`/reviews/${reviewId}/reply`, { content }),
  getMyWritten: () => api.get('/reviews/my-written'),
  update: (reviewId, data) => api.patch(`/reviews/${reviewId}`, data),
  remove: (reviewId) => api.delete(`/reviews/${reviewId}`),
};
