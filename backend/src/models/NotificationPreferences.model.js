import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const notificationPreferencesSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },
    categories: {
      jobs: { type: Boolean, default: true },
      projects: { type: Boolean, default: true },
      payments: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      reviews: { type: Boolean, default: true },
      aiRecommendations: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
      systemAlerts: { type: Boolean, default: true },
      jobInvitations: { type: Boolean, default: true },
      jobMatches: { type: Boolean, default: true },
      proposals: { type: Boolean, default: true },
      contracts: { type: Boolean, default: true },
      milestones: { type: Boolean, default: true },
      serviceOrders: { type: Boolean, default: true },
      catalogPerformance: { type: Boolean, default: true },
      verification: { type: Boolean, default: true },
      proposalUpdates: { type: Boolean, default: true },
      freelancerMessages: { type: Boolean, default: true },
    },
    aiPreferences: {
      jobMatchThreshold: { type: Number, default: 60, min: 0, max: 100 },
      showPriceSuggestions: { type: Boolean, default: true },
      showSkillRecommendations: { type: Boolean, default: true },
      showEarningInsights: { type: Boolean, default: true },
      showProfileTips: { type: Boolean, default: true },
      showTrendAlerts: { type: Boolean, default: true },
      maxDailyAiNotifications: { type: Number, default: 5, min: 0, max: 20 },
      quietHoursStart: { type: Number, min: 0, max: 23, default: 22 },
      quietHoursEnd: { type: Number, min: 0, max: 23, default: 8 },
    },
    lastDigestSentAt: { type: Date },
    lastAiNotificationAt: { type: Date },
    aiNotificationCountToday: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

const NotificationPreferences = model('NotificationPreferences', notificationPreferencesSchema);
export default NotificationPreferences;
