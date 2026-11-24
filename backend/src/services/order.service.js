import { ServiceOrder, Catalog, Project, Milestone, Conversation, Escrow, User, Report } from '../models/index.js';
import {
  createEscrow,
  fundEscrow,
  startEscrowWork,
  submitEscrowWork,
  releaseEscrowFunds,
  refundEscrowFunds,
} from './payment.service.js';
import {
  notifyOrderPlaced,
  notifyOrderFunded,
  notifyOrderAccepted,
  notifyOrderDeclined,
  notifyOrderCompleted,
  notifyOrderCancelled,
  notifyOrderReviewReceived,
  notifyOrderDeliverySubmitted,
  notifyOrderRevisionRequested,
  notifyOrderDisputeReported,
  notifyEscrowReleased,
  notifyCommissionDeducted,
  notifyPaymentReceived,
} from './notification.service.js';
import { emitToUser } from './socket.service.js';
import { ApiError } from '../utils/apiResponse.js';
import { applyProjectTransition } from '../utils/projectStateMachine.js';

const ACTIVE_STATUSES = ['pending_payment', 'funded', 'accepted', 'delivered', 'revision_requested'];
const CLOSED_STATUSES = ['completed', 'declined', 'cancelled', 'disputed'];

/**
 * Snapshot the requested tier so later edits to the service never affect an
 * already-placed order.
 */
const snapshotTier = (catalog, tierName) => {
  const tier = (catalog.pricingTiers || []).find((t) => t.name === tierName);
  if (!tier) throw new ApiError(400, `Tier "${tierName}" is not available on this service`);
  return {
    name: tier.name,
    title: tier.title,
    description: tier.description || '',
    price: tier.price,
    currency: tier.currency || 'ETB',
    deliveryTime: tier.deliveryTime,
    deliveryUnit: tier.deliveryUnit || 'days',
    revisions: tier.revisions ?? 1,
    features: tier.features || [],
  };
};

/**
 * Place a new service order. Creates the order record (status pending_payment)
 * plus a pending escrow (existing createEscrow), then notifies the freelancer.
 * Ordering is a single real event — no fake data anywhere.
 */
export const placeServiceOrder = async ({
  clientId,
  serviceId,
  tier,
  title,
  description = '',
  requirements = '',
  expectedDelivery = null,
  additionalNotes = '',
  files = [],
}) => {
  const catalog = await Catalog.findOne({ _id: serviceId, isActive: true });
  if (!catalog) throw new ApiError(404, 'Service not found');
  if (catalog.status !== 'active') throw new ApiError(400, 'This service is not published');
  if (!catalog.freelancer) throw new ApiError(400, 'This service has no active freelancer');
  if (catalog.freelancer.toString() === clientId.toString()) {
    throw new ApiError(400, 'You cannot order your own service');
  }

  const tierSnapshot = snapshotTier(catalog, tier);

  const order = await ServiceOrder.create({
    service: catalog._id,
    client: clientId,
    freelancer: catalog.freelancer,
    tier: tierSnapshot,
    title,
    description,
    requirements,
    expectedDelivery: expectedDelivery || null,
    additionalNotes,
    files,
    budget: {
      amount: tierSnapshot.price,
      currency: tierSnapshot.currency,
    },
    status: 'pending_payment',
    timeline: { placedAt: new Date() },
  });

  const escrow = await createEscrow({
    clientId,
    freelancerId: catalog.freelancer,
    projectId: null,
    amount: tierSnapshot.price,
    currency: tierSnapshot.currency,
    description: `Service order ${order.orderNumber}`,
    serviceOrder: order._id,
  });

  order.escrow = escrow._id;
  await order.save();

  // Denormalized service stats + last order time.
  await Catalog.findByIdAndUpdate(catalog._id, {
    $inc: { 'stats.orders': 1 },
    lastOrderAt: new Date(),
  });

  const client = await User.findById(clientId).select('firstName lastName avatar');
  await notifyOrderPlaced(order, client);

  return ServiceOrder.findById(order._id)
    .populate('service', 'title slug images pricingTiers')
    .populate('client', 'firstName lastName avatar')
    .populate('freelancer', 'firstName lastName avatar');
};

/**
 * Client funds the order. Locks payment via the existing escrow funding flow.
 */
export const fundServiceOrder = async ({ orderId, clientId }) => {
  const order = await ServiceOrder.findOne({ _id: orderId, client: clientId });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'pending_payment') {
    throw new ApiError(400, `Order is ${order.status}; only pending_payment orders can be funded`);
  }

  await fundEscrow(order.escrow.toString(), clientId);

  order.status = 'funded';
  order.timeline.fundedAt = new Date();
  await order.save();

  await notifyOrderFunded(order);

  return ServiceOrder.findById(order._id)
    .populate('service', 'title slug images pricingTiers')
    .populate('client', 'firstName lastName avatar')
    .populate('freelancer', 'firstName lastName avatar');
};

/**
 * Freelancer accepts a funded order. Auto-creates the Project, a project
 * Conversation and a single Milestone (mirrors the application acceptance
 * pattern), then marks the escrow in_progress. Sends notifications to both
 * parties and emits a real-time event.
 */
export const acceptServiceOrder = async ({ orderId, freelancerId }) => {
  const order = await ServiceOrder.findOne({ _id: orderId, freelancer: freelancerId })
    .populate('client', 'firstName lastName avatar')
    .populate('service', 'title slug');
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'funded') {
    throw new ApiError(400, `Order is ${order.status}; only funded orders can be accepted`);
  }

  // Deadline derived from the tier snapshot at order time.
  const { deliveryTime, deliveryUnit } = order.tier;
  const days = deliveryUnit === 'weeks' ? deliveryTime * 7 : deliveryTime;
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + days);

  const project = await Project.create({
    job: null,
    application: null,
    serviceOrder: order._id,
    client: order.client._id,
    freelancer: order.freelancer,
    title: order.title,
    description: order.description || `Service order ${order.orderNumber}`,
    status: 'active',
    budget: {
      agreedAmount: order.budget.amount,
      currency: order.budget.currency,
    },
    timeline: {
      startDate: new Date(),
      deadline,
      estimatedDuration: days,
    },
    conversationId: null,
  });

  const conversation = await Conversation.create({
    participants: [order.client._id, order.freelancer],
    type: 'project',
    project: project._id,
    unreadCounts: [
      { user: order.client._id, count: 0 },
      { user: order.freelancer, count: 0 },
    ],
    metadata: {
      title: order.title,
      jobTitle: order.title,
      serviceOrder: order._id,
    },
  });

  project.conversationId = conversation._id;
  await project.save();

  const milestone = await Milestone.create({
    project: project._id,
    client: order.client._id,
    freelancer: order.freelancer,
    title: order.tier.title || order.title,
    description: `Payment for service order ${order.orderNumber}: ${order.title}`,
    amount: order.budget.amount,
    currency: order.budget.currency,
    dueDate: deadline,
    status: 'in_progress',
  });

  const escrow = await Escrow.findById(order.escrow);
  if (escrow) {
    escrow.project = project._id;
    escrow.milestone = milestone._id;
    await escrow.save();
  }

  await startEscrowWork(order.escrow.toString(), freelancerId);

  order.project = project._id;
  order.conversation = conversation._id;
  order.milestone = milestone._id;
  order.status = 'accepted';
  order.timeline.acceptedAt = new Date();
  await order.save();

  await User.findByIdAndUpdate(order.client._id, { $inc: { 'stats.activeProjects': 1 } });
  await User.findByIdAndUpdate(order.freelancer, { $inc: { 'stats.activeProjects': 1 } });

  const freelancer = await User.findById(freelancerId).select('firstName lastName avatar');
  await notifyOrderAccepted(order, freelancer);

  emitToUser(order.client._id.toString(), 'project:update', {
    type: 'order_accepted',
    orderId: order._id,
    projectId: project._id,
    conversationId: conversation._id,
  });

  return ServiceOrder.findById(order._id)
    .populate('service', 'title slug images pricingTiers')
    .populate('client', 'firstName lastName avatar')
    .populate('freelancer', 'firstName lastName avatar')
    .populate('project', 'title status _id')
    .populate('conversation', '_id')
    .populate('milestone', 'title amount status _id');
};

/**
 * Freelancer declines a funded order. Escrow is refunded to the client via the
 * existing refund flow and both parties are notified.
 */
export const declineServiceOrder = async ({ orderId, freelancerId, reason = '' }) => {
  const order = await ServiceOrder.findOne({ _id: orderId, freelancer: freelancerId });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'funded') {
    throw new ApiError(400, `Order is ${order.status}; only funded orders can be declined`);
  }

  await refundEscrowFunds(order.escrow.toString(), freelancerId, { reason });

  order.status = 'declined';
  order.declineReason = reason;
  order.timeline.declinedAt = new Date();
  await order.save();

  const freelancer = await User.findById(freelancerId).select('firstName lastName avatar');
  await notifyOrderDeclined(order, freelancer);

  emitToUser(order.client.toString(), 'project:update', {
    type: 'order_declined',
    orderId: order._id,
  });

  return order;
};

/**
 * Client cancels an order before funding. Nothing was paid, so we only mark the
 * escrow as cancelled.
 */
export const cancelServiceOrder = async ({ orderId, clientId }) => {
  const order = await ServiceOrder.findOne({ _id: orderId, client: clientId });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'pending_payment') {
    throw new ApiError(400, `Order is ${order.status}; only unfunded orders can be cancelled`);
  }

  await Escrow.findByIdAndUpdate(order.escrow, { status: 'cancelled' });

  order.status = 'cancelled';
  order.timeline.cancelledAt = new Date();
  await order.save();

  const client = await User.findById(clientId).select('firstName lastName avatar');
  await notifyOrderCancelled(order, client);

  return order;
};

/**
 * Freelancer submits the completed work. Escrow is marked submitted via the
 * existing flow and the client is notified to review the delivery.
 */
export const deliverServiceOrder = async ({ orderId, freelancerId, message = '', files = [] }) => {
  const order = await ServiceOrder.findOne({ _id: orderId, freelancer: freelancerId })
    .populate('client', 'firstName lastName avatar');
  if (!order) throw new ApiError(404, 'Order not found');
  if (!['accepted', 'revision_requested'].includes(order.status)) {
    throw new ApiError(400, `Order is ${order.status}; only accepted or revision_requested orders can be delivered`);
  }

  await submitEscrowWork(order.escrow.toString(), freelancerId);

  order.delivery = { message, files, submittedAt: new Date() };
  order.status = 'delivered';
  order.timeline.deliveredAt = new Date();
  await order.save();

  if (order.milestone) {
    await Milestone.findByIdAndUpdate(order.milestone, {
      status: 'submitted',
      deliveryFiles: files,
      deliveryNote: message,
      submittedAt: new Date(),
    });
  }
  if (order.project) {
    const project = await Project.findById(order.project);
    if (project) {
      applyProjectTransition(project, 'pending_delivery');
      await project.save();
    }
  }

  const freelancer = await User.findById(freelancerId).select('firstName lastName avatar');
  await notifyOrderDeliverySubmitted(order, freelancer);

  emitToUser(order.client._id.toString(), 'project:update', {
    type: 'order_delivered',
    orderId: order._id,
  });

  return reloadOrder(order._id);
};

/**
 * Client asks the freelancer for changes. Funds stay in escrow and the escrow
 * is put back in_progress so the freelancer can resubmit.
 */
export const requestRevisionServiceOrder = async ({ orderId, clientId, reason }) => {
  const order = await ServiceOrder.findOne({ _id: orderId, client: clientId })
    .populate('freelancer', 'firstName lastName avatar');
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'delivered') {
    throw new ApiError(400, `Order is ${order.status}; only delivered orders can request a revision`);
  }

  const escrow = await Escrow.findById(order.escrow);
  if (escrow && escrow.status === 'submitted') {
    escrow.status = 'in_progress';
    await escrow.save();
  }

  order.status = 'revision_requested';
  order.revisionNote = reason;
  order.timeline.revisionRequestedAt = new Date();
  await order.save();

  if (order.milestone) {
    await Milestone.findByIdAndUpdate(order.milestone, { status: 'revision_requested' });
  }
  if (order.project) {
    const project = await Project.findById(order.project);
    if (project) {
      applyProjectTransition(project, 'in_revision');
      await project.save();
    }
  }

  const client = await User.findById(clientId).select('firstName lastName avatar');
  await notifyOrderRevisionRequested(order, client);

  emitToUser(order.freelancer._id.toString(), 'project:update', {
    type: 'order_revision_requested',
    orderId: order._id,
  });

  return reloadOrder(order._id);
};

/**
 * Client accepts the delivery. Payment is released to the freelancer via the
 * existing escrow release flow (wallet credit + escrow release + commission
 * transactions), the project/milestone close and both parties are notified.
 */
export const completeServiceOrder = async ({ orderId, clientId }) => {
  const order = await ServiceOrder.findOne({ _id: orderId, client: clientId });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'delivered') {
    throw new ApiError(400, `Order is ${order.status}; only delivered orders can be completed`);
  }

  const result = await releaseEscrowFunds(order.escrow.toString(), clientId);

  order.status = 'completed';
  order.transaction = result.freelancerTransaction._id;
  order.timeline.completedAt = new Date();
  await order.save();

  if (order.milestone) {
    await Milestone.findByIdAndUpdate(order.milestone, {
      status: 'released',
      approvedAt: new Date(),
      approvedBy: clientId,
      escrowReleasedAt: new Date(),
    });
  }
  if (order.project) {
    // releaseEscrowFunds → propagateRelease already closed the project as
    // completed; only apply the transition when it has not already happened so
    // a redundant status write never fails on a terminal state.
    const project = await Project.findById(order.project);
    if (project && project.status !== 'completed') {
      applyProjectTransition(project, 'completed');
      project.progress = 100;
      project.timeline = { ...(project.timeline || {}), completedAt: new Date() };
      await project.save();
    }
  }

  await User.findByIdAndUpdate(clientId, {
    $inc: { 'stats.completedProjects': 1, 'stats.activeProjects': -1 },
  });
  await User.findByIdAndUpdate(order.freelancer, {
    $inc: { 'stats.completedProjects': 1, 'stats.activeProjects': -1 },
  });

  const escrow = result.escrow;
  await notifyOrderCompleted(order);
  await notifyEscrowReleased(order.freelancer, escrow.amount, escrow.freelancerAmount, escrow.commissionAmount, escrow.commissionRate);
  await notifyCommissionDeducted(order.freelancer, escrow.commissionAmount, escrow.commissionRate);
  await notifyPaymentReceived(order.freelancer, escrow.freelancerAmount, escrow.currency, `Order: ${order.title}`);

  emitToUser(order.freelancer.toString(), 'project:update', {
    type: 'order_completed',
    orderId: order._id,
    transactionId: result.freelancerTransaction._id,
  });

  return reloadOrder(order._id);
};

/**
 * Client reports a problem on a delivered order. Funds stay locked in escrow
 * (marked disputed), an admin Report is created and admins are notified so the
 * dispute can be resolved via the existing admin escrow-dispute flow.
 */
export const reportServiceOrderProblem = async ({ orderId, clientId, reason, description }) => {
  const order = await ServiceOrder.findOne({ _id: orderId, client: clientId })
    .populate('freelancer', 'firstName lastName avatar');
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'delivered') {
    throw new ApiError(400, `Order is ${order.status}; only delivered orders can be reported`);
  }

  const report = await Report.create({
    reporter: clientId,
    reportedUser: order.freelancer._id,
    resourceType: 'service_order',
    resourceId: order._id,
    reason,
    description,
    reportHistory: [{ action: 'created', admin: null, details: {}, createdAt: new Date() }],
  });

  const escrow = await Escrow.findById(order.escrow);
  if (escrow && escrow.status === 'submitted') {
    escrow.status = 'disputed';
    escrow.disputeReason = description;
    escrow.disputeOpenedBy = clientId;
    escrow.disputeOpenedAt = new Date();
    await escrow.save();
  }

  order.status = 'disputed';
  order.disputeReason = description;
  order.report = report._id;
  order.timeline.disputedAt = new Date();
  await order.save();

  if (order.milestone) {
    await Milestone.findByIdAndUpdate(order.milestone, { status: 'disputed' });
  }
  if (order.project) {
    const project = await Project.findById(order.project);
    if (project) {
      applyProjectTransition(project, 'disputed');
      await project.save();
    }
  }

  const client = await User.findById(clientId).select('firstName lastName avatar');
  await notifyOrderDisputeReported(order, client);

  emitToUser(order.freelancer._id.toString(), 'project:update', {
    type: 'order_disputed',
    orderId: order._id,
  });

  return reloadOrder(order._id);
};

/**
 * Reload an order with the standard populated shape used by order responses.
 */
const reloadOrder = (orderId) =>
  ServiceOrder.findById(orderId)
    .populate('service', 'title slug images pricingTiers')
    .populate('client', 'firstName lastName avatar')
    .populate('freelancer', 'firstName lastName avatar')
    .populate('project', 'title status _id')
    .populate('conversation', '_id')
    .populate('milestone', 'title amount status _id')
    .populate('report', '_id status');

/**
 * List orders as the client or the freelancer, optionally filtered by status.
 */
export const listServiceOrders = async ({ userId, as, status, page = 1, limit = 10 }) => {
  const role = as === 'freelancer' ? 'freelancer' : 'client';
  const filter = { [role]: userId };
  if (status) filter.status = status;

  const skip = (Math.max(1, page) - 1) * limit;
  const total = await ServiceOrder.countDocuments(filter);
  const orders = await ServiceOrder.find(filter)
    .populate('service', 'title slug images pricingTiers')
    .populate('client', 'firstName lastName avatar')
    .populate('freelancer', 'firstName lastName avatar')
    .populate('project', 'title status _id')
    .populate('escrow', 'status amount')
    .populate('review', '_id rating')
    .populate('report', '_id status')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    orders,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      counts: await getOrderCounts(userId, role),
    },
  };
};

/**
 * Get a single order with full access check.
 */
export const getServiceOrder = async ({ orderId, userId, isAdmin = false }) => {
  const order = await ServiceOrder.findById(orderId)
    .populate('service', 'title slug images pricingTiers skills category subcategory')
    .populate('client', 'firstName lastName email avatar')
    .populate('freelancer', 'firstName lastName email avatar')
    .populate('project', 'title status _id')
    .populate('conversation', '_id')
    .populate('milestone', 'title amount status _id')
    .populate('escrow', 'status amount commissionAmount freelancerAmount fundingTransaction releaseTransaction refundTransaction')
    .populate('review', '_id rating comment')
    .populate('report', '_id status');
  if (!order) throw new ApiError(404, 'Order not found');

  const isParty = order.client._id.toString() === userId.toString() || order.freelancer._id.toString() === userId.toString();
  if (!isParty && !isAdmin) throw new ApiError(403, 'Not authorized to view this order');
  return order;
};

/**
 * Denormalized stats for dashboards.
 */
export const getServiceOrdersStats = async ({ userId, as }) => {
  const role = as === 'freelancer' ? 'freelancer' : 'client';
  const pipeline = [
    { $match: { [role]: userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $in: ['$status', ACTIVE_STATUSES] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $in: ['$status', CLOSED_STATUSES] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $in: ['$status', ['pending_payment', 'funded']] }, 1, 0] } },
        grossRevenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$budget.amount', 0] } },
      },
    },
  ];

  const [stats] = await ServiceOrder.aggregate(pipeline);
  return {
    total: stats?.total || 0,
    active: stats?.active || 0,
    completed: stats?.completed || 0,
    cancelled: stats?.cancelled || 0,
    pending: stats?.pending || 0,
    grossRevenue: stats?.grossRevenue || 0,
  };
};

const getOrderCounts = async (userId, role) => {
  const counts = await ServiceOrder.aggregate([
    { $match: { [role]: userId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  return counts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {});
};
