import api from './api';

export const learningHubService = {
  getDashboard: () => api.get('/learning-hub/dashboard'),
  getAnalysis: (params) => api.get('/learning-hub/analysis', { params }),
  getCourses: (params) => api.get('/learning-hub/courses', { params }),
  getCertifications: (params) => api.get('/learning-hub/certifications', { params }),
  getResources: (params) => api.get('/learning-hub/resources', { params }),
  getPlans: (params) => api.get('/learning-hub/plans', { params }),
  getPlan: (planId) => api.get(`/learning-hub/plans/${planId}`),
  createPlan: (data) => api.post('/learning-hub/plans', data),
  updatePlanStatus: (planId, status) => api.patch(`/learning-hub/plans/${planId}/status`, { status }),
  updateCourseProgress: (planId, courseId, data) => api.patch(`/learning-hub/plans/${planId}/courses/${courseId}`, data),
  updateCertProgress: (planId, certId, data) => api.patch(`/learning-hub/plans/${planId}/certifications/${certId}`, data),
  updateResourceProgress: (planId, resourceId, data) => api.patch(`/learning-hub/plans/${planId}/resources/${resourceId}`, data),
  toggleBookmark: (planId, resourceId) => api.patch(`/learning-hub/plans/${planId}/resources/${resourceId}/bookmark`),
  deletePlan: (planId) => api.delete(`/learning-hub/plans/${planId}`),
};
