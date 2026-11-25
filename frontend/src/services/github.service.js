import api from './api';

export const githubService = {
  link: (githubUrl) => api.post('/github/link', { githubUrl }),
  unlink: () => api.post('/github/unlink'),
  getMyData: () => api.get('/github/me'),
  refresh: () => api.post('/github/refresh'),
  getUserData: (userId) => api.get(`/github/${userId}`),
  getUserRepos: (userId, params) => api.get(`/github/${userId}/repos`, { params }),
  getUserLanguages: (userId) => api.get(`/github/${userId}/languages`),
  getUserContributions: (userId) => api.get(`/github/${userId}/contributions`),
  getUserCommitActivity: (userId) => api.get(`/github/${userId}/commits`),
};
