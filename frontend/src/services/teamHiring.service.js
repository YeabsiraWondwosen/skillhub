import api from './api';

export const teamHiringService = {
  // Dashboard
  getDashboardStats: () => api.get('/team-hiring/dashboard'),

  // Teams CRUD
  getTeams: (params) => api.get('/team-hiring', { params }),
  getTeam: (id) => api.get(`/team-hiring/${id}`),
  createTeam: (data) => api.post('/team-hiring', data),
  updateTeam: (id, data) => api.patch(`/team-hiring/${id}`, data),
  deleteTeam: (id) => api.delete(`/team-hiring/${id}`),

  // Members
  addMember: (teamId, data) => api.post(`/team-hiring/${teamId}/members`, data),
  updateMember: (teamId, memberId, data) => api.patch(`/team-hiring/${teamId}/members/${memberId}`, data),
  removeMember: (teamId, memberId, reason) =>
    api.delete(`/team-hiring/${teamId}/members/${memberId}`, { data: { reason } }),
  updateMemberStatus: (teamId, memberId, status) =>
    api.patch(`/team-hiring/${teamId}/members/${memberId}/status`, { status }),

  // Invitations
  sendInvitation: (teamId, memberId, message) =>
    api.post(`/team-hiring/${teamId}/members/${memberId}/invite`, { message }),
  getInvitations: (teamId) => api.get(`/team-hiring/${teamId}/invitations`),
  cancelInvitation: (teamId, memberId) =>
    api.patch(`/team-hiring/${teamId}/members/${memberId}/cancel-invite`),

  // Required Roles
  addRequiredRole: (teamId, data) => api.post(`/team-hiring/${teamId}/roles`, data),
  updateRequiredRole: (teamId, roleId, data) => api.patch(`/team-hiring/${teamId}/roles/${roleId}`, data),
  deleteRequiredRole: (teamId, roleId) => api.delete(`/team-hiring/${teamId}/roles/${roleId}`),

  // Tasks
  addTask: (teamId, data) => api.post(`/team-hiring/${teamId}/tasks`, data),
  updateTask: (teamId, taskId, data) => api.patch(`/team-hiring/${teamId}/tasks/${taskId}`, data),
  deleteTask: (teamId, taskId) => api.delete(`/team-hiring/${teamId}/tasks/${taskId}`),
  addTaskComment: (teamId, taskId, content) =>
    api.post(`/team-hiring/${teamId}/tasks/${taskId}/comments`, { content }),

  // Messages
  getMessages: (teamId, params) => api.get(`/team-hiring/${teamId}/messages`, { params }),
  sendMessage: (teamId, data) => api.post(`/team-hiring/${teamId}/messages`, data),

  // Budget
  initBudget: (teamId, data) => api.post(`/team-hiring/${teamId}/budget`, data),
  getBudgetSummary: (teamId) => api.get(`/team-hiring/${teamId}/budget`),
  addExpense: (teamId, data) => api.post(`/team-hiring/${teamId}/budget/expenses`, data),
  approveExpense: (teamId, expenseId, approved) =>
    api.patch(`/team-hiring/${teamId}/budget/expenses/${expenseId}`, { approved }),

  // Milestones
  addMilestone: (teamId, data) => api.post(`/team-hiring/${teamId}/milestones`, data),
  updateMilestone: (teamId, milestoneId, data) =>
    api.patch(`/team-hiring/${teamId}/milestones/${milestoneId}`, data),

  // AI
  generateTeamRecommendation: (teamId) => api.post(`/team-hiring/${teamId}/ai-recommendation`),

  // Analytics
  getTeamAnalytics: (teamId) => api.get(`/team-hiring/${teamId}/analytics`),
};
