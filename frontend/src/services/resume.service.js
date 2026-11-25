import api from './api';

export const resumeService = {
  generateResume: (data) =>
    api.post('/resumes/generate', data, { timeout: 120000 }),

  getMyResumes: (params) =>
    api.get('/resumes/my', { params }),

  getResume: (resumeId) =>
    api.get(`/resumes/${resumeId}`),

  previewResume: (resumeId) =>
    api.get(`/resumes/${resumeId}/preview`, { responseType: 'blob' }),

  downloadResume: (resumeId) =>
    api.get(`/resumes/${resumeId}/download`, { responseType: 'blob' }),

  deleteResume: (resumeId) =>
    api.delete(`/resumes/${resumeId}`),

  getTemplates: () =>
    api.get('/resumes/templates'),

  getStats: () =>
    api.get('/resumes/stats'),
};
