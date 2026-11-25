import api from './api';

export const projectPlannerService = {
  createPlan: (data) => api.post('/project-planner', data),
  getMyPlans: (params) => api.get('/project-planner', { params }),
  getPlanById: (planId) => api.get(`/project-planner/${planId}`),
  deletePlan: (planId) => api.delete(`/project-planner/${planId}`),
  convertToProject: (planId, data) => api.post(`/project-planner/${planId}/convert`, data),
  getUserProjects: () => api.get('/project-planner/projects'),
};
