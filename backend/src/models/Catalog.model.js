import mongoose from 'mongoose';
import { MIN_PACKAGE_PRICE, minPackagePriceMessage, getFirstPackagePriceError } from '../config/pricing.js';

const { Schema, model } = mongoose;

const pricingTierSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      enum: ['basic', 'standard', 'premium'],
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, maxlength: 500 },
    price: { type: Number, required: true, min: [MIN_PACKAGE_PRICE, minPackagePriceMessage()] },
    currency: { type: String, default: 'ETB', uppercase: true },
    deliveryTime: { type: Number, required: true, min: 1 },
    deliveryUnit: {
      type: String,
      enum: ['days', 'weeks'],
      default: 'days',
    },
    revisions: { type: Number, default: 1, min: 0 },
    features: [{ type: String, trim: true }],
  },
  { _id: true }
);

const catalogSchema = new Schema(
  {
    freelancer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    shortDescription: {
      type: String,
      required: [true, 'Short description is required'],
      maxlength: [200, 'Short description cannot exceed 200 characters'],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    skills: [{ type: String, trim: true }],
    pricingTiers: {
      type: [pricingTierSchema],
      // Final safeguard: price minimum and strict ascending order
      // (Basic < Standard < Premium) are re-checked on every save.
      validate: {
        validator: (tiers) => getFirstPackagePriceError(tiers) === null,
        message: (props) => getFirstPackagePriceError(props.value) || 'Invalid package pricing',
      },
    },
    images: [
      {
        url: { type: String },
        publicId: { type: String },
        originalName: { type: String },
      },
    ],
    tags: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'archived'],
      default: 'draft',
      index: true,
    },
    stats: {
      views: { type: Number, default: 0 },
      orders: { type: Number, default: 0 },
      avgRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    deliveryTime: {
      type: Number,
      default: 7,
    },
    startingPrice: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    lastOrderAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
catalogSchema.index({ freelancer: 1, status: 1 });
catalogSchema.index({ category: 1, status: 1 });
catalogSchema.index({ category: 1, subcategory: 1, status: 1 });
catalogSchema.index({ skills: 1 });
catalogSchema.index({ 'stats.avgRating': -1 });
catalogSchema.index({ 'stats.orders': -1 });
catalogSchema.index({ createdAt: -1 });

// ─── Text search ──────────────────────────────────────────────────────────────
catalogSchema.index(
  { title: 'text', description: 'text', skills: 'text', tags: 'text' },
  { weights: { title: 3, skills: 2, description: 1, tags: 1 } }
);

// ─── Virtual ──────────────────────────────────────────────────────────────────
catalogSchema.virtual('freelancerDetails', {
  ref: 'User',
  localField: 'freelancer',
  foreignField: '_id',
  justOne: true,
});

// ─── Pre-save: generate slug ──────────────────────────────────────────────────
catalogSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('title')) {
    const base = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80);
    this.slug = `${base}-${this._id.toString().slice(-6)}`;
  }
  // Keep a denormalized starting price so the browse endpoint can sort/filter
  // by price without unwinding the pricingTiers array.
  if (this.isNew || this.isModified('pricingTiers')) {
    const prices = (this.pricingTiers || [])
      .map((t) => (typeof t.price === 'number' && t.price > 0 ? t.price : null))
      .filter((v) => v !== null);
    this.startingPrice = prices.length ? Math.min(...prices) : 0;
  }
  next();
});

const Catalog = model('Catalog', catalogSchema);
export default Catalog;
