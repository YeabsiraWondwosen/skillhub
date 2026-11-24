import mongoose from 'mongoose';
import { futureDateValidator } from '../utils/dateValidation.js';

const { Schema, model } = mongoose;

const milestoneSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    freelancer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Milestone title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    amount: {
      type: Number,
      required: [true, 'Milestone amount is required'],
      min: [1, 'Milestone amount must be at least 1 ETB'],
    },
    currency: { type: String, default: 'ETB', uppercase: true },
    dueDate: {
      type: Date,
      required: [true, 'Milestone due date is required'],
      validate: futureDateValidator('dueDate'),
    },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        'pending',           // Not yet funded
        'funded',            // Escrow funded by client
        'in_progress',       // Freelancer working
        'submitted',         // Freelancer submitted
        'approved',          // Client approved
        'released',          // Payment released to freelancer
        'revision_requested',// Client requested changes
        'disputed',          // Under dispute
        'cancelled',         // Cancelled
      ],
      default: 'pending',
    },

    // Delivery
    deliveryFiles: [
      {
        url: { type: String },
        publicId: { type: String },
        originalName: { type: String },
        fileType: { type: String },
        fileSize: { type: Number },
      },
    ],
    deliveryNote: { type: String, maxlength: 2000 },
    submittedAt: { type: Date },

    // Payment references
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    escrowReleasedAt: { type: Date },

    // Feedback
    revisionNote: { type: String, default: '' },
    revisionsCount: { type: Number, default: 0 },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

milestoneSchema.index({ project: 1, order: 1 });
milestoneSchema.index({ status: 1 });

milestoneSchema.virtual('isOverdue').get(function () {
  return (
    ['funded', 'in_progress'].includes(this.status) &&
    this.dueDate < new Date()
  );
});

const Milestone = model('Milestone', milestoneSchema);
export default Milestone;
