import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const transactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    wallet: {
      type: Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'deposit',           // Add funds to wallet
        'withdrawal',        // Withdraw from wallet
        'escrow_hold',       // Funds moved to escrow
        'escrow_release',    // Escrow released to freelancer
        'escrow_refund',     // Escrow refunded to client
        'commission',        // Platform commission deducted
        'bonus',             // Platform bonus
        'refund',            // Refund to user
      ],
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be at least 0.01 ETB'],
    },
    currency: { type: String, default: 'ETB', uppercase: true },
    fee: { type: Number, default: 0, min: 0 },
    netAmount: { type: Number, required: true },

    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
      default: 'pending',
    },

    // Reference
    reference: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    externalReference: { type: String, default: '' }, // Stripe/Chapa ref
    description: { type: String, maxlength: 500, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },

    // Relationships
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    milestoneId: { type: Schema.Types.ObjectId, ref: 'Milestone' },

    // Balance snapshot
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },

    // Failure info
    failureReason: { type: String, default: '' },

    processedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ status: 1, type: 1 });

const Transaction = model('Transaction', transactionSchema);
export default Transaction;
