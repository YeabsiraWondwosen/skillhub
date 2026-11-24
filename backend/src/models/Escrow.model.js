import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const escrowSchema = new Schema(
  {
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
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },
    serviceOrder: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceOrder',
      default: null,
      index: true,
    },
    milestone: {
      type: Schema.Types.ObjectId,
      ref: 'Milestone',
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Escrow amount is required'],
      min: [0.01, 'Escrow amount must be positive'],
    },
    currency: { type: String, default: 'ETB', uppercase: true },
    commissionRate: { type: Number, default: 0.10 },
    commissionAmount: { type: Number, default: 0 },
    freelancerAmount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: [
        'pending',     // Created, waiting for client to fund
        'funded',      // Client has funded (locked from wallet)
        'in_progress', // Freelancer is working
        'submitted',   // Freelancer submitted deliverable
        'released',    // Payment released to freelancer
        'refunded',    // Refunded to client
        'disputed',    // Under dispute
        'cancelled',   // Cancelled before funding
        'expired',     // Escrow expired (auto-refund)
      ],
      default: 'pending',
    },

    // Payment references
    fundingTransaction: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    releaseTransaction: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    refundTransaction: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },

    // Lifecycle timestamps
    fundedAt: { type: Date },
    submittedAt: { type: Date },
    releasedAt: { type: Date },
    refundedAt: { type: Date },
    expiresAt: { type: Date },

    // Release info
    releasedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },

    // Refund info
    refundReason: { type: String, maxlength: 500 },
    refundedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // Dispute info
    disputeReason: { type: String, maxlength: 1000 },
    disputeOpenedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    disputeOpenedAt: { type: Date },
    disputeResolvedAt: { type: Date },

    description: { type: String, maxlength: 500, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

escrowSchema.index({ client: 1, status: 1 });
escrowSchema.index({ freelancer: 1, status: 1 });
escrowSchema.index({ project: 1, status: 1 });
escrowSchema.index({ status: 1, createdAt: -1 });

const Escrow = model('Escrow', escrowSchema);
export default Escrow;
