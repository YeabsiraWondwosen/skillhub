import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ClockIcon, CheckBadgeIcon, PaperAirplaneIcon, BanknotesIcon,
  CheckCircleIcon, ArrowPathIcon, FlagIcon, ChatBubbleLeftRightIcon,
  EyeIcon, StarIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import DeliverySubmitModal from '@/components/orders/DeliverySubmitModal';
import DeliveryViewModal from '@/components/orders/DeliveryViewModal';
import RequestRevisionModal from '@/components/orders/RequestRevisionModal';
import ReportProblemModal from '@/components/orders/ReportProblemModal';
import ReviewOrderModal from '@/components/orders/ReviewOrderModal';
import {
  useFundOrder, useAcceptOrder, useDeclineOrder, useCancelOrder,
  useCompleteOrder,
} from '@/hooks/useOrders';
import { messageService } from '@/services/message.service';
import { formatCurrency } from '@/utils/currency';
import { format } from 'date-fns';

export const ORDER_STATUS_META = {
  pending_payment: { label: 'Awaiting Payment', color: 'warning', dot: 'bg-warning-500' },
  funded: { label: 'Awaiting Response', color: 'info', dot: 'bg-blue-500' },
  accepted: { label: 'In Progress', color: 'success', dot: 'bg-success-500' },
  delivered: { label: 'Delivered', color: 'primary', dot: 'bg-primary-500' },
  revision_requested: { label: 'Revision Requested', color: 'warning', dot: 'bg-warning-500' },
  completed: { label: 'Completed', color: 'success', dot: 'bg-success-500' },
  declined: { label: 'Declined', color: 'danger', dot: 'bg-danger-500' },
  cancelled: { label: 'Cancelled', color: 'gray', dot: 'bg-gray-400' },
  disputed: { label: 'Disputed', color: 'danger', dot: 'bg-danger-500' },
};

export function OrderStatusBadge({ status }) {
  const meta = ORDER_STATUS_META[status] || { label: status, color: 'gray', dot: 'bg-gray-400' };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      <Badge color={meta.color} size="sm">{meta.label}</Badge>
    </span>
  );
}

export default function OrderCard({ order, index = 0, as }) {
  const navigate = useNavigate();
  const client = order.client || {};
  const freelancer = order.freelancer || {};
  const isFreelancerView = as === 'freelancer';
  const other = isFreelancerView ? client : freelancer;
  const otherName = [other.firstName, other.lastName].filter(Boolean).join(' ') || (isFreelancerView ? 'Client' : 'Freelancer');
  const service = order.service || {};
  const tier = order.tier || {};
  const detailPath = `/services/orders/${order._id}`;

  const [deliverOpen, setDeliverOpen] = useState(false);
  const [viewDeliveryOpen, setViewDeliveryOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const { mutate: fund, isPending: isFunding } = useFundOrder();
  const { mutate: accept, isPending: isAccepting } = useAcceptOrder();
  const { mutate: decline, isPending: isDeclining } = useDeclineOrder();
  const { mutate: cancel, isPending: isCancelling } = useCancelOrder();
  const { mutate: complete, isPending: isCompleting } = useCompleteOrder();

  const onMessage = async () => {
    try {
      const res = await messageService.startConversation(other._id);
      const conv = res.data?.data || res.data;
      navigate(`/messages/${conv._id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to start a conversation');
    }
  };

  const onDecline = () => {
    decline({ orderId: order._id, reason: declineReason }, {
      onSuccess: () => { setDeclineOpen(false); setDeclineReason(''); },
    });
  };

  const actions = [];
  let context = null;

  if (isFreelancerView) {
    if (order.status === 'pending_payment') {
      context = 'Awaiting payment from the client.';
    } else if (order.status === 'funded') {
      context = 'Payment is secured in escrow. Accept to start working.';
      actions.push(
        <Button key="accept" size="sm" onClick={() => accept(order._id)} loading={isAccepting}>
          <CheckCircleIcon className="w-4 h-4" /> Accept Order
        </Button>,
        <Button key="decline" size="sm" variant="danger" onClick={() => setDeclineOpen(true)}>
          Decline
        </Button>
      );
    } else if (order.status === 'accepted') {
      context = 'In progress — deliver the work when it is ready.';
    } else if (order.status === 'delivered') {
      context = 'Delivery submitted. Awaiting client review.';
    } else if (order.status === 'revision_requested') {
      context = order.revisionNote ? `Revision requested: ${order.revisionNote}` : 'Client requested revisions.';
      actions.push(
        <Button key="deliver" size="sm" onClick={() => setDeliverOpen(true)}>
          <PaperAirplaneIcon className="w-4 h-4" /> Resubmit Delivery
        </Button>
      );
    } else if (order.status === 'completed') {
      context = 'Order completed.';
    } else if (order.status === 'declined') {
      context = order.declineReason ? `Declined: ${order.declineReason}` : 'Order declined.';
    } else if (order.status === 'cancelled') {
      context = 'Order cancelled by the client before funding.';
    } else if (order.status === 'disputed') {
      context = 'This order is under dispute. Our team is reviewing it.';
    }
  } else {
    if (order.status === 'pending_payment') {
      context = 'Complete payment to send this order to the freelancer.';
      actions.push(
        <Button key="pay" size="sm" onClick={() => fund(order._id)} loading={isFunding}>
          <BanknotesIcon className="w-4 h-4" /> Pay {formatCurrency(order.budget?.amount, order.budget?.currency || 'ETB')} Now
        </Button>,
        <Button key="cancel" size="sm" variant="secondary" onClick={() => setCancelOpen(true)} loading={isCancelling}>
          Cancel
        </Button>
      );
    } else if (order.status === 'funded') {
      context = 'Payment secured in escrow — awaiting the freelancer\'s response.';
      actions.push(
        <Button key="msg" size="sm" variant="secondary" onClick={onMessage}>
          <ChatBubbleLeftRightIcon className="w-4 h-4" /> Message Freelancer
        </Button>
      );
    } else if (order.status === 'accepted') {
      context = 'In progress — the freelancer is working on your order.';
      actions.push(
        <Button key="msg" size="sm" variant="secondary" onClick={onMessage}>
          <ChatBubbleLeftRightIcon className="w-4 h-4" /> Message Freelancer
        </Button>
      );
    } else if (order.status === 'delivered') {
      context = 'Delivery received — review it below.';
      actions.push(
        <Button key="view" size="sm" variant="secondary" onClick={() => setViewDeliveryOpen(true)}>
          <EyeIcon className="w-4 h-4" /> View Delivery
        </Button>,
        <Button key="revision" size="sm" variant="secondary" onClick={() => setRevisionOpen(true)}>
          <ArrowPathIcon className="w-4 h-4" /> Request Revision
        </Button>,
        <Button key="complete" size="sm" onClick={() => complete(order._id)} loading={isCompleting}>
          <CheckCircleIcon className="w-4 h-4" /> Accept & Complete
        </Button>,
        <Button key="report" size="sm" variant="danger" onClick={() => setReportOpen(true)}>
          <FlagIcon className="w-4 h-4" /> Report Problem
        </Button>
      );
    } else if (order.status === 'revision_requested') {
      context = order.revisionNote ? `Revision requested: ${order.revisionNote}` : 'Revision in progress.';
      actions.push(
        <Button key="msg" size="sm" variant="secondary" onClick={onMessage}>
          <ChatBubbleLeftRightIcon className="w-4 h-4" /> Message Freelancer
        </Button>
      );
    } else if (order.status === 'completed') {
      context = 'Order completed.';
      if (!order.review) {
        actions.push(
          <Button key="review" size="sm" variant="outline" onClick={() => setReviewOpen(true)}>
            <StarIcon className="w-4 h-4" /> Leave Review
          </Button>
        );
      }
    } else if (order.status === 'declined') {
      context = order.declineReason ? `Declined: ${order.declineReason}` : 'Order declined.';
    } else if (order.status === 'cancelled') {
      context = 'Order cancelled before funding.';
    } else if (order.status === 'disputed') {
      context = 'Dispute opened — funds are locked in escrow while our team reviews it.';
    }
  }

  actions.push(
    <Link key="view-order" to={detailPath} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
      View Order
    </Link>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
    >
      <div className="card card-hover p-5">
        <Link to={detailPath} className="flex flex-col sm:flex-row sm:items-center gap-4 block">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-dark-700 shrink-0">
            {service.images?.length > 0 ? (
              <img src={service.images[0].url} alt={service.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-primary-300">
                <CheckBadgeIcon className="w-7 h-7" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <OrderStatusBadge status={order.status} />
              {order.orderNumber && (
                <span className="text-[10px] font-mono text-gray-400">{order.orderNumber}</span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mt-1.5 truncate">{order.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
              {isFreelancerView ? 'Client' : 'Freelancer'}: {otherName}
              {order.freelancer?.isVerifiedFreelancer && isFreelancerView && (
                <CheckBadgeIcon className="inline w-3.5 h-3.5 text-green-500 ml-1" />
              )}
            </p>
          </div>

          <div className="sm:text-right shrink-0">
            <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
              {formatCurrency(order.budget?.amount, order.budget?.currency || 'ETB')}
            </p>
            <p className="text-xs text-gray-400 flex items-center gap-1 justify-start sm:justify-end">
              <ClockIcon className="w-3.5 h-3.5" />
              {order.timeline?.placedAt ? format(new Date(order.timeline.placedAt), 'MMM d, yyyy') : format(new Date(order.createdAt), 'MMM d, yyyy')}
            </p>
            {tier?.title && (
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">
                {tier.title} · {order.tier?.deliveryTime} {order.tier?.deliveryUnit}
              </p>
            )}
          </div>
        </Link>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row sm:items-center gap-3">
          {context && (
            <p className="flex-1 min-w-0 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <ShieldCheckIcon className="w-3.5 h-3.5 shrink-0 text-primary-400" />
              <span className="line-clamp-2">{context}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2 shrink-0">
            {actions}
          </div>
        </div>
      </div>

      {isFreelancerView && (
        <>
          <DeliverySubmitModal open={deliverOpen} onClose={() => setDeliverOpen(false)} order={order} />
          <ConfirmModal
            open={declineOpen}
            onClose={() => setDeclineOpen(false)}
            onConfirm={onDecline}
            title="Decline this order?"
            message="The client's payment will be refunded to their wallet. This cannot be undone."
            confirmLabel="Decline & Refund"
            danger
            loading={isDeclining}
          >
            <Textarea
              label="Reason (optional)"
              placeholder="Why are you declining? This helps the client understand."
              rows={3}
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
            />
          </ConfirmModal>
        </>
      )}

      {!isFreelancerView && (
        <>
          <DeliveryViewModal open={viewDeliveryOpen} onClose={() => setViewDeliveryOpen(false)} order={order} />
          <RequestRevisionModal open={revisionOpen} onClose={() => setRevisionOpen(false)} order={order} />
          <ReportProblemModal open={reportOpen} onClose={() => setReportOpen(false)} order={order} />
          <ReviewOrderModal open={reviewOpen} onClose={() => setReviewOpen(false)} order={order} />
          <ConfirmModal
            open={cancelOpen}
            onClose={() => setCancelOpen(false)}
            onConfirm={() => cancel(order._id, { onSuccess: () => setCancelOpen(false) })}
            title="Cancel this order?"
            message="The order has not been funded yet, so no payment will be released."
            confirmLabel="Cancel Order"
            danger
            loading={isCancelling}
          />
        </>
      )}
    </motion.div>
  );
}

export function OrderActorAvatar({ order, as }) {
  const isFreelancerView = as === 'freelancer';
  const other = isFreelancerView ? order.client : order.freelancer;
  const name = [other?.firstName, other?.lastName].filter(Boolean).join(' ');
  return (
    <div className="flex items-center gap-2">
      <Avatar src={other?.avatar?.url} alt={name} size="sm" />
      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</span>
      {other?.isVerifiedFreelancer && !isFreelancerView && (
        <CheckBadgeIcon className="w-4 h-4 text-green-500" />
      )}
    </div>
  );
}

export function ServiceRating({ value, count }) {
  if (!value || value <= 0) {
    return <span className="text-xs text-gray-400">No reviews yet</span>;
  }
  return (
    <span className="flex items-center gap-1 text-sm">
      <StarIcon className="w-4 h-4 text-yellow-400" />
      <span className="font-bold text-gray-900 dark:text-white">{value.toFixed(1)}</span>
      <span className="text-xs text-gray-400">({count || 0})</span>
    </span>
  );
}
