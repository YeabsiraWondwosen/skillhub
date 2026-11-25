import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminFinanceService } from '@/services/adminFinance.service';
import { DataTable, KPICard, SelectFilter, GatewayIcon, ActionModal, SearchInput } from './components';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import { useConfirm, usePrompt } from '@/components/ui/DialogProvider';
import { format } from 'date-fns';
import {
  BanknotesIcon, EyeIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const METHOD_OPTIONS = ['bank_transfer', 'paypal', 'stripe', 'chapa', 'telebirr', 'cbe_birr'];

const ACCOUNT_DETAIL_KEYS = ['bankName', 'accountName', 'accountNumber', 'email', 'phone', 'phoneNumber', 'holderName', 'destination', 'walletAddress'];

const COUNTERS = [
  { label: 'Total', status: undefined },
  { label: 'Pending', status: 'pending' },
  { label: 'Processing', status: 'processing' },
  { label: 'Completed', status: 'completed' },
  { label: 'Failed', status: 'failed' },
  { label: 'Cancelled', status: 'cancelled' },
];

const COUNTER_COLORS = {
  completed: { color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  failed: { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  cancelled: { color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-dark-700' },
  pending: { color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  processing: { color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
};

const fmtDate = (d) => (d ? format(new Date(d), 'MMM d, yyyy HH:mm') : '—');

function formatAccountDetails(details) {
  if (!details) return null;
  if (typeof details === 'string') return details;
  const parts = ACCOUNT_DETAIL_KEYS
    .map(k => details[k])
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '');
  return parts.length ? parts.join(' · ') : null;
}

function WithdrawalDetailModal({ withdrawal, onClose }) {
  if (!withdrawal) return null;
  const w = withdrawal;
  const destination = formatAccountDetails(w.metadata?.details);

  const timeline = [
    { label: 'Requested', value: fmtDate(w.createdAt) },
    { label: w.status === 'processing' ? 'Processing' : 'Processed', value: fmtDate(w.processedAt || w.metadata?.failedAt) },
  ];
  if (w.status === 'failed' && w.failureReason) timeline.push({ label: 'Failed', value: w.failureReason });
  if (w.metadata?.adminNotes) timeline.push({ label: 'Admin Notes', value: w.metadata.adminNotes });

  return (
    <ActionModal isOpen onClose={onClose} title="Withdrawal Details" size="lg">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-medium">Withdrawal ID</p>
            <p className="font-mono text-xs text-gray-900 dark:text-white mt-0.5 break-all">{w.reference}</p>
          </div>
          <Badge status={w.status} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Freelancer</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
              {w.payer?.firstName ? `${w.payer.firstName} ${w.payer.lastName}` : '—'}
            </p>
            <p className="text-[11px] text-gray-400">{w.payer?.email || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Withdrawal Method</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1 inline-flex items-center gap-1">
              <GatewayIcon provider={w.metadata?.method} className="w-3.5 h-3.5" /> {(w.metadata?.method || w.provider || '').replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
            <p className="text-[11px] text-blue-600 uppercase font-medium">Amount</p>
            <p className="text-sm font-bold text-blue-700 dark:text-blue-400 mt-1">{formatCurrency(w.amount, w.currency)}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg text-center">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Fee</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{formatCurrency(w.fee, w.currency)}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg text-center">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Net Amount</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{formatCurrency(w.netAmount ?? w.amount, w.currency)}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg text-center">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Requested</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{format(new Date(w.createdAt), 'MMM d, yyyy')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Destination / Account</p>
            <p className="text-sm text-gray-900 dark:text-white mt-1 break-words">{destination || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Description</p>
            <p className="text-sm text-gray-900 dark:text-white mt-1">{w.description || '—'}</p>
          </div>
        </div>

        <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
          <p className="text-[11px] text-gray-400 uppercase font-medium">Transaction ID</p>
          <div className="flex items-center justify-between gap-4 mt-1">
            <p className="font-mono text-xs text-gray-900 dark:text-white break-all">{w.reference}</p>
            <Link to="/admin/finance/transactions" className="text-[11px] font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 shrink-0">
              View in Transactions
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/40">
          {timeline.map((t, i) => (
            <div key={i} className="flex items-start justify-between px-3 py-2">
              <div>
                <p className="text-[11px] text-gray-400 uppercase font-medium">{t.label}</p>
                <p className="text-xs font-medium text-gray-900 dark:text-white mt-0.5">{t.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ActionModal>
  );
}

function WithdrawalActions({ withdrawal }) {
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState(null);
  const confirm = useConfirm();
  const prompt = usePrompt();

  const processMutation = useMutation({
    mutationFn: ({ action, adminNotes, failureReason }) =>
      adminFinanceService.processWithdrawal(withdrawal._id, { action, adminNotes, failureReason }),
    onSuccess: () => queryClient.invalidateQueries(['admin-finance-withdrawals']),
  });

  const retryMutation = useMutation({
    mutationFn: () => adminFinanceService.retryWithdrawal(withdrawal._id),
    onSuccess: () => queryClient.invalidateQueries(['admin-finance-withdrawals']),
  });

  const handleApprove = async () => {
    const notes = await prompt({
      title: 'Approve withdrawal',
      message: `Approve this withdrawal of ${formatCurrency(withdrawal.amount, withdrawal.currency)}? The freelancer will be paid out.`,
      label: 'Approval notes (optional)',
      placeholder: 'Approved',
      confirmLabel: 'Approve',
    });
    if (notes === null) return;
    processMutation.mutate({ action: 'approve', adminNotes: notes.trim() || 'Approved' });
  };

  const handleReject = async () => {
    const reason = await prompt({
      title: 'Reject withdrawal',
      message: `Reject this withdrawal of ${formatCurrency(withdrawal.amount, withdrawal.currency)}? The funds will be returned to the freelancer's balance.`,
      label: 'Rejection reason',
      placeholder: 'e.g. Invalid payout account details',
      required: true,
      requiredMessage: 'A rejection reason is required.',
      multiline: true,
      rows: 3,
      confirmLabel: 'Continue',
      destructive: true,
    });
    if (reason === null) return;

    const notes = await prompt({
      title: 'Admin notes',
      message: 'Add any internal notes about this decision (optional).',
      label: 'Admin notes (optional)',
      multiline: true,
      rows: 3,
      confirmLabel: 'Reject withdrawal',
      destructive: true,
    });
    if (notes === null) return;

    processMutation.mutate({ action: 'reject', adminNotes: notes.trim(), failureReason: reason.trim() });
  };

  const handleRetry = async () => {
    const ok = await confirm({
      title: 'Retry withdrawal',
      message: 'Retry this failed withdrawal?',
      confirmLabel: 'Retry',
    });
    if (ok) retryMutation.mutate();
  };

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <button onClick={() => setDetail(withdrawal)} title="View Details"
          className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
          <EyeIcon className="w-4 h-4" />
        </button>
        {['pending', 'processing'].includes(withdrawal.status) && (
          <>
            <button onClick={handleApprove} disabled={processMutation.isPending} title="Approve / Process"
              className="p-1.5 rounded-md text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50">
              <CheckCircleIcon className="w-4 h-4" />
            </button>
            <button onClick={handleReject} disabled={processMutation.isPending} title="Reject / Cancel"
              className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
              <XCircleIcon className="w-4 h-4" />
            </button>
          </>
        )}
        {withdrawal.status === 'failed' && (
          <button onClick={handleRetry} disabled={retryMutation.isPending} title="Retry"
            className="p-1.5 rounded-md text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50">
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      {detail && <WithdrawalDetailModal withdrawal={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

export default function AdminWithdrawals() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [methodFilter, setMethodFilter] = useState(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  const filters = useMemo(() => {
    const f = {};
    if (statusFilter) f.status = statusFilter;
    if (methodFilter) f.method = methodFilter;
    return f;
  }, [statusFilter, methodFilter]);

  const { data: withdrawalsData, isLoading: withdrawalsLoading } = useQuery({
    queryKey: ['admin-finance-withdrawals', page, filters, searchQuery],
    queryFn: () => adminFinanceService.getWithdrawals({ page, limit: 15, q: searchQuery || undefined, ...filters }).then(r => r.data),
  });

  const { data: withdrawalStats } = useQuery({
    queryKey: ['admin-finance-wd-stats'],
    queryFn: () => adminFinanceService.getWithdrawalStats().then(r => r.data),
  });

  const st = withdrawalStats?.data;
  const statusMap = useMemo(() => {
    const m = {};
    (st?.byStatus || []).forEach(s => { m[s._id] = s; });
    return m;
  }, [st]);

  const resetFilters = useCallback(() => {
    setStatusFilter(undefined);
    setMethodFilter(undefined);
    setSearchQuery('');
    setPage(1);
  }, []);

  const columns = [
    {
      key: 'reference', label: 'Withdrawal ID',
      render: (r) => <span title={r.reference} className="text-xs font-mono text-gray-600 dark:text-gray-400">{r.reference?.slice(-12)}</span>,
    },
    {
      key: 'payer', label: 'Freelancer',
      render: (r) => (
        <div>
          <p className="text-xs font-medium text-gray-900 dark:text-white">{r.payer?.firstName ? `${r.payer.firstName} ${r.payer.lastName}` : '—'}</p>
          <p className="text-[11px] text-gray-400">{r.payer?.email || '—'}</p>
        </div>
      ),
    },
    {
      key: 'amount', label: 'Amount', align: 'right',
      render: (r) => <span className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(r.amount, r.currency)}</span>,
    },
    {
      key: 'method', label: 'Method',
      render: (r) => <span className="text-xs inline-flex items-center gap-1 capitalize"><GatewayIcon provider={r.metadata?.method || r.provider} className="w-3.5 h-3.5" /> {(r.metadata?.method || r.provider || '').replace(/_/g, ' ')}</span>,
    },
    {
      key: 'destination', label: 'Destination',
      render: (r) => {
        const d = formatAccountDetails(r.metadata?.details);
        return <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[160px] block">{d || '—'}</span>;
      },
    },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'createdAt', label: 'Requested',
      render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy')}</span>,
    },
    {
      key: 'processedAt', label: 'Processed',
      render: (r) => <span className="text-xs text-gray-400">{r.processedAt ? format(new Date(r.processedAt), 'MMM d, yyyy') : '—'}</span>,
    },
    {
      key: 'txRef', label: 'Transaction ID',
      render: (r) => <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{r.reference?.slice(-12)}</span>,
    },
    {
      key: 'actions', label: 'Actions', align: 'right',
      render: (r) => <WithdrawalActions withdrawal={r} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Withdrawals</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage freelancer withdrawal requests</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {COUNTERS.map(c => {
          const s = c.status ? (statusMap[c.status] || { count: 0, total: 0 }) : { count: (st?.byStatus || []).reduce((sum, x) => sum + x.count, 0), total: (st?.byStatus || []).reduce((sum, x) => sum + x.total, 0) };
          const style = c.status ? COUNTER_COLORS[c.status] : { color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-dark-700' };
          return (
            <KPICard key={c.label} label={c.label} value={s.total ? formatCurrency(s.total) : s.count}
              icon={BanknotesIcon} color={style.color} bg={style.bg} sub={`${s.count || 0} request${(s.count || 0) === 1 ? '' : 's'}`}
              onClick={() => { setStatusFilter(c.status); setPage(1); }} />
          );
        })}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(1); }} placeholder="Search by ID, name, email, description..." />
          <SelectFilter label="All Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUS_OPTIONS} />
          <select value={methodFilter || ''} onChange={e => { setMethodFilter(e.target.value || undefined); setPage(1); }}
            className="px-3 py-2 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300">
            <option value="">All Methods</option>
            {METHOD_OPTIONS.map(m => (
              <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
            ))}
          </select>
          {(searchQuery || statusFilter || methodFilter) && (
            <button onClick={resetFilters} className="px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <DataTable loading={withdrawalsLoading} columns={columns} data={withdrawalsData?.data || []} emptyMessage="No withdrawals found" />
        {withdrawalsData?.meta && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <Pagination meta={withdrawalsData.meta} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
