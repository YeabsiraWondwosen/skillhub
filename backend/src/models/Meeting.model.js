import mongoose from 'mongoose';
import { futureDateTimeValidator } from '../utils/dateValidation.js';

const { Schema, model } = mongoose;

const meetingSchema = new Schema(
  {
    // Participants — canonical refs. `client` is always the client account,
    // `freelancer` is always the freelancer account.
    client: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    freelancer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 2000, default: '' },
    notes: { type: String, maxlength: 2000, default: '' },

    // Meeting window (UTC instants). `duration` is derived but stored for cheap querying.
    startTime: { type: Date, required: true, validate: futureDateTimeValidator('startTime') },
    endTime: { type: Date, required: true, validate: futureDateTimeValidator('endTime') },
    duration: { type: Number, min: 15, max: 480 }, // minutes

    // Timezone the meeting is anchored to (the freelancer's timezone).
    timezone: { type: String, default: 'UTC' },

    meetingType: {
      type: String,
      enum: ['video_call', 'phone', 'in_person', 'other'],
      default: 'video_call',
    },
    location: { type: String, default: '' },
    meetingUrl: { type: String, default: '' },

    // Relationships to existing domain entities (ObjectIds only).
    relatedJob: { type: Schema.Types.ObjectId, ref: 'Job', default: null },
    relatedProposal: { type: Schema.Types.ObjectId, ref: 'Application', default: null },
    relatedProject: { type: Schema.Types.ObjectId, ref: 'Project', default: null },

    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'completed', 'cancelled'],
      default: 'pending',
    },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    declinedReason: { type: String, default: '' },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: '' },

    // Reminder tracking — set only by the reminder job, guarded to avoid duplicates.
    reminders: {
      '24h': { type: Boolean, default: false },
      '1h': { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

meetingSchema.index({ freelancer: 1, startTime: -1 });
meetingSchema.index({ client: 1, startTime: -1 });
meetingSchema.index({ status: 1, startTime: 1 });

const Meeting = model('Meeting', meetingSchema);
export default Meeting;