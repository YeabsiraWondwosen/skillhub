import mongoose from 'mongoose';
import { futureDateValidator } from '../utils/dateValidation.js';

const { Schema, model } = mongoose;

const orderFileSchema = new Schema(
  {
    url: { type: String },
    publicId: { type: String },
    originalName: { type: String },
    fileType: { type: String },
    fileSize: { type: Number },
  },
  { _id: false }
);

// Snapshot of the pricing tier at the moment the order was placed so later
// edits to the service can never change an already-placed order.
const tierSnapshotSchema = new Schema(
  {
    name: {
      type: String,
      enum: ['basic', 'standard', 'premium'],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'ETB', uppercase: true },
    deliveryTime: { type: Number, default: 7, min: 1 },
    deliveryUnit: {
      type: String,
      enum: ['days', 'weeks'],
      default: 'days',
    },
    revisions: { type: Number, default: 1, min: 0 },
    features: [{ type: String }],
  },
  { _id: false }
);

const serviceOrderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Catalog',
      required: true,
      index: true,
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
    tier: tierSnapshotSchema,

    // Client-supplied order details
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
      maxlength: 200,
    },
    description: { type: String, maxlength: 5000, default: '' },
    requirements: { type: String, maxlength: 5000, default: '' },
    expectedDelivery: { type: Date, default: null, validate: futureDateValidator('expectedDelivery') },
    additionalNotes: { type: String, maxlength: 2000, default: '' },
    files: [orderFileSchema],

    // Escrow / payment
    budget: {
      amount: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'ETB', uppercase: true },
    },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    escrow: { type: Schema.Types.ObjectId, ref: 'Escrow', default: null },
    transaction: { type: Schema.Types.ObjectId, ref: 'Transaction', default: null },

    // Entities created when the freelancer accepts
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', default: null },
    milestone: { type: Schema.Types.ObjectId, ref: 'Milestone', default: null },
    review: { type: Schema.Types.ObjectId, ref: 'Review', default: null },

    status: {
      type: String,
      enum: [
        'pending_payment', // client created order, escrow awaiting funding
        'funded',          // client funded escrow, freelancer to respond
        'accepted',        // freelancer accepted, project created
        'delivered',       // freelancer submitted delivery
        'revision_requested', // client asked for changes
        'completed',       // delivery approved + escrow released
        'declined',        // freelancer declined (escrow refunded)
        'cancelled',       // client cancelled before funding
        'refunded',        // admin refunded escrow to client
        'disputed',        // under dispute
      ],
      default: 'pending_payment',
      index: true,
    },
    declineReason: { type: String, maxlength: 1000, default: '' },

    // Delivery submission (freelancer)
    delivery: {
      message: { type: String, maxlength: 5000, default: '' },
      files: [orderFileSchema],
      submittedAt: { type: Date },
    },
    revisionNote: { type: String, maxlength: 2000, default: '' },
    disputeReason: { type: String, maxlength: 2000, default: '' },
    report: { type: Schema.Types.ObjectId, ref: 'Report', default: null },

    timeline: {
      placedAt: { type: Date, default: Date.now },
      fundedAt: { type: Date },
      acceptedAt: { type: Date },
      declinedAt: { type: Date },
      cancelledAt: { type: Date },
      deliveredAt: { type: Date },
      revisionRequestedAt: { type: Date },
      completedAt: { type: Date },
      refundedAt: { type: Date },
      disputedAt: { type: Date },
    },

    isActive: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
serviceOrderSchema.index({ client: 1, status: 1, createdAt: -1 });
serviceOrderSchema.index({ freelancer: 1, status: 1, createdAt: -1 });
serviceOrderSchema.index({ service: 1, status: 1 });
serviceOrderSchema.index({ project: 1 });

// ─── Pre-save: generate order number ──────────────────────────────────────────
serviceOrderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const seq = Math.floor(1000 + Math.random() * 9000);
    this.orderNumber = `SO-${Date.now().toString(36).toUpperCase()}${seq}`;
  }
  next();
});

const ServiceOrder = model('ServiceOrder', serviceOrderSchema);
export default ServiceOrder;
