import api from './api';

export const contractService = {
  getMyContracts: (params) => api.get('/contracts', { params }),
  getContract: (contractId) => api.get(`/contracts/${contractId}`),
  fundContract: (contractId, data = {}) => api.post(`/contracts/${contractId}/fund`, data),
  submitDelivery: (contractId, formData) =>
    api.post(`/contracts/${contractId}/deliver`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  reviewDelivery: (contractId, deliveryId, data) =>
    api.post(`/contracts/${contractId}/deliveries/${deliveryId}/review`, data),
  raiseDispute: (contractId, data) => api.post(`/contracts/${contractId}/dispute`, data),
};
