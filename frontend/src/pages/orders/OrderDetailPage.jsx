import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon, CheckCircleIcon, XCircleIcon,
  ChatBubbleLeftRightIcon, FlagIcon,
  FolderIcon, BanknotesIcon,
  ShieldCheckIcon, CalendarIcon, PaperClipIcon, StarIcon,
  ArrowPathIcon, EyeIcon, PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { useOrder, useFundOrder, useAcceptOrder, useDeclineOrder, useCancelOrder, useCompleteOrder } from '@/hooks/useOrders';
import { useAuthStore } from '@/store/authStore';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import { SkeletonText } from '@/components/ui/Skeleton';
import ReviewOrderModal from '@/components/orders/ReviewOrderModal';
import DeliverySubmitModal from '@/components/orders/DeliverySubmitModal';
import DeliveryViewModal from '@/components/orders/DeliveryViewModal';
import RequestRevisionModal from '@/components/orders/RequestRevisionModal';
import ReportProblemModal from '@/components/orders/ReportProblemModal';
import ReportModal from '@/components/chat/ReportModal';
import { OrderStatusBadge } from '@/components/orders/OrderCard';
import { formatCurrency } from '@/utils/currency';
import { format } from 'date-fns';
import { clsx } from 'clsx';

const TIMELINE_LABELS = [
  { key: 'placedAt', label: 'Order placed' },
  { key: 'fundedAt', label: 'Payment funded' },
  { key: 'acceptedAt', label: 'Freelancer accepted' },
  { key: 'deliveredAt', label: 'Delivery submitted' },
  { key: 'revisionRequestedAt', label: 'Revision requested' },
  { key: 'completedAt', label: 'Order completed' },
  { key: 'declinedAt', label: 'Order declined' },
  { key: 'cancelledAt', label: 'Order cancelled' },
  { key: 'disputedAt', label: 'Dispute opened' },
];

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data, isLoading } = useOrder(orderId);
  const order = data?.data;

  const [declineOpen, setDeclineOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDisputeOpen, setReportDisputeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [viewDeliveryOpen, setViewDeliveryOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const { mutate: fund, isPending: isFunding } = useFundOrder();
  const { mutate: accept, isPending: isAccepting } = useAcceptOrder();
  const { mutate: decline, isPending: isDeclining } = useDeclineOrder();
  const { mutate: cancel, isPending: isCancelling } = useCancelOrder();
  const { mutate: complete, isPending: isCompleting } = useCompleteOrder();

  if (isLoading) return <div className="page-container"><SkeletonText lines={12} /></div>;
  if (!order) return <div className="page-container text-center py-20"><h2>Order not found</h2></div>;

  const isClient = order.client?._id === user?._id;
  const isFreelancer = order.freelancer?._id === user?._id;
  const isAdmin = user?.role === 'admin';

  const client = order.client || {};
  const freelancer = order.freelancer || {};
  const service = order.service || {};
  const tier = order.tier || {};
  const escrow = order.escrow || {};

  const other = isClient ? freelancer : client;
  const otherName = [other.firstName, other.lastName].filter(Boolean).join(' ') || (isClient ? 'Freelancer' : 'Client');

  const canFund = isClient && order.status === 'pending_payment';
  const canAccept = isFreelancer && order.status === 'funded';
  const canDecline = isFreelancer && order.status === 'funded';
  const canCancel = isClient && order.status === 'pending_payment';
  const canDeliver = isFreelancer && ['accepted', 'revision_requested'].includes(order.status);
  const canRequestRevision = isClient && order.status === 'delivered';
  const canComplete = isClient && order.status === 'delivered';
  const canMessage = !!order.conversation?._id;
  const canReview = isClient && order.status === 'completed' && !order.review;
  const canReportDispute = isClient && order.status === 'delivered';

  const timeline = (TIMELINE_LABELS.map(t => ({ ...t, at: order.timeline?.[t.key] }))).filter(t => t.at);

  const onDecline = () => {
    decline({ orderId, reason: declineReason }, {
      onSuccess: () => { setDeclineOpen(false); setDeclineReason(''); },
    });
  };

  const onCancel = () => {
    cancel(orderId, { onSuccess: () => setCancelOpen(false) });
  };

  const onFund = () => {
    fund(orderId, { onSuccess: () => navigate(`/services/orders/${orderId}`) });
  };

  return (
    <div className="page-container max-w-5xl mx-auto space-y-6">
      <Link to={isClient ? '/client/service-orders' : '/freelancer/service-orders'}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeftIcon className="w-4 h-4" /> Back to {isClient ? 'My Service Orders' : 'Service Orders'}
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <OrderStatusBadge status={order.status} />
              {order.orderNumber && <span className="text-xs font-mono text-gray-400">{order.orderNumber}</span>}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{order.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {service.title ? (
                <Link to={`/catalogs/${service.slug}`} className="hover:text-primary-600">{service.title}</Link>
              ) : 'Service order'}
              {tier.title && <> · {tier.title} package</>}
            </p>
          </div>
          <div className="lg:text-right">
            <p className="text-3xl font-black text-primary-600 dark:text-primary-400">
              {formatCurrency(order.budget?.amount, order.budget?.currency || 'ETB')}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {tier.deliveryTime} {tier.deliveryUnit} delivery · {tier.revisions} revision{tier.revisions !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Action bar */}
        {(canFund || canAccept || canDecline || canCancel || canDeliver || canRequestRevision || canComplete || canMessage) && (
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-gray-100 dark:border-gray-700/50">
            {canFund && (
              <Button onClick={onFund} loading={isFunding} className="text-sm">
                <BanknotesIcon className="w-4 h-4" /> Fund {formatCurrency(order.budget?.amount, order.budget?.currency)} to Escrow
              </Button>
            )}
            {canAccept && (
              <Button onClick={() => accept(orderId)} loading={isAccepting} className="text-sm">
                <CheckCircleIcon className="w-4 h-4" /> Accept Order
              </Button>
            )}
            {canDecline && (
              <Button variant="danger" onClick={() => setDeclineOpen(true)} className="text-sm">
                <XCircleIcon className="w-4 h-4" /> Decline Order
              </Button>
            )}
            {canCancel && (
              <Button variant="secondary" onClick={() => setCancelOpen(true)} loading={isCancelling} className="text-sm">
                <XCircleIcon className="w-4 h-4" /> Cancel Order
              </Button>
            )}
            {canDeliver && (
              <Button onClick={() => setDeliverOpen(true)} className="text-sm">
                <PaperAirplaneIcon className="w-4 h-4" /> {order.status === 'revision_requested' ? 'Resubmit Delivery' : 'Submit Delivery'}
              </Button>
            )}
            {canRequestRevision && (
              <Button variant="secondary" onClick={() => setRevisionOpen(true)} className="text-sm">
                <ArrowPathIcon className="w-4 h-4" /> Request Revision
              </Button>
            )}
            {canComplete && (
              <Button onClick={() => complete(orderId)} loading={isCompleting} className="text-sm">
                <CheckCircleIcon className="w-4 h-4" /> Accept & Complete
              </Button>
            )}
            {canRequestRevision && (
              <Button variant="outline" onClick={() => setViewDeliveryOpen(true)} className="text-sm">
                <EyeIcon className="w-4 h-4" /> View Delivery
              </Button>
            )}
            {canMessage && (
              <Link to={`/messages/${order.conversation._id}`} className="btn-secondary text-sm inline-flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="w-4 h-4" /> Open Conversation
              </Link>
            )}
            {canReview && (
              <Button variant="outline" onClick={() => setReviewOpen(true)} className="text-sm">
                <StarIcon className="w-4 h-4" /> Leave a review
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Order Details</h2>
            {order.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap mb-4">{order.description}</p>
            )}
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Requirements</p>
                <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {order.requirements || 'No requirements provided'}
                </p>
              </div>
              {order.additionalNotes && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Additional Notes</p>
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{order.additionalNotes}</p>
                </div>
              )}
              {order.expectedDelivery && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <CalendarIcon className="w-4 h-4 text-gray-400" />
                  Expected by {format(new Date(order.expectedDelivery), 'MMM d, yyyy')}
                </div>
              )}
              {order.files?.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Attachments</p>
                  <div className="flex flex-wrap gap-2">
                    {order.files.map((file, i) => (
                      <a key={i} href={file.url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-dark-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600">
                        <PaperClipIcon className="w-3.5 h-3.5" /> {file.name || `File ${i + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Delivery */}
          {order.delivery && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Delivery</h2>
              {order.delivery.submittedAt && (
                <p className="text-xs text-gray-400 mb-3">
                  Submitted {format(new Date(order.delivery.submittedAt), 'MMM d, yyyy h:mm a')}
                </p>
              )}
              {order.delivery.message ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap mb-4">{order.delivery.message}</p>
              ) : (
                <p className="text-sm text-gray-400 mb-4">No delivery message provided.</p>
              )}
              {order.delivery.files?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {order.delivery.files.map((file, i) => (
                    <a key={i} href={file.url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-dark-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600">
                      <PaperClipIcon className="w-3.5 h-3.5" /> {file.name || `File ${i + 1}`}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Revision note */}
          {order.status === 'revision_requested' && order.revisionNote && (
            <div className="card p-6 border-l-4 border-l-warning-400">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Revision Request</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{order.revisionNote}</p>
            </div>
          )}

          {/* Package contents */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Package: {tier.title || tier.name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{tier.description}</p>
            <ul className="space-y-2">
              {tier.features?.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
              {!tier.features?.length && <li className="text-sm text-gray-400">No additional features listed.</li>}
            </ul>
          </div>

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Order Timeline</h2>
              <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2">
                {timeline.map((item, i) => (
                  <li key={item.key} className="ml-6 pb-5 last:pb-0">
                    <span className={clsx(
                      'absolute -left-[7px] mt-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-dark-800',
                      i === 0 ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                    )} />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                    <p className="text-xs text-gray-400">{format(new Date(item.at), 'MMM d, yyyy h:mm a')}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Parties */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Parties</h3>
            <div className="flex items-center gap-3">
              <Avatar src={client.avatar?.url} alt="Client" size="md" />
              <div className="min-w-0">
                <p className="text-xs text-gray-400">Client</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {[client.firstName, client.lastName].filter(Boolean).join(' ') || '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Avatar src={freelancer.avatar?.url} alt="Freelancer" size="md" />
              <div className="min-w-0">
                <p className="text-xs text-gray-400">Freelancer</p>
                <Link to={`/freelancers/${freelancer._id}`} className="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-600 truncate block">
                  {[freelancer.firstName, freelancer.lastName].filter(Boolean).join(' ') || '—'}
                </Link>
              </div>
            </div>
          </div>

          {/* Escrow */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3 flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4 text-primary-500" /> Escrow
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Amount</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(order.budget?.amount, order.budget?.currency || 'ETB')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Status</span>
                <BadgeStatus status={escrow.status} />
              </div>
              {order.project?._id && (
                <Link to={`/projects/${order.project._id}`} className="mt-3 flex items-center justify-between btn-secondary text-sm w-full">
                  <span className="flex items-center gap-2"><FolderIcon className="w-4 h-4" /> Open Project</span>
                </Link>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            {isAdmin && (
              <Link to={`/payments/escrow?order=${order._id}`} className="btn-secondary w-full text-sm">View Escrow Records</Link>
            )}
            <Button variant="outline" className="w-full text-sm" onClick={() => (canReportDispute ? setReportDisputeOpen(true) : setReportOpen(true))}>
              <FlagIcon className="w-4 h-4" /> {canReportDispute ? 'Report Problem' : 'Report Issue'}
            </Button>
          </div>
        </div>
      </div>

      {/* Decline modal */}
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

      {/* Cancel modal */}
      <ConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={onCancel}
        title="Cancel this order?"
        message="The order has not been funded yet, so no payment will be released."
        confirmLabel="Cancel Order"
        danger
        loading={isCancelling}
      />

      {/* Review modal */}
      <ReviewOrderModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        order={order}
        onSubmitted={() => setReviewOpen(false)}
      />

      {/* Deliver modal */}
      <DeliverySubmitModal
        open={deliverOpen}
        onClose={() => setDeliverOpen(false)}
        order={order}
      />

      {/* View delivery modal */}
      <DeliveryViewModal
        open={viewDeliveryOpen}
        onClose={() => setViewDeliveryOpen(false)}
        order={order}
      />

      {/* Revision modal */}
      <RequestRevisionModal
        open={revisionOpen}
        onClose={() => setRevisionOpen(false)}
        order={order}
      />

      {/* Report dispute modal */}
      <ReportProblemModal
        open={reportDisputeOpen}
        onClose={() => setReportDisputeOpen(false)}
        order={order}
      />

      {/* Report modal */}
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        resourceType="catalog"
        resourceId={service._id || order.service}
        resourceLabel={service.title || 'service order'}
      />
    </div>
  );
}

function BadgeStatus({ status }) {
  const map = {
    pending: 'badge-warning', funded: 'badge-warning', in_progress: 'badge-info',
    released: 'badge-success', refunded: 'badge-primary', cancelled: 'badge-gray',
    failed: 'badge-danger', disputed: 'badge-danger',
  };
  return <span className={clsx('badge', map[status] || 'badge-gray')}>{status?.replace(/_/g, ' ') || '—'}</span>;
}
