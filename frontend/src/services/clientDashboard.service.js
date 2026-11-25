import api from './api';

export const clientDashboardService = {
  getDashboard: () => api.get('/client/dashboard'),
};
