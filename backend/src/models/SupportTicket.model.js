import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const ticketMessageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderType: {
      type: String,
      enum: ['user', 'admin', 'ai'],
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    attachments: [
      {
        url: { type: String },
        publicId: { type: String },
        originalName: { type: String },
      },
    ],
    isRead: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

const ticketActivitySchema = new Schema(
  {
    action: {
      type: String,
      enum: [
        'created',
        'assigned',
        'status_changed',
        'priority_changed',
        'reply_sent',
        'note_added',
        'investigation_started',
        'investigation_updated',
        'resolution_added',
        'resolved',
        'closed',
        'reopened',
      ],
      required: true,
    },
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    from: { type: String, default: '' },
    to: { type: String, default: '' },
    note: { type: String, maxlength: [5000, 'Activity note cannot exceed 5000 characters'] },
  },
  { _id: true, timestamps: true }
);

const supportTicketSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ticketId: {
      type: String,
      unique: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    category: {
      type: String,
      enum: [
        'general_inquiry',
        'account_issue',
        'payment_problem',
        'project_dispute',
        'technical_issue',
        'billing',
        'feature_request',
        'bug_report',
        'other',
      ],
      required: true,
      default: 'general_inquiry',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'],
      default: 'open',
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    messages: [ticketMessageSchema],
    relatedJob: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
    },
    relatedProject: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    resolution: {
      content: { type: String },
      resolvedAt: { type: Date },
      resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    rootCause: { type: String, trim: true, default: '', maxlength: [2000, 'Root cause cannot exceed 2000 characters'] },
    investigationNotes: { type: String, trim: true, default: '', maxlength: [2000, 'Investigation notes cannot exceed 2000 characters'] },
    satisfactionRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    tags: [{ type: String, trim: true }],
    internalNotes: [
      {
        content: {
          type: String,
          required: [true, 'Note content is required'],
          maxlength: [2000, 'Note cannot exceed 2000 characters'],
        },
        author: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isAIGenerated: { type: Boolean, default: false },
    lastReplyAt: { type: Date, default: Date.now },
    messageCount: { type: Number, default: 0 },
    activities: [ticketActivitySchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
supportTicketSchema.index({ user: 1, status: 1 });
supportTicketSchema.index({ status: 1, priority: 1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });
supportTicketSchema.index({ createdAt: -1 });

// ─── Pre-save: generate ticket ID ─────────────────────────────────────────────
supportTicketSchema.pre('save', function (next) {
  if (this.isNew && !this.ticketId) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.ticketId = `SKH-TKT-${timestamp}-${random}`;
  }
  if (this.isModified('messages')) {
    this.messageCount = this.messages.length;
    if (this.messages.length > 0) {
      this.lastReplyAt = this.messages[this.messages.length - 1].createdAt || new Date();
    }
  }
  next();
});

const SupportTicket = model('SupportTicket', supportTicketSchema);
export default SupportTicket;
