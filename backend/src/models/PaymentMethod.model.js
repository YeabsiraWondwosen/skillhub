import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const paymentMethodSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['bank_transfer', 'telebirr', 'cbe_birr', 'chapa'],
      required: true,
    },
    label: { type: String, maxlength: 100 },
    isDefault: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },

    // Bank details
    bankName: { type: String, maxlength: 200 },
    accountNumber: { type: String, maxlength: 100 },
    accountName: { type: String, maxlength: 200 },

    // Telebirr
    phone: { type: String, maxlength: 20 },

    // CBE Birr
    cbeAccountNumber: { type: String, maxlength: 100 },

    // Chapa
    chapaEmail: { type: String, maxlength: 200 },

    // Last used
    lastUsedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

paymentMethodSchema.index({ user: 1, isDefault: 1 });

const PaymentMethod = model('PaymentMethod', paymentMethodSchema);
export default PaymentMethod;
