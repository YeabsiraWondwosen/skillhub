import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const reportSchema = new Schema(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportedUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    resourceType: {
      type: String,
      required: true,
      enum: ['user', 'job', 'review', 'message', 'project', 'catalog', 'service_order'],
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'spam',
        'fake_account',
        'inappropriate_content',
        'harassment',
        'scam',
        'copyright_violation',
        'false_information',
        'other',
      ],
    },
    description: {
      type: String,
      required: [true, 'Report description is required'],
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    evidence: [
      {
        url: { type: String },
        publicId: { type: String },
        originalName: { type: String },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'under_review', 'resolved', 'dismissed'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent', 'critical'],
      default: 'medium',
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    resolutionReason: {
      type: String,
      maxlength: 1000,
      default: '',
    },
    resolution: {
      action: {
        type: String,
        enum: ['no_action', 'warning', 'content_removed', 'account_suspended', 'account_banned', null],
        default: null,
      },
      note: { type: String, maxlength: 1000, default: '' },
      resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      resolvedAt: { type: Date },
    },

    // Internal admin investigation notes (Trust & Safety)
    investigation: {
      rootCause: { type: String, maxlength: 2000, default: '' },
      notes: { type: String, maxlength: 4000, default: '' },
      recommendedResolution: { type: String, maxlength: 2000, default: '' },
      updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      updatedAt: { type: Date },
    },

    // Internal admin notes (only visible to staff)
    adminNotes: [
      {
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        note: { type: String, required: true, maxlength: 2000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Full audit trail of every admin action on this report
    reportHistory: [
      {
        action: {
          type: String,
          required: true,
          enum: [
            'created', 'status_changed', 'priority_changed', 'assigned',
            'note_added', 'investigation_updated', 'resolved', 'dismissed',
            'reopened', 'action_taken',
          ],
        },
        admin: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        details: { type: Schema.Types.Mixed, default: {} },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

reportSchema.index({ status: 1, priority: -1, createdAt: -1 });
reportSchema.index({ resourceType: 1, resourceId: 1 });
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ reportedUser: 1, createdAt: -1 });

const Report = model('Report', reportSchema);
export default Report;
