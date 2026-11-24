import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ─── Customization Sub-schema ─────────────────────────────────────────────────
const resumeCustomizationSchema = new Schema(
  {
    template: {
      type: String,
      enum: ['modern', 'classic', 'minimal', 'creative'],
      default: 'modern',
    },
    accentColor: { type: String, default: '#2563eb' },
    fontSize: {
      type: String,
      enum: ['small', 'medium', 'large'],
      default: 'medium',
    },
    includePhoto: { type: Boolean, default: true },
    includeGitHub: { type: Boolean, default: true },
    includePortfolio: { type: Boolean, default: true },
    includeCertifications: { type: Boolean, default: true },
    sectionOrder: [{
      type: String,
      enum: ['summary', 'skills', 'experience', 'education', 'portfolio', 'certifications', 'languages', 'github'],
    }],
  },
  { _id: false }
);

// ─── AI Content Sub-schema ────────────────────────────────────────────────────
const aiContentSchema = new Schema(
  {
    professionalSummary: { type: String, maxlength: 2000 },
    skillDescriptions: { type: Schema.Types.Mixed, default: {} },
    experienceEnhancements: [{ type: String, maxlength: 500 }],
    projectHighlights: [{ type: String, maxlength: 500 }],
    generatedAt: { type: Date },
  },
  { _id: false }
);

// ─── Main Resume Schema ───────────────────────────────────────────────────────
const resumeSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Resume content (snapshot of profile at generation time)
    content: {
      fullName: { type: String, required: true },
      email: { type: String },
      phone: { type: String, default: '' },
      location: { type: String, default: '' },
      tagline: { type: String, default: '' },
      summary: { type: String, default: '' },
      website: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      github: { type: String, default: '' },
      avatar: { type: String, default: '' },

      skills: [{
        name: { type: String },
        level: { type: String },
        yearsOfExperience: { type: Number },
      }],

      experience: [{
        title: { type: String },
        company: { type: String },
        location: { type: String },
        startDate: { type: Date },
        endDate: { type: Date },
        isCurrent: { type: Boolean, default: false },
        description: { type: String },
      }],

      education: [{
        institution: { type: String },
        degree: { type: String },
        fieldOfStudy: { type: String },
        startDate: { type: Date },
        endDate: { type: Date },
        isCurrent: { type: Boolean, default: false },
        description: { type: String },
      }],

      certifications: [{
        name: { type: String },
        issuingOrganization: { type: String },
        issueDate: { type: Date },
        credentialUrl: { type: String },
      }],

      portfolio: [{
        title: { type: String },
        description: { type: String },
        technologies: [{ type: String }],
        projectUrl: { type: String },
      }],

      languages: [{
        name: { type: String },
        proficiency: { type: String },
      }],

      github: {
        username: { type: String },
        totalStars: { type: Number, default: 0 },
        totalForks: { type: Number, default: 0 },
        contributionScore: { type: Number, default: 0 },
        topLanguages: [{ type: String }],
        pinnedRepos: [{
          name: { type: String },
          description: { type: String },
          stars: { type: Number, default: 0 },
          language: { type: String },
        }],
      },

      stats: {
        completedProjects: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0 },
        totalReviews: { type: Number, default: 0 },
        successRate: { type: Number, default: 0 },
        reputationScore: { type: Number, default: 0 },
        trustTier: { type: String, default: 'unrated' },
        freelancerLevel: { type: String, default: 'newcomer' },
      },
    },

    // AI-enhanced content
    aiContent: aiContentSchema,

    // Customization options
    customization: {
      type: resumeCustomizationSchema,
      default: () => ({}),
    },

    // Generated PDF
    pdfUrl: { type: String, default: '' },
    pdfPublicId: { type: String, default: '' },

    // Status
    status: {
      type: String,
      enum: ['draft', 'generating', 'completed', 'failed'],
      default: 'draft',
    },
    errorMessage: { type: String, default: '' },

    // Metadata
    generatedAt: { type: Date },
    generationDuration: { type: Number, default: 0 }, // ms
    aiModel: { type: String, default: 'gemini-flash-latest' },
    downloadCount: { type: Number, default: 0 },
    lastDownloadedAt: { type: Date },

    // Version tracking
    version: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
resumeSchema.index({ user: 1, createdAt: -1 });
resumeSchema.index({ status: 1 });

const Resume = model('Resume', resumeSchema);
export default Resume;
