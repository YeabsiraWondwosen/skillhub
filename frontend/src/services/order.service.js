import api from './api';

export const orderService = {
  getOrders: (params) => api.get('/service-orders', { params }),
  getOrder: (orderId) => api.get(`/service-orders/${orderId}`),
  createOrder: (formData) =>
    api.post('/service-orders', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  fundOrder: (orderId) => api.post(`/service-orders/${orderId}/fund`),
  acceptOrder: (orderId) => api.post(`/service-orders/${orderId}/accept`),
  declineOrder: (orderId, reason) => api.post(`/service-orders/${orderId}/decline`, { reason }),
  cancelOrder: (orderId) => api.post(`/service-orders/${orderId}/cancel`),
  deliverOrder: (orderId, formData) =>
    api.post(`/service-orders/${orderId}/deliver`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  requestRevision: (orderId, reason) => api.post(`/service-orders/${orderId}/request-revision`, { reason }),
  completeOrder: (orderId) => api.post(`/service-orders/${orderId}/complete`),
  reportOrder: (orderId, data) => api.post(`/service-orders/${orderId}/report`, data),
  getOrderStats: (params) => api.get('/service-orders/stats', { params }),
};
