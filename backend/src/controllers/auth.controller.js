import crypto from 'crypto';
import {
  User, Profile, Wallet, Category, Follow, Meeting, Notification,
  ReputationScore, PortfolioSite, Resume, DeveloperVerification,
  Transaction, PaymentMethod, NotificationPreferences,
} from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import {
  generateTokenPair,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from '../services/token.service.js';
import {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  sendEmailChangeEmail,
  sendEmailVerificationOtpEmail,
} from '../services/email.service.js';
import {
  evaluateOtpAttempt,
  evaluateResend,
  OTP_STATUS,
  OTP_DEFAULTS,
} from '../utils/emailVerification.js';
import { uploadAvatar as uploadAvatarToCloud, deleteFile, deleteMultipleFiles } from '../services/cloudinary.service.js';
import { getOrCreateWallet } from '../services/payment.service.js';

// ─── Register ─────────────────────────────────────────────────────────────────
export const register = catchAsync(async (req, res) => {
  let { firstName, lastName, email, password, role, primaryCategory, subcategory, skills } = req.body;
  email = String(email || '').toLowerCase().trim();

  // Check duplicate (normalized so case variants of an existing email are caught)
  const existingUser = await User.findOne({ email });
  if (existingUser) throw new ApiError(409, 'Email already registered');

  if (role === 'freelancer' && subcategory) {
    const sub = await Category.findById(subcategory);
    if (!sub) throw new ApiError(400, 'Subcategory not found');
    if (!sub.parent) throw new ApiError(400, 'Selected subcategory must be a subcategory');
    if (primaryCategory && sub.parent.toString() !== primaryCategory.toString()) {
      throw new ApiError(400, 'Subcategory does not belong to the selected category');
    }
  }

  // Create user
  const user = await User.create({
    firstName, lastName, email, password, role,
    primaryCategory: primaryCategory || null,
  });
  const userId = user._id;

  try {
    // Create profile
    const profileData = { user: userId };
    if (role === 'freelancer') {
      if (primaryCategory) profileData.categories = [primaryCategory];
      if (subcategory) profileData.subcategories = [subcategory];
      if (Array.isArray(skills) && skills.length > 0) {
        profileData.skills = skills.slice(0, 20).map((s) =>
          typeof s === 'string' ? { name: s } : { name: s?.name || '', level: s?.level || 'intermediate' }
        );
      }
    }
    await Profile.create(profileData);

    // Create wallet
    await getOrCreateWallet(userId);
  } catch (err) {
    await User.findByIdAndDelete(userId).catch(() => {});
    throw err;
  }

  // Issue email verification OTP (non-critical: send failure does not break signup)
  try {
    const otp = user.issueEmailVerificationOtp(config.emailVerification?.otpSecret);
    user.emailVerificationResendCount = 0;
    await user.save({ validateBeforeSave: false });
    await sendEmailVerificationOtpEmail(user, otp);
  } catch (err) {
    logger.error(`Email verification OTP issuance failed for ${email}: ${err.message}`);
    // Non-fatal: proceed with registration
  }

  sendResponse(res, 201, 'Registration successful. Check your email for a 6-digit verification code.', {
    user: user.toSafeObject(),
    requiresEmailVerification: true,
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────
export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated');
  if (user.isBanned) throw new ApiError(403, `Account banned: ${user.banReason || 'Terms violation'}`);

  // Generate tokens
  const { accessToken, refreshToken, refreshExpiresAt } = generateTokenPair(user);

  // Persist refresh token
  user.clearExpiredRefreshTokens();
  user.addRefreshToken(
    refreshToken,
    refreshExpiresAt,
    req.headers['user-agent'] || '',
    req.ip
  );
  user.isOnline = true;
  user.lastSeen = new Date();
  await user.save({ validateBeforeSave: false });

  setAuthCookies(res, accessToken, refreshToken);

  sendResponse(res, 200, 'Login successful', {
    user: user.toSafeObject(),
    accessToken,
    refreshToken,
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────
export const logout = catchAsync(async (req, res) => {
  const refreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (refreshToken && req.user) {
    req.user.removeRefreshToken(refreshToken);
    req.user.isOnline = false;
    req.user.lastSeen = new Date();
    await req.user.save({ validateBeforeSave: false });
  }

  clearAuthCookies(res);
  sendResponse(res, 200, 'Logged out successfully');
});

// ─── Refresh Token ────────────────────────────────────────────────────────────
export const refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) throw new ApiError(401, 'Refresh token required');

  // Verify JWT
  const decoded = verifyRefreshToken(token);

  // Find user and validate stored token
  const user = await User.findById(decoded.userId).select('+refreshTokens');
  if (!user) throw new ApiError(401, 'User not found');

  const storedToken = user.refreshTokens.find((rt) => rt.token === token);
  if (!storedToken) throw new ApiError(401, 'Invalid or revoked refresh token');
  if (storedToken.expiresAt < new Date()) {
    user.removeRefreshToken(token);
    await user.save({ validateBeforeSave: false });
    throw new ApiError(401, 'Refresh token expired');
  }

  // Rotate refresh token
  user.removeRefreshToken(token);
  const { accessToken, refreshToken: newRefreshToken, refreshExpiresAt } = generateTokenPair(user);
  user.addRefreshToken(newRefreshToken, refreshExpiresAt, req.headers['user-agent'] || '', req.ip);
  await user.save({ validateBeforeSave: false });

  setAuthCookies(res, accessToken, newRefreshToken);

  sendResponse(res, 200, 'Token refreshed', {
    accessToken,
    refreshToken: newRefreshToken,
  });
});

// ─── Forgot Password ──────────────────────────────────────────────────────────
export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Always respond 200 to prevent email enumeration.
  if (!user) {
    return sendResponse(res, 200, 'If an account with that email exists, a password reset link has been sent.');
  }

  const rawToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${config.frontendUrl}/auth/reset-password?token=${rawToken}`;

  try {
    await sendPasswordResetEmail(user, resetUrl);
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    // Never surface delivery failures here — doing so would reveal whether the
    // account exists. Log the failure server-side instead.
    logger.error(`Password reset email delivery failed for ${email}: ${err.message}`);
  }

  sendResponse(res, 200, 'If an account with that email exists, a password reset link has been sent.');
});

// ─── Reset Password ───────────────────────────────────────────────────────────
export const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) throw new ApiError(400, 'Invalid or expired password reset token');

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // Invalidate all refresh tokens on password reset (security)
  user.refreshTokens = [];
  await user.save();

  clearAuthCookies(res);
  await sendPasswordChangedEmail(user).catch(() => null);

  sendResponse(res, 200, 'Password reset successfully. Please log in with your new password.');
});

// ─── Change Password ──────────────────────────────────────────────────────────
export const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  user.password = newPassword;
  user.refreshTokens = []; // Invalidate all sessions
  await user.save();

  clearAuthCookies(res);
  await sendPasswordChangedEmail(user).catch(() => null);

  sendResponse(res, 200, 'Password changed successfully. Please log in again.');
});

// ─── Change Email ─────────────────────────────────────────────────────────────
export const changeEmail = catchAsync(async (req, res) => {
  const { newEmail, password } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(password))) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  if (newEmail.toLowerCase() === user.email.toLowerCase()) {
    throw new ApiError(400, 'New email is the same as your current email');
  }

  const taken = await User.isEmailTaken(newEmail, user._id);
  if (taken) throw new ApiError(409, 'Email is already in use');

  // Store the pending email and issue a confirmation token (24h expiry).
  user.pendingEmail = newEmail.toLowerCase().trim();
  const rawToken = user.createEmailChangeToken();
  await user.save({ validateBeforeSave: false });

  const confirmUrl = `${config.frontendUrl}/auth/verify-email-change?token=${rawToken}`;

  try {
    await sendEmailChangeEmail(user, confirmUrl);
  } catch (err) {
    user.pendingEmail = undefined;
    user.emailChangeToken = undefined;
    user.emailChangeExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(500, 'Failed to send confirmation email. Please try again.');
  }

  sendResponse(res, 200, 'Confirmation link sent to your new email address.');
});

// ─── Verify Email Change ──────────────────────────────────────────────────────
export const verifyEmailChange = catchAsync(async (req, res) => {
  const { token } = req.params;
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    emailChangeToken: hashedToken,
    emailChangeExpires: { $gt: Date.now() },
  }).select('+emailChangeToken +emailChangeExpires');

  if (!user || !user.pendingEmail) {
    throw new ApiError(400, 'Invalid or expired email change link');
  }

  const newEmail = user.pendingEmail.toLowerCase().trim();
  const taken = await User.isEmailTaken(newEmail, user._id);
  if (taken) throw new ApiError(409, 'Email is already in use');

  user.email = newEmail;
  user.pendingEmail = undefined;
  user.emailChangeToken = undefined;
  user.emailChangeExpires = undefined;
  await user.save({ validateBeforeSave: false });

  sendResponse(res, 200, 'Email address updated successfully', {
    user: user.toSafeObject(),
  });
});

// ─── Verify Email OTP ──────────────────────────────────────────────────────────
export const verifyEmailOtp = catchAsync(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const otp = String(req.body.otp || '').trim();

  const user = await User.findOne({ email }).select(
    '+emailVerificationOtpHash +emailVerificationOtpExpires +emailVerificationAttempts +emailVerificationResendCount +emailVerificationLastSentAt'
  );
  if (!user) {
    throw new ApiError(400, 'Invalid or expired verification code.');
  }

  if (user.isEmailVerified) {
    return sendResponse(res, 200, 'Email is already verified.', {
      user: user.toSafeObject(),
      alreadyVerified: true,
    });
  }

  const result = evaluateOtpAttempt(
    {
      candidate: otp,
      storedHash: user.emailVerificationOtpHash,
      expiresAt: user.emailVerificationOtpExpires,
      attempts: user.emailVerificationAttempts || 0,
    },
    {
      secret: config.emailVerification?.otpSecret,
      maxAttempts: config.emailVerification?.maxAttempts ?? OTP_DEFAULTS.maxAttempts,
    }
  );

  if (result.status === OTP_STATUS.VALID) {
    user.isEmailVerified = true;
    user.clearEmailVerificationOtp();
    await user.save({ validateBeforeSave: false });
    sendWelcomeEmail(user).catch(() => null);
    return sendResponse(res, 200, 'Email verified successfully.', {
      user: user.toSafeObject(),
    });
  }

  if (result.status === OTP_STATUS.INVALID) {
    user.emailVerificationAttempts = result.attempts;
    await user.save({ validateBeforeSave: false });
    const remaining = Math.max(
      0,
      (config.emailVerification?.maxAttempts ?? OTP_DEFAULTS.maxAttempts) - result.attempts
    );
    throw new ApiError(400, `Incorrect verification code. ${remaining} attempt(s) remaining.`);
  }

  if (result.status === OTP_STATUS.LOCKED) {
    throw new ApiError(429, 'Too many incorrect attempts. Please request a new code.');
  }

  if (result.status === OTP_STATUS.EXPIRED) {
    throw new ApiError(400, 'Verification code has expired. Please request a new one.');
  }

  throw new ApiError(400, 'Invalid or expired verification code.');
});

// ─── Resend Email OTP ──────────────────────────────────────────────────────────
export const resendEmailOtp = catchAsync(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();

  const user = await User.findOne({ email }).select(
    '+emailVerificationOtpHash +emailVerificationOtpExpires +emailVerificationAttempts +emailVerificationResendCount +emailVerificationLastSentAt'
  );

  if (!user || user.isEmailVerified) {
    return sendResponse(res, 200, 'If your account requires verification, a new code has been sent.');
  }

  const gate = evaluateResend(
    {
      lastSentAt: user.emailVerificationLastSentAt,
      resendCount: user.emailVerificationResendCount || 0,
    },
    {
      cooldownMs: config.emailVerification?.resendCooldownMs ?? OTP_DEFAULTS.cooldownMs,
      maxResends: config.emailVerification?.maxResends ?? OTP_DEFAULTS.maxResends,
    }
  );

  if (!gate.allowed) {
    if (gate.reason === 'cooldown') {
      const seconds = Math.ceil(gate.retryAfterMs / 1000);
      throw new ApiError(429, `Please wait ${seconds}s before requesting another code.`);
    }
    throw new ApiError(429, 'Resend limit reached. Please contact support.');
  }

  const otp = user.issueEmailVerificationOtp(config.emailVerification?.otpSecret);
  user.emailVerificationResendCount = (user.emailVerificationResendCount || 0) + 1;
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmailVerificationOtpEmail(user, otp);
  } catch (err) {
    logger.error(`Email verification OTP resend failed for ${email}: ${err.message}`);
    throw new ApiError(500, 'Failed to send verification email. Please try again later.');
  }

  return sendResponse(res, 200, 'A new verification code has been sent to your email.', {
    email: user.email,
  });
});

// ─── Delete Account ───────────────────────────────────────────────────────────
export const deleteAccount = catchAsync(async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  if (!(await user.comparePassword(password))) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  const userId = user._id;

  // 1. Clean up Cloudinary assets before removing the account
  const profile = await Profile.findOne({ user: userId });
  const cleanups = [];
  if (user.avatar?.publicId) cleanups.push(deleteFile(user.avatar.publicId).catch(() => null));
  if (profile?.resume?.publicId) cleanups.push(deleteFile(profile.resume.publicId, 'raw').catch(() => null));
  const portfolioIds = (profile?.portfolio || []).flatMap((item) =>
    (item.images || []).map((img) => img.publicId).filter(Boolean)
  );
  if (portfolioIds.length) cleanups.push(deleteMultipleFiles(portfolioIds).catch(() => null));
  await Promise.allSettled(cleanups);

  // 2. Remove account-owned data
  await Promise.all([
    Profile.deleteMany({ user: userId }),
    Wallet.deleteMany({ user: userId }),
    Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] }),
    Meeting.deleteMany({ $or: [{ client: userId }, { freelancer: userId }, { createdBy: userId }] }),
    Notification.deleteMany({ $or: [{ recipient: userId }, { sender: userId }] }),
    ReputationScore.deleteMany({ user: userId }),
    PortfolioSite.deleteMany({ user: userId }),
    Resume.deleteMany({ user: userId }),
    DeveloperVerification.deleteMany({ user: userId }),
    Transaction.deleteMany({ user: userId }),
    PaymentMethod.deleteMany({ user: userId }),
    NotificationPreferences.deleteMany({ user: userId }),
  ]);

  // 3. Remove this user from other accounts' saved lists
  await User.updateMany({ savedJobs: userId }, { $pull: { savedJobs: userId } });
  await User.updateMany({ savedCatalogs: userId }, { $pull: { savedCatalogs: userId } });

  // 4. Delete the account
  await User.findByIdAndDelete(userId);

  clearAuthCookies(res);
  sendResponse(res, 200, 'Your account has been permanently deleted. We are sorry to see you go.');
});

// ─── Get Me ───────────────────────────────────────────────────────────────────
export const getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).populate('profile wallet');
  sendResponse(res, 200, 'User fetched', user.toSafeObject());
});

// ─── Upload Avatar ────────────────────────────────────────────────────────────
export const uploadAvatar = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image file uploaded');

  // Delete the previous avatar before replacing it (prevents Cloudinary leaks)
  if (req.user.avatar?.publicId) {
    await deleteFile(req.user.avatar.publicId).catch(() => null);
  }

  const result = await uploadAvatarToCloud(req.file.buffer, req.user._id.toString());

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: result },
    { new: true }
  );

  sendResponse(res, 200, 'Avatar uploaded successfully', { avatar: user.avatar });
});
