import Joi from 'joi';
import { NOTIFICATION_PREFERENCE_KEYS } from '../utils/notificationPreference.js';

const categoryShape = {};
NOTIFICATION_PREFERENCE_KEYS.forEach((key) => { categoryShape[key] = Joi.boolean(); });

export const updateNotificationPreferencesSchema = Joi.object({
  channels: Joi.object({
    inApp: Joi.boolean(),
    email: Joi.boolean(),
    push: Joi.boolean(),
  }).min(1),
  categories: Joi.object(categoryShape).min(1),
  aiPreferences: Joi.object({
    jobMatchThreshold: Joi.number().min(0).max(100),
    showPriceSuggestions: Joi.boolean(),
    showSkillRecommendations: Joi.boolean(),
    showEarningInsights: Joi.boolean(),
    showProfileTips: Joi.boolean(),
    showTrendAlerts: Joi.boolean(),
    maxDailyAiNotifications: Joi.number().min(0).max(20),
    quietHoursStart: Joi.number().integer().min(0).max(23),
    quietHoursEnd: Joi.number().integer().min(0).max(23),
  }).min(1),
}).min(1).messages({
  'object.min': 'Provide at least one setting to update',
});
