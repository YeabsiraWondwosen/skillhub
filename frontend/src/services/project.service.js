import api from './api';

export const projectService = {
  getMyProjects: (params) => api.get('/projects', { params }),
  getProject: (id) => api.get(`/projects/${id}`),
  updateProject: (id, data) => api.patch(`/projects/${id}`, data),
  addTask: (projectId, data) => api.post(`/projects/${projectId}/tasks`, data),
  updateTask: (projectId, taskId, data) => api.put(`/projects/${projectId}/tasks/${taskId}`, data),
  deleteTask: (projectId, taskId) => api.delete(`/projects/${projectId}/tasks/${taskId}`),
  uploadFiles: (projectId, formData) => api.post(`/projects/${projectId}/files`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  submitDelivery: (projectId, formData) => api.post(`/projects/${projectId}/deliver`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  reviewDelivery: (projectId, deliveryId, data) => api.post(`/projects/${projectId}/deliveries/${deliveryId}/review`, data),
  getProjectDeliveries: (projectId) => api.get(`/projects/${projectId}/deliveries`),
  getProjectDelivery: (projectId, deliveryId) => api.get(`/projects/${projectId}/deliveries/${deliveryId}`),
  updateDelivery: (projectId, deliveryId, formData) => api.put(`/projects/${projectId}/deliveries/${deliveryId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  completeProject: (projectId) => api.post(`/projects/${projectId}/complete`),
  raiseDispute: (projectId, data) => api.post(`/projects/${projectId}/dispute`, data),
};
