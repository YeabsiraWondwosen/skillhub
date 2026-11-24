import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const followSchema = new Schema(
  {
    follower: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    following: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    notifyOnPortfolio: { type: Boolean, default: true },
    notifyOnAvailable: { type: Boolean, default: true },
    notifyOnAwards: { type: Boolean, default: true },
    notifyOnServices: { type: Boolean, default: true },
  },
  { timestamps: true }
);

followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1, createdAt: -1 });

const Follow = model('Follow', followSchema);
export default Follow;
