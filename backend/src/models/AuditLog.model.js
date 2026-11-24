import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const auditLogSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['payment', 'wallet', 'escrow', 'withdrawal', 'commission', 'refund', 'auth', 'admin', 'system'],
      required: true,
    },
    resourceType: { type: String, default: '' },
    resourceId: { type: Schema.Types.ObjectId, default: null },
    details: { type: Schema.Types.Mixed, default: {} },
    amount: { type: Number, default: null },
    currency: { type: String, default: '' },
    reference: { type: String, default: '' },

    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },

    status: {
      type: String,
      enum: ['success', 'failure', 'warning'],
      default: 'success',
    },
    errorMessage: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ user: 1, category: 1, createdAt: -1 });
auditLogSchema.index({ reference: 1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 }); // TTL: 2 years

const AuditLog = model('AuditLog', auditLogSchema);
export default AuditLog;
