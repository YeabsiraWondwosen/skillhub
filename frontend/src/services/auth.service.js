import api from './api';

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  refreshToken: () => api.post('/auth/refresh'),
  verifyEmailChange: (token) => api.post(`/auth/verify-email-change/${token}`),
  verifyEmailOtp: (data) => api.post('/auth/verify-email-otp', data),
  resendEmailOtp: (data) => api.post('/auth/resend-email-otp', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  deleteAccount: (data) => api.delete('/auth/account', { data }),
  uploadAvatar: (formData) => api.post('/auth/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};
