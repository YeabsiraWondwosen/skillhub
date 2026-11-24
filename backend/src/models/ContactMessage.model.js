import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const contactMessageSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, 'Invalid email address'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    status: {
      type: String,
      enum: ['New', 'In Progress', 'Replied', 'Resolved', 'Closed'],
      default: 'New',
      index: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
      index: true,
    },
    adminReply: {
      type: String,
      trim: true,
      maxlength: [5000, 'Reply cannot exceed 5000 characters'],
      default: null,
    },
    repliedAt: {
      type: Date,
      default: null,
    },
    repliedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Delivery state of the admin reply EMAIL (kept separate from `status`,
    // which tracks the support conversation). Null until a reply is attempted.
    emailStatus: {
      type: String,
      enum: ['Pending', 'Sending', 'Sent', 'Failed'],
      default: null,
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
    emailError: {
      type: String,
      trim: true,
      maxlength: [1000, 'Email error cannot exceed 1000 characters'],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ status: 1, priority: -1, createdAt: -1 });

const ContactMessage = model('ContactMessage', contactMessageSchema);
export default ContactMessage;
