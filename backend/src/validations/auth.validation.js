import Joi from 'joi';

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Invalid ID format' });

const emailRule = Joi.string().email().lowercase().trim().required();

const passwordRule = Joi.string()
  .min(8)
  .max(72)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .messages({
    'string.pattern.base':
      'Password must contain at least one uppercase, lowercase, number, and special character',
  })
  .required();

export const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName: Joi.string().trim().min(2).max(50).required(),
  email: emailRule,
  password: passwordRule,
  role: Joi.string().valid('freelancer', 'client').default('client'),
  primaryCategory: objectId.allow('', null),
  subcategory: objectId.allow('', null),
  skills: Joi.array().items(Joi.string().trim().max(100)).max(20),
});

export const loginSchema = Joi.object({
  email: emailRule,
  password: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: emailRule,
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: passwordRule,
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match',
    'any.required': 'Please confirm your password',
  }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(8).max(72).required(),
  newPassword: passwordRule,
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Passwords do not match',
    'any.required': 'Please confirm your new password',
  }),
});

export const changeEmailSchema = Joi.object({
  newEmail: emailRule,
  password: Joi.string().required(),
});

export const verifyEmailChangeParamsSchema = Joi.object({
  token: Joi.string().required(),
});

export const verifyEmailOtpSchema = Joi.object({
  email: emailRule,
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({ 'string.pattern.base': 'Verification code must be 6 digits' }),
});

export const resendEmailOtpSchema = Joi.object({
  email: emailRule,
});

export const deleteAccountSchema = Joi.object({
  password: Joi.string().required(),
  confirmText: Joi.string().valid('DELETE').required().messages({
    'any.only': 'Please type DELETE exactly',
  }),
});
