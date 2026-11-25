import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { useConfirm, usePrompt } from '@/components/ui/DialogProvider';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/store/authStore';
import { joinProject, leaveProject } from '@/services/socket';
import { formatCurrency } from '@/utils/currency';
import {
  useContract,
  useFundContract,
  useSubmitContractDelivery,
  useReviewContractDelivery,
  useRaiseContractDispute,
} from '@/hooks/useContracts';
import {
  ArrowLeftIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  ShieldCheckIcon,
  StarIcon,
} from '@heroicons/react/24/outline';

function SectionCard({ title, icon: Icon, children, action }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary-500" />}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm font-medium text-gray-800 dark:text-gray-200">{value ?? '—'}</dd>
    </div>
  );
}

const fmtDate = (d) => (d ? format(new Date(d), 'MMM d, yyyy') : '—');

export default function ContractDetailPage() {
  const { contractId } = useParams();
  const user = useAuthStore((s) => s.user);
  const confirm = useConfirm();
  const prompt = usePrompt();
  const { data: contract, isLoading, error } = useContract(contractId);

  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [deliveryFiles, setDeliveryFiles] = useState([]);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('other');
  const [disputeDescription, setDisputeDescription] = useState('');

  const fundMutation = useFundContract();
  const submitMutation = useSubmitContractDelivery();
  const reviewMutation = useReviewContractDelivery();
  const disputeMutation = useRaiseContractDispute();

  useEffect(() => {
    if (!contractId) return;
    joinProject(contractId);
    return () => leaveProject(contractId);
  }, [contractId]);

  if (isLoading) {
    return (
      <div className="page-container space-y-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <p className="text-gray-500">Failed to load contract: {error?.response?.data?.message || error?.message || 'Network or server error'}</p>
        <p className="text-sm text-gray-400 mt-2">If the backend server is not running the page cannot load contract details. Try starting the backend and reload.</p>
        <Link to={user?.role === 'client' ? '/client/contracts' : '/freelancer/contracts'} className="text-primary-600 text-sm">← Back to contracts</Link>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="page-container">
        <p className="text-gray-500">Contract not found.</p>
        <Link to={user?.role === 'client' ? '/client/contracts' : '/freelancer/contracts'} className="text-primary-600 text-sm">← Back to contracts</Link>
      </div>
    );
  }

  const isClient = user?.role === 'client' || contract.isClient;
  const isFreelancer = user?.role === 'freelancer' || contract.isFreelancer;
  const projectKey = contract.projectStatus?.key;
  const paymentKey = contract.paymentStatus?.key;
  const isFinalized = paymentKey === 'released' || projectKey === 'completed';
  const effectiveProjectKey = isFinalized ? 'completed' : projectKey;
  const effectivePaymentKey = isFinalized ? 'released' : paymentKey;

  const canFund = isClient && !isFinalized && paymentKey === 'pending_payment';
  const canDeliver = isFreelancer && !isFinalized && ['submitted', 'in_progress', 'in_revision'].includes(projectKey);
  const awaitingReview = isClient && !isFinalized && projectKey === 'submitted';
  const pendingDelivery = contract.deliverables?.find((d) => d.status === 'pending');
  const canDispute = !['completed', 'cancelled', 'disputed'].includes(effectiveProjectKey) && !contract.dispute?.isDisputed;

  const submitDelivery = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('message', deliveryMessage);
    deliveryFiles.forEach((f) => formData.append('files', f));
    submitMutation.mutate({ contractId, formData }, { onSuccess: () => setShowDeliveryForm(false) });
  };

  const handleFund = async () => {
    const ok = await confirm({
      title: 'Fund escrow',
      message: `Fund ${formatCurrency(contract.amount, contract.currency)} into escrow for this contract? The amount will be held securely until the work is approved.`,
      confirmLabel: 'Fund escrow',
    });
    if (ok) fundMutation.mutate({ contractId });
  };

  const handleReview = async (action) => {
    if (action === 'approve') {
      const ok = await confirm({
        title: 'Approve delivery',
        message: 'Approve this delivery? The escrow payment will be released to the freelancer.',
        confirmLabel: 'Approve & release',
      });
      if (!ok) return;
    }
    if (!pendingDelivery) return;

    let revisionNote;
    if (action === 'request_revision') {
      revisionNote = await prompt({
        title: 'Request revision',
        message: 'Let the freelancer know what needs to change before the delivery can be approved.',
        label: 'Revision note',
        placeholder: 'Describe the changes needed...',
        multiline: true,
        rows: 4,
        confirmLabel: 'Request revision',
      });
      if (revisionNote === null) return;
    }

    reviewMutation.mutate({
      contractId,
      deliveryId: pendingDelivery._id,
      data: action === 'request_revision'
        ? { action, revisionNote: revisionNote.trim() || 'Please make the requested changes.' }
        : { action },
    });
  };

  const raiseDispute = (e) => {
    e.preventDefault();
    disputeMutation.mutate(
      { contractId, data: { reason: disputeReason, description: disputeDescription } },
      { onSuccess: () => setShowDisputeModal(false) }
    );
  };

  const backTo = isClient ? '/client/contracts' : '/freelancer/contracts';

  return (
    <div className="page-container space-y-6">
      <div>
        <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600">
          <ArrowLeftIcon className="w-4 h-4" /> Back to contracts
        </Link>
      </div>

      {/* ─── Header ─── */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{contract.title}</h1>
              <Badge status={effectiveProjectKey}>{contract.projectStatus?.label || 'Completed'}</Badge>
              <Badge status={effectivePaymentKey}>{effectivePaymentKey === 'released' ? 'Released' : (contract.paymentStatus?.label || 'Pending Payment')}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Contract <span className="font-mono">{contract.contractNumber}</span>
              {contract.job ? <> · Job: {contract.job.title}</> : null}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <Avatar
                src={(isClient ? contract.freelancer?.avatar?.url || contract.freelancer?.avatar : contract.client?.avatar?.url || contract.client?.avatar)}
                alt={(isClient ? contract.freelancer?.firstName || contract.freelancer?.email || 'Freelancer' : contract.client?.firstName || contract.client?.email || 'Client')}
                size="lg"
              />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {isClient ? 'Freelancer' : 'Client'}:{' '}
                  {isClient
                    ? `${contract.freelancer?.firstName || contract.freelancer?.email || 'Freelancer'} ${contract.freelancer?.lastName || ''}`.trim()
                    : `${contract.client?.firstName || contract.client?.email || 'Client'} ${contract.client?.lastName || ''}`.trim()}
                </p>
                <p className="text-xs text-gray-400">{formatCurrency(contract.amount, contract.currency)} agreed budget</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-end">
            {canFund && (
              <button onClick={handleFund} disabled={fundMutation.isPending} className="btn-primary btn-sm flex items-center gap-1.5">
                <BanknotesIcon className="w-4 h-4" /> Pay Now — Fund Escrow
              </button>
            )}
            {canDeliver && (
              <button onClick={() => setShowDeliveryForm((v) => !v)} className="btn-primary btn-sm flex items-center gap-1.5">
                <DocumentArrowUpIcon className="w-4 h-4" /> Submit Delivery
              </button>
            )}
            {awaitingReview && (
              <div className="flex gap-2">
                <button onClick={() => handleReview('approve')} disabled={reviewMutation.isPending} className="btn-success btn-sm flex items-center gap-1.5">
                  <CheckCircleIcon className="w-4 h-4" /> Approve & Release
                </button>
                <button onClick={() => handleReview('request_revision')} disabled={reviewMutation.isPending} className="btn-outline btn-sm">
                  Request Revision
                </button>
              </div>
            )}
            {canDispute && (
              <button onClick={() => setShowDisputeModal(true)} className="btn-outline btn-sm text-red-500 flex items-center gap-1.5">
                <ExclamationTriangleIcon className="w-4 h-4" /> Raise Dispute
              </button>
            )}
          </div>
        </div>

        <div className="mt-5">
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${contract.progress ?? 0}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{contract.progress ?? 0}% complete</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Main column ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <SectionCard title="Overview" icon={FolderIcon}>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Budget" value={formatCurrency(contract.amount, contract.currency)} />
              <Field label="Paid so far" value={formatCurrency(contract.paidAmount, contract.currency)} />
              <Field label="Deadline" value={fmtDate(contract.deadline)} />
              <Field label="Started" value={fmtDate(contract.startDate)} />
              <Field label="Completed" value={fmtDate(contract.completedAt)} />
              <Field label="Revisions" value={`${contract.revisions?.used ?? 0} / ${contract.revisions?.allowed ?? 2}`} />
            </dl>
            {contract.description && (
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{contract.description}</p>
            )}
          </SectionCard>

          {/* Milestones */}
          <SectionCard title="Milestones" icon={ClockIcon}>
            {contract.milestones?.length ? (
              <ul className="space-y-3">
                {contract.milestones.map((m) => (
                  <li key={m._id} className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.title}</p>
                      <p className="text-xs text-gray-400">{fmtDate(m.dueDate)} · {m.description || ''}</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatCurrency(m.amount, m.currency)}</span>
                      <Badge status={m.status}>{m.status?.replace(/_/g, ' ')}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No milestones have been created yet.</p>
            )}
          </SectionCard>

          {/* Deliverables */}
          <SectionCard
            title="Deliverables"
            icon={DocumentArrowUpIcon}
            action={canDeliver && (
              <button onClick={() => setShowDeliveryForm((v) => !v)} className="btn-primary btn-xs">
                {showDeliveryForm ? 'Close form' : 'Submit delivery'}
              </button>
            )}
          >
            {showDeliveryForm && canDeliver && (
              <form onSubmit={submitDelivery} className="mb-4 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg space-y-3">
                <textarea
                  value={deliveryMessage}
                  onChange={(e) => setDeliveryMessage(e.target.value)}
                  required
                  rows={3}
                  placeholder="Describe what you delivered…"
                  className="input w-full"
                />
                <input
                  type="file"
                  multiple
                  onChange={(e) => setDeliveryFiles([...e.target.files])}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-primary-600"
                />
                <button type="submit" disabled={submitMutation.isPending} className="btn-primary btn-sm flex items-center gap-1.5">
                  <PaperAirplaneIcon className="w-4 h-4" /> {submitMutation.isPending ? 'Submitting…' : 'Submit Delivery'}
                </button>
              </form>
            )}

            {contract.deliverables?.length ? (
              <ul className="space-y-3">
                {contract.deliverables.map((d) => (
                  <li key={d._id} className="border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200">{d.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Submitted {fmtDate(d.submittedAt)}</p>
                        {d.revisionNote && (
                          <p className="text-xs text-amber-600 mt-1">Revision note: {d.revisionNote}</p>
                        )}
                        {d.files?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {d.files.map((f, i) => (
                              <a key={i} href={f.url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded-md">
                                <PaperClipIcon className="w-3.5 h-3.5" /> {f.originalName || 'Attachment'}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <Badge status={d.status === 'pending' ? 'submitted' : d.status}>
                        {d.status === 'pending' ? 'Awaiting review' : d.status?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    {awaitingReview && String(d._id) === String(pendingDelivery?._id) && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => handleReview('approve')} disabled={reviewMutation.isPending} className="btn-success btn-xs">Approve & Release</button>
                        <button onClick={() => handleReview('request_revision')} disabled={reviewMutation.isPending} className="btn-outline btn-xs">Request Revision</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No deliverables submitted yet.</p>
            )}
          </SectionCard>

          {/* Timeline */}
          <SectionCard title="Activity Timeline" icon={ClockIcon}>
            {contract.timeline?.length ? (
              <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 space-y-4">
                {contract.timeline.map((ev, i) => (
                  <li key={i} className="ml-4">
                    <span className="absolute -left-1.5 mt-1 w-2.5 h-2.5 rounded-full bg-primary-500" />
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ev.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{ev.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{format(new Date(ev.at), 'MMM d, yyyy h:mm a')}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-400">No activity recorded yet.</p>
            )}
          </SectionCard>

          {/* Reviews */}
          <SectionCard title="Reviews" icon={StarIcon}>
            {contract.reviews?.length ? (
              <ul className="space-y-4">
                {contract.reviews.map((r) => (
                  <li key={r._id} className="border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {r.reviewer?.firstName} {r.reviewer?.lastName} ({r.reviewerRole})
                      </span>
                      <span className="text-xs text-amber-500">{'★'.repeat(r.rating?.overall || 0)}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{r.comment}</p>
                    {r.reply && <p className="text-xs text-gray-400 mt-1">Reply: {r.reply.content}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No reviews yet.</p>
            )}
          </SectionCard>
        </div>

        {/* ─── Sidebar ─── */}
        <div className="space-y-6">
          <SectionCard title="Payment & Escrow" icon={BanknotesIcon}>
            <dl className="space-y-3">
              <Field label="Payment status" value={contract.paymentStatus?.label} />
              <Field label="Agreed amount" value={formatCurrency(contract.amount, contract.currency)} />
              <Field label="Released to freelancer" value={formatCurrency(contract.paidAmount, contract.currency)} />
            </dl>
            {contract.escrow && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Escrow</p>
                <div className="flex items-center gap-2 mt-1">
                  <ShieldCheckIcon className="w-4 h-4 text-primary-500" />
                  <span className="text-sm font-medium capitalize">{contract.escrow.status?.replace(/_/g, ' ')}</span>
                  <span className="text-sm font-semibold ml-auto">{formatCurrency(contract.escrow.amount, contract.escrow.currency)}</span>
                </div>
                {contract.escrow.fundedAt && <p className="text-xs text-gray-400 mt-1">Funded {fmtDate(contract.escrow.fundedAt)}</p>}
                {contract.escrow.releasedAt && <p className="text-xs text-gray-400 mt-1">Released {fmtDate(contract.escrow.releasedAt)}</p>}
              </div>
            )}
            {!isFinalized && paymentKey === 'pending_payment' && (
              <button onClick={handleFund} disabled={fundMutation.isPending} className="btn-primary btn-sm w-full mt-4">
                Fund Escrow ({formatCurrency(contract.amount, contract.currency)})
              </button>
            )}
          </SectionCard>

          <SectionCard title="Dispute" icon={ExclamationTriangleIcon}>
            {contract.dispute?.isDisputed ? (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Under dispute</p>
                <p className="text-xs text-gray-500 mt-1">{contract.dispute.reason || 'A dispute is open on this contract.'}</p>
              </div>
            ) : canDispute ? (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400">Something wrong with this contract? Disputes keep funds locked in escrow while an admin reviews.</p>
                <button onClick={() => setShowDisputeModal(true)} className="btn-outline btn-sm text-red-500 w-full mt-3 flex items-center justify-center gap-1.5">
                  <ExclamationTriangleIcon className="w-4 h-4" /> Raise a Dispute
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-400">No dispute.</p>
            )}
          </SectionCard>

          {contract.recentMessages?.length > 0 && (
            <SectionCard title="Recent Messages" icon={PaperAirplaneIcon}>
              <ul className="space-y-3">
                {contract.recentMessages.slice(0, 5).map((m) => (
                  <li key={m._id} className="text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-200">{m.sender?.firstName}:</span>{' '}
                    <span className="text-gray-500 dark:text-gray-400">{m.content}</span>
                  </li>
                ))}
              </ul>
              {contract.conversationId && (
                <Link to={`/messages/${contract.conversationId}`} className="text-sm text-primary-600 mt-2 inline-block">Open chat →</Link>
              )}
            </SectionCard>
          )}
        </div>
      </div>

      {/* ─── Dispute modal ─── */}
      <Modal open={showDisputeModal} onClose={() => setShowDisputeModal(false)} title="Raise a Dispute">
        <form onSubmit={raiseDispute} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
            <select value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} className="input w-full mt-1">
              <option value="not_as_described">Work not as described</option>
              <option value="late_delivery">Late delivery</option>
              <option value="payment_issue">Payment issue</option>
              <option value="communication">Communication breakdown</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description (min 20 characters)</label>
            <textarea
              value={disputeDescription}
              onChange={(e) => setDisputeDescription(e.target.value)}
              required
              minLength={20}
              rows={4}
              className="input w-full mt-1"
              placeholder="Explain what went wrong. Funds stay locked in escrow while this is reviewed."
            />
          </div>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <ShieldCheckIcon className="w-4 h-4" /> While a dispute is open, escrow funds are frozen and cannot be released.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowDisputeModal(false)} className="btn-outline btn-sm">Cancel</button>
            <button type="submit" disabled={disputeMutation.isPending} className="btn-danger btn-sm">
              {disputeMutation.isPending ? 'Submitting…' : 'Raise Dispute'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
