import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const paymentSchema = new Schema(
  {
    payer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    payee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    milestone: {
      type: Schema.Types.ObjectId,
      ref: 'Milestone',
      default: null,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'deposit',
        'withdrawal',
        'milestone_payment',
        'project_payment',
        'service_order_payment',
        'escrow',
        'refund',
        'commission',
      ],
      index: true,
    },
    serviceOrder: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceOrder',
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Amount must be positive'],
    },
    currency: { type: String, default: 'ETB', uppercase: true },
    commission: { type: Number, default: 0 },
    commissionRate: { type: Number, default: 0.10 },
    netAmount: { type: Number, required: true },

    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'disputed', 'cancelled'],
      default: 'pending',
    },

    // Payment provider info
    provider: {
      type: String,
      enum: ['stripe', 'chapa', 'telebirr', 'cbe_birr', 'wallet', 'manual', 'demo'],
      required: true,
      default: 'stripe',
    },
    providerPaymentId: { type: String, default: '' },
    providerCustomerId: { type: String, default: '' },
    providerTransactionRef: { type: String, default: '' },

    // Internal reference
    reference: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },

    description: { type: String, maxlength: 500, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },

    // Invoice
    invoiceNumber: { type: String, unique: true, sparse: true },
    invoiceUrl: { type: String, default: '' },

    // Escrow
    isEscrow: { type: Boolean, default: false },
    escrowReleasedAt: { type: Date },
    escrowHeldAt: { type: Date },

    // Webhook/event tracking
    webhookEvents: [
      {
        eventId: { type: String },
        eventType: { type: String },
        receivedAt: { type: Date, default: Date.now },
        payload: { type: Schema.Types.Mixed },
      },
    ],

    failureReason: { type: String, default: '' },
    refundedAt: { type: Date },
    refundReason: { type: String, default: '' },
    processedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ payer: 1, createdAt: -1 });
paymentSchema.index({ payee: 1, createdAt: -1 });
paymentSchema.index({ status: 1, type: 1 });

const Payment = model('Payment', paymentSchema);
export default Payment;
