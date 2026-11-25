import api from './api';

export const categoryService = {
  getCategories: () => api.get('/categories'),
  getCategory: (id) => api.get(`/categories/${id}`),
  getCategoryBySlug: (slug) => api.get(`/categories/by-slug/${slug}`),
  getCategoryTree: () => api.get('/categories/tree'),
  getSkillsByCategory: (id) => api.get(`/categories/${id}/skills`),
  getSubcategoriesByCategory: (id) => api.get(`/categories/${id}/subcategories`),

  // Admin
  getAllCategories: (params) => api.get('/categories/admin/all', { params }),
  getAdminTree: () => api.get('/categories/admin/tree'),
  getCategoriesStats: () => api.get('/categories/admin/stats'),
  getAdminCategoryOverview: () => api.get('/categories/admin/overview'),
  getAdminCategoryDetail: (id) => api.get(`/categories/admin/${id}/overview`),
  getAdminCategoryFreelancers: (id, params) => api.get(`/categories/admin/${id}/freelancers`, { params }),
  getAdminCategoryJobs: (id, params) => api.get(`/categories/admin/${id}/jobs`, { params }),
  getAdminCategoryServices: (id, params) => api.get(`/categories/admin/${id}/services`, { params }),
  createCategory: (data) => api.post('/categories/admin', data),
  updateCategory: (id, data) => api.put(`/categories/admin/${id}`, data),
  deleteCategory: (id) => api.delete(`/categories/admin/${id}`),
  seedCategories: () => api.post('/categories/admin/seed'),
  toggleFeatured: (id) => api.put(`/categories/admin/${id}/toggle-featured`),
  toggleHidden: (id) => api.put(`/categories/admin/${id}/toggle-hidden`),
  reorderCategories: (orderedIds) => api.put('/categories/admin/reorder', { orderedIds }),
  bulkCategoriesAction: (ids, action) => api.post('/categories/admin/bulk', { ids, action }),

  // Skill CRUD (admin)
  createSkill: (categoryId, data) => api.post(`/categories/admin/${categoryId}/skills`, data),
  updateSkill: (skillId, data) => api.put(`/categories/admin/skills/${skillId}`, data),
  deleteSkill: (skillId) => api.delete(`/categories/admin/skills/${skillId}`),
  toggleSkillActive: (skillId) => api.put(`/categories/admin/skills/${skillId}/toggle-active`),
};
