import api from './api';

export const costEstimatorService = {
  createEstimate: (data) => api.post('/cost-estimator', data),
  getMyEstimates: (params) => api.get('/cost-estimator', { params }),
  getEstimateById: (estimateId) => api.get(`/cost-estimator/${estimateId}`),
  deleteEstimate: (estimateId) => api.delete(`/cost-estimator/${estimateId}`),
};
