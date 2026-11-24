import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const conversationSchema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    type: {
      type: String,
      enum: ['direct', 'project'],
      default: 'direct',
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageAt: { type: Date, default: Date.now },
    unreadCounts: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        count: { type: Number, default: 0 },
      },
    ],
    isActive: { type: Boolean, default: true },
    // Users who deleted this conversation from their list (per-user soft delete)
    deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    // For project conversations, track status
    metadata: {
      title: { type: String, default: '' },
      jobTitle: { type: String, default: '' },
    },

    // Per-user conversation settings
    userSettings: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        isPinned: { type: Boolean, default: false },
        isStarred: { type: Boolean, default: false },
        isMuted: { type: Boolean, default: false },
        isArchived: { type: Boolean, default: false },
        isBlocked: { type: Boolean, default: false },
        blockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        nickname: { type: String, default: '' },
        lastReadAt: { type: Date, default: Date.now },
      },
    ],

    // Shared project workspace data
    workspace: {
      isActive: { type: Boolean, default: false },
      notes: [
        {
          _id: { type: Schema.Types.ObjectId, auto: true },
          content: { type: String, required: true },
          author: { type: Schema.Types.ObjectId, ref: 'User' },
          createdAt: { type: Date, default: Date.now },
          isPinned: { type: Boolean, default: false },
        },
      ],
      tasks: [
        {
          _id: { type: Schema.Types.ObjectId, auto: true },
          title: { type: String, required: true },
          description: { type: String, default: '' },
          assignee: { type: Schema.Types.ObjectId, ref: 'User' },
          status: { type: String, enum: ['todo', 'in-progress', 'done'], default: 'todo' },
          dueDate: { type: Date },
          createdAt: { type: Date, default: Date.now },
          createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        },
      ],
      sharedFiles: [
        {
          url: { type: String },
          publicId: { type: String },
          name: { type: String },
          uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ project: 1 });
conversationSchema.index({ 'userSettings.user': 1 });
conversationSchema.index({ 'userSettings.isPinned': 1 });
conversationSchema.index({ 'userSettings.isStarred': 1 });

// Ensure unique direct conversations between two users
conversationSchema.index(
  { participants: 1, type: 1 },
  {
    unique: false, // handled in service layer
    partialFilterExpression: { type: 'direct' },
  }
);

conversationSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'conversation',
});

const Conversation = model('Conversation', conversationSchema);
export default Conversation;
