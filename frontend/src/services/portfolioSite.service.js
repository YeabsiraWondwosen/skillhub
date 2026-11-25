import api from './api';

export const portfolioSiteService = {
  getTemplates: () => api.get('/portfolio-sites/templates'),

  getMySites: (params) => api.get('/portfolio-sites/my', { params }),

  getSite: (slug) => api.get(`/portfolio-sites/${slug}`),

  getSiteHtml: (slug) => api.get(`/portfolio-sites/${slug}/html`),

  generatePortfolio: (data) => api.post('/portfolio-sites/generate', data),

  updateSite: (slug, data) => api.put(`/portfolio-sites/${slug}`, data),

  deleteSite: (slug) => api.delete(`/portfolio-sites/${slug}`),

  setDefault: (slug) => api.patch(`/portfolio-sites/${slug}/default`),

  getStats: () => api.get('/portfolio-sites/stats'),
};
