import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ─── Component Score Sub-schema ───────────────────────────────────────────────
const componentScoreSchema = new Schema(
  {
    score: { type: Number, min: 0, max: 100, required: true },
    weight: { type: Number, min: 0, max: 1, required: true },
    weightedScore: { type: Number, min: 0, max: 100, required: true },
    dataPoints: { type: Number, default: 0 },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

// ─── History Entry Sub-schema ─────────────────────────────────────────────────
const historyEntrySchema = new Schema(
  {
    trustScore: { type: Number, required: true },
    components: { type: Schema.Types.Mixed, default: {} },
    triggeredBy: {
      type: String,
      enum: ['review', 'project_completion', 'milestone', 'verification', 'assessment', 'manual', 'periodic'],
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId },
    calculatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Main ReputationScore Schema ──────────────────────────────────────────────
const reputationScoreSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Composite trust score (0-100)
    trustScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      index: true,
    },

    // Trust tier derived from score
    trustTier: {
      type: String,
      enum: ['unrated', 'emerging', 'reliable', 'trusted', 'elite'],
      default: 'unrated',
      index: true,
    },

    // Individual component scores
    components: {
      ratings: componentScoreSchema,
      projectSuccess: componentScoreSchema,
      completionRate: componentScoreSchema,
      communication: componentScoreSchema,
      verification: componentScoreSchema,
    },

    // Raw data used for calculation
    rawMetrics: {
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
      completedProjects: { type: Number, default: 0 },
      totalProjects: { type: Number, default: 0 },
      onTimeCompletions: { type: Number, default: 0 },
      onTimeRate: { type: Number, default: 0 },
      avgCommunicationRating: { type: Number, default: 0 },
      disputeCount: { type: Number, default: 0 },
      cancellationCount: { type: Number, default: 0 },
      verificationCount: { type: Number, default: 0 },
      accountAgeDays: { type: Number, default: 0 },
    },

    // Score history for tracking changes over time
    history: {
      type: [historyEntrySchema],
      default: [],
    },

    // Metadata
    lastCalculatedAt: { type: Date, default: Date.now },
    calculationVersion: { type: String, default: '1.0' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
reputationScoreSchema.index({ trustScore: -1 });
reputationScoreSchema.index({ trustTier: 1, trustScore: -1 });
reputationScoreSchema.index({ lastCalculatedAt: 1 });

// ─── Static: Get trust tier from score ────────────────────────────────────────
reputationScoreSchema.statics.getTierFromScore = function (score) {
  if (score >= 90) return 'elite';
  if (score >= 70) return 'trusted';
  if (score >= 50) return 'reliable';
  if (score >= 20) return 'emerging';
  return 'unrated';
};

const ReputationScore = model('ReputationScore', reputationScoreSchema);
export default ReputationScore;
