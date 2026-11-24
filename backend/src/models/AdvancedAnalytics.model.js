import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const fraudAlertSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'suspicious_login', 'rapid_transactions', 'fake_reviews',
        'identity_mismatch', 'payment_fraud', 'account_takeover',
        'money_laundering', 'multi_account', 'bot_activity',
        'price_manipulation', 'escrow_abuse', 'chargeback_fraud',
      ],
    },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetUser: { type: Schema.Types.ObjectId, ref: 'User' },
    description: { type: String, required: true, maxlength: 2000 },
    evidence: [
      {
        type: { type: String },
        data: { type: Schema.Types.Mixed },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['detected', 'investigating', 'confirmed', 'false_positive', 'resolved'],
      default: 'detected',
    },
    aiReasoning: { type: String, maxlength: 3000 },
    aiModel: { type: String, default: 'gemini-flash-latest' },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { Date },
    resolution: { type: String, maxlength: 1000 },
    actionTaken: { type: String, enum: ['none', 'warning', 'suspension', 'ban', 'flag_account'], default: 'none' },
  },
  { _id: true, timestamps: true }
);

const spamFlagSchema = new Schema(
  {
    contentType: {
      type: String,
      required: true,
      enum: ['review', 'profile', 'job_post', 'message', 'portfolio', 'proposal'],
    },
    contentId: { type: Schema.Types.ObjectId, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      required: true,
      enum: [
        'repetitive_content', 'promotional_spam', 'fake_review',
        'inappropriate_language', 'scam_attempt', 'phishing',
        'keyword_stuffing', 'link_stuffing', 'ai_generated_suspicious',
        'review_farming', 'fake_portfolio', 'impersonation',
      ],
    },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    content: { type: String, maxlength: 5000 },
    aiAnalysis: {
      reasoning: String,
      patterns: [String],
      suggestions: [String],
      isSpam: Boolean,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'confirmed', 'dismissed', 'actioned'],
      default: 'pending',
    },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    action: { type: String, enum: ['none', 'remove_content', 'warn_user', 'suspend_user', 'ban_user'], default: 'none' },
  },
  { _id: true, timestamps: true }
);

const growthMetricsSchema = new Schema(
  {
    date: { type: Date, required: true, index: true },
    period: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    newUsers: {
      total: { type: Number, default: 0 },
      freelancers: { type: Number, default: 0 },
      clients: { type: Number, default: 0 },
    },
    activeUsers: {
      total: { type: Number, default: 0 },
      freelancers: { type: Number, default: 0 },
      clients: { type: Number, default: 0 },
    },
    churnedUsers: { type: Number, default: 0 },
    retentionRate: { type: Number, min: 0, max: 100 },
    dau: { type: Number, default: 0 },
    mau: { type: Number, default: 0 },
    dauMauRatio: { type: Number },
    cohortRetention: [{
      cohortMonth: Date,
      month0: Number,
      month1: Number,
      month2: Number,
      month3: Number,
      month6: Number,
      month12: Number,
    }],
  },
  { _id: true, timestamps: true }
);

const businessInsightSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'revenue_forecast', 'market_trend', 'user_segment',
        'growth_opportunity', 'risk_alert', 'performance_benchmark',
        'competitive_analysis', 'demand_forecast', 'pricing_insight',
        'retention_insight',
      ],
    },
    title: { type: String, required: true, maxlength: 200 },
    summary: { type: String, required: true, maxlength: 2000 },
    details: { type: String, maxlength: 5000 },
    impact: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    confidence: { type: Number, min: 0, max: 1 },
    metrics: { type: Schema.Types.Mixed },
    recommendations: [String],
    generatedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    isActive: { type: Boolean, default: true },
    viewedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: true, timestamps: true }
);

const analyticsSnapshotSchema = new Schema(
  {
    date: { type: Date, required: true, index: true },
    revenue: {
      total: { type: Number, default: 0 },
      commissions: { type: Number, default: 0 },
      deposits: { type: Number, default: 0 },
      withdrawals: { type: Number, default: 0 },
      escrowHeld: { type: Number, default: 0 },
      byProvider: { type: Schema.Types.Mixed, default: {} },
      byCategory: { type: Schema.Types.Mixed, default: {} },
    },
    platform: {
      totalUsers: { type: Number, default: 0 },
      newUsers: { type: Number, default: 0 },
      activeJobs: { type: Number, default: 0 },
      completedProjects: { type: Number, default: 0 },
      totalTransactions: { type: Number, default: 0 },
      avgProjectValue: { type: Number, default: 0 },
      avgFreelancerRating: { type: Number, default: 0 },
    },
    fraudAlerts: { type: Number, default: 0 },
    spamFlags: { type: Number, default: 0 },
  },
  { _id: true, timestamps: true }
);

analyticsSnapshotSchema.index({ date: -1 });

const AdvancedAnalytics = model('AdvancedAnalytics', new Schema({
  fraudAlerts: [fraudAlertSchema],
  spamFlags: [spamFlagSchema],
  growthMetrics: [growthMetricsSchema],
  businessInsights: [businessInsightSchema],
  snapshots: [analyticsSnapshotSchema],
}, { timestamps: true }));

export default AdvancedAnalytics;
