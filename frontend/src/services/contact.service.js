import api from './api';

export const contactService = {
  submitContactMessage: (data) => api.post('/contact', data),

  getAdminMessages: (params = {}) => api.get('/contact/admin', { params }),
  getAdminMessageStats: () => api.get('/contact/admin/stats'),
  getAdminMessage: (id) => api.get(`/contact/admin/${id}`),
  updateStatus: (id, status) => api.patch(`/contact/admin/${id}/status`, { status }),
  updatePriority: (id, priority) => api.patch(`/contact/admin/${id}/priority`, { priority }),
  replyToMessage: (id, adminReply) => api.post(`/contact/admin/${id}/reply`, { adminReply }),
  deleteMessage: (id) => api.delete(`/contact/admin/${id}`),
};

export default contactService;
