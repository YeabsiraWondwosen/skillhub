import mongoose from 'mongoose';
import { futureDateValidator } from '../utils/dateValidation.js';

const { Schema, model } = mongoose;

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'review', 'done'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    dueDate: { type: Date },
    completedAt: { type: Date },
    order: { type: Number, default: 0 },
  },
  { _id: true, timestamps: true }
);

const projectFileSchema = new Schema(
  {
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    url: { type: String, required: true },
    publicId: { type: String },
    originalName: { type: String, required: true },
    fileType: { type: String },
    fileSize: { type: Number },
    description: { type: String, maxlength: 500 },
    category: {
      type: String,
      enum: ['document', 'design', 'code', 'delivery', 'other'],
      default: 'other',
    },
  },
  { _id: true, timestamps: true }
);

const deliveryFileSchema = new Schema(
  {
    url: { type: String },
    publicId: { type: String },
    originalName: { type: String },
    fileType: { type: String },
    fileSize: { type: Number },
  },
  { _id: false }
);

const deliverySchema = new Schema(
  {
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: '', trim: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 3000 },
    demoUrl: { type: String, default: '', trim: true, maxlength: 2048 },
    files: [deliveryFileSchema],
    screenshots: [deliveryFileSchema],
    submittedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'approved', 'revision_requested'],
      default: 'pending',
    },
    revisionNote: { type: String, default: '' },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const projectSchema = new Schema(
  {
    job: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
    },
    application: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      default: null,
    },
    serviceOrder: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceOrder',
      default: null,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    freelancer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: { type: String, maxlength: 5000 },
    status: {
      type: String,
      enum: [
        'pending_payment',
        'active',
        'on_hold',
        'pending_delivery',
        'in_revision',
        'completed',
        'cancelled',
        'disputed',
      ],
      default: 'pending_payment',
    },
    budget: {
      agreedAmount: { type: Number, required: true, min: 0 },
      paidAmount: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'ETB' },
    },
    timeline: {
      // Not auto-stamped: a contract is only "started" once it is actually
      // funded (see propagateFunding / fundProjectPayment). A pending_payment
      // contract must not display a start date.
      startDate: { type: Date },
      deadline: { type: Date, required: true, validate: futureDateValidator('timeline.deadline') },
      completedAt: { type: Date },
      estimatedDuration: { type: Number }, // days
    },
    tasks: [taskSchema],
    files: [projectFileSchema],
    deliveries: [deliverySchema],

    // Progress (0-100)
    progress: { type: Number, default: 0, min: 0, max: 100 },

    // Communication channel ID (references a conversation)
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },

    // Escrow payment reference
    escrowPaymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },

    // Client satisfaction
    clientRating: { type: Number, min: 1, max: 5 },
    freelancerRating: { type: Number, min: 1, max: 5 },

    // Dispute info
    dispute: {
      isDisputed: { type: Boolean, default: false },
      reason: { type: String, default: '' },
      raisedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      raisedAt: { type: Date },
      resolvedAt: { type: Date },
      resolution: { type: String, default: '' },
    },

    // Revision tracking
    revisionsAllowed: { type: Number, default: 2 },
    revisionsUsed: { type: Number, default: 0 },

    // Notes
    clientNotes: { type: String, default: '', maxlength: 2000 },
    freelancerNotes: { type: String, default: '', maxlength: 2000 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
projectSchema.index({ status: 1, createdAt: -1 });
projectSchema.index({ client: 1, status: 1 });
projectSchema.index({ freelancer: 1, status: 1 });
projectSchema.index({ 'timeline.deadline': 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
projectSchema.virtual('milestones', {
  ref: 'Milestone',
  localField: '_id',
  foreignField: 'project',
});

projectSchema.virtual('isOverdue').get(function () {
  return (
    this.status === 'active' &&
    this.timeline.deadline < new Date()
  );
});

const Project = model('Project', projectSchema);
export default Project;
