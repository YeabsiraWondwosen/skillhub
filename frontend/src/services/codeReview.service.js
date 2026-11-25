import api from './api';

export const codeReviewService = {
  submitFileReview: (formData) =>
    api.post('/code-reviews/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),

  submitPasteReview: (data) =>
    api.post('/code-reviews/paste', data, { timeout: 120000 }),

  getReview: (reviewId) =>
    api.get(`/code-reviews/${reviewId}`),

  getMyReviews: (params) =>
    api.get('/code-reviews/my', { params }),

  getMyReviewStats: () =>
    api.get('/code-reviews/my/stats'),

  deleteReview: (reviewId) =>
    api.delete(`/code-reviews/${reviewId}`),

  getPublicReview: (reviewId) =>
    api.get(`/code-reviews/public/${reviewId}`),
};
