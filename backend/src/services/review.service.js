import mongoose from 'mongoose';
import { Review, User, Project, Catalog, ServiceOrder } from '../models/index.js';

const { Types } = mongoose;

// Category rating fields stored on Review.rating (each validated 1..5).
export const REVIEW_CATEGORY_FIELDS = [
  'communication',
  'quality',
  'expertise',
  'professionalism',
  'deadlineAdherence',
];

const round1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : null);

export const emptyReviewStats = () => ({
  averageRating: 0,
  totalReviews: 0,
  ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  categoryAverages: REVIEW_CATEGORY_FIELDS.reduce((acc, f) => ({ ...acc, [f]: null }), {}),
});

/**
 * Calculate real review statistics for a reviewee straight from MongoDB.
 *
 * `averageRating`   – mean of all public `rating.overall` values (rounded to 1 dp)
 * `totalReviews`    – count of public reviews
 * `ratingDistribution` – { 1..5 } histogram keyed by rounded overall rating
 * `categoryAverages`   – mean of each optional category rating (1..5), null when absent
 *
 * An optional `extraMatch` (e.g. `{ reviewerRole: 'client' }`) narrows which reviews
 * are included in BOTH the list and the statistics.
 */
export const buildReviewStats = async (revieweeId, extraMatch = {}) => {
  const id = String(revieweeId || '');
  if (!Types.ObjectId.isValid(id)) return emptyReviewStats();

  const match = { reviewee: new Types.ObjectId(id), isPublic: true };
  if (extraMatch && typeof extraMatch === 'object') Object.assign(match, extraMatch);

  const [agg] = await Review.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating.overall' },
        totalReviews: { $sum: 1 },
        overalls: { $push: '$rating.overall' },
        communication: { $avg: '$rating.communication' },
        quality: { $avg: '$rating.quality' },
        expertise: { $avg: '$rating.expertise' },
        professionalism: { $avg: '$rating.professionalism' },
        deadlineAdherence: { $avg: '$rating.deadlineAdherence' },
      },
    },
  ]);

  if (!agg) return emptyReviewStats();

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  (agg.overalls || []).forEach((r) => {
    const k = Math.round(Number(r));
    if (k >= 1 && k <= 5) distribution[k] += 1;
  });

  const categoryAverages = {};
  REVIEW_CATEGORY_FIELDS.forEach((f) => {
    categoryAverages[f] = round1(agg[f]);
  });

  return {
    averageRating: round1(agg.averageRating) || 0,
    totalReviews: agg.totalReviews || 0,
    ratingDistribution: distribution,
    categoryAverages,
  };
};

/**
 * Recompute and persist the denormalized rating stats on User.stats. Called by
 * the Review model post-save / post-delete hooks and by review mutations so the
 * profile badge, dashboards and browse pages always reflect real data.
 */
export const recomputeUserReviewStats = async (revieweeId) => {
  try {
    const stats = await buildReviewStats(revieweeId);
    await User.findByIdAndUpdate(revieweeId, {
      'stats.averageRating': stats.averageRating,
      'stats.totalReviews': stats.totalReviews,
    });
    return stats;
  } catch (error) {
    console.error('Error recomputing user review stats:', error.message);
    return null;
  }
};

/**
 * Re-aggregate a service catalog's average rating + review count from every
 * public client review posted on projects created from that service's orders.
 */
export const recomputeCatalogStats = async (serviceOrderId) => {
  const order = await ServiceOrder.findById(serviceOrderId).select('service');
  if (!order) return;

  const serviceProjectIds = (
    await Project.find({ serviceOrder: order._id }).select('_id').lean()
  ).map((p) => p._id);

  const [agg] = await Review.aggregate([
    {
      $match: {
        reviewerRole: 'client',
        isPublic: true,
        project: { $in: serviceProjectIds },
      },
    },
    { $group: { _id: null, avg: { $avg: '$rating.overall' }, count: { $sum: 1 } } },
  ]);

  await Catalog.findByIdAndUpdate(order.service, {
    'stats.avgRating': agg ? Math.round(agg.avg * 10) / 10 : 0,
    'stats.totalReviews': agg?.count || 0,
  });
};