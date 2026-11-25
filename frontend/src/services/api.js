import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

const AUTH_URLS_SKIP_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email-change',
  '/auth/verify-email-otp',
  '/auth/resend-email-otp',
];

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (original._isRefreshCall || AUTH_URLS_SKIP_REFRESH.some((u) => original.url?.startsWith(u))) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              original.headers['Authorization'] = `Bearer ${token}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const { data } = await api.post('/auth/refresh', {}, { _isRefreshCall: true });
        const newToken = data.data?.accessToken;
        if (newToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          original.headers['Authorization'] = `Bearer ${newToken}`;
          const { useAuthStore } = await import('@/store/authStore');
          useAuthStore.getState().setTokens(newToken);
          processQueue(null, newToken);
          return api(original);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        const { useAuthStore } = await import('@/store/authStore');
        useAuthStore.getState().logout();
        window.location.href = '/auth/login';
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
