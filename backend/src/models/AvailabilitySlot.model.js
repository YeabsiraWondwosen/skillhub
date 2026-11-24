import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Weekly recurring availability window defined by a freelancer.
// Times are stored as minutes from midnight in the freelancer's timezone
// (dayOfWeek 0 = Sunday, aligns with Date.prototype.getDay()).
const availabilitySlotSchema = new Schema(
  {
    freelancer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
      required: true,
      index: true,
    },
    startMinute: { type: Number, min: 0, max: 1439, required: true },
    endMinute: { type: Number, min: 1, max: 1440, required: true },
    timezone: { type: String, default: 'UTC' },
  },
  { timestamps: true }
);

availabilitySlotSchema.index({ freelancer: 1, dayOfWeek: 1, startMinute: 1 });

const AvailabilitySlot = model('AvailabilitySlot', availabilitySlotSchema);
export default AvailabilitySlot;