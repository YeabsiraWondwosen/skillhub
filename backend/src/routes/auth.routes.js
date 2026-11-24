import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { authLimiter, passwordResetLimiter, uploadLimiter, refreshLimiter, emailVerificationLimiter, otpResendLimiter } from '../middleware/rateLimiter.js';
import { handleMulterError, uploadAvatar } from '../middleware/upload.middleware.js';
import {
  registerSchema, loginSchema, forgotPasswordSchema,
  resetPasswordSchema, changePasswordSchema,
  changeEmailSchema, verifyEmailChangeParamsSchema, deleteAccountSchema,
  verifyEmailOtpSchema, resendEmailOtpSchema,
} from '../validations/auth.validation.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', protect, authController.logout);
router.post('/refresh', refreshLimiter, authController.refreshToken);
router.get('/me', protect, authController.getMe);

router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.put('/change-password', protect, validate(changePasswordSchema), authController.changePassword);

router.post('/change-email', protect, authLimiter, validate(changeEmailSchema), authController.changeEmail);
router.post('/verify-email-change/:token', validate(verifyEmailChangeParamsSchema, 'params'), authController.verifyEmailChange);
router.post('/verify-email-otp', authLimiter, validate(verifyEmailOtpSchema), authController.verifyEmailOtp);
router.post('/resend-email-otp', authLimiter, validate(resendEmailOtpSchema), authController.resendEmailOtp);
router.delete('/account', protect, validate(deleteAccountSchema), authController.deleteAccount);

router.post('/avatar', protect, uploadLimiter, handleMulterError(uploadAvatar), authController.uploadAvatar);

export default router;
