import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const courseSchema = new Schema(
  {
    title: { type: String, required: true },
    provider: { type: String, required: true },
    url: { type: String },
    thumbnail: { type: String },
    duration: { type: String },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
    rating: { type: Number, min: 0, max: 5 },
    price: { type: String },
    skills: [String],
    description: { type: String, maxlength: 1000 },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    startedAt: { type: Date },
    progress: { type: Number, min: 0, max: 100, default: 0 },
  },
  { _id: true, timestamps: false }
);

const certificationSchema = new Schema(
  {
    name: { type: String, required: true },
    issuingOrg: { type: String, required: true },
    url: { type: String },
    validityPeriod: { type: String },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
    estimatedHours: { type: Number },
    skills: [String],
    description: { type: String, maxlength: 1000 },
    prerequisites: [String],
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    credentialUrl: { type: String },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  },
  { _id: true, timestamps: false }
);

const resourceSchema = new Schema(
  {
    title: { type: String, required: true },
    type: { type: String, enum: ['article', 'video', 'tutorial', 'book', 'documentation', 'podcast', 'tool', 'practice'], required: true },
    url: { type: String },
    source: { type: String },
    duration: { type: String },
    skills: [String],
    description: { type: String, maxlength: 1000 },
    isFree: { type: Boolean, default: true },
    rating: { type: Number, min: 0, max: 5 },
    isCompleted: { type: Boolean, default: false },
    isBookmarked: { type: Boolean, default: false },
  },
  { _id: true, timestamps: false }
);

const skillGapSchema = new Schema(
  {
    skill: { type: String, required: true },
    currentLevel: { type: String, enum: ['none', 'beginner', 'intermediate', 'advanced', 'expert'], default: 'none' },
    targetLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'], required: true },
    gapSize: { type: String, enum: ['critical', 'significant', 'moderate', 'minor'], required: true },
    demandScore: { type: Number, min: 0, max: 100 },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    reason: { type: String, maxlength: 500 },
    estimatedWeeks: { type: Number },
  },
  { _id: true, timestamps: false }
);

const learningPlanSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    goal: { type: String, maxlength: 500 },
    targetRole: { type: String },
    status: {
      type: String,
      enum: ['active', 'completed', 'paused', 'archived'],
      default: 'active',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },

    skillGaps: [skillGapSchema],
    courses: [courseSchema],
    certifications: [certificationSchema],
    resources: [resourceSchema],

    aiAnalysis: {
      overallReadiness: { type: Number, min: 0, max: 100 },
      estimatedCompletionWeeks: { type: Number },
      focusAreas: [String],
      strengths: [String],
      weaknesses: [String],
      careerAdvice: { type: String, maxlength: 1500 },
      marketDemand: { type: String, enum: ['low', 'moderate', 'high', 'very_high'] },
    },

    progress: {
      totalItems: { type: Number, default: 0 },
      completedItems: { type: Number, default: 0 },
      percentage: { type: Number, min: 0, max: 100, default: 0 },
    },

    generatedFrom: {
      type: String,
      enum: ['ai_analysis', 'manual', 'skill_test', 'career_path'],
      default: 'ai_analysis',
    },

    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

learningPlanSchema.index({ user: 1, status: 1 });
learningPlanSchema.index({ user: 1, createdAt: -1 });

const LearningPlan = model('LearningPlan', learningPlanSchema);
export default LearningPlan;
