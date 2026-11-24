import mongoose from 'mongoose';
import {
  Catalog,
  Category,
  User,
  ServiceOrder,
  Report,
  Escrow,
} from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination, buildSortObject } from '../utils/helpers.js';
import { deleteMultipleFiles } from '../services/cloudinary.service.js';
import { createNotification } from '../services/notification.service.js';
import { logAudit } from '../services/audit.service.js';
import { getServiceOrder } from '../services/order.service.js';

const ACTIVE_CATALOG_REPORT_STATUSES = ['pending', 'under_review'];
const OBJECT_ID = mongoose.Types.ObjectId;

const asObjectId = (value) => {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  return OBJECT_ID.isValid(value) ? new OBJECT_ID(value) : null;
};

const buildCatalogMatch = ({ status, category, subcategory, freelancer, isFeatured }) => {
  const match = {};

  if (status && status !== 'all') {
    match.status = status;
  }
  if (isFeatured === 'true') match.isFeatured = true;
  if (isFeatured === 'false') match.isFeatured = false;
  const categoryId = asObjectId(category);
  if (categoryId) match.category = categoryId;
  const subcategoryId = asObjectId(subcategory);
  if (subcategoryId) match.subcategory = subcategoryId;
  const freelancerId = asObjectId(freelancer);
  if (freelancerId) match.freelancer = freelancerId;

  return match;
};

// ─── Catalog Management ──────────────────────────────────────────────────────
// Admin listing of every service (any status). Aggregation mirrors the public
// browse endpoint so live `startingPrice` sorting/filtering works, plus an
// `isReported` flag from real open reports (resourceType: 'catalog').
export const getAdminCatalogs = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status = 'all', search, sortBy } = req.query;

  const reportedIds = await Report.distinct('resourceId', {
    resourceType: 'catalog',
    status: { $in: ACTIVE_CATALOG_REPORT_STATUSES },
  });

  const match = buildCatalogMatch(req.query);
  if (status === 'reported') {
    match._id = { $in: reportedIds };
  }

  if (search) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escaped, 'i');
    match.$or = [
      { title: searchRegex },
      { shortDescription: searchRegex },
      { description: searchRegex },
      { skills: searchRegex },
      { tags: searchRegex },
    ];
  }

  const sortMap = {
    'price-asc': { startingPrice: 1, createdAt: -1 },
    'price-desc': { startingPrice: -1, createdAt: -1 },
    popular: { 'stats.orders': -1, createdAt: -1 },
    'highest-rated': { 'stats.avgRating': -1, 'stats.totalReviews': -1, createdAt: -1 },
    oldest: { createdAt: 1 },
    newest: { createdAt: -1 },
  };
  const sort = sortMap[sortBy] || { createdAt: -1 };

  const [result] = await Catalog.aggregate([
    {
      $addFields: {
        startingPrice: { $min: '$pricingTiers.price' },
        isReported: { $in: ['$_id', reportedIds] },
      },
    },
    { $match: match },
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $sort: sort },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'freelancer',
              foreignField: '_id',
              as: 'freelancer',
            },
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'category',
              foreignField: '_id',
              as: 'category',
            },
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'subcategory',
              foreignField: '_id',
              as: 'subcategory',
            },
          },
          {
            $addFields: {
              freelancer: { $arrayElemAt: ['$freelancer', 0] },
              category: { $arrayElemAt: ['$category', 0] },
              subcategory: { $arrayElemAt: ['$subcategory', 0] },
            },
          },
          {
            $project: {
              'freelancer.password': 0,
              'freelancer.refreshTokens': 0,
              'freelancer.email': 0,
              'freelancer.createdAt': 0,
              'freelancer.updatedAt': 0,
              'freelancer.__v': 0,
            },
          },
        ],
      },
    },
  ]);

  const total = result?.metadata?.[0]?.total || 0;
  sendResponse(res, 200, 'Admin catalogs fetched', result?.data || [], paginationMeta(total, page, limit));
});

export const getAdminCatalog = catchAsync(async (req, res) => {
  const catalog = await Catalog.findById(req.params.catalogId)
    .populate('freelancer', 'firstName lastName email avatar stats isActive isBanned isVerifiedFreelancer')
    .populate('category', 'name slug icon color')
    .populate('subcategory', 'name slug');
  if (!catalog) throw new ApiError(404, 'Catalog not found');

  const openReports = await Report.find({
    resourceType: 'catalog',
    resourceId: catalog._id,
    status: { $in: ACTIVE_CATALOG_REPORT_STATUSES },
  })
    .populate('reporter', 'firstName lastName email')
    .select('reason description status priority createdAt');

  sendResponse(res, 200, 'Catalog fetched', { ...catalog.toObject(), openReports });
});

// Admin edit — a safe subset of fields so freelancer-owned flows are untouched.
export const updateAdminCatalog = catchAsync(async (req, res) => {
  const catalog = await Catalog.findById(req.params.catalogId);
  if (!catalog) throw new ApiError(404, 'Catalog not found');

  const { title, shortDescription, description, status, isFeatured, isActive } = req.body;
  if (title !== undefined) catalog.title = title;
  if (shortDescription !== undefined) catalog.shortDescription = shortDescription;
  if (description !== undefined) catalog.description = description;
  if (status !== undefined) {
    if (!['draft', 'active', 'paused', 'archived'].includes(status)) {
      throw new ApiError(400, 'Invalid catalog status');
    }
    catalog.status = status;
  }
  if (isFeatured !== undefined) catalog.isFeatured = String(isFeatured) === 'true';
  if (isActive !== undefined) catalog.isActive = String(isActive) === 'true';

  await catalog.save();

  await logAudit({
    userId: req.user._id,
    action: 'admin_catalog_update',
    category: 'admin',
    resourceType: 'Catalog',
    resourceId: catalog._id,
    details: { title, shortDescription, description, status, isFeatured, isActive },
  });

  sendResponse(res, 200, 'Catalog updated', catalog);
});

export const updateAdminCatalogStatus = catchAsync(async (req, res) => {
  const catalog = await Catalog.findById(req.params.catalogId);
  if (!catalog) throw new ApiError(404, 'Catalog not found');

  const { status } = req.body;
  if (!['draft', 'active', 'paused', 'archived'].includes(status)) {
    throw new ApiError(400, 'Invalid catalog status');
  }
  catalog.status = status;
  if (status === 'archived') catalog.isActive = false;
  if (status === 'active') catalog.isActive = true;
  await catalog.save();

  await createNotification({
    recipient: catalog.freelancer,
    type: 'catalog_moderated',
    title: `Service "${catalog.title}" ${status}`,
    message: `An admin updated the status of your service to ${status}.`,
    actionUrl: '/freelancer/catalogs',
    resourceType: 'catalog',
    resourceId: catalog._id,
  });

  await logAudit({
    userId: req.user._id,
    action: 'admin_catalog_status_update',
    category: 'admin',
    resourceType: 'Catalog',
    resourceId: catalog._id,
    details: { status },
  });

  sendResponse(res, 200, 'Catalog status updated', catalog);
});

export const toggleAdminCatalogFeatured = catchAsync(async (req, res) => {
  const catalog = await Catalog.findById(req.params.catalogId);
  if (!catalog) throw new ApiError(404, 'Catalog not found');

  catalog.isFeatured = !catalog.isFeatured;
  await catalog.save();

  if (catalog.isFeatured) {
    await createNotification({
      recipient: catalog.freelancer,
      type: 'catalog_featured',
      title: 'Service Featured',
      message: `Congratulations! "${catalog.title}" has been featured on the marketplace.`,
      actionUrl: '/freelancer/catalogs',
      resourceType: 'catalog',
      resourceId: catalog._id,
    });
  }

  await logAudit({
    userId: req.user._id,
    action: catalog.isFeatured ? 'admin_catalog_featured' : 'admin_catalog_unfeatured',
    category: 'admin',
    resourceType: 'Catalog',
    resourceId: catalog._id,
  });

  sendResponse(res, 200, catalog.isFeatured ? 'Service featured' : 'Service unfeatured', catalog);
});

export const deleteAdminCatalog = catchAsync(async (req, res) => {
  const catalog = await Catalog.findById(req.params.catalogId);
  if (!catalog) throw new ApiError(404, 'Catalog not found');
  if (catalog.stats?.orders > 0) {
    throw new ApiError(400, 'Cannot delete a service with existing orders. Archive it instead.');
  }

  if (catalog.images?.length) {
    await deleteMultipleFiles(catalog.images.map((i) => i.publicId)).catch(() => null);
  }

  const deleted = await catalog.deleteOne();

  await logAudit({
    userId: req.user._id,
    action: 'admin_catalog_delete',
    category: 'admin',
    resourceType: 'Catalog',
    resourceId: catalog._id,
  });

  sendResponse(res, 200, 'Catalog deleted', { deleted: deleted?.deletedCount ?? 1 });
});

// ─── Featured Services ───────────────────────────────────────────────────────
export const getAdminFeaturedCatalogs = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const filter = { isFeatured: true };
  const total = await Catalog.countDocuments(filter);
  const catalogs = await Catalog.find(filter)
    .populate('freelancer', 'firstName lastName avatar stats isVerifiedFreelancer')
    .populate('category', 'name slug icon color')
    .populate('subcategory', 'name slug')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Featured services fetched', catalogs, paginationMeta(total, page, limit));
});

// ─── Service Orders ──────────────────────────────────────────────────────────
export const getAdminServiceOrders = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, search, sortBy } = req.query;

  const filter = {};
  if (status && status !== 'all') {
    const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
    filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }

  if (search) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const or = [{ orderNumber: regex }, { title: regex }];

    const userIds = (
      await User.find({ $or: [{ firstName: regex }, { lastName: regex }, { email: regex }] })
        .select('_id')
        .lean()
    ).map((u) => u._id);
    if (userIds.length) {
      or.push({ client: { $in: userIds } }, { freelancer: { $in: userIds } });
    }

    const catalogIds = (
      await Catalog.find({ title: regex }).select('_id').lean()
    ).map((c) => c._id);
    if (catalogIds.length) or.push({ service: { $in: catalogIds } });

    filter.$or = or;
  }

  const total = await ServiceOrder.countDocuments(filter);
  const orders = await ServiceOrder.find(filter)
    .populate('service', 'title slug images category')
    .populate('client', 'firstName lastName email avatar')
    .populate('freelancer', 'firstName lastName email avatar')
    .populate('escrow', 'status amount')
    .sort(buildSortObject(sortBy))
    .skip(skip)
    .limit(limit);

  const counts = await ServiceOrder.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  sendResponse(res, 200, 'Service orders fetched', orders, {
    ...paginationMeta(total, page, limit),
    counts: counts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {}),
  });
});

export const getAdminServiceOrder = catchAsync(async (req, res) => {
  const order = await getServiceOrder({
    orderId: req.params.orderId,
    userId: req.user._id,
    isAdmin: true,
  });
  sendResponse(res, 200, 'Service order fetched', order);
});

// Cancel a service order that was never funded.
export const adminCancelServiceOrder = catchAsync(async (req, res) => {
  const order = await ServiceOrder.findById(req.params.orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'pending_payment') {
    throw new ApiError(400, `Order is ${order.status}; only unfunded orders can be cancelled`);
  }

  await Escrow.findByIdAndUpdate(order.escrow, { status: 'cancelled' });
  order.status = 'cancelled';
  order.timeline.cancelledAt = new Date();
  await order.save();

  const [client, freelancer] = await Promise.all([
    User.findById(order.client).select('firstName lastName'),
    User.findById(order.freelancer).select('firstName lastName'),
  ]);
  await Promise.all([
    createNotification({
      recipient: order.client,
      type: 'order_cancelled_admin',
      title: `Order ${order.orderNumber} cancelled`,
      message: `Your order for "${order.title}" was cancelled by an admin.`,
      actionUrl: '/client/service-orders',
      resourceType: 'service_order',
      resourceId: order._id,
    }),
    createNotification({
      recipient: order.freelancer,
      type: 'order_cancelled_admin',
      title: `Order ${order.orderNumber} cancelled`,
      message: `The order "${order.title}" from ${client?.firstName || 'a client'} was cancelled by an admin.`,
      actionUrl: '/freelancer/service-orders',
      resourceType: 'service_order',
      resourceId: order._id,
    }),
  ]);

  await logAudit({
    userId: req.user._id,
    action: 'admin_order_cancel',
    category: 'admin',
    resourceType: 'ServiceOrder',
    resourceId: order._id,
    amount: order.budget?.amount,
    details: { orderNumber: order.orderNumber },
  });

  sendResponse(res, 200, 'Order cancelled', order);
});

// Refund escrow funds back to the client via the existing payment flow.
export const adminRefundServiceOrder = catchAsync(async (req, res) => {
  const order = await ServiceOrder.findById(req.params.orderId).populate('escrow');
  if (!order) throw new ApiError(404, 'Order not found');

  const escrow = order.escrow;
  if (!escrow) throw new ApiError(400, 'Order has no escrow to refund');
  if (!['funded', 'submitted', 'disputed'].includes(escrow.status)) {
    throw new ApiError(
      400,
      `Cannot refund an order in its current state (escrow ${escrow.status}).`
    );
  }

  const { note } = req.body;
  await (await import('../services/payment.service.js')).refundEscrowFunds(
    escrow._id.toString(),
    req.user._id,
    { reason: note || `Admin refund for ${order.orderNumber}` }
  );

  order.status = 'refunded';
  order.timeline.refundedAt = new Date();
  order.metadata = { ...(order.metadata || {}), adminRefundNote: note, adminRefundedBy: req.user._id };
  await order.save();

  await createNotification({
    recipient: order.client,
    type: 'order_refunded_admin',
    title: `Order ${order.orderNumber} refunded`,
    message: `Your payment for "${order.title}" was refunded by an admin.`,
    actionUrl: '/client/service-orders',
    resourceType: 'service_order',
    resourceId: order._id,
  });

  await logAudit({
    userId: req.user._id,
    action: 'admin_order_refund',
    category: 'refund',
    resourceType: 'ServiceOrder',
    resourceId: order._id,
    amount: escrow.amount,
    currency: escrow.currency,
    details: { orderNumber: order.orderNumber, note },
  });

  sendResponse(res, 200, 'Order refunded', order);
});

// Force-complete an order and release escrow to the freelancer.
export const adminCompleteServiceOrder = catchAsync(async (req, res) => {
  const order = await ServiceOrder.findById(req.params.orderId).populate('escrow');
  if (!order) throw new ApiError(404, 'Order not found');

  const escrow = order.escrow;
  if (!escrow) throw new ApiError(400, 'Order has no escrow');
  if (!['funded', 'submitted'].includes(escrow.status)) {
    throw new ApiError(
      400,
      `Cannot complete an order in its current state (escrow ${escrow.status}).`
    );
  }

  await (await import('../services/payment.service.js')).releaseEscrowFunds(
    escrow._id.toString(),
    escrow.client,
    {}
  );

  order.status = 'completed';
  order.timeline.completedAt = new Date();
  order.metadata = { ...(order.metadata || {}), adminCompletedBy: req.user._id };
  await order.save();

  await createNotification({
    recipient: order.client,
    type: 'order_completed_admin',
    title: `Order ${order.orderNumber} completed`,
    message: `Your order "${order.title}" was marked complete and paid out by an admin.`,
    actionUrl: '/client/service-orders',
    resourceType: 'service_order',
    resourceId: order._id,
  });

  await logAudit({
    userId: req.user._id,
    action: 'admin_order_complete',
    category: 'escrow',
    resourceType: 'ServiceOrder',
    resourceId: order._id,
    amount: escrow.amount,
    currency: escrow.currency,
    details: { orderNumber: order.orderNumber },
  });

  sendResponse(res, 200, 'Order completed', order);
});

// Resolve an order dispute — release to the freelancer or refund the client.
export const adminResolveServiceOrderDispute = catchAsync(async (req, res) => {
  const order = await ServiceOrder.findById(req.params.orderId).populate('escrow');
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'disputed') {
    throw new ApiError(400, `Order is ${order.status}; only disputed orders can be resolved`);
  }

  const escrow = order.escrow;
  if (!escrow || escrow.status !== 'disputed') {
    throw new ApiError(400, 'Order is not currently under dispute');
  }

  const { releaseTo = 'freelancer', note } = req.body;
  const paymentService = await import('../services/payment.service.js');
  let result;
  if (releaseTo === 'client') {
    result = await paymentService.refundEscrowFunds(escrow._id.toString(), req.user._id, {
      reason: note || 'Admin dispute resolution',
    });
    order.status = 'refunded';
    order.timeline.refundedAt = new Date();
  } else {
    result = await paymentService.releaseEscrowFunds(escrow._id.toString(), escrow.client, {});
    order.status = 'completed';
    order.timeline.completedAt = new Date();
  }

  escrow.metadata = {
    ...(escrow.metadata || {}),
    disputeResolution: note,
    resolvedBy: req.user._id,
  };
  escrow.disputeResolvedAt = new Date();
  await escrow.save();
  await order.save();

  await createNotification({
    recipient: order.client,
    type: 'dispute_resolved_admin',
    title: `Dispute resolved for ${order.orderNumber}`,
    message:
      releaseTo === 'client'
        ? `The dispute on "${order.title}" was resolved in your favor — funds refunded.`
        : `The dispute on "${order.title}" was resolved — funds released to the freelancer.`,
    actionUrl: '/client/service-orders',
    resourceType: 'service_order',
    resourceId: order._id,
  });

  await logAudit({
    userId: req.user._id,
    action: 'admin_order_dispute_resolved',
    category: 'refund',
    resourceType: 'ServiceOrder',
    resourceId: order._id,
    amount: escrow.amount,
    currency: escrow.currency,
    details: { orderNumber: order.orderNumber, releaseTo, note },
  });

  sendResponse(res, 200, 'Dispute resolved', order);
});

// ─── Reported Services ───────────────────────────────────────────────────────
export const getAdminReportedServices = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status = 'pending' } = req.query;

  const filter = { resourceType: 'catalog' };
  if (status && status !== 'all') filter.status = status;

  const total = await Report.countDocuments(filter);
  const reports = await Report.find(filter)
    .populate('reporter', 'firstName lastName email avatar')
    .sort({ priority: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const catalogIds = reports.map((r) => r.resourceId);
  const catalogs = await Catalog.find({ _id: { $in: catalogIds } })
    .select('title slug images status isActive isFeatured stats category freelancer createdAt')
    .populate('freelancer', 'firstName lastName email avatar isActive isBanned')
    .populate('category', 'name slug icon color');

  const catalogMap = new Map(catalogs.map((c) => [c._id.toString(), c]));
  const items = reports.map((r) => ({
    report: r,
    catalog: catalogMap.get(r.resourceId.toString()) || null,
  }));

  sendResponse(res, 200, 'Reported services fetched', items, paginationMeta(total, page, limit));
});

const resolveCatalogReport = async ({ report, status, action, note, adminId }) => {
  report.status = status;
  report.resolution = {
    action,
    note: note || '',
    resolvedBy: adminId,
    resolvedAt: new Date(),
  };
  await report.save();
  return report;
};

export const adminDismissReportedService = catchAsync(async (req, res) => {
  const report = await Report.findOne({ _id: req.params.reportId, resourceType: 'catalog' });
  if (!report) throw new ApiError(404, 'Report not found');

  await resolveCatalogReport({
    report,
    status: 'dismissed',
    action: 'no_action',
    note: req.body.note,
    adminId: req.user._id,
  });

  await logAudit({
    userId: req.user._id,
    action: 'admin_report_dismissed',
    category: 'admin',
    resourceType: 'Report',
    resourceId: report._id,
    details: { resourceType: 'catalog', resourceId: report.resourceId },
  });

  sendResponse(res, 200, 'Report dismissed', report);
});

export const adminWarnReportedFreelancer = catchAsync(async (req, res) => {
  const report = await Report.findOne({ _id: req.params.reportId, resourceType: 'catalog' });
  if (!report) throw new ApiError(404, 'Report not found');
  if (!report.reportedUser) throw new ApiError(400, 'Report has no associated freelancer');

  await createNotification({
    recipient: report.reportedUser,
    type: 'content_warning',
    title: 'Warning about your service',
    message:
      req.body.note ||
      'One of your services was reported. Please review it to ensure it follows our guidelines.',
    actionUrl: '/freelancer/catalogs',
    resourceType: 'catalog',
    resourceId: report.resourceId,
  });

  await resolveCatalogReport({
    report,
    status: 'resolved',
    action: 'warning',
    note: req.body.note,
    adminId: req.user._id,
  });

  await logAudit({
    userId: req.user._id,
    action: 'admin_report_warned',
    category: 'admin',
    resourceType: 'Report',
    resourceId: report._id,
    details: { resourceType: 'catalog', resourceId: report.resourceId },
  });

  sendResponse(res, 200, 'Freelancer warned', report);
});

export const adminRemoveReportedService = catchAsync(async (req, res) => {
  const report = await Report.findOne({ _id: req.params.reportId, resourceType: 'catalog' });
  if (!report) throw new ApiError(404, 'Report not found');

  const catalog = await Catalog.findById(report.resourceId);
  if (catalog) {
    catalog.status = 'archived';
    catalog.isActive = false;
    await catalog.save();

    await createNotification({
      recipient: catalog.freelancer,
      type: 'catalog_removed',
      title: 'Service removed',
      message: `Your service "${catalog.title}" was removed after a report. ${req.body.note || ''}`.trim(),
      actionUrl: '/freelancer/catalogs',
      resourceType: 'catalog',
      resourceId: catalog._id,
    });
  }

  await resolveCatalogReport({
    report,
    status: 'resolved',
    action: 'content_removed',
    note: req.body.note,
    adminId: req.user._id,
  });

  await logAudit({
    userId: req.user._id,
    action: 'admin_report_content_removed',
    category: 'admin',
    resourceType: 'Report',
    resourceId: report._id,
    details: { resourceType: 'catalog', resourceId: report.resourceId },
  });

  sendResponse(res, 200, 'Service removed', report);
});

export const adminSuspendReportedFreelancer = catchAsync(async (req, res) => {
  const report = await Report.findOne({ _id: req.params.reportId, resourceType: 'catalog' });
  if (!report) throw new ApiError(404, 'Report not found');
  if (!report.reportedUser) throw new ApiError(400, 'Report has no associated freelancer');

  const freelancer = await User.findById(report.reportedUser);
  if (freelancer && freelancer.role !== 'admin') {
    freelancer.isActive = false;
    freelancer.isBanned = true;
    freelancer.banReason = req.body.note || 'Violation of platform policies';
    freelancer.refreshTokens = [];
    await freelancer.save({ validateBeforeSave: false });

    await createNotification({
      recipient: freelancer._id,
      type: 'account_banned',
      title: 'Account Suspended',
      message: `Your account was suspended. Reason: ${req.body.note || 'Violation of platform policies'}`,
      actionUrl: '/support',
    });
  }

  await resolveCatalogReport({
    report,
    status: 'resolved',
    action: 'account_suspended',
    note: req.body.note,
    adminId: req.user._id,
  });

  await logAudit({
    userId: req.user._id,
    action: 'admin_report_account_suspended',
    category: 'admin',
    resourceType: 'Report',
    resourceId: report._id,
    details: { resourceType: 'catalog', resourceId: report.resourceId, user: report.reportedUser },
  });

  sendResponse(res, 200, 'Freelancer suspended', report);
});

// ─── Service Analytics (computed live, real data only) ──────────────────────
export const getAdminServiceAnalytics = catchAsync(async (req, res) => {
  const [
    catalogCounts,
    orderCounts,
    revenueResult,
    ratingResult,
    featuredCount,
    reportedCount,
    categoryOrders,
    topSelling,
    topFreelancers,
    recentOrders,
    monthlyOrders,
  ] = await Promise.all([
    Catalog.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          paused: { $sum: { $cond: [{ $eq: ['$status', 'paused'] }, 1, 0] } },
          draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          archived: { $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] } },
          totalViews: { $sum: '$stats.views' },
        },
      },
    ]),
    ServiceOrder.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [
                { $in: ['$status', ['pending_payment', 'funded', 'accepted', 'delivered', 'revision_requested']] },
                1,
                0,
              ],
            },
          },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          refunded: { $sum: { $in: ['$status', ['refunded', 'declined']] } },
          disputed: { $sum: { $cond: [{ $eq: ['$status', 'disputed'] }, 1, 0] } },
        },
      },
    ]),
    ServiceOrder.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$budget.amount' } } },
    ]),
    Catalog.aggregate([
      { $match: { 'stats.totalReviews': { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$stats.avgRating' }, count: { $sum: '$stats.totalReviews' } } },
    ]),
    Catalog.countDocuments({ isFeatured: true }),
    Report.countDocuments({ resourceType: 'catalog', status: { $in: ACTIVE_CATALOG_REPORT_STATUSES } }),
    ServiceOrder.aggregate([
      { $lookup: { from: 'catalogs', localField: 'service', foreignField: '_id', as: 'service' } },
      { $unwind: '$service' },
      {
        $group: {
          _id: '$service.category',
          orders: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$budget.amount', 0] } },
        },
      },
      { $sort: { orders: -1 } },
      { $limit: 8 },
    ]),
    Catalog.aggregate([
      { $sort: { 'stats.orders': -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: 'freelancer',
          foreignField: '_id',
          as: 'freelancer',
        },
      },
      { $addFields: { freelancer: { $arrayElemAt: ['$freelancer', 0] } } },
      {
        $project: {
          title: 1,
          slug: 1,
          images: 1,
          status: 1,
          isFeatured: 1,
          'stats.views': 1,
          'stats.orders': 1,
          'stats.avgRating': 1,
          startingPrice: 1,
          createdAt: 1,
          'freelancer.firstName': 1,
          'freelancer.lastName': 1,
          'freelancer.avatar': 1,
        },
      },
    ]),
    ServiceOrder.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'freelancer',
          foreignField: '_id',
          as: 'freelancer',
        },
      },
      { $unwind: '$freelancer' },
      {
        $group: {
          _id: '$freelancer._id',
          firstName: { $first: '$freelancer.firstName' },
          lastName: { $first: '$freelancer.lastName' },
          avatar: { $first: '$freelancer.avatar' },
          orders: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$budget.amount', 0] } },
          rating: { $first: '$freelancer.stats.averageRating' },
        },
      },
      { $sort: { orders: -1 } },
      { $limit: 5 },
    ]),
    ServiceOrder.find()
      .populate('service', 'title slug images')
      .populate('client', 'firstName lastName avatar')
      .populate('freelancer', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .limit(5),
    ServiceOrder.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$budget.amount', 0] } },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
  ]);

  const categoryIds = categoryOrders.map((c) => c._id).filter(Boolean);
  const categories = await Category.find({ _id: { $in: categoryIds } })
    .select('name slug icon color')
    .lean();
  const categoryMap = new Map(categories.map((c) => [c._id.toString(), c]));

  const orderStats = orderCounts[0] || {};
  const catalogStats = catalogCounts[0] || {};

  sendResponse(res, 200, 'Service analytics fetched', {
    catalogStats: {
      total: catalogStats.total || 0,
      active: catalogStats.active || 0,
      paused: catalogStats.paused || 0,
      draft: catalogStats.draft || 0,
      archived: catalogStats.archived || 0,
      totalViews: catalogStats.totalViews || 0,
    },
    orderStats: {
      total: orderStats.total || 0,
      active: orderStats.active || 0,
      completed: orderStats.completed || 0,
      refunded: orderStats.refunded || 0,
      disputed: orderStats.disputed || 0,
    },
    revenue: revenueResult[0]?.total || 0,
    rating: ratingResult[0] ? Math.round(ratingResult[0].avg * 10) / 10 : 0,
    reviews: ratingResult[0]?.count || 0,
    featuredCount,
    reportedCount,
    topCategories: categoryOrders.map((c) => ({
      _id: c._id,
      category: categoryMap.get(c._id?.toString()) || null,
      orders: c.orders,
      revenue: c.revenue,
    })),
    topSelling,
    topFreelancers,
    recentOrders,
    monthlyOrders,
  });
});
