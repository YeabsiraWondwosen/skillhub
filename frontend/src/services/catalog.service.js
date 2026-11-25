import api from './api';

export const catalogService = {
  getCatalogs: (params) => api.get('/catalogs', { params }),

  getCatalog: (slug) => api.get(`/catalogs/${slug}`),

  getMyCatalogs: (params) => api.get('/catalogs/my/catalogs', { params }),

  createCatalog: (formData) =>
    api.post('/catalogs', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  updateCatalog: (catalogId, formData) =>
    api.put(`/catalogs/${catalogId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  deleteCatalog: (catalogId) => api.delete(`/catalogs/${catalogId}`),

  toggleStatus: (catalogId) => api.patch(`/catalogs/${catalogId}/toggle-status`),

  getFreelancerCatalogs: (userId, params) =>
    api.get(`/catalogs/freelancer/${userId}`, { params }),

  getCatalogReviews: (catalogId, params) =>
    api.get(`/catalogs/${catalogId}/reviews`, { params }),

  getCatalogAnalytics: (catalogId) => api.get(`/catalogs/${catalogId}/analytics`),

  getRecommendedFreelancers: (params) =>
    api.get('/catalogs/recommended/freelancers', { params }),

  getRecentCatalogs: (params) => api.get('/catalogs/recent', { params }),

  getSimilarCatalogs: (catalogId, params) =>
    api.get(`/catalogs/${catalogId}/similar`, { params }),

  duplicateCatalog: (catalogId) => api.post(`/catalogs/${catalogId}/duplicate`),
};
