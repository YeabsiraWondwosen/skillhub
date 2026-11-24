import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const messageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
      default: '',
    },
    messageType: {
      type: String,
      enum: ['text', 'file', 'image', 'system', 'offer', 'milestone'],
      default: 'text',
    },
    attachments: [
      {
        url: { type: String, required: true },
        publicId: { type: String },
        originalName: { type: String, required: true },
        fileType: { type: String },
        fileSize: { type: Number },
        thumbnailUrl: { type: String },
      },
    ],

    // Read receipts
    readBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],

    // For system/offer messages
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    // Per-user soft delete: users listed here no longer see the message
    deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // Reply to another message
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },

    // Reactions from users
    reactions: {
      type: [
        {
          user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          emoji: { type: String, required: true, maxlength: 4 },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    // Pinned by users in conversation
    pinnedBy: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },

    // Forwarded from another conversation
    forwardedFrom: {
      conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
      sender: { type: Schema.Types.ObjectId, ref: 'User' },
    },

    // Starred/bookmarked by users
    starredBy: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },

    // AI-generated or AI-enhanced metadata
    aiMetadata: {
      isAiGenerated: { type: Boolean, default: false },
      aiTool: { type: String, enum: ['reply', 'grammar', 'rewrite', 'translate', 'summarize', 'smartReply', null], default: null },
      originalContent: { type: String },
      language: { type: String },
    },

    // Sentiment analysis result (computed on read, cached in metadata)
    sentiment: {
      label: { type: String, enum: ['positive', 'neutral', 'negative', null], default: null },
      score: { type: Number, min: 0, max: 1 },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ isDeleted: 1 });

const Message = model('Message', messageSchema);
export default Message;
