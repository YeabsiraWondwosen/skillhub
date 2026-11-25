import api from './api';

export const interviewAssistantService = {
  // AI Generation
  generateQuestions: (data) => api.post('/interview-assistant/generate-questions', data),
  generateCodingChallenge: (data) => api.post('/interview-assistant/generate-challenge', data),
  evaluateAnswer: (data) => api.post('/interview-assistant/evaluate-answer', data),
  evaluateCode: (data) => api.post('/interview-assistant/evaluate-code', data),

  // Sessions
  getSessions: (params) => api.get('/interview-assistant/sessions', { params }),
  getSession: (id) => api.get(`/interview-assistant/sessions/${id}`),
  createSession: (data) => api.post('/interview-assistant/sessions', data),
  updateSession: (id, data) => api.patch(`/interview-assistant/sessions/${id}`, data),
  deleteSession: (id) => api.delete(`/interview-assistant/sessions/${id}`),

  // Questions & Challenges
  updateQuestionAnswer: (sessionId, questionId, data) =>
    api.patch(`/interview-assistant/sessions/${sessionId}/questions/${questionId}`, data),
  updateChallengeSolution: (sessionId, challengeId, data) =>
    api.patch(`/interview-assistant/sessions/${sessionId}/challenges/${challengeId}`, data),

  // Scorecard & Summary
  generateScorecard: (sessionId) => api.post(`/interview-assistant/sessions/${sessionId}/generate-scorecard`),
  generateSummary: (sessionId) => api.post(`/interview-assistant/sessions/${sessionId}/generate-summary`),

  // Analytics
  getAnalytics: () => api.get('/interview-assistant/analytics'),
};
