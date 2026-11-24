import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const notificationActionSchema = new Schema(
  {
    label: { type: String, required: true },
    url: { type: String },
    method: { type: String, enum: ['GET', 'POST', 'PATCH', 'DELETE'], default: 'GET' },
    payload: { type: Schema.Types.Mixed },
    style: { type: String, enum: ['primary', 'secondary', 'danger'], default: 'primary' },
  },
  { _id: false }
);

const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Free-form type (e.g. 'job_application_received', 'ai_job_match').
    // Known types are mapped to a `category` via utils/notificationCategory.js;
    // the enum is intentionally not enforced so new / legacy event types are
    // persisted and categorised safely instead of being silently dropped.
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // Deep link
    actionUrl: { type: String, default: '' },
    // The resource a notification refers to (e.g. 'service_order',
    // 'support_ticket', 'contact_message', 'withdrawal', 'escrow', 'report').
    // Intentionally free-form (like `type`): several real event producers use
    // values that were never part of the original whitelist, and an enforced
    // enum caused those notifications to be rejected — and silently dropped —
    // so the admin never saw them. Keeping it unconstrained preserves every
    // record and prevents future event types from being lost.
    resourceType: { type: String, trim: true, default: null },
    resourceId: { type: Schema.Types.ObjectId, default: null },

    // ─── AI-specific fields ─────────────────────────────────────────────────
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    category: {
      type: String,
      enum: ['system', 'job', 'project', 'payment', 'message', 'social', 'ai', null],
      default: null,
      index: true,
    },
    isAiGenerated: { type: Boolean, default: false },
    aiConfidence: { type: Number, min: 0, max: 1 },
    aiReasoning: { type: String, maxlength: 500 },
    actions: [notificationActionSchema],

    // Read & delivery
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    isDismissed: { type: Boolean, default: false },
    isEmailSent: { type: Boolean, default: false },
    isPushSent: { type: Boolean, default: false },

    // Expiry for time-sensitive AI notifications
    expiresAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, category: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isAiGenerated: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // TTL: 90 days

const Notification = model('Notification', notificationSchema);
export default Notification;
