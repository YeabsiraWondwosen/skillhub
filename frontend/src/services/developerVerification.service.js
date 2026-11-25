import api from './api';

export const developerVerificationService = {
  getMyVerifications: () => api.get('/developer-verifications/my'),

  getMyScore: () => api.get('/developer-verifications/my/score'),

  getVerification: (id) => api.get(`/developer-verifications/${id}`),

  getScoreByUser: (userId) => api.get(`/developer-verifications/score/${userId}`),

  submitIdentity: (data) => api.post('/developer-verifications/identity', data),

  uploadIdentityDocuments: (formData, onProgress) =>
    api.post('/developer-verifications/identity/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }),

  submitGithub: (data) => api.post('/developer-verifications/github', data),

  submitPortfolio: (formData, onProgress) =>
    api.post('/developer-verifications/portfolio', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }),

  resubmitVerification: (id) => api.post(`/developer-verifications/${id}/resubmit`),

  // Admin
  adminGetAll: (params) => api.get('/developer-verifications/admin/all', { params }),

  adminGetPending: (params) => api.get('/developer-verifications/admin/pending', { params }),

  adminGetStats: () => api.get('/developer-verifications/admin/stats'),

  adminReview: (id, data) => api.patch(`/developer-verifications/admin/${id}/review`, data),
};
