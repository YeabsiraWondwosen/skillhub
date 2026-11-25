import api from './api';

export const supportService = {
  aiChat: (message, conversationHistory = []) =>
    api.post('/support/chat', { message, conversationHistory }),

  createTicket: (data) => api.post('/support/tickets', data),

  getMyTickets: (params) => api.get('/support/tickets/my', { params }),

  getTicket: (ticketId) => api.get(`/support/tickets/${ticketId}`),

  replyToTicket: (ticketId, content) =>
    api.post(`/support/tickets/${ticketId}/reply`, { content }),

  rateTicket: (ticketId, rating) =>
    api.post(`/support/tickets/${ticketId}/rate`, { rating }),

  adminGetAllTickets: (params) => api.get('/support/admin/tickets', { params }),

  adminGetStats: () => api.get('/support/admin/stats'),

  adminGetTicket: (ticketId) => api.get(`/support/admin/tickets/${ticketId}`),

  adminGetTicketContext: (ticketId) => api.get(`/support/admin/tickets/${ticketId}/context`),

  adminReplyToTicket: (ticketId, content) =>
    api.post(`/support/admin/tickets/${ticketId}/reply`, { content }),

  adminResolveTicket: (ticketId, data) =>
    api.patch(`/support/admin/tickets/${ticketId}/resolve`, data),

  adminUpdateTicketStatus: (ticketId, status) =>
    api.patch(`/support/admin/tickets/${ticketId}/status`, { status }),

  adminUpdateTicketPriority: (ticketId, priority) =>
    api.patch(`/support/admin/tickets/${ticketId}/priority`, { priority }),

  adminAddInternalNote: (ticketId, content) =>
    api.post(`/support/admin/tickets/${ticketId}/notes`, { content }),

  adminSaveInvestigation: (ticketId, data) =>
    api.patch(`/support/admin/tickets/${ticketId}/investigation`, data),
};
