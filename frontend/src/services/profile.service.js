import api from './api';

export const profileService = {
  // Follow
  follow: (userId) => api.post(`/profile/${userId}/follow`),
  unfollow: (userId) => api.delete(`/profile/${userId}/follow`),
  isFollowing: (userId) => api.get(`/profile/${userId}/is-following`),
  getFollowers: (userId, params) => api.get(`/profile/${userId}/followers`, { params }),
  getFollowing: (userId, params) => api.get(`/profile/${userId}/following`, { params }),
  getFollowersCount: (userId) => api.get(`/profile/${userId}/followers-count`),
  getFollowingCount: (userId) => api.get(`/profile/${userId}/following-count`),

  // Availability — the real availability workflow (/availability)
  getMyAvailability: () => api.get('/availability/me'),
  updateAvailability: (data) => api.patch('/availability/status', data), // { availabilityStatus, nextAvailableDate }
  getMySlots: () => api.get('/availability/slots'),
  saveMySlots: (slots) => api.put('/availability/slots', { slots }),
  getPublicAvailability: (userId) => api.get(`/availability/public/${userId}`),
  getPublicSlots: (userId, params) => api.get(`/availability/public/${userId}/slots`, { params }),

  // Meetings — the real meeting workflow (/meetings)
  createMeeting: (data) => api.post('/meetings', data),
  getMeetings: (params) => api.get('/meetings', { params }),
  getMeetingById: (meetingId) => api.get(`/meetings/${meetingId}`),
  updateMeetingStatus: (meetingId, data) => api.patch(`/meetings/${meetingId}`, data),

  // Analytics & Trust
  getAnalytics: (userId) => api.get(`/profile/${userId}/analytics`),
  getTrustScore: (userId) => api.get(`/profile/${userId}/trust-score`),
  getAISummary: (userId) => api.get(`/profile/${userId}/ai-summary`),

  // Resume
  downloadResume: (userId) => api.get(`/profile/${userId}/resume`),

  // Intro video
  updateIntroVideo: (data) => api.patch('/profile/me/intro-video', data),
};
