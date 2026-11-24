import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ─── Sub-schemas ──────────────────────────────────────────────────────────────
const experienceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    isCurrent: { type: Boolean, default: false },
    description: { type: String, maxlength: 1000 },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'freelance', 'internship'],
    },
    technologies: [{ type: String, trim: true }],
  },
  { _id: true }
);

const educationSchema = new Schema(
  {
    institution: { type: String, required: true, trim: true },
    degree: { type: String, required: true, trim: true },
    fieldOfStudy: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    isCurrent: { type: Boolean, default: false },
    description: { type: String, maxlength: 500 },
    grade: { type: String, maxlength: 100, trim: true },
  },
  { _id: true }
);

const certificationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    issuingOrganization: { type: String, required: true, trim: true },
    issueDate: { type: Date },
    expirationDate: { type: Date },
    credentialId: { type: String, trim: true },
    credentialUrl: { type: String, trim: true },
  },
  { _id: true }
);

const portfolioItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 1000 },
    projectUrl: { type: String, trim: true },
    repositoryUrl: { type: String, trim: true },
    images: [
      {
        url: { type: String },
        publicId: { type: String },
      },
    ],
    technologies: [{ type: String, trim: true }],
    skillsUsed: [{ type: String, trim: true }],
    demoUrl: { type: String, trim: true },
    clientName: { type: String, trim: true, maxlength: 100 },
    category: { type: String, trim: true, maxlength: 100 },
    completedAt: { type: Date },
    isFeatured: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

const skillSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate',
    },
    yearsOfExperience: { type: Number, min: 0, max: 50 },
  },
  { _id: true }
);

// ─── Main Profile Schema ──────────────────────────────────────────────────────
const profileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    bio: {
      type: String,
      maxlength: [2000, 'Bio cannot exceed 2000 characters'],
      trim: true,
      default: '',
    },
    tagline: {
      type: String,
      maxlength: [150, 'Tagline cannot exceed 150 characters'],
      trim: true,
      default: '',
    },
    skills: [skillSchema],
    categories: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
      validate: {
        validator: (arr) => arr.length <= 5,
        message: 'Cannot select more than 5 categories',
      },
      default: [],
    },
    subcategories: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
      validate: {
        validator: (arr) => arr.length <= 5,
        message: 'Cannot select more than 5 subcategories',
      },
      default: [],
    },
    experience: [experienceSchema],
    education: [educationSchema],
    certifications: [certificationSchema],
    portfolio: [portfolioItemSchema],

    // Freelancer-specific
    hourlyRate: { type: Number, min: 0, max: 10000, default: null },
    availability: {
      type: String,
      enum: ['available', 'partially_available', 'not_available'],
      default: 'available',
    },
    availabilityHoursPerWeek: { type: Number, min: 0, max: 168, default: 40 },
    yearsOfExperience: { type: Number, min: 0, max: 50, default: null },
    responseTime: {
      type: String,
      enum: ['within_hour', 'within_24h', 'within_48h', 'within_week'],
      default: 'within_24h',
    },
    workingHours: {
      start: { type: String, default: '' },
      end: { type: String, default: '' },
      timezone: { type: String, default: 'UTC' },
    },
    preferredContractType: {
      type: String,
      enum: ['hourly', 'fixed', 'milestone'],
      default: 'hourly',
    },
    preferredProjectSize: {
      type: String,
      enum: ['small', 'medium', 'large'],
      default: 'medium',
    },
    visibility: {
      showHourlyRate: { type: Boolean, default: true },
      showEarnings: { type: Boolean, default: true },
    },
    privacy: {
      showOnlineStatus: { type: Boolean, default: true },
      allowDirectMessages: { type: Boolean, default: true },
      showPortfolio: { type: Boolean, default: true },
      showReviews: { type: Boolean, default: true },
    },
    preferredProjectTypes: {
      type: [String],
      enum: ['hourly', 'fixed', 'retainer'],
      default: ['hourly', 'fixed'],
    },

    // Client-specific
    hiringPreferences: {
      allowFreelancerMessages: { type: Boolean, default: true },
      notifyMatchingFreelancers: { type: Boolean, default: true },
      notifyNewProposals: { type: Boolean, default: true },
      notifyServiceUpdates: { type: Boolean, default: true },
      preferredLanguage: { type: String, default: 'en' },
      preferredPaymentCurrency: { type: String, default: 'ETB', uppercase: true },
    },
    billing: {
      defaultPaymentMethod: { type: String, default: '' },
      billingName: { type: String, default: '' },
      company: { type: String, default: '' },
      taxId: { type: String, default: '' },
      billingAddress: { type: String, default: '' },
      defaultInvoiceInfo: { type: String, default: '' },
    },

    languages: [
      {
        name: { type: String, required: true, trim: true },
        proficiency: {
          type: String,
          enum: ['basic', 'conversational', 'professional', 'native'],
          default: 'professional',
        },
      },
    ],

    // Resume
    resume: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      originalName: { type: String, default: '' },
      uploadedAt: { type: Date },
    },

    // Location
    location: {
      country: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      timezone: { type: String, default: 'UTC' },
    },

    // Profile completion score (0-100)
    completionScore: { type: Number, default: 0, min: 0, max: 100 },

    // Visibility
    isPublic: { type: Boolean, default: true },
    profileViews: { type: Number, default: 0 },

    // Cached GitHub data
    githubData: {
      username: { type: String },
      profile: {
        username: String,
        displayName: String,
        bio: String,
        avatarUrl: String,
        profileUrl: String,
        publicRepos: Number,
        followers: Number,
        following: Number,
        company: String,
        location: String,
        blog: String,
        createdAt: String,
      },
      repos: [{
        id: Number,
        name: String,
        fullName: String,
        url: String,
        description: String,
        language: String,
        stars: Number,
        forks: Number,
        watchers: Number,
        openIssues: Number,
        topics: [String],
        isFork: Boolean,
        isPrivate: Boolean,
        createdAt: String,
        updatedAt: String,
        pushedAt: String,
        defaultBranch: String,
        license: String,
      }],
      pinnedRepos: [{
        id: Number,
        name: String,
        fullName: String,
        url: String,
        description: String,
        language: String,
        stars: Number,
        forks: Number,
      }],
      languages: {
        topByRepos: [{ name: String, count: Number }],
        byBytes: [{ name: String, bytes: Number, percentage: Number }],
        totalLanguages: Number,
      },
      contributions: {
        totalContributions: Number,
        commitEvents: Number,
        prEvents: Number,
        issueEvents: Number,
        activityLevel: String,
        contributionsByType: Schema.Types.Mixed,
        topRepos: [{ name: String, count: Number }],
        recentActivity: [{
          type: String,
          repo: String,
          createdAt: String,
          payload: Schema.Types.Mixed,
        }],
      },
      commitActivity: {
        weeklyActivity: [{
          week: Number,
          total: Number,
          days: [Number],
        }],
        repoActivity: [{
          repo: String,
          recentCommits: [{
            message: String,
            date: String,
            url: String,
          }],
          totalRecentCommits: Number,
        }],
        totalRecentCommits: Number,
      },
      stats: {
        totalStars: Number,
        totalForks: Number,
        publicRepos: Number,
        followers: Number,
        contributionScore: Number,
      },
      fetchedAt: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
profileSchema.index({ 'skills.name': 1 });
profileSchema.index({ hourlyRate: 1 });
profileSchema.index({ availability: 1 });
profileSchema.index({ 'location.country': 1 });
profileSchema.index({ categories: 1 });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcScore(doc) {
  let score = 0;
  if (doc.bio && doc.bio.length > 50) score += 12;
  if (doc.tagline) score += 5;
  if (doc.skills.length > 0) score += 12;
  if (doc.categories && doc.categories.length > 0) score += 5;
  if (doc.experience.length > 0) score += 12;
  if (doc.education.length > 0) score += 8;
  if (doc.portfolio.length > 0) score += 15;
  if (doc.certifications.length > 0) score += 5;
  if (doc.languages.length > 0) score += 5;
  if (doc.resume?.url) score += 8;
  if (typeof doc.hourlyRate === 'number' && doc.hourlyRate > 0) score += 5;
  if (doc.location?.country || doc.location?.city) score += 5;
  if (doc.githubData?.username) score += 5;
  return Math.min(score, 100);
}

// ─── Pre-save: Calculate completion score ─────────────────────────────────────
profileSchema.pre('save', function (next) {
  this.completionScore = calcScore(this);
  next();
});

// ─── Post findOneAndUpdate: Recalculate completion score ──────────────────────
profileSchema.post('findOneAndUpdate', async function (doc) {
  if (doc) {
    const fresh = await doc.constructor.findById(doc._id);
    if (fresh) {
      const score = calcScore(fresh);
      if (fresh.completionScore !== score) {
        await fresh.save();
      }
    }
  }
});

const Profile = model('Profile', profileSchema);
export default Profile;
