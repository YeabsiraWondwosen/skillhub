import api from './api';

export const jobService = {
  getJobs: (params) => api.get('/jobs', { params }),
  getJob: (id) => api.get(`/jobs/${id}`),
  createJob: (formData) => api.post('/jobs', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateJob: (id, data) => api.put(`/jobs/${id}`, data),
  updateJobStatus: (id, status) => api.patch(`/jobs/${id}/status`, { status }),
  deleteJob: (id) => api.delete(`/jobs/${id}`),
  getMyJobs: (params) => api.get('/jobs/my/jobs', { params }),
  inviteFreelancer: (jobId, freelancerId) => api.post(`/jobs/${jobId}/invite`, { freelancerId }),
  getRecommendedJobs: () => api.get('/jobs/recommended/for-me'),
  pauseJob: (id) => api.patch(`/jobs/${id}/pause`),
  resumeJob: (id) => api.patch(`/jobs/${id}/resume`),
  cancelJob: (id) => api.post(`/jobs/${id}/cancel`),

  // Payment workflow
  fundJobPayment: (jobId) => api.post(`/jobs/${jobId}/fund`),
  startJobWork: (jobId) => api.post(`/jobs/${jobId}/start-work`),
  submitJobDelivery: (jobId, formData) => api.post(`/jobs/${jobId}/submit-delivery`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  approveJobDelivery: (jobId) => api.post(`/jobs/${jobId}/approve-delivery`),
};
