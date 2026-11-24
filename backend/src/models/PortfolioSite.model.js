import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const customizationSchema = new Schema(
  {
    template: {
      type: String,
      enum: ['modern', 'classic', 'minimal', 'creative'],
      default: 'modern',
    },
    accentColor: { type: String, default: '#2563eb' },
    fontFamily: {
      type: String,
      enum: ['inter', 'poppins', 'playfair', 'fira'],
      default: 'inter',
    },
    showGitHub: { type: Boolean, default: true },
    showProjects: { type: Boolean, default: true },
    showSkills: { type: Boolean, default: true },
    showExperience: { type: Boolean, default: true },
    showEducation: { type: Boolean, default: true },
    showLanguages: { type: Boolean, default: true },
    showContact: { type: Boolean, default: true },
    sectionOrder: [{ type: String }],
  },
  { _id: false }
);

const portfolioSiteSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, trim: true, maxlength: 200 },
    slug: { type: String, unique: true, sparse: true, index: true },
    customization: { type: customizationSchema, default: () => ({}) },
    aiContent: {
      headline: { type: String },
      subheadline: { type: String },
      aboutText: { type: String },
      skillHighlights: [{ type: String }],
      projectDescriptions: [{
        projectId: { type: Schema.Types.ObjectId },
        title: { type: String },
        aiDescription: { type: String },
      }],
      ctaText: { type: String },
      generatedAt: { type: Date },
    },
    generatedHtml: { type: String },
    stats: {
      views: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 },
    },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

portfolioSiteSchema.index({ user: 1, createdAt: -1 });

portfolioSiteSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('title')) {
    const base = (this.title || 'portfolio')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80);
    this.slug = `${base}-${this._id.toString().slice(-6)}`;
  }
  next();
});

const PortfolioSite = model('PortfolioSite', portfolioSiteSchema);
export default PortfolioSite;
