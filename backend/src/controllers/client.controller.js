import mongoose from 'mongoose';
import {
  User,
  Job,
  Project,
  Payment,
  Review,
  Application,
  Conversation,
  ServiceOrder,
  Wallet,
  Transaction,
} from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendResponse } from '../utils/apiResponse.js';
import { ACTIVE_PROJECT_STATUSES } from '../utils/projectStateMachine.js';

const { Types: { ObjectId } } = mongoose;

// Payment types that represent money a client spent funding work
const SPEND_TYPES = ['escrow', 'milestone_payment', 'project_payment', 'service_order_payment'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const mapFreelancer = (user) =>
  user ? { _id: user._id, firstName: user.firstName, lastName: user.lastName, avatar: user.avatar } : null;

// ─── Client Dashboard ──────────────────────────────────────────────────────────
export const getClientDashboard = catchAsync(async (req, res) => {
  const userId = new ObjectId(req.user._id);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    activeJobs,
    postedJobs,
    activeProjects,
    completedProjects,
    serviceOrders,
    totalSpentAgg,
    thisMonthAgg,
    monthlySpendingAgg,
    completedPaymentsCount,
    refundsAgg,
    wallet,
    completedProjectsList,
    myReviews,
    activeProjectsList,
    recentOrders,
    recentJobs,
    deliveredProjects,
    pendingPaymentOrders,
    deliveredOrders,
    pendingProposalsCount,
    conversations,
  ] = await Promise.all([
    Job.countDocuments({ client: userId, status: 'open' }),
    Job.countDocuments({ client: userId, status: { $ne: 'draft' } }),
    Project.countDocuments({ client: userId, status: { $in: ACTIVE_PROJECT_STATUSES } }),
    Project.countDocuments({ client: userId, status: 'completed' }),
    ServiceOrder.countDocuments({ client: userId }),

    Payment.aggregate([
      { $match: { payer: userId, status: 'completed', type: { $in: SPEND_TYPES } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    Payment.aggregate([
      { $match: { payer: userId, status: 'completed', type: { $in: SPEND_TYPES }, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    Payment.aggregate([
      { $match: { payer: userId, status: 'completed', type: { $in: SPEND_TYPES }, createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          spent: { $sum: '$amount' },
        },
      },
    ]),

    Payment.countDocuments({ payer: userId, status: 'completed', type: { $in: SPEND_TYPES } }),

    Transaction.aggregate([
      { $match: { user: userId, type: 'escrow_refund', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    Wallet.findOne({ user: userId }),

    Project.find({ client: userId, status: 'completed' }).select('_id title').lean(),
    Review.find({ reviewer: userId }).select('project').lean(),

    Project.find({ client: userId, status: { $in: ACTIVE_PROJECT_STATUSES } })
      .populate('freelancer', 'firstName lastName avatar')
      .sort({ updatedAt: -1 })
      .limit(5),

    ServiceOrder.find({ client: userId })
      .populate('service', 'title slug')
      .populate('freelancer', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .limit(5),

    Job.find({ client: userId, status: { $ne: 'draft' } })
      .select('title status applicationsCount createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),

    Project.find({ client: userId, status: 'pending_delivery' }).select('_id title').lean(),
    ServiceOrder.find({ client: userId, status: 'pending_payment' }).select('_id orderNumber title').lean(),
    ServiceOrder.find({ client: userId, status: 'delivered' }).select('_id orderNumber title').lean(),
    Application.countDocuments({ client: userId, status: { $in: ['pending', 'viewed'] } }),

    Conversation.find({
      participants: userId,
      isActive: true,
      deletedFor: { $ne: userId },
    })
      .populate('participants', 'firstName lastName avatar role')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 })
      .limit(6),
  ]);

  // ── Pending reviews: completed projects the client has not reviewed ──────
  const reviewedProjectIds = new Set(
    myReviews.map((r) => r.project?.toString()).filter(Boolean)
  );
  const pendingProjects = completedProjectsList.filter(
    (p) => !reviewedProjectIds.has(p._id.toString())
  );

  // ── Monthly spending (last 12 months, zero-filled) ────────────────────────
  const spentByMonth = new Map(
    monthlySpendingAgg.map((m) => [`${m._id.year}-${m._id.month}`, m.spent])
  );
  const monthlySpending = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    monthlySpending.push({
      year,
      month,
      label: MONTH_NAMES[month - 1],
      spent: Math.round((spentByMonth.get(`${year}-${month}`) || 0) * 100) / 100,
    });
  }

  // ── Needs your attention (deterministic, real data only) ──────────────────
  const attention = [];
  if (pendingProposalsCount > 0) {
    attention.push({
      key: 'proposals',
      type: 'info',
      title: `${pendingProposalsCount} proposal${pendingProposalsCount === 1 ? '' : 's'} awaiting your response`,
      detail: 'New proposals have arrived on your jobs',
      href: '/client/proposals',
    });
  }
  pendingPaymentOrders.forEach((o) => {
    attention.push({
      key: `order-${o._id}`,
      type: 'payment',
      title: 'Payment required to start',
      detail: `${o.title} (${o.orderNumber})`,
      href: '/client/service-orders',
    });
  });
  deliveredProjects.forEach((p) => {
    attention.push({
      key: `project-${p._id}`,
      type: 'delivery',
      title: 'Delivery awaiting your approval',
      detail: p.title,
      href: `/projects/${p._id}`,
    });
  });
  deliveredOrders.forEach((o) => {
    attention.push({
      key: `order-${o._id}`,
      type: 'delivery',
      title: 'Order delivery awaiting your approval',
      detail: `${o.title} (${o.orderNumber})`,
      href: '/client/service-orders',
    });
  });
  pendingProjects.slice(0, 3).forEach((p) => {
    attention.push({
      key: `review-${p._id}`,
      type: 'review',
      title: 'Leave a review for a completed project',
      detail: p.title,
      href: '/client/reviews',
    });
  });

  // ── Recent messages ────────────────────────────────────────────────────────
  const recentMessages = conversations.map((conv) => {
    const other = conv.participants?.find((p) => p._id.toString() !== userId.toString());
    let preview = 'No messages yet';
    const last = conv.lastMessage;
    if (last) {
      const deletedForMe = (last.deletedFor || []).some(
        (id) => id.toString() === userId.toString()
      );
      preview = last.isDeleted || deletedForMe
        ? 'This message was deleted'
        : last.content || (last.attachments?.length ? 'Attachment' : 'No messages yet');
    }
    const unread = conv.unreadCounts?.find(
      (u) => u.user.toString() === userId.toString()
    );
    return {
      conversationId: conv._id,
      user: mapFreelancer(other),
      preview,
      lastMessageAt: conv.lastMessageAt,
      unreadCount: unread?.count || 0,
    };
  });

  const user = await User.findById(userId).select('firstName lastName avatar');

  sendResponse(res, 200, 'Client dashboard fetched', {
    user: user ? { firstName: user.firstName, lastName: user.lastName, avatar: user.avatar } : null,
    stats: {
      activeJobs,
      totalJobsPosted: postedJobs,
      activeProjects,
      completedProjects,
      serviceOrders,
      totalSpent: totalSpentAgg[0]?.total || 0,
      pendingReviews: pendingProjects.length,
    },
    monthlySpending,
    spendingSummary: {
      totalSpent: totalSpentAgg[0]?.total || 0,
      thisMonth: thisMonthAgg[0]?.total || 0,
      escrowHeld: wallet?.escrowBalance || 0,
      completedPayments: completedPaymentsCount,
      refunds: refundsAgg[0]?.total || 0,
    },
    activeProjects: activeProjectsList.map((p) => ({
      _id: p._id,
      title: p.title,
      freelancer: mapFreelancer(p.freelancer),
      status: p.status,
      progress: p.progress ?? 0,
      amount: p.budget?.agreedAmount ?? 0,
      currency: p.budget?.currency || 'ETB',
      deadline: p.timeline?.deadline || null,
    })),
    recentOrders: recentOrders.map((o) => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      title: o.title,
      service: o.service ? { _id: o.service._id, title: o.service.title, slug: o.service.slug } : null,
      freelancer: mapFreelancer(o.freelancer),
      tier: o.tier ? { name: o.tier.name, title: o.tier.title } : null,
      amount: o.budget?.amount ?? o.tier?.price ?? 0,
      currency: o.budget?.currency || o.tier?.currency || 'ETB',
      status: o.status,
      expectedDelivery: o.expectedDelivery || null,
    })),
    recentJobs,
    attention: attention.slice(0, 8),
    recentMessages,
  });
});
