import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ─── Issue Sub-schema ─────────────────────────────────────────────────────────
const issueSchema = new Schema(
  {
    category: {
      type: String,
      enum: ['bug', 'security', 'performance', 'best_practice', 'maintainability', 'style'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'info'],
      required: true,
    },
    line: { type: Number, min: 1 },
    endLine: { type: Number, min: 1 },
    column: { type: Number, min: 1 },
    rule: { type: String, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    suggestion: { type: String, maxlength: 1500 },
    codeSnippet: { type: String, maxlength: 2000 },
    fixSnippet: { type: String, maxlength: 2000 },
  },
  { _id: true }
);

// ─── File Analysis Sub-schema ─────────────────────────────────────────────────
const fileAnalysisSchema = new Schema(
  {
    fileName: { type: String, required: true, maxlength: 500 },
    language: { type: String, required: true, maxlength: 50 },
    fileSize: { type: Number, required: true },
    lineCount: { type: Number, default: 0 },
    issues: [issueSchema],
    metrics: {
      linesOfCode: { type: Number, default: 0 },
      blankLines: { type: Number, default: 0 },
      commentLines: { type: Number, default: 0 },
      functions: { type: Number, default: 0 },
      classes: { type: Number, default: 0 },
      complexity: { type: Number, default: 0 },
    },
  },
  { _id: true }
);

// ─── Main CodeReview Schema ───────────────────────────────────────────────────
const codeReviewSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Input
    inputType: {
      type: String,
      enum: ['file_upload', 'code_paste', 'github_url'],
      required: true,
    },
    sourceFiles: [{
      fileName: { type: String, required: true },
      language: { type: String },
      mimeType: { type: String },
      size: { type: Number },
      url: { type: String },
      publicId: { type: String },
    }],
    githubUrl: { type: String, default: '' },
    pastedCode: { type: String, default: '' },
    detectedLanguage: { type: String, default: '' },

    // Review options
    options: {
      focusAreas: [{
        type: String,
        enum: ['bugs', 'security', 'performance', 'best_practice', 'maintainability', 'style'],
      }],
      severity: {
        type: String,
        enum: ['all', 'critical', 'high', 'medium'],
        default: 'all',
      },
    },

    // Results
    status: {
      type: String,
      enum: ['pending', 'analyzing', 'completed', 'failed'],
      default: 'pending',
    },
    fileAnalyses: [fileAnalysisSchema],

    // Summary scores
    overallScore: { type: Number, min: 0, max: 100, default: 0 },
    categoryScores: {
      bugs: { type: Number, min: 0, max: 100, default: 0 },
      security: { type: Number, min: 0, max: 100, default: 0 },
      performance: { type: Number, min: 0, max: 100, default: 0 },
      bestPractice: { type: Number, min: 0, max: 100, default: 0 },
      maintainability: { type: Number, min: 0, max: 100, default: 0 },
      style: { type: Number, min: 0, max: 100, default: 0 },
    },

    // Aggregate counts
    totalIssues: { type: Number, default: 0 },
    criticalCount: { type: Number, default: 0 },
    highCount: { type: Number, default: 0 },
    mediumCount: { type: Number, default: 0 },
    lowCount: { type: Number, default: 0 },
    infoCount: { type: Number, default: 0 },

    // AI summary
    summary: { type: String, maxlength: 3000 },
    recommendations: [{ type: String, maxlength: 500 }],
    strengths: [{ type: String, maxlength: 500 }],

    // Metadata
    analyzedAt: { type: Date },
    analysisDuration: { type: Number, default: 0 }, // ms
    aiModel: { type: String, default: 'gemini-flash-latest' },
    errorMessage: { type: String, default: '' },

    // Project context (optional)
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },

    // Public sharing (opt-in). Defaults to false: a review may only be read via
    // the public route /code-reviews/public/:reviewId when the owner explicitly
    // shares it. The owner's own /code-reviews/:reviewId always returns the full
    // private review.
    isPublic: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
codeReviewSchema.index({ user: 1, createdAt: -1 });
codeReviewSchema.index({ status: 1 });
codeReviewSchema.index({ overallScore: -1 });

// ─── Virtual: total file count ────────────────────────────────────────────────
codeReviewSchema.virtual('fileCount').get(function () {
  return this.fileAnalyses?.length || 0;
});

const CodeReview = model('CodeReview', codeReviewSchema);
export default CodeReview;
