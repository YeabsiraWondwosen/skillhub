import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const budgetEstimateSchema = new Schema(
  {
    min: { type: Number, required: true, min: 0 },
    max: { type: Number, required: true, min: 0 },
    recommended: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'ETB', uppercase: true },
    confidence: { type: Number, min: 0, max: 100, required: true },
  },
  { _id: false }
);

const technologySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['frontend', 'backend', 'database', 'devops', 'mobile', 'ai_ml', 'other'],
      required: true,
    },
    purpose: { type: String, required: true, maxlength: 300 },
    essential: { type: Boolean, default: true },
  },
  { _id: true }
);

const timelineSchema = new Schema(
  {
    optimistic: { type: Number, required: true, min: 0 },
    realistic: { type: Number, required: true, min: 0 },
    pessimistic: { type: Number, required: true, min: 0 },
    unit: {
      type: String,
      enum: ['hours', 'days', 'weeks', 'months'],
      default: 'weeks',
    },
    phases: [{
      name: { type: String, required: true, trim: true },
      duration: { type: Number, required: true, min: 0 },
      unit: { type: String, default: 'weeks' },
      description: { type: String, maxlength: 300 },
    }],
  },
  { _id: false }
);

const teamRecommendationSchema = new Schema(
  {
    size: { type: Number, required: true, min: 1, max: 100 },
    composition: {
      type: String,
      required: true,
      maxlength: 500,
    },
    roles: [{
      role: { type: String, required: true, trim: true },
      count: { type: Number, required: true, min: 1 },
      skillLevel: {
        type: String,
        enum: ['junior', 'mid', 'senior', 'lead'],
        required: true,
      },
      hourlyRateRange: {
        min: { type: Number, min: 0 },
        max: { type: Number, min: 0 },
      },
    }],
  },
  { _id: false }
);

const costBreakdownSchema = new Schema(
  {
    development: { type: Number, default: 0 },
    design: { type: Number, default: 0 },
    testing: { type: Number, default: 0 },
    projectManagement: { type: Number, default: 0 },
    infrastructure: { type: Number, default: 0 },
    thirdPartyServices: { type: Number, default: 0 },
    contingency: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const riskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, maxlength: 500 },
    impact: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    probability: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    mitigation: { type: String, maxlength: 500 },
  },
  { _id: true }
);

// ─── Main CostEstimate Schema ────────────────────────────────────────────────

const costEstimateSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    projectDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    projectName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: 'Untitled Project',
    },
    // AI-generated estimates
    budget: budgetEstimateSchema,
    technologies: [technologySchema],
    timeline: timelineSchema,
    team: teamRecommendationSchema,
    costBreakdown: costBreakdownSchema,
    risks: [riskSchema],
    // AI reasoning
    reasoning: [{ type: String, maxlength: 500 }],
    assumptions: [{ type: String, maxlength: 300 }],
    suggestions: [{ type: String, maxlength: 500 }],
    // Metadata
    complexityScore: { type: Number, min: 1, max: 10, default: 5 },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    errorMessage: { type: String, default: '' },
    estimatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
costEstimateSchema.index({ user: 1, createdAt: -1 });
costEstimateSchema.index({ status: 1 });

const CostEstimate = model('CostEstimate', costEstimateSchema);
export default CostEstimate;
