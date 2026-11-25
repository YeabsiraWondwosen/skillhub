import api from './api';

export const recruiterService = {
  // Freelancer Search
  searchFreelancers: (params) => api.get('/recruiter/freelancers', { params }),
  getFreelancer: (id) => api.get(`/recruiter/freelancers/${id}`),
  compareCandidates: (ids) => api.post('/recruiter/compare', { ids }),

  // Pipelines
  getPipelines: (params) => api.get('/recruiter/pipelines', { params }),
  getPipeline: (id) => api.get(`/recruiter/pipelines/${id}`),
  createPipeline: (data) => api.post('/recruiter/pipelines', data),
  updatePipeline: (id, data) => api.patch(`/recruiter/pipelines/${id}`, data),
  deletePipeline: (id) => api.delete(`/recruiter/pipelines/${id}`),

  // Candidates
  addCandidate: (pipelineId, data) => api.post(`/recruiter/pipelines/${pipelineId}/candidates`, data),
  moveCandidate: (pipelineId, candidateId, stage, reason) =>
    api.patch(`/recruiter/pipelines/${pipelineId}/candidates/${candidateId}/move`, { stage, reason }),
  rateCandidate: (pipelineId, candidateId, rating) =>
    api.patch(`/recruiter/pipelines/${pipelineId}/candidates/${candidateId}/rate`, { rating }),
  addCandidateNote: (pipelineId, candidateId, content) =>
    api.post(`/recruiter/pipelines/${pipelineId}/candidates/${candidateId}/notes`, { content }),
  removeCandidate: (pipelineId, candidateId) =>
    api.delete(`/recruiter/pipelines/${pipelineId}/candidates/${candidateId}`),

  // Invitations
  sendInvitation: (pipelineId, data) => api.post(`/recruiter/pipelines/${pipelineId}/invitations`, data),
  getInvitations: (pipelineId) => api.get(`/recruiter/pipelines/${pipelineId}/invitations`),
  cancelInvitation: (pipelineId, invitationId) =>
    api.patch(`/recruiter/pipelines/${pipelineId}/invitations/${invitationId}/cancel`),

  // Analytics
  getAnalytics: () => api.get('/recruiter/analytics'),
};
