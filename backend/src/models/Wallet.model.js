import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const walletSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
      get: (v) => Math.round(v * 100) / 100, // 2 decimal places
    },
    escrowBalance: {
      type: Number,
      default: 0,
      min: [0, 'Escrow balance cannot be negative'],
      get: (v) => Math.round(v * 100) / 100,
    },
    pendingBalance: {
      type: Number,
      default: 0,
      min: [0, 'Pending balance cannot be negative'],
      get: (v) => Math.round(v * 100) / 100,
    },
    totalEarned: { type: Number, default: 0, min: 0 },
    totalWithdrawn: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'ETB', uppercase: true },
    isActive: { type: Boolean, default: true },

    // Withdrawal settings
    withdrawalMethod: {
      type: {
        type: String,
        enum: ['bank_transfer', 'paypal', 'stripe', 'chapa', null],
        default: null,
      },
      details: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

walletSchema.virtual('availableBalance').get(function () {
  return Math.round((this.balance - this.escrowBalance) * 100) / 100;
});

const Wallet = model('Wallet', walletSchema);
export default Wallet;
