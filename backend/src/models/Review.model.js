import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const reviewSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewerRole: {
      type: String,
      enum: ['client', 'freelancer'],
      required: true,
    },

    // Ratings (1-5, integers only — enforced at the schema level too, so no
    // out-of-range, fractional, string or NaN rating can ever reach MongoDB)
    rating: {
      overall: {
        type: Number,
        required: [true, 'Overall rating is required'],
        min: 1,
        max: 5,
        integer: true,
      },
      communication: { type: Number, min: 1, max: 5, integer: true },
      quality: { type: Number, min: 1, max: 5, integer: true },
      expertise: { type: Number, min: 1, max: 5, integer: true },
      professionalism: { type: Number, min: 1, max: 5, integer: true },
      deadlineAdherence: { type: Number, min: 1, max: 5, integer: true },
    },

    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      minlength: [20, 'Review must be at least 20 characters'],
      maxlength: [2000, 'Review cannot exceed 2000 characters'],
    },

    // Reviewee can reply to review
    reply: {
      content: { type: String, maxlength: 1000 },
      repliedAt: { type: Date },
    },

    isPublic: { type: Boolean, default: true },
    isFlagged: { type: Boolean, default: false },
    flagReason: { type: String, default: '' },

    // Prevent duplicate reviews per project per reviewer
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Compound index: one review per project per reviewer ──────────────────────
reviewSchema.index({ project: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ reviewee: 1, isPublic: 1 });
reviewSchema.index({ 'rating.overall': -1 });

// ─── Keep User.stats + reputation in sync with real review data ───────────────
// Runs after a review is saved, deleted via doc.deleteOne()/Model.deleteOne(),
// or deleted via findOneAndDelete. Every path recomputes the reviewee's average
// rating, review count and reputation from the actual Review collection so the
// denormalized User.stats can never drift from MongoDB.
async function syncRatingsAfterChange(doc) {
  const revieweeId = doc?.reviewee;
  if (!revieweeId) return;

  try {
    const { recomputeUserReviewStats } = await import('../services/review.service.js');
    await recomputeUserReviewStats(revieweeId);

    // Trigger reputation recalculation (non-blocking)
    try {
      const User = mongoose.model('User');
      const { calculateReputationScore } = await import('../services/reputation.service.js');
      const repResult = await calculateReputationScore(revieweeId, 'review', doc._id);
      if (repResult) {
        await User.findByIdAndUpdate(revieweeId, {
          'stats.reputationScore': repResult.trustScore,
          'stats.trustTier': repResult.trustTier,
        });
      }
    } catch (repErr) {
      console.error('Reputation recalculation error after review:', repErr.message);
    }
  } catch (error) {
    console.error('Error updating user rating:', error);
  }
}

reviewSchema.post('save', syncRatingsAfterChange);
reviewSchema.post('deleteOne', syncRatingsAfterChange);
reviewSchema.post('findOneAndDelete', syncRatingsAfterChange);

const Review = model('Review', reviewSchema);
export default Review;
