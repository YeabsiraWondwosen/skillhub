import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const platformSettingSchema = new Schema(
  {
    key: {
      type: String,
      default: 'platform',
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: 'SkillHub',
      trim: true,
      maxlength: 100,
    },
    tagline: {
      type: String,
      default: '',
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    focus: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    logo: {
      url: { type: String, default: '', trim: true, maxlength: 600 },
      publicId: { type: String, default: '', trim: true },
    },
    currency: {
      type: String,
      default: 'ETB',
      trim: true,
      uppercase: true,
      maxlength: 8,
    },
    language: {
      type: String,
      default: 'en',
      trim: true,
      lowercase: true,
      maxlength: 12,
    },
    timeZone: {
      type: String,
      default: 'Africa/Addis_Ababa',
      trim: true,
      maxlength: 64,
    },
    // Stored as a fraction (0 – 1). Left unset until an admin saves a value so
    // the environment fallback keeps working for existing installations.
    commissionRate: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

const PlatformSetting = model('PlatformSetting', platformSettingSchema);
export default PlatformSetting;
