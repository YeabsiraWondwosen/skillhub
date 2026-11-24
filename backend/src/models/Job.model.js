import mongoose from 'mongoose';
import { futureDateValidator } from '../utils/dateValidation.js';

const { Schema, model } = mongoose;

const jobSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
      index: 'text',
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      maxlength: [10000, 'Description cannot exceed 10000 characters'],
    },
    requiredSkills: {
      type: [String],
      required: [true, 'At least one skill is required'],
      validate: {
        validator: (arr) => arr.length >= 1 && arr.length <= 20,
        message: 'Must have between 1 and 20 required skills',
      },
    },
    budget: {
      type: {
        type: String,
        enum: ['fixed', 'hourly'],
        required: true,
        default: 'fixed',
      },
      minAmount: { type: Number, min: 0, default: 0 },
      maxAmount: { type: Number, min: 0, required: true },
      currency: { type: String, default: 'ETB', uppercase: true },
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required'],
      validate: futureDateValidator('deadline'),
    },
    duration: {
      type: String,
      enum: ['less_than_1_week', '1_to_4_weeks', '1_to_3_months', '3_to_6_months', 'more_than_6_months'],
      default: '1_to_4_weeks',
    },
    experienceLevel: {
      type: String,
      enum: ['entry', 'intermediate', 'expert'],
      required: true,
      default: 'intermediate',
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    subcategories: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: 'Cannot have more than 10 subcategories',
      },
    },
    attachments: [
      {
        url: { type: String },
        publicId: { type: String },
        originalName: { type: String },
        fileType: { type: String },
        fileSize: { type: Number },
      },
    ],
    status: {
      type: String,
      enum: [
        'draft', 'open', 'proposals_received',
        'freelancer_selected', 'payment_pending', 'funded',
        'in_progress', 'delivery_submitted', 'client_review',
        'completed', 'cancelled', 'paused',
      ],
      default: 'open',
    },
    paymentStatus: {
      type: String,
      enum: ['none', 'pending', 'funded', 'released', 'refunded'],
      default: 'none',
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    escrowId: {
      type: Schema.Types.ObjectId,
      ref: 'Escrow',
      default: null,
    },
    milestoneId: {
      type: Schema.Types.ObjectId,
      ref: 'Milestone',
      default: null,
    },
    visibility: {
      type: String,
      enum: ['public', 'invite_only'],
      default: 'public',
    },
    invitedFreelancers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    hiredFreelancer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },

    // Stats
    applicationsCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },

    // Flags
    isFeatured: { type: Boolean, default: false },
    isUrgent: { type: Boolean, default: false },

    // Slug for SEO
    slug: { type: String, unique: true, sparse: true, index: true },

    // Moderation
    isApproved: { type: Boolean, default: true },
    rejectionReason: { type: String, default: '' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Text Search Index ────────────────────────────────────────────────────────
jobSchema.index(
  { title: 'text', description: 'text', requiredSkills: 'text' },
  { weights: { title: 3, requiredSkills: 2, description: 1 } }
);

jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ category: 1, status: 1 });
jobSchema.index({ 'budget.maxAmount': 1 });
jobSchema.index({ experienceLevel: 1 });
jobSchema.index({ deadline: 1 });

// ─── Virtual ──────────────────────────────────────────────────────────────────
jobSchema.virtual('applications', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'job',
});

jobSchema.virtual('isExpired').get(function () {
  return this.deadline < new Date();
});

// ─── Pre-save: generate slug ──────────────────────────────────────────────────
jobSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('title')) {
    const base = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80);
    this.slug = `${base}-${this._id.toString().slice(-6)}`;
  }
  next();
});

const Job = model('Job', jobSchema);
export default Job;
