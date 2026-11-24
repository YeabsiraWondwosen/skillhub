import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const skillTaxonomySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Skill name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      sparse: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    aliases: {
      type: [String],
      default: [],
    },
    demandLevel: {
      type: String,
      enum: ['low', 'moderate', 'high', 'very_high'],
      default: 'moderate',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

skillTaxonomySchema.index({ name: 1, category: 1 }, { unique: true });
skillTaxonomySchema.index({ name: 'text', aliases: 'text' });
skillTaxonomySchema.index({ category: 1, isActive: 1 });

skillTaxonomySchema.pre('save', function (next) {
  if (this.isNew || this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
  }
  next();
});

const SkillTaxonomy = model('SkillTaxonomy', skillTaxonomySchema);
export default SkillTaxonomy;
