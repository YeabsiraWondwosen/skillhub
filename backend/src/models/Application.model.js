import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const applicationSchema = new Schema(
  {
    job: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    freelancer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    coverLetter: {
      type: String,
      required: [true, 'Cover letter is required'],
      minlength: [100, 'Cover letter must be at least 100 characters'],
      maxlength: [3000, 'Cover letter cannot exceed 3000 characters'],
    },
    priceOffer: {
      amount: {
        type: Number,
        required: [true, 'Price offer is required'],
        min: [1, 'Price offer must be at least 1 ETB'],
      },
      type: {
        type: String,
        enum: ['fixed', 'hourly'],
        required: true,
        default: 'fixed',
      },
      currency: { type: String, default: 'ETB', uppercase: true },
    },
    deliveryTime: {
      value: {
        type: Number,
        required: [true, 'Delivery time is required'],
        min: 1,
      },
      unit: {
        type: String,
        enum: ['hours', 'days', 'weeks', 'months'],
        default: 'days',
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
        'pending',      // Submitted, awaiting review
        'viewed',       // Client viewed
        'shortlisted',  // Added to shortlist
        'accepted',     // Hired
        'rejected',     // Rejected
        'withdrawn',    // Freelancer withdrew
      ],
      default: 'pending',
    },
    rejectionReason: { type: String, default: '' },
    clientNote: { type: String, default: '' },

    // AI match score (0-100)
    aiMatchScore: { type: Number, default: 0, min: 0, max: 100 },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date },

    // Unique constraint: one application per job per freelancer
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Compound Index: prevent duplicate applications ───────────────────────────
applicationSchema.index({ job: 1, freelancer: 1 }, { unique: true });
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ client: 1, status: 1 });

const Application = model('Application', applicationSchema);
export default Application;
