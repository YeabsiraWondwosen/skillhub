import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    type: {
      type: String,
      enum: ['behavioral', 'technical', 'situational', 'problem_solving', 'system_design', 'culture_fit'],
      required: true,
    },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    expectedAnswer: { type: String, maxlength: 2000 },
    followUp: { type: String, maxlength: 1000 },
    scoringCriteria: [String],
    candidateAnswer: { type: String, maxlength: 3000 },
    score: { type: Number, min: 0, max: 10 },
    scoreReasoning: { type: String, maxlength: 500 },
    timeSpentSeconds: { type: Number },
  },
  { _id: false }
);

const codingChallengeSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true, maxlength: 3000 },
    type: {
      type: String,
      enum: ['algorithm', 'data_structure', ' debugging', 'code_review', 'system_design', 'api_design', 'refactoring'],
      required: true,
    },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    language: { type: String, default: 'javascript' },
    starterCode: { type: String, maxlength: 3000 },
    solution: { type: String, maxlength: 5000 },
    testCases: [{
      input: { type: String },
      expectedOutput: { type: String },
      isHidden: { type: Boolean, default: false },
    }],
    hints: [String],
    candidateSolution: { type: String, maxlength: 5000 },
    passedTests: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },
    score: { type: Number, min: 0, max: 10 },
    scoreReasoning: { type: String, maxlength: 500 },
    codeQualityScore: { type: Number, min: 0, max: 10 },
    efficiencyScore: { type: Number, min: 0, max: 10 },
    timeSpentSeconds: { type: Number },
    feedback: { type: String, maxlength: 1000 },
  },
  { _id: false }
);

const scorecardSchema = new Schema(
  {
    technicalSkills: { type: Number, min: 0, max: 10, default: 0 },
    problemSolving: { type: Number, min: 0, max: 10, default: 0 },
    communication: { type: Number, min: 0, max: 10, default: 0 },
    codeQuality: { type: Number, min: 0, max: 10, default: 0 },
    systemDesign: { type: Number, min: 0, max: 10, default: 0 },
    cultureFit: { type: Number, min: 0, max: 10, default: 0 },
    learningAbility: { type: Number, min: 0, max: 10, default: 0 },
    timeManagement: { type: Number, min: 0, max: 10, default: 0 },
    overallScore: { type: Number, min: 0, max: 10, default: 0 },
    recommendation: {
      type: String,
      enum: ['strong_hire', 'hire', 'maybe', 'no_hire', 'strong_no_hire'],
      default: 'maybe',
    },
    strengths: [String],
    weaknesses: [String],
    notes: { type: String, maxlength: 2000 },
    evaluatorNotes: { type: String, maxlength: 2000 },
  },
  { _id: false }
);

const interviewSessionSchema = new Schema(
  {
    interviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    candidate: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    candidateName: { type: String, maxlength: 100 },
    job: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
    },
    title: { type: String, required: true, maxlength: 200 },
    status: {
      type: String,
      enum: ['draft', 'in_progress', 'completed', 'cancelled'],
      default: 'draft',
    },
    interviewType: {
      type: String,
      enum: ['technical', 'behavioral', 'mixed', 'coding_challenge', 'system_design'],
      default: 'mixed',
    },
    difficulty: {
      type: String,
      enum: ['junior', 'mid', 'senior', 'lead'],
      default: 'mid',
    },
    skills: [String],
    questions: [questionSchema],
    codingChallenges: [codingChallengeSchema],
    scorecard: scorecardSchema,
    summary: {
      overview: { type: String, maxlength: 2000 },
      highlights: [String],
      concerns: [String],
      recommendation: { type: String, maxlength: 1000 },
      nextSteps: [String],
      generatedAt: { type: Date },
    },
    duration: { type: Number, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    tags: [String],
  },
  {
    timestamps: true,
  }
);

interviewSessionSchema.index({ interviewer: 1, status: 1 });
interviewSessionSchema.index({ interviewer: 1, createdAt: -1 });
interviewSessionSchema.index({ candidate: 1 });

const InterviewSession = model('InterviewSession', interviewSessionSchema);
export default InterviewSession;
