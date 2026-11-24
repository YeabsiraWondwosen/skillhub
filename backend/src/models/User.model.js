import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { futureDateValidator } from '../utils/dateValidation.js';
import { generateOtp, hashOtp, OTP_DEFAULTS } from '../utils/emailVerification.js';

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['freelancer', 'client', 'admin'],
      required: [true, 'Role is required'],
      default: 'client',
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    avatar: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    isEmailVerified: { type: Boolean, default: false },
    // Email verification (OTP) - secure fields
    emailVerificationOtpHash: { type: String, select: false },
    emailVerificationOtpExpires: { type: Date, select: false },
    emailVerificationAttempts: { type: Number, default: 0, select: false },
    emailVerificationLastSentAt: { type: Date, select: false },
    emailVerificationResendCount: { type: Number, default: 0, select: false },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    isVerifiedFreelancer: { type: Boolean, default: false },

    // Auth tokens
    refreshTokens: [
      {
        token: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        userAgent: { type: String, default: '' },
        ip: { type: String, default: '' },
      },
    ],
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // Email change flow
    pendingEmail: { type: String, lowercase: true, trim: true, default: '' },
    emailChangeToken: { type: String, select: false },
    emailChangeExpires: { type: Date, select: false },

    // Online status
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },

    // Notification preferences
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      jobInvitations: { type: Boolean, default: true },
      applicationUpdates: { type: Boolean, default: true },
      projectUpdates: { type: Boolean, default: true },
      paymentNotifications: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      reviews: { type: Boolean, default: true },
    },

    // Freelancer badges and level
    badges: [{
      type: {
        type: String,
        enum: ['top_rated', 'rising_talent', 'expert_vetted', 'skill_verified', 'top_earner', 'fast_responder', 'client_favorite'],
      },
      earnedAt: { type: Date, default: Date.now },
      skill: { type: String },
      expiresAt: { type: Date },
    }],
    freelancerLevel: {
      type: String,
      enum: ['newcomer', 'intermediate', 'experienced', 'expert', 'top_rated_plus'],
      default: 'newcomer',
    },
    levelProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Saved jobs (for freelancers)
    savedJobs: [{ type: Schema.Types.ObjectId, ref: 'Job' }],

    // Saved services (for clients)
    savedCatalogs: [{ type: Schema.Types.ObjectId, ref: 'Catalog' }],

    // Social links
    socialLinks: {
      github: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      twitter: { type: String, default: '' },
      website: { type: String, default: '' },
      behance: { type: String, default: '' },
      dribbble: { type: String, default: '' },
      stackoverflow: { type: String, default: '' },
    },

    // Platform stats (denormalized for performance)
    stats: {
      totalEarnings: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      completedProjects: { type: Number, default: 0 },
      activeProjects: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      totalReviews: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 },
      responseTime: { type: Number, default: 0 }, // in hours
      reputationScore: { type: Number, default: 0, min: 0, max: 100 },
      trustTier: {
        type: String,
        enum: ['unrated', 'emerging', 'reliable', 'trusted', 'elite'],
        default: 'unrated',
      },
    },

    timezone: { type: String, default: 'UTC' },
    country: { type: String, default: '' },
    language: { type: String, default: 'en' },
    primaryCategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },

    // Availability status
    availabilityStatus: {
      type: String,
      enum: ['available', 'busy', 'vacation', 'offline'],
      default: 'available',
    },
    nextAvailableDate: { type: Date, default: null, validate: futureDateValidator('nextAvailableDate') },

    // Intro video
    introVideo: {
      url: { type: String, default: '' },
      thumbnail: { type: String, default: '' },
      duration: { type: Number, default: 0 },
    },

    // Follower counts (denormalized)
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('profile', {
  ref: 'Profile',
  localField: '_id',
  foreignField: 'user',
  justOne: true,
});

userSchema.virtual('wallet', {
  ref: 'Wallet',
  localField: '_id',
  foreignField: 'user',
  justOne: true,
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ isOnline: 1 });
userSchema.index({ createdAt: -1 });

// ─── Pre-save Hooks ───────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createPasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  return token;
};

userSchema.methods.createEmailChangeToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailChangeToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailChangeExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

// Email verification (OTP) helpers
userSchema.methods.issueEmailVerificationOtp = function (
  secret,
  { ttlMs, now = Date.now() } = {}
) {
  const otp = generateOtp(OTP_DEFAULTS.length);
  this.emailVerificationOtpHash = hashOtp(otp, secret);
  this.emailVerificationOtpExpires = new Date(now + (ttlMs ?? OTP_DEFAULTS.ttlMs));
  this.emailVerificationAttempts = 0;
  this.emailVerificationLastSentAt = new Date(now);
  return otp;
};

userSchema.methods.incrementEmailVerificationResend = function () {
  this.emailVerificationResendCount = (this.emailVerificationResendCount || 0) + 1;
};

userSchema.methods.clearEmailVerificationOtp = function () {
  this.emailVerificationOtpHash = undefined;
  this.emailVerificationOtpExpires = undefined;
  this.emailVerificationAttempts = 0;
  this.emailVerificationResendCount = 0;
  this.emailVerificationLastSentAt = undefined;
};

/**
 * Check whether an email is already in use, either as a primary email or
 * as a pending (not yet confirmed) email on another account.
 */
userSchema.statics.isEmailTaken = async function (email, excludeUserId) {
  const normalized = String(email || '').toLowerCase().trim();
  if (!normalized) return false;
  const filter = {
    $or: [{ email: normalized }, { pendingEmail: normalized }],
    ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
  };
  return !!(await this.findOne(filter).select('_id').lean());
};

userSchema.methods.addRefreshToken = function (token, expiresAt, userAgent = '', ip = '') {
  if (!Array.isArray(this.refreshTokens)) this.refreshTokens = [];
  if (this.refreshTokens.length >= 5) {
    this.refreshTokens.shift();
  }
  this.refreshTokens.push({ token, expiresAt, userAgent, ip });
};

userSchema.methods.removeRefreshToken = function (token) {
  if (!Array.isArray(this.refreshTokens)) this.refreshTokens = [];
  this.refreshTokens = this.refreshTokens.filter((rt) => rt.token !== token);
};

userSchema.methods.clearExpiredRefreshTokens = function () {
  if (!Array.isArray(this.refreshTokens)) this.refreshTokens = [];
  this.refreshTokens = this.refreshTokens.filter((rt) => rt.expiresAt > new Date());
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject({ virtuals: false });
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailChangeToken;
  delete obj.emailChangeExpires;
  delete obj.emailVerificationOtpHash;
  delete obj.emailVerificationOtpExpires;
  delete obj.emailVerificationAttempts;
  delete obj.emailVerificationLastSentAt;
  delete obj.emailVerificationResendCount;
  delete obj.__v;
  return obj;
};

const User = model('User', userSchema);
export default User;
