import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const withdrawalSchema = new Schema(
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
    amount: {
      type: Number,
      required: [true, 'Withdrawal amount is required'],
      min: [10, 'Minimum withdrawal is 10 ETB'],
    },
    currency: { type: String, default: 'ETB', uppercase: true },
    fee: { type: Number, default: 0, min: 0 },
    netAmount: { type: Number, required: true },

    method: {
      type: String,
      enum: ['bank_transfer', 'paypal', 'stripe', 'chapa', 'telebirr', 'cbe_birr'],
      required: true,
    },
    accountDetails: {
      type: Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },

    reference: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    externalReference: { type: String, default: '' },

    // Processing
    processedAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },
    failureReason: { type: String, default: '' },

    // Admin review
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    adminNotes: { type: String, maxlength: 500, default: '' },

    // KYC/AML compliance
    kycVerified: { type: Boolean, default: false },
    amlCheckPassed: { type: Boolean, default: true },

    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

withdrawalSchema.index({ user: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, method: 1 });
withdrawalSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }); // TTL: 1 year

const Withdrawal = model('Withdrawal', withdrawalSchema);
export default Withdrawal;
