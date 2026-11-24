import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const verificationAttemptSchema = new Schema(
  {
    method: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    result: { type: String, enum: ['success', 'failure', 'pending'], default: 'pending' },
    details: { type: String, maxlength: 500 },
  },
  { _id: false }
);

const developerVerificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['identity', 'github', 'portfolio', 'skill'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'submitted', 'under_review', 'approved', 'rejected', 'expired'],
      default: 'pending',
    },

    // Identity verification
    identity: {
      fullName: { type: String, trim: true },
      dateOfBirth: { type: Date },
      documentType: {
        type: String,
        enum: ['passport', 'drivers_license', 'national_id'],
      },
      documentFrontUrl: { type: String, default: '' },
      documentFrontPublicId: { type: String, default: '' },
      documentBackUrl: { type: String, default: '' },
      documentBackPublicId: { type: String, default: '' },
      selfieUrl: { type: String, default: '' },
      selfiePublicId: { type: String, default: '' },
      country: { type: String, default: '' },
    },

    // GitHub verification
    github: {
      username: { type: String, trim: true, lowercase: true },
      profileUrl: { type: String, default: '' },
      publicRepos: { type: Number, default: 0 },
      totalStars: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      contributionScore: { type: Number, default: 0 },
      topLanguages: [{ type: String }],
      pinnedRepos: [{
        name: { type: String },
        url: { type: String },
        description: { type: String },
        stars: { type: Number, default: 0 },
        language: { type: String },
      }],
      verifiedAt: { type: Date },
    },

    // Portfolio verification
    portfolio: {
      websiteUrl: { type: String, trim: true },
      projectScreenshots: [{
        url: { type: String },
        publicId: { type: String },
        caption: { type: String, maxlength: 200 },
      }],
      projectDescription: { type: String, maxlength: 2000 },
      technologiesUsed: [{ type: String }],
      liveProjectUrl: { type: String, default: '' },
      sourceCodeUrl: { type: String, default: '' },
      clientTestimonial: { type: String, maxlength: 1000 },
      clientName: { type: String, maxlength: 100 },
    },

    // Skill verification (legacy records, retained for backward compatibility)
    skill: {
      testId: { type: Schema.Types.ObjectId, ref: 'SkillTest' },
      testResultId: { type: Schema.Types.ObjectId, ref: 'SkillTestResult' },
      score: { type: Number, min: 0, max: 100 },
      skillName: { type: String, trim: true },
      verifiedAt: { type: Date },
    },

    // Review tracking
    review: {
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date },
      notes: { type: String, maxlength: 1000 },
      requestedMoreInfoAt: { type: Date },
    },

    // Verification badge earned
    badgeAwarded: { type: Boolean, default: false },
    badgeType: { type: String },

    // Attempts tracking
    attempts: [verificationAttemptSchema],
    attemptsCount: { type: Number, default: 0 },

    // Expiry
    expiresAt: { type: Date },

    // Rejection reason
    rejectionReason: { type: String, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index: one active verification per type per user
developerVerificationSchema.index({ user: 1, type: 1, status: 1 });
developerVerificationSchema.index({ status: 1, createdAt: -1 });
developerVerificationSchema.index({ expiresAt: 1 }, { sparse: true });

const DeveloperVerification = model('DeveloperVerification', developerVerificationSchema);
export default DeveloperVerification;
