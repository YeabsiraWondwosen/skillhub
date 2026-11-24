import mongoose from 'mongoose';
import { Review, Project, ServiceOrder } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { notifyReviewReceived } from '../services/notification.service.js';
import {
  buildReviewStats,
  recomputeCatalogStats,
  recomputeUserReviewStats,
} from '../services/review.service.js';

const { Types } = mongoose;

const parseReviewId = (id) => Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;

// ─── Create Review ────────────────────────────────────────────────────────────
export const createReview = catchAsync(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  if (project.status !== 'completed') throw new ApiError(400, 'Can only review completed projects');

  const isClient = project.client.toString() === req.user._id.toString();
  const isFreelancer = project.freelancer.toString() === req.user._id.toString();
  if (!isClient && !isFreelancer) throw new ApiError(403, 'Not authorized');

  const revieweeId = isClient ? project.freelancer : project.client;
  const reviewerRole = isClient ? 'client' : 'freelancer';

  const existingReview = await Review.findOne({ project: projectId, reviewer: req.user._id });
  if (existingReview) throw new ApiError(409, 'You have already reviewed this project');

  const review = await Review.create({
    project: projectId,
    reviewer: req.user._id,
    reviewee: revieweeId,
    reviewerRole,
    ...req.body,
  });

  await review.populate([
    { path: 'reviewer', select: 'firstName lastName avatar' },
    { path: 'reviewee', select: 'firstName lastName avatar' },
  ]);

  await notifyReviewReceived(
    revieweeId,
    `${req.user.firstName} ${req.user.lastName}`,
    req.body.rating.overall,
    req.user._id,
    revieweeId,
    projectId
  );

  // Service-order review: recompute the catalog's aggregate rating from all
  // client reviews on projects created from that service's orders.
  if (project.serviceOrder && isClient) {
    try {
      const order = await ServiceOrder.findById(project.serviceOrder);
      if (order) {
        await recomputeCatalogStats(order._id);
        order.review = review._id;
        await order.save();
        const { notifyOrderReviewReceived } = await import('../services/notification.service.js');
        await notifyOrderReviewReceived(order, `${req.user.firstName} ${req.user.lastName}`, req.body.rating.overall);
      }
    } catch (reviewSyncErr) {
      console.error('Service catalog review sync error:', reviewSyncErr.message);
    }
  }

  sendResponse(res, 201, 'Review submitted', review);
});

// ─── Get Reviews for a User ───────────────────────────────────────────────────
export const getUserReviews = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { page, limit, skip } = parsePagination(req.query);
  const { reviewerRole } = req.query;

  if (!Types.ObjectId.isValid(userId)) throw new ApiError(404, 'User not found');

  const filter = { reviewee: userId, isPublic: true };
  if (reviewerRole) filter.reviewerRole = reviewerRole;

  const total = await Review.countDocuments(filter);
  const reviews = await Review.find(filter)
    .populate('reviewer', 'firstName lastName avatar role')
    .populate('project', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Stats computed from real MongoDB data (public reviews for this reviewee).
  const stats = await buildReviewStats(userId);

  sendResponse(res, 200, 'Reviews fetched', reviews, {
    ...paginationMeta(total, page, limit),
    stats,
  });
});

// ─── Update Review (author only) ──────────────────────────────────────────────
export const updateReview = catchAsync(async (req, res) => {
  const reviewId = parseReviewId(req.params.reviewId);
  const review = reviewId
    ? await Review.findOne({ _id: reviewId, reviewer: req.user._id })
    : null;

  if (!review) throw new ApiError(404, 'Review not found');

  if (req.body.rating) review.rating = { ...review.rating.toObject(), ...req.body.rating };
  if (req.body.comment !== undefined) review.comment = req.body.comment;

  await review.save();

  await review.populate([
    { path: 'reviewer', select: 'firstName lastName avatar role' },
    { path: 'project', select: 'title' },
  ]);

  sendResponse(res, 200, 'Review updated', review);
});

// ─── Delete Review (author only) ──────────────────────────────────────────────
export const deleteReview = catchAsync(async (req, res) => {
  const reviewId = parseReviewId(req.params.reviewId);
  const review = reviewId
    ? await Review.findOne({ _id: reviewId, reviewer: req.user._id })
    : null;

  if (!review) throw new ApiError(404, 'Review not found');

  const revieweeId = review.reviewee;
  await review.deleteOne();

  // Post-delete hook already recomputes stats; recompute here explicitly too so
  // the cached User.stats can never drift if middleware changes.
  await recomputeUserReviewStats(revieweeId);

  sendResponse(res, 200, 'Review deleted', { _id: reviewId });
});

// ─── Reply to Review ──────────────────────────────────────────────────────────
export const replyToReview = catchAsync(async (req, res) => {
  const review = await Review.findOne({
    _id: req.params.reviewId,
    reviewee: req.user._id,
  });

  if (!review) throw new ApiError(404, 'Review not found');
  if (review.reply?.content) throw new ApiError(400, 'You have already replied to this review');

  review.reply = { content: req.body.content, repliedAt: new Date() };
  await review.save();

  sendResponse(res, 200, 'Reply added', review);
});

// ─── Get Reviews I Wrote ──────────────────────────────────────────────────────
export const getMyWrittenReviews = catchAsync(async (req, res) => {
  const reviews = await Review.find({ reviewer: req.user._id })
    .populate('reviewee', 'firstName lastName avatar')
    .populate('project', 'title')
    .sort({ createdAt: -1 });

  sendResponse(res, 200, 'My reviews fetched', reviews);
});