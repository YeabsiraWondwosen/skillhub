import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    estimatedHours: { type: Number, min: 0, default: 0 },
    dependencies: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true }],
  },
  { _id: true }
);

const milestoneSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    order: { type: Number, required: true, min: 0 },
    dueDate: { type: Date },
    estimatedDuration: { type: Number, min: 0 },
    durationUnit: {
      type: String,
      enum: ['hours', 'days', 'weeks'],
      default: 'days',
    },
    tasks: [taskSchema],
    totalEstimatedHours: { type: Number, min: 0, default: 0 },
    keyDeliverables: [{ type: String, maxlength: 200 }],
  },
  { _id: true }
);

const effortBreakdownSchema = new Schema(
  {
    planning: { type: Number, default: 0 },
    design: { type: Number, default: 0 },
    development: { type: Number, default: 0 },
    testing: { type: Number, default: 0 },
    deployment: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

// ─── Main ProjectPlan Schema ─────────────────────────────────────────────────

const projectPlanSchema = new Schema(
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
    // Project constraints
    budget: { type: Number, min: 0 },
    deadline: { type: Date },
    teamSize: { type: Number, min: 1, max: 100 },
    // AI-generated plan
    milestones: [milestoneSchema],
    totalEstimatedHours: { type: Number, min: 0, default: 0 },
    totalMilestones: { type: Number, min: 0, default: 0 },
    totalTasks: { type: Number, min: 0, default: 0 },
    effortBreakdown: effortBreakdownSchema,
    estimatedTimelineWeeks: { type: Number, min: 0, default: 0 },
    // AI metadata
    reasoning: [{ type: String, maxlength: 500 }],
    assumptions: [{ type: String, maxlength: 300 }],
    criticalPath: [{ type: String, maxlength: 200 }],
    riskFactors: [{ type: String, maxlength: 300 }],
    // Metadata
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    errorMessage: { type: String, default: '' },
    plannedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
projectPlanSchema.index({ user: 1, createdAt: -1 });
projectPlanSchema.index({ status: 1 });

const ProjectPlan = model('ProjectPlan', projectPlanSchema);
export default ProjectPlan;
