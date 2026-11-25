import api from './api';

export const aiService = {
  getFreelancerMatches: (jobId) => api.get(`/ai/match/${jobId}`),
  getJobRecommendations: () => api.get('/ai/recommend-jobs'),
  generateProposal: (jobId) => api.get(`/ai/proposal/${jobId}`),
  generateFullProposal: (jobId) => api.get(`/ai/full-proposal/${jobId}`),
  getSkillGaps: (jobId) => api.get(`/ai/skill-gaps/${jobId}`),
};
