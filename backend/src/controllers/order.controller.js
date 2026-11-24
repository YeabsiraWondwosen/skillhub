import { catchAsync } from '../utils/catchAsync.js';
import { sendResponse } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { uploadMultipleFiles } from '../services/cloudinary.service.js';
import * as orderService from '../services/order.service.js';

// ─── Place Order ──────────────────────────────────────────────────────────────
export const placeOrder = catchAsync(async (req, res) => {
  const files = req.files?.length
    ? await uploadMultipleFiles(req.files, 'orders')
    : [];

  const order = await orderService.placeServiceOrder({
    clientId: req.user._id,
    serviceId: req.body.serviceId,
    tier: req.body.tier,
    title: req.body.title,
    description: req.body.description || '',
    requirements: req.body.requirements || '',
    expectedDelivery: req.body.expectedDelivery || null,
    additionalNotes: req.body.additionalNotes || '',
    files,
  });

  sendResponse(res, 201, 'Order placed. Fund the escrow to send it to the freelancer.', order);
});

// ─── Fund Order ───────────────────────────────────────────────────────────────
export const fundOrder = catchAsync(async (req, res) => {
  const order = await orderService.fundServiceOrder({
    orderId: req.params.orderId,
    clientId: req.user._id,
  });
  sendResponse(res, 200, 'Order funded. The freelancer can now accept or decline it.', order);
});

// ─── Accept Order (freelancer) ────────────────────────────────────────────────
export const acceptOrder = catchAsync(async (req, res) => {
  const order = await orderService.acceptServiceOrder({
    orderId: req.params.orderId,
    freelancerId: req.user._id,
  });
  sendResponse(res, 200, 'Order accepted. Project, conversation and milestone created.', order);
});

// ─── Decline Order (freelancer) ───────────────────────────────────────────────
export const declineOrder = catchAsync(async (req, res) => {
  const order = await orderService.declineServiceOrder({
    orderId: req.params.orderId,
    freelancerId: req.user._id,
    reason: req.body.reason || '',
  });
  sendResponse(res, 200, 'Order declined. Payment refunded to the client.', order);
});

// ─── Cancel Order (client, before funding) ────────────────────────────────────
export const cancelOrder = catchAsync(async (req, res) => {
  const order = await orderService.cancelServiceOrder({
    orderId: req.params.orderId,
    clientId: req.user._id,
  });
  sendResponse(res, 200, 'Order cancelled.', order);
});

// ─── Deliver Order (freelancer) ───────────────────────────────────────────────
export const deliverOrder = catchAsync(async (req, res) => {
  const files = req.files?.length
    ? await uploadMultipleFiles(req.files, 'deliveries')
    : [];

  const order = await orderService.deliverServiceOrder({
    orderId: req.params.orderId,
    freelancerId: req.user._id,
    message: req.body.message || '',
    files,
  });
  sendResponse(res, 200, 'Delivery submitted. Awaiting client review.', order);
});

// ─── Request Revision (client) ────────────────────────────────────────────────
export const requestRevision = catchAsync(async (req, res) => {
  const order = await orderService.requestRevisionServiceOrder({
    orderId: req.params.orderId,
    clientId: req.user._id,
    reason: req.body.reason,
  });
  sendResponse(res, 200, 'Revision requested. The freelancer has been notified.', order);
});

// ─── Complete Order (client, accepts delivery + releases payment) ─────────────
export const completeOrder = catchAsync(async (req, res) => {
  const order = await orderService.completeServiceOrder({
    orderId: req.params.orderId,
    clientId: req.user._id,
  });
  sendResponse(res, 200, 'Order completed. Payment released to the freelancer.', order);
});

// ─── Report Problem (client, opens dispute) ───────────────────────────────────
export const reportOrder = catchAsync(async (req, res) => {
  const order = await orderService.reportServiceOrderProblem({
    orderId: req.params.orderId,
    clientId: req.user._id,
    reason: req.body.reason,
    description: req.body.description,
  });
  sendResponse(res, 200, 'Problem reported. Funds are locked in escrow and our team will review it.', order);
});

// ─── List My Orders ───────────────────────────────────────────────────────────
export const listOrders = catchAsync(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const as = req.query.as === 'freelancer' ? 'freelancer' : 'client';

  const result = await orderService.listServiceOrders({
    userId: req.user._id,
    as,
    status: req.query.status || undefined,
    page,
    limit,
  });

  sendResponse(res, 200, 'Orders fetched', result.orders, result.meta);
});

// ─── Get Single Order ─────────────────────────────────────────────────────────
export const getOrder = catchAsync(async (req, res) => {
  const order = await orderService.getServiceOrder({
    orderId: req.params.orderId,
    userId: req.user._id,
    isAdmin: req.user.role === 'admin',
  });
  sendResponse(res, 200, 'Order fetched', order);
});

// ─── Order Stats (dashboards) ─────────────────────────────────────────────────
export const getOrderStats = catchAsync(async (req, res) => {
  const as = req.query.as === 'freelancer' ? 'freelancer' : 'client';
  const stats = await orderService.getServiceOrdersStats({ userId: req.user._id, as });
  sendResponse(res, 200, 'Order stats fetched', stats);
});
