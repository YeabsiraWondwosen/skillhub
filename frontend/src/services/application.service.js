import api from './api';

export const applicationService = {
  submit: (jobId, formData) => api.post(`/applications/jobs/${jobId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getMyApplications: (params) => api.get('/applications/my', { params }),
  getJobApplications: (jobId, params) => api.get(`/applications/jobs/${jobId}`, { params }),
  getApplication: (id) => api.get(`/applications/${id}`),
  updateStatus: (id, data) => api.patch(`/applications/${id}/status`, data),
  withdraw: (id) => api.delete(`/applications/${id}/withdraw`),
  hireFreelancer: (id) => api.post(`/applications/${id}/hire`),
};
