import api from './api';

export const milestoneService = {
  getProjectMilestones: (projectId) => api.get(`/milestones/projects/${projectId}`),
  create: (projectId, data) => api.post(`/milestones/projects/${projectId}`, data),
  update: (id, data) => api.put(`/milestones/${id}`, data),
  delete: (id) => api.delete(`/milestones/${id}`),
  fund: (id) => api.post(`/milestones/${id}/fund`),
  submit: (id, formData) => api.post(`/milestones/${id}/submit`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  approve: (id) => api.post(`/milestones/${id}/approve`),
  requestRevision: (id, note) => api.post(`/milestones/${id}/revision`, { note }),
};
