import api from './api';

export const reportService = {
  submitReport: (data) => api.post('/reports', data),
};
