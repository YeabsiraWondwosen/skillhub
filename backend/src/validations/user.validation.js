import Joi from 'joi';

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Invalid ID format' });

/**
 * Param schemas for routes that take a MongoDB ObjectId in the URL.
 * Used with validate(schema, 'params').
 */
export const idParamSchemas = {
  userId: Joi.object({ userId: objectId.required() }),
  expId: Joi.object({ expId: objectId.required() }),
  eduId: Joi.object({ eduId: objectId.required() }),
  certId: Joi.object({ certId: objectId.required() }),
  itemId: Joi.object({ itemId: objectId.required() }),
  jobId: Joi.object({ jobId: objectId.required() }),
  catalogId: Joi.object({ catalogId: objectId.required() }),
};

export const updateUserSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50),
  lastName: Joi.string().trim().min(2).max(50),
  timezone: Joi.string().max(50),
  country: Joi.string().max(100).allow('', null),
  language: Joi.string().max(10).default('en'),
  socialLinks: Joi.object({
    github: Joi.string().uri().allow('', null),
    linkedin: Joi.string().uri().allow('', null),
    twitter: Joi.string().uri().allow('', null),
    website: Joi.string().uri().allow('', null),
    behance: Joi.string().uri().allow('', null),
    dribbble: Joi.string().uri().allow('', null),
    stackoverflow: Joi.string().uri().allow('', null),
  }),
  notificationPreferences: Joi.object({
    email: Joi.boolean(),
    push: Joi.boolean(),
    sms: Joi.boolean(),
    jobInvitations: Joi.boolean(),
    applicationUpdates: Joi.boolean(),
    projectUpdates: Joi.boolean(),
    paymentNotifications: Joi.boolean(),
    messages: Joi.boolean(),
    reviews: Joi.boolean(),
  }),
}).min(1);

export const adminUpdateUserSchema = Joi.object({
  isActive: Joi.boolean(),
  isBanned: Joi.boolean(),
  banReason: Joi.string().max(500).allow('', null),
  isVerifiedFreelancer: Joi.boolean(),
  role: Joi.string().valid('freelancer', 'client', 'admin'),
}).min(1);

export const reportSchema = Joi.object({
  resourceType: Joi.string().valid('user', 'job', 'review', 'message', 'project', 'catalog', 'service_order').required(),
  resourceId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  reason: Joi.string()
    .valid('spam', 'fake_account', 'inappropriate_content', 'harassment', 'scam', 'copyright_violation', 'false_information', 'other')
    .required(),
  description: Joi.string().trim().min(20).max(2000).required(),
});
