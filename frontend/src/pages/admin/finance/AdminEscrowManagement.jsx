import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminFinanceService } from '@/services/adminFinance.service';
import { DataTable, KPICard, SelectFilter, ActionModal } from './components';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import {
  ShieldCheckIcon, CheckCircleIcon, ArrowUturnLeftIcon, ScaleIcon, ClockIcon,
  EyeIcon, EllipsisVerticalIcon, DocumentArrowDownIcon, ArrowTopRightOnSquareIcon,
  DocumentTextIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';

const ACTIVE_STATUSES = ['funded', 'in_progress', 'submitted'];

// Strictly the money/management actions valid for each escrow status,
// matching the backend escrow fund-service rules (release/refund are only
// allowed from eligible states; an expired escrow can still be refunded to
// unstick locked funds; pending/in_progress/released/refunded/cancelled
// expose no direct fund actions).
const STATUS_ACTIONS = {
  pending: [],
  funded: ['release', 'refund'],
  in_progress: [],
  submitted: ['release', 'refund'],
  disputed: ['resolve'],
  released: [],
  refunded: [],
  cancelled: [],
  expired: ['refund'],
};

const ACTION_META = {
  release: { label: 'Release Funds', icon: <CheckCircleIcon className="w-3.5 h-3.5" />, className: 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' },
  refund: { label: 'Refund to Client', icon: <ArrowUturnLeftIcon className="w-3.5 h-3.5" />, className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' },
  resolve: { label: 'Resolve Dispute', icon: <ScaleIcon className="w-3.5 h-3.5" />, className: 'text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20' },
};

const KPI_COLORS = {
  pending: { color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  funded: { color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  in_progress: { color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  submitted: { color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20' },
  released: { color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  refunded: { color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-dark-700' },
  disputed: { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  cancelled: { color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-dark-700' },
  expired: { color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-dark-700' },
};

const fmtDate = (d) => (d ? format(new Date(d), 'MMM d, yyyy') : '—');
const fmtTime = (d) => (d ? format(new Date(d), 'MMM d, yyyy HH:mm') : '—');

async function downloadReceipt(paymentId) {
  try {
    const response = await adminFinanceService.downloadInvoice(paymentId);
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${paymentId}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    toast.error('Failed to download invoice');
  }
}

function InfoBlock({ label, children }) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
      <p className="text-[11px] text-gray-400 uppercase font-medium">{label}</p>
      <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">{children || '—'}</div>
    </div>
  );
}

function EscrowActionModal({ escrow, action, onClose }) {
  const [notes, setNotes] = useState('');
  const [releaseTo, setReleaseTo] = useState('freelancer');
  const queryClient = useQueryClient();

  const config = {
    release: {
      title: 'Release Funds',
      confirm: 'Release Funds',
      desc: `Release ${formatCurrency(escrow.amount, escrow.currency)} to the freelancer.`,
      placeholder: 'Admin notes (optional)',
    },
    refund: {
      title: 'Refund to Client',
      confirm: 'Refund',
      desc: `Refund ${formatCurrency(escrow.amount, escrow.currency)} to the client's wallet.`,
      placeholder: 'Refund reason (optional)',
    },
    resolve: {
      title: 'Resolve Dispute',
      confirm: 'Resolve Dispute',
      desc: 'Resolve the dispute by releasing the funds to the freelancer or refunding the client.',
      placeholder: 'Resolution notes (optional)',
    },
  }[action];

  const mutation = useMutation({
    mutationFn: async () => {
      if (action === 'release') return adminFinanceService.releaseEscrow(escrow._id, { adminNotes: notes });
      if (action === 'refund') return adminFinanceService.refundEscrow(escrow._id, { adminNotes: notes });
      return adminFinanceService.resolveDispute(escrow._id, {
        resolution: releaseTo === 'freelancer' ? 'release' : 'refund',
        releaseTo,
        adminNotes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-finance-escrows']);
      queryClient.invalidateQueries(['admin-finance-escrow-stats']);
      queryClient.invalidateQueries(['admin-finance-disputes']);
      queryClient.invalidateQueries(['admin-finance-resolved-disputes']);
      queryClient.invalidateQueries(['admin-finance-refunds']);
      toast.success('Escrow updated');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Action failed'),
  });

  return (
    <ActionModal isOpen onClose={onClose} title={config.title}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">{config.desc}</p>

        {action === 'resolve' && (
          <div className="space-y-2 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-200">
              <input type="radio" name="releaseTo" checked={releaseTo === 'freelancer'} onChange={() => setReleaseTo('freelancer')} className="accent-primary-600" />
              Release to Freelancer
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-200">
              <input type="radio" name="releaseTo" checked={releaseTo === 'client'} onChange={() => setReleaseTo('client')} className="accent-primary-600" />
              Refund to Client
            </label>
          </div>
        )}

        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={config.placeholder}
          className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white resize-none" rows={3} />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Processing...' : config.confirm}
          </Button>
        </div>
      </div>
    </ActionModal>
  );
}

function TimelineModal({ escrowId, onClose }) {
  const { data } = useQuery({
    queryKey: ['escrow-timeline', escrowId],
    queryFn: () => adminFinanceService.getEscrowTimeline(escrowId).then(r => r.data),
  });
  const timeline = data?.data?.timeline || [];

  return (
    <ActionModal isOpen onClose={onClose} title="Escrow History / Timeline">
      <div className="space-y-4">
        {timeline.map((t, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white capitalize">{t.event?.replace(/_/g, ' ')}</p>
              <p className="text-[11px] text-gray-400">{t.details}</p>
              <p className="text-[11px] text-gray-400">{fmtTime(t.date)}</p>
            </div>
          </div>
        ))}
        {timeline.length === 0 && <p className="text-center text-sm text-gray-400 py-4">No timeline events</p>}
      </div>
    </ActionModal>
  );
}

function EscrowDetailModal({ escrow, onClose }) {
  const { data } = useQuery({
    queryKey: ['escrow-detail', escrow._id],
    queryFn: () => adminFinanceService.getEscrowTimeline(escrow._id).then(r => r.data),
  });

  const e = data?.data?.escrow || escrow;
  const timeline = data?.data?.timeline || [];
  const payment = e.paymentId;

  const transactions = [
    payment && { label: 'Payment', ref: payment.reference, invoice: payment.invoiceNumber, status: payment.status },
    e.fundingTransaction && { label: 'Funding', ref: e.fundingTransaction.reference, status: e.fundingTransaction.status },
    e.releaseTransaction && { label: 'Release', ref: e.releaseTransaction.reference, status: e.releaseTransaction.status },
    e.refundTransaction && { label: 'Refund', ref: e.refundTransaction.reference, status: e.refundTransaction.status },
  ].filter(Boolean);

  return (
    <ActionModal isOpen onClose={onClose} title="Escrow Details" size="lg">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-medium">Escrow ID</p>
            <p className="font-mono text-xs text-gray-900 dark:text-white mt-0.5 break-all">{e._id}</p>
          </div>
          <Badge status={e.status} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoBlock label="Client">
            <p>{e.client?.firstName} {e.client?.lastName}</p>
            <p className="text-[11px] font-normal text-gray-400">{e.client?.email}</p>
          </InfoBlock>
          <InfoBlock label="Freelancer">
            <p>{e.freelancer?.firstName} {e.freelancer?.lastName}</p>
            <p className="text-[11px] font-normal text-gray-400">{e.freelancer?.email}</p>
          </InfoBlock>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InfoBlock label="Related Project / Job">
            {e.project?.title ? (
              <Link to={`/projects/${e.project._id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary-600 hover:underline">
                {e.project.title} <ArrowTopRightOnSquareIcon className="w-3 h-3" />
              </Link>
            ) : e.serviceOrder?.title || e.serviceOrder?.orderNumber ? (
              <span>
                {e.serviceOrder.title || 'Service Order'}
                {e.serviceOrder.orderNumber ? ` · Order ${e.serviceOrder.orderNumber}` : ''}
              </span>
            ) : '—'}
          </InfoBlock>
          <InfoBlock label="Description">
            <span className="font-normal text-gray-600 dark:text-gray-300">{e.description || '—'}</span>
          </InfoBlock>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <InfoBlock label="Amount"><p className="text-green-600">{formatCurrency(e.amount, e.currency)}</p></InfoBlock>
          <InfoBlock label="Commission"><p className="text-primary-600">{formatCurrency(e.commissionAmount, e.currency)}</p></InfoBlock>
          <InfoBlock label="Freelancer Receives"><p className="text-blue-600">{formatCurrency(e.freelancerAmount, e.currency)}</p></InfoBlock>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <InfoBlock label="Created">{fmtTime(e.createdAt)}</InfoBlock>
          <InfoBlock label="Funded">{fmtTime(e.fundedAt)}</InfoBlock>
          <InfoBlock label="Expected Release">{fmtTime(e.expiresAt)}</InfoBlock>
          <InfoBlock label="Submitted">{fmtTime(e.submittedAt)}</InfoBlock>
          <InfoBlock label="Released">{fmtTime(e.releasedAt)}</InfoBlock>
          <InfoBlock label="Refunded">{fmtTime(e.refundedAt)}</InfoBlock>
        </div>

        {transactions.length > 0 && (
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-medium mb-1">Transactions</p>
            <div className="rounded-lg border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/40">
              {transactions.map(tx => (
                <div key={tx.label} className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-gray-500 capitalize">{tx.label}</span>
                  <div className="text-right">
                    <p className="text-xs font-mono text-gray-900 dark:text-white">{tx.ref || tx.invoice || '—'}</p>
                    {tx.invoice && <p className="text-[11px] text-primary-600">{tx.invoice}</p>}
                    {tx.status && <p className="text-[11px] text-gray-400 capitalize">{tx.status}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(e.disputeReason || e.disputeOpenedAt) && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40">
            <p className="text-xs font-semibold text-red-600 uppercase">Dispute</p>
            {e.disputeReason && <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{e.disputeReason}</p>}
            <p className="text-[11px] text-gray-500 mt-1">
              Opened: {fmtTime(e.disputeOpenedAt)}{e.disputeOpenedBy ? ` by ${e.disputeOpenedBy.firstName} ${e.disputeOpenedBy.lastName}` : ''}
            </p>
            {e.disputeResolvedAt && <p className="text-[11px] text-gray-500">Resolved: {fmtTime(e.disputeResolvedAt)}</p>}
          </div>
        )}

        {e.status === 'expired' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/40 text-sm text-yellow-700 dark:text-yellow-300">
            <InformationCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              This escrow expired on {fmtTime(e.expiresAt)}. If funds are still locked, refund them to the client to release the escrow balance.
            </span>
          </div>
        )}

        <div>
          <p className="text-[11px] text-gray-400 uppercase font-medium mb-2">History</p>
          <div className="space-y-3">
            {timeline.map((t, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-900 dark:text-white capitalize">{t.event?.replace(/_/g, ' ')}</p>
                  <p className="text-[11px] text-gray-400">{t.details}</p>
                  <p className="text-[11px] text-gray-400">{fmtTime(t.date)}</p>
                </div>
              </div>
            ))}
            {timeline.length === 0 && <p className="text-center text-sm text-gray-400 py-4">No history available</p>}
          </div>
        </div>

        {payment?._id && payment.invoiceNumber && (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => downloadReceipt(payment._id)} className="flex items-center gap-2">
              <DocumentArrowDownIcon className="w-4 h-4" />
              Download Receipt ({payment.invoiceNumber})
            </Button>
          </div>
        )}
      </div>
    </ActionModal>
  );
}

function EscrowTransactionsModal({ escrow, onClose }) {
  const rows = [
    escrow.fundingTransaction && {
      label: 'Funding / Hold', ref: escrow.fundingTransaction.reference,
      amount: escrow.amount, status: escrow.fundingTransaction.status, date: escrow.fundingTransaction.createdAt,
    },
    escrow.releaseTransaction && {
      label: 'Release to Freelancer', ref: escrow.releaseTransaction.reference,
      amount: escrow.freelancerAmount, status: escrow.releaseTransaction.status, date: escrow.releaseTransaction.createdAt,
    },
    escrow.refundTransaction && {
      label: 'Refund to Client', ref: escrow.refundTransaction.reference,
      amount: escrow.amount, status: escrow.refundTransaction.status, date: escrow.refundTransaction.createdAt,
    },
  ].filter(Boolean);

  return (
    <ActionModal isOpen onClose={onClose} title="Escrow Transactions" size="lg">
      <div className="space-y-4">
        <div>
          <p className="text-[11px] text-gray-400 uppercase font-medium">Escrow</p>
          <p className="font-mono text-xs text-gray-900 dark:text-white mt-0.5 break-all">{escrow._id}</p>
        </div>

        {rows.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">No transactions recorded for this escrow.</p>
        ) : (
          <div className="rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-dark-700">
                <tr>
                  {['Type', 'Reference', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 text-left uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
                {rows.map(tx => (
                  <tr key={tx.label}>
                    <td className="px-4 py-2 text-xs capitalize text-gray-700 dark:text-gray-200">{tx.label}</td>
                    <td className="px-4 py-2 text-xs font-mono text-gray-600 dark:text-gray-400">{tx.ref || '—'}</td>
                    <td className="px-4 py-2 text-xs font-medium text-gray-900 dark:text-white">{formatCurrency(tx.amount, escrow.currency)}</td>
                    <td className="px-4 py-2"><Badge status={tx.status} /></td>
                    <td className="px-4 py-2 text-xs text-gray-400">{fmtTime(tx.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ActionModal>
  );
}

function UserCell({ user }) {
  if (!user) return <span className="text-xs text-gray-300">—</span>;
  return (
    <div>
      <p className="text-xs font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</p>
      <p className="text-[11px] text-gray-400">{user.email}</p>
    </div>
  );
}

function ProjectCell({ escrow }) {
  if (escrow.project?.title) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{escrow.project.title}</p>
        {escrow.project.category && <p className="text-[11px] text-gray-400">{escrow.project.category}</p>}
      </div>
    );
  }
  if (escrow.serviceOrder?.title || escrow.serviceOrder?.orderNumber) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{escrow.serviceOrder.title || 'Service Order'}</p>
        {escrow.serviceOrder.orderNumber && <p className="text-[11px] text-gray-400">Order {escrow.serviceOrder.orderNumber}</p>}
      </div>
    );
  }
  return <span className="text-xs text-gray-300">—</span>;
}

function RefundDetailModal({ refund, onClose }) {
  const r = refund;
  return (
    <ActionModal isOpen onClose={onClose} title="Refund Details">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-medium">Refund ID</p>
            <p className="font-mono text-xs text-gray-900 dark:text-white mt-0.5 break-all">{r.reference}</p>
          </div>
          <Badge status={r.status} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoBlock label="Client">
            <p>{r.payer?.firstName} {r.payer?.lastName}</p>
            <p className="text-[11px] font-normal text-gray-400">{r.payer?.email}</p>
          </InfoBlock>
          <InfoBlock label="Freelancer">
            <p>{r.payee?.firstName} {r.payee?.lastName}</p>
            <p className="text-[11px] font-normal text-gray-400">{r.payee?.email}</p>
          </InfoBlock>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <InfoBlock label="Amount"><p className="text-red-600">{formatCurrency(r.amount, r.currency)}</p></InfoBlock>
          <InfoBlock label="Related Escrow">
            <p className="font-mono text-xs">{r.metadata?.escrowId ? String(r.metadata.escrowId).slice(-12) : '—'}</p>
          </InfoBlock>
          <InfoBlock label="Related Transaction">
            <p className="font-mono text-xs">{r.metadata?.transactionReference || r.providerTransactionRef || '—'}</p>
          </InfoBlock>
          <InfoBlock label="Reason">{r.refundReason || r.description || '—'}</InfoBlock>
          <InfoBlock label="Created">{fmtTime(r.createdAt)}</InfoBlock>
          {r.processedAt && <InfoBlock label="Processed">{fmtTime(r.processedAt)}</InfoBlock>}
        </div>
      </div>
    </ActionModal>
  );
}

function RefundActions({ refund }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-end">
        <button onClick={() => setOpen(true)} title="View Details"
          className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
          <EyeIcon className="w-4 h-4" />
        </button>
      </div>
      {open && <RefundDetailModal refund={refund} onClose={() => setOpen(false)} />}
    </>
  );
}

function DisputeActions({ escrow, resolved }) {
  const [detail, setDetail] = useState(false);
  const [resolve, setResolve] = useState(false);
  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <button onClick={() => setDetail(true)} title={resolved ? 'View Details' : 'Review Dispute'}
          className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
          <EyeIcon className="w-4 h-4" />
        </button>
        {!resolved && (
          <button onClick={() => setResolve(true)} title="Resolve Dispute"
            className="p-1.5 rounded-md text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
            <ScaleIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      {detail && <EscrowDetailModal escrow={escrow} onClose={() => setDetail(false)} />}
      {resolve && <EscrowActionModal escrow={escrow} action="resolve" onClose={() => setResolve(false)} />}
    </>
  );
}

function EscrowActionsMenu({ escrow, onDetails }) {
  const [menuPos, setMenuPos] = useState(null);
  const [action, setAction] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showTx, setShowTx] = useState(false);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!menuPos) return;
    const close = () => setMenuPos(null);
    const onKey = (e) => { if (e.key === 'Escape') setMenuPos(null); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuPos]);

  const validActions = STATUS_ACTIONS[escrow.status] || [];
  const hasProject = !!(escrow.project?._id && escrow.project.title);
  const payment = escrow.paymentId;
  const hasReceipt = !!(payment?._id && payment.invoiceNumber);
  const hasTx = !!(payment || escrow.fundingTransaction || escrow.releaseTransaction || escrow.refundTransaction);

  const toggle = () => {
    if (menuPos) { setMenuPos(null); return; }
    const rect = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 260 && spaceBelow < rect.top;
    setMenuPos({
      openUp,
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      right: window.innerWidth - rect.right,
      maxHeight: openUp ? Math.max(160, rect.top - 8) : Math.max(160, spaceBelow - 8),
    });
  };

  const close = () => setMenuPos(null);

  const itemClass = 'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left';
  const base = 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700';

  return (
    <>
      <div className="inline-flex justify-end">
        <button ref={btnRef} onClick={toggle} title="Actions"
          className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
          <EllipsisVerticalIcon className="w-4 h-4" />
        </button>
      </div>

      {menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="fixed z-50 w-56 bg-white dark:bg-dark-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-1.5 overflow-y-auto"
            style={{ top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right, maxHeight: menuPos.maxHeight }}>
            <button onClick={() => { close(); onDetails(escrow); }} className={clsx(itemClass, base)}>
              <EyeIcon className="w-3.5 h-3.5" /> View Details
            </button>
            {hasProject && (
              <Link to={`/projects/${escrow.project._id}`} target="_blank" rel="noopener noreferrer" onClick={close} className={clsx(itemClass, base)}>
                <DocumentTextIcon className="w-3.5 h-3.5" /> View Project / Job
              </Link>
            )}
            {hasTx && (
              <button onClick={() => { close(); setShowTx(true); }} className={clsx(itemClass, base)}>
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" /> View Transaction
              </button>
            )}
            <button onClick={() => { close(); setShowTimeline(true); }} className={clsx(itemClass, base)}>
              <ClockIcon className="w-3.5 h-3.5" /> View History / Timeline
            </button>

            {validActions.length > 0 && (
              <>
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                {validActions.map(action => (
                  <button key={action} onClick={() => { close(); setAction(action); }} className={clsx(itemClass, ACTION_META[action].className)}>
                    {ACTION_META[action].icon} {ACTION_META[action].label}
                  </button>
                ))}
              </>
            )}

            {hasReceipt && (
              <>
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                <button onClick={() => { close(); downloadReceipt(payment._id); }} className={clsx(itemClass, base)}>
                  <DocumentArrowDownIcon className="w-3.5 h-3.5" /> Download Receipt
                </button>
              </>
            )}
          </div>
        </>,
        document.body
      )}

      {showTimeline && createPortal(<TimelineModal escrowId={escrow._id} onClose={() => setShowTimeline(false)} />, document.body)}
      {showTx && createPortal(<EscrowTransactionsModal escrow={escrow} onClose={() => setShowTx(false)} />, document.body)}
      {action && createPortal(<EscrowActionModal escrow={escrow} action={action} onClose={() => setAction(null)} />, document.body)}
    </>
  );
}

export default function AdminEscrowManagement() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || undefined);
  const [detailEscrow, setDetailEscrow] = useState(null);
  const [disputePage, setDisputePage] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(1);

  const filters = useMemo(() => {
    const f = {};
    if (statusFilter === 'active') f.status = ACTIVE_STATUSES.join(',');
    else if (statusFilter) f.status = statusFilter;
    return f;
  }, [statusFilter]);

  const { data: escrowData, isLoading: escrowLoading } = useQuery({
    queryKey: ['admin-finance-escrows', page, filters],
    queryFn: () => adminFinanceService.getEscrows({ page, limit: 15, ...filters }).then(r => r.data),
  });

  const { data: escrowStats } = useQuery({
    queryKey: ['admin-finance-escrow-stats'],
    queryFn: () => adminFinanceService.getEscrowStats().then(r => r.data),
  });

  const { data: refundData } = useQuery({
    queryKey: ['admin-finance-refunds'],
    queryFn: () => adminFinanceService.getRefundDashboard().then(r => r.data),
  });

  const { data: disputesData } = useQuery({
    queryKey: ['admin-finance-disputes', disputePage],
    queryFn: () => adminFinanceService.getDisputes({ page: disputePage, limit: 10 }).then(r => r.data),
  });

  const { data: resolvedData } = useQuery({
    queryKey: ['admin-finance-resolved-disputes', resolvedPage],
    queryFn: () => adminFinanceService.getDisputes({ page: resolvedPage, limit: 10, resolved: true }).then(r => r.data),
  });

  const pendingRefunds = refundData?.data?.pending || [];
  const pendingRefundStats = (refundData?.data?.stats || []).filter(s => ['pending', 'processing'].includes(s._id));
  const pendingRefundCount = pendingRefundStats.reduce((sum, s) => sum + (s.count || 0), 0) || pendingRefunds.length;
  const pendingRefundAmount = pendingRefundStats.reduce((sum, s) => sum + (s.total || 0), 0) || pendingRefunds.reduce((sum, r) => sum + (r.amount || 0), 0);

  const activeDisputes = disputesData?.data || [];
  const activeDisputeCount = disputesData?.meta?.total || 0;
  const activeDisputeStats = (escrowStats?.data || []).find(s => s._id === 'disputed');
  const activeDisputeAmount = activeDisputeStats?.total || activeDisputes.reduce((sum, d) => sum + (d.amount || 0), 0);

  const resolvedDisputes = resolvedData?.data || [];
  const resolvedCount = resolvedData?.meta?.total || 0;
  const resolvedAmount = resolvedDisputes.reduce((sum, d) => sum + (d.amount || 0), 0);

  const columns = [
    {
      key: 'client', label: 'Client',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-xs">{r.client?.firstName} {r.client?.lastName}</p>
          <p className="text-[11px] text-gray-400">{r.client?.email}</p>
        </div>
      ),
    },
    {
      key: 'freelancer', label: 'Freelancer',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-xs">{r.freelancer?.firstName} {r.freelancer?.lastName}</p>
          <p className="text-[11px] text-gray-400">{r.freelancer?.email}</p>
        </div>
      ),
    },
    {
      key: 'project', label: 'Project / Job',
      render: (r) => {
        if (r.project?.title) {
          return (
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[220px]">{r.project.title}</p>
              {r.project.category && <p className="text-[11px] text-gray-400">{r.project.category}</p>}
            </div>
          );
        }
        if (r.serviceOrder?.title || r.serviceOrder?.orderNumber) {
          return (
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[220px]">{r.serviceOrder.title || 'Service Order'}</p>
              {r.serviceOrder.orderNumber && <p className="text-[11px] text-gray-400">Order {r.serviceOrder.orderNumber}</p>}
            </div>
          );
        }
        return <span className="text-xs text-gray-300">—</span>;
      },
    },
    {
      key: 'amount', label: 'Amount', align: 'right',
      render: (r) => <span className="font-bold text-xs">{formatCurrency(r.amount, r.currency)}</span>,
    },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'createdAt', label: 'Created',
      render: (r) => <span className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(r.createdAt)}</span>,
    },
    {
      key: 'expectedRelease', label: 'Expected / Release',
      render: (r) => {
        if (r.releasedAt) {
          return (
            <div>
              <p className="text-xs font-medium text-green-600">Released</p>
              <p className="text-[11px] text-gray-400">{fmtDate(r.releasedAt)}</p>
            </div>
          );
        }
        if (r.expiresAt) {
          return (
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300">Expected</p>
              <p className="text-[11px] text-gray-400">{fmtDate(r.expiresAt)}</p>
            </div>
          );
        }
        return <span className="text-xs text-gray-300">—</span>;
      },
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => <EscrowActionsMenu escrow={r} onDetails={setDetailEscrow} />,
    },
  ];

  const refundColumns = [
    {
      key: 'reference', label: 'Refund ID',
      render: (r) => <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{r.reference?.slice(-12)}</span>,
    },
    { key: 'payer', label: 'Client', render: (r) => <UserCell user={r.payer} /> },
    { key: 'payee', label: 'Freelancer', render: (r) => <UserCell user={r.payee} /> },
    {
      key: 'escrow', label: 'Related Escrow',
      render: (r) => <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{r.metadata?.escrowId ? String(r.metadata.escrowId).slice(-12) : '—'}</span>,
    },
    {
      key: 'transaction', label: 'Related Transaction',
      render: (r) => <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{r.metadata?.transactionReference || r.providerTransactionRef || '—'}</span>,
    },
    {
      key: 'amount', label: 'Amount', align: 'right',
      render: (r) => <span className="text-xs font-bold text-red-600">{formatCurrency(r.amount, r.currency)}</span>,
    },
    {
      key: 'reason', label: 'Reason',
      render: (r) => <span className="text-xs text-gray-500 truncate max-w-[180px] block">{r.refundReason || r.description || '—'}</span>,
    },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'createdAt', label: 'Created',
      render: (r) => <span className="text-xs text-gray-400">{fmtDate(r.createdAt)}</span>,
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => <RefundActions refund={r} />,
    },
  ];

  const makeDisputeColumns = (resolved) => [
    {
      key: 'reference', label: 'Dispute ID',
      render: (r) => <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{r._id?.slice(-12)}</span>,
    },
    { key: 'client', label: 'Client', render: (r) => <UserCell user={r.client} /> },
    { key: 'freelancer', label: 'Freelancer', render: (r) => <UserCell user={r.freelancer} /> },
    { key: 'project', label: 'Related Project / Order', render: (r) => <ProjectCell escrow={r} /> },
    {
      key: 'amount', label: 'Escrow Amount', align: 'right',
      render: (r) => <span className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(r.amount, r.currency)}</span>,
    },
    {
      key: 'reason', label: 'Reason',
      render: (r) => <span className="text-xs text-gray-500 truncate max-w-[180px] block">{r.disputeReason || '—'}</span>,
    },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'createdAt', label: 'Created',
      render: (r) => <span className="text-xs text-gray-400">{fmtDate(r.disputeOpenedAt || r.createdAt)}</span>,
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => <DisputeActions escrow={r} resolved={resolved} />,
    },
  ];

  const disputeColumns = makeDisputeColumns(false);
  const resolvedDisputeColumns = makeDisputeColumns(true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Escrow Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage escrow funds and dispute resolution</p>
      </div>

      {escrowStats?.data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {escrowStats.data.map(s => {
            const style = KPI_COLORS[s._id] || { color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' };
            return (
              <KPICard key={s._id} label={s._id?.replace(/_/g, ' ')} value={formatCurrency(s.total)} icon={ShieldCheckIcon}
                color={style.color} bg={style.bg} sub={`${s.count} contract${s.count === 1 ? '' : 's'}`} />
            );
          })}
        </div>
      )}

      <div className="card p-4 flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</span>
        <SelectFilter
          label="All Status"
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={['active', 'pending', 'funded', 'in_progress', 'submitted', 'released', 'refunded', 'disputed', 'cancelled', 'expired']} />
      </div>

      <div className="card overflow-hidden">
        <DataTable loading={escrowLoading} columns={columns} data={escrowData?.data || []} emptyMessage="No escrows found" />
        {escrowData?.meta && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <Pagination meta={escrowData.meta} onPageChange={setPage} />
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Refunds & Disputes</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage refunds, active disputes and resolved disputes</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KPICard label="Pending Refunds" value={pendingRefundCount} icon={ArrowUturnLeftIcon}
            color="text-yellow-600" bg="bg-yellow-50 dark:bg-yellow-900/20" delay={0}
            sub={pendingRefundAmount ? `${formatCurrency(pendingRefundAmount)} total` : `${pendingRefundCount} request${pendingRefundCount === 1 ? '' : 's'}`} />
          <KPICard label="Active Disputes" value={activeDisputeCount} icon={ScaleIcon}
            color="text-red-600" bg="bg-red-50 dark:bg-red-900/20" delay={1}
            sub={activeDisputeAmount ? `${formatCurrency(activeDisputeAmount)} held` : `${activeDisputeCount} dispute${activeDisputeCount === 1 ? '' : 's'}`} />
          <KPICard label="Resolved Disputes" value={resolvedCount} icon={CheckCircleIcon}
            color="text-green-600" bg="bg-green-50 dark:bg-green-900/20" delay={2}
            sub={resolvedAmount ? `${formatCurrency(resolvedAmount)} resolved` : `${resolvedCount} dispute${resolvedCount === 1 ? '' : 's'}`} />
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
            <ArrowUturnLeftIcon className="w-5 h-5 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Pending Refunds</h3>
              <p className="text-xs text-gray-400 mt-0.5">Awaiting admin review</p>
            </div>
          </div>
          <DataTable loading={!refundData} columns={refundColumns} data={pendingRefunds} emptyMessage="No pending refunds" />
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
            <ScaleIcon className="w-5 h-5 text-red-500" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Active Disputes</h3>
              <p className="text-xs text-gray-400 mt-0.5">Escrows under dispute</p>
            </div>
          </div>
          <DataTable loading={!disputesData} columns={disputeColumns} data={activeDisputes} emptyMessage="No active disputes" />
          {disputesData?.meta && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <Pagination meta={disputesData.meta} onPageChange={setDisputePage} />
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-500" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Resolved Disputes</h3>
              <p className="text-xs text-gray-400 mt-0.5">Disputes that have been resolved</p>
            </div>
          </div>
          <DataTable loading={!resolvedData} columns={resolvedDisputeColumns} data={resolvedDisputes} emptyMessage="No resolved disputes" />
          {resolvedData?.meta && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <Pagination meta={resolvedData.meta} onPageChange={setResolvedPage} />
            </div>
          )}
        </div>
      </div>

      {detailEscrow && <EscrowDetailModal escrow={detailEscrow} onClose={() => setDetailEscrow(null)} />}
    </div>
  );
}
