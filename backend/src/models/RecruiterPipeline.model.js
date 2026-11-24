import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const candidateNoteSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 2000 },
    isInternal: { type: Boolean, default: true },
  },
  { _id: true, timestamps: true }
);

const candidateSchema = new Schema(
  {
    freelancer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stage: {
      type: String,
      enum: ['sourcing', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'],
      default: 'sourcing',
    },
    matchScore: { type: Number, min: 0, max: 100, default: 0 },
    notes: [candidateNoteSchema],
    rejectionReason: { type: String, maxlength: 500 },
    rating: { type: Number, min: 1, max: 5 },
    shortlistedAt: { type: Date },
    stageHistory: [
      {
        from: { type: String },
        to: { type: String, required: true },
        movedAt: { type: Date, default: Date.now },
        movedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { _id: true, timestamps: true }
);

const invitationSchema = new Schema(
  {
    freelancer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: Schema.Types.ObjectId, ref: 'Job' },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired'],
      default: 'pending',
    },
    message: { type: String, maxlength: 1000 },
    sentAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
  },
  { _id: true, timestamps: true }
);

const recruiterPipelineSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 100,
    },
    description: { type: String, maxlength: 500 },
    job: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'completed'],
      default: 'active',
    },
    candidates: [candidateSchema],
    invitations: [invitationSchema],
    customStages: [
      {
        name: { type: String, required: true },
        order: { type: Number, required: true },
        color: { type: String, default: '#6366f1' },
      },
    ],
    tags: [String],
  },
  {
    timestamps: true,
  }
);

recruiterPipelineSchema.index({ user: 1, status: 1 });
recruiterPipelineSchema.index({ user: 1, createdAt: -1 });
recruiterPipelineSchema.index({ 'candidates.freelancer': 1 });

const RecruiterPipeline = model('RecruiterPipeline', recruiterPipelineSchema);
export default RecruiterPipeline;
