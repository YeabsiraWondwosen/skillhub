import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminFinanceService } from '@/services/adminFinance.service';
import {
  DataTable, DateRangeFilter, FilterPills, SelectFilter, SearchInput,
  ActionModal, SectionHeader, GatewayIcon, GATEWAYS,
} from './components';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import {
  ArrowPathIcon, DocumentArrowDownIcon, EyeIcon, FunnelIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';

const TYPE_FILTERS = [
  { label: 'All Types', value: '' },
  { label: 'Deposit', value: 'deposit' },
  { label: 'Withdrawal', value: 'withdrawal' },
  { label: 'Escrow', value: 'escrow' },
  { label: 'Escrow Release', value: 'escrow_release' },
  { label: 'Refund', value: 'refund' },
  { label: 'Milestone', value: 'milestone_payment' },
  { label: 'Project', value: 'project_payment' },
];

const STATUS_FILTERS = [
  { label: 'All Status', value: '' },
  { label: 'Completed', value: 'completed' },
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Failed', value: 'failed' },
  { label: 'Refunded', value: 'refunded' },
  { label: 'Cancelled', value: 'cancelled' },
];

async function downloadInvoice(paymentId) {
  const response = await adminFinanceService.downloadInvoice(paymentId);
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${paymentId}.pdf`;
  a.click();
  window.URL.revokeObjectURL(url);
}

function TransactionDetail({ transaction, onClose }) {
  if (!transaction) return null;
  const t = transaction;
  const netAmount = (t.amount || 0) - (t.commission || 0) - (t.gatewayFee || 0);
  return (
    <ActionModal isOpen={!!transaction} onClose={onClose} title="Transaction Details" size="lg">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Transaction ID</p>
            <p className="text-xs font-mono text-gray-500 mt-0.5">{t.reference}</p>
          </div>
          <Badge status={t.status} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Client</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{t.payer?.firstName} {t.payer?.lastName}</p>
            <p className="text-[11px] text-gray-400">{t.payer?.email}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Freelancer</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{t.payee?.firstName ? `${t.payee.firstName} ${t.payee.lastName}` : '—'}</p>
            <p className="text-[11px] text-gray-400">{t.payee?.email || '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Transaction Type</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1 capitalize">{t.type?.replace(/_/g, ' ')}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Payment Gateway</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1 inline-flex items-center gap-1"><GatewayIcon provider={t.provider} className="w-3.5 h-3.5" /> {t.provider}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
            <p className="text-[11px] text-green-600 uppercase font-medium">Amount</p>
            <p className="text-sm font-bold text-green-700 dark:text-green-400 mt-1">{formatCurrency(t.amount, t.currency)}</p>
          </div>
          <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-center">
            <p className="text-[11px] text-primary-600 uppercase font-medium">Commission</p>
            <p className="text-sm font-bold text-primary-700 dark:text-primary-400 mt-1">{formatCurrency(t.commission, t.currency)}</p>
          </div>
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
            <p className="text-[11px] text-orange-600 uppercase font-medium">Gateway Fee</p>
            <p className="text-sm font-bold text-orange-700 dark:text-orange-400 mt-1">{formatCurrency(t.gatewayFee, t.currency)}</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
            <p className="text-[11px] text-blue-600 uppercase font-medium">Net Amount</p>
            <p className="text-sm font-bold text-blue-700 dark:text-blue-400 mt-1">{formatCurrency(netAmount, t.currency)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Date & Time</p>
            <p className="text-sm text-gray-900 dark:text-white mt-1">{format(new Date(t.createdAt), 'MMM d, yyyy HH:mm:ss')}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Description</p>
            <p className="text-sm text-gray-900 dark:text-white mt-1">{t.description || '—'}</p>
          </div>
        </div>

        {t.invoiceNumber && (
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
            <p className="text-[11px] text-gray-400 uppercase font-medium">Invoice Number</p>
            <div className="flex items-center justify-between gap-4 mt-1">
              <p className="text-sm font-medium font-mono text-gray-900 dark:text-white">{t.invoiceNumber}</p>
              <Button variant="ghost" onClick={() => downloadInvoice(t._id)} className="flex items-center gap-2">
                <DocumentArrowDownIcon className="w-4 h-4" />
                Download PDF
              </Button>
            </div>
          </div>
        )}
      </div>
    </ActionModal>
  );
}

export default function AdminTransactions() {
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [gatewayFilter, setGatewayFilter] = useState(undefined);
  const [detailTx, setDetailTx] = useState(null);

  const dateParams = useMemo(() => {
    const p = {};
    if (dateRange.startDate) p.startDate = dateRange.startDate;
    if (dateRange.endDate) p.endDate = dateRange.endDate;
    return p;
  }, [dateRange]);

  const filters = useMemo(() => {
    const f = {};
    if (typeFilter) f.type = typeFilter;
    if (statusFilter) f.status = statusFilter;
    if (gatewayFilter) f.provider = gatewayFilter;
    return f;
  }, [typeFilter, statusFilter, gatewayFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-finance-transactions', page, filters, searchQuery, dateParams],
    queryFn: () => {
      if (searchQuery) return adminFinanceService.searchPayments({ page, limit: 15, includeDemo: true, q: searchQuery, ...filters, ...dateParams }).then(r => r.data);
      return adminFinanceService.getPayments({ page, limit: 15, includeDemo: true, ...filters, ...dateParams }).then(r => r.data);
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-finance-tx-stats', dateParams],
    queryFn: () => adminFinanceService.getPaymentStats({ ...dateParams, includeDemo: true }).then(r => r.data),
  });

  const payments = data?.data ?? [];
  const meta = data?.meta;
  const st = stats?.data;

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setTypeFilter(undefined);
    setStatusFilter(undefined);
    setGatewayFilter(undefined);
    setDateRange({ startDate: '', endDate: '' });
    setPage(1);
  }, []);

  const columns = [
    {
      key: 'reference', label: 'TX ID',
      render: (r) => <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{r.reference?.slice(-12)}</span>,
    },
    {
      key: 'payer', label: 'Client',
      render: (r) => (
        <div>
          <p className="text-xs font-medium text-gray-900 dark:text-white">{r.payer?.firstName} {r.payer?.lastName}</p>
          <p className="text-[11px] text-gray-400">{r.payer?.email}</p>
        </div>
      ),
    },
    {
      key: 'payee', label: 'Freelancer',
      render: (r) => (
        <div>
          <p className="text-xs font-medium text-gray-900 dark:text-white">{r.payee?.firstName ? `${r.payee.firstName} ${r.payee.lastName}` : '—'}</p>
          <p className="text-[11px] text-gray-400">{r.payee?.email || '—'}</p>
        </div>
      ),
    },
    {
      key: 'type', label: 'Type',
      render: (r) => (
        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize',
          r.type === 'deposit' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
          r.type === 'withdrawal' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
          r.type === 'refund' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
          r.type === 'commission' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' :
          r.type?.includes('escrow') ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
          'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
        )}>
          {r.type?.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'provider', label: 'Gateway',
      render: (r) => <span className="text-xs inline-flex items-center gap-1"><GatewayIcon provider={r.provider} className="w-3.5 h-3.5" /> {r.provider}</span>,
    },
    {
      key: 'amount', label: 'Amount', align: 'right',
      render: (r) => <span className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(r.amount, r.currency)}</span>,
    },
    {
      key: 'commission', label: 'Commission', align: 'right',
      render: (r) => <span className="text-xs font-semibold text-green-600">{formatCurrency(r.commission, r.currency)}</span>,
    },
    {
      key: 'gatewayFee', label: 'Gateway Fee', align: 'right',
      render: (r) => <span className="text-xs text-orange-600">{formatCurrency(r.gatewayFee, r.currency)}</span>,
    },
    {
      key: 'netAmount', label: 'Net Amount', align: 'right',
      render: (r) => {
        const net = (r.amount || 0) - (r.commission || 0) - (r.gatewayFee || 0);
        return <span className="text-xs font-semibold text-blue-600">{formatCurrency(net, r.currency)}</span>;
      },
    },
    {
      key: 'status', label: 'Status',
      render: (r) => <Badge status={r.status} />,
    },
    {
      key: 'createdAt', label: 'Date & Time',
      render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy HH:mm')}</span>,
    },
    {
      key: 'actions', label: 'Actions', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.invoiceNumber ? (
            <button onClick={() => downloadInvoice(r._id)} title={`Download invoice ${r.invoiceNumber}`}
              className="text-[11px] font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
              <DocumentArrowDownIcon className="w-3.5 h-3.5" /> Download
            </button>
          ) : (
            <span className="text-[11px] text-gray-300 px-2">—</span>
          )}
          <button onClick={() => setDetailTx(r)} title="View Details"
            className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
            <EyeIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const hasActiveFilters = typeFilter || statusFilter || gatewayFilter || searchQuery || dateRange.startDate || dateRange.endDate;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transaction Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {meta?.total ? `${meta.total.toLocaleString()} total transactions` : 'Manage all platform transactions'}
          </p>
        </div>
        <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />
      </div>

      {st && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total', status: undefined, value: st.total || 0, color: 'text-gray-900 dark:text-white' },
            { label: 'Completed', status: 'completed', value: st.completed || 0, color: 'text-green-600' },
            { label: 'Pending', status: 'pending', value: st.pending || 0, color: 'text-yellow-600' },
            { label: 'Processing', status: 'processing', value: st.processing || 0, color: 'text-blue-600' },
            { label: 'Failed', status: 'failed', value: st.failed || 0, color: 'text-red-600' },
          ].map(s => (
            <button
              key={s.label}
              type="button"
              onClick={() => { setStatusFilter(s.status); setPage(1); }}
              className={clsx('card p-3 text-center cursor-pointer transition-all',
                (statusFilter === s.status || (!s.status && !statusFilter))
                  ? 'ring-2 ring-primary-500 border-primary-500'
                  : 'hover:ring-1 hover:ring-gray-300 hover:border-gray-300')}
            >
              <p className={clsx('text-lg font-bold', s.color)}>{s.value.toLocaleString()}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(1); }} placeholder="Search by TX ID, invoice, description..." />
          <SelectFilter label="All Types" value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} options={TYPE_FILTERS.filter(o => o.value)} />
          <SelectFilter label="All Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUS_FILTERS.filter(o => o.value)} />
          <SelectFilter label="All Gateways" value={gatewayFilter} onChange={(v) => { setGatewayFilter(v); setPage(1); }} options={GATEWAYS} />
          {hasActiveFilters && (
            <button onClick={resetFilters} className="px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <DataTable loading={isLoading} columns={columns} data={payments} emptyMessage="No transactions found" />
        {meta && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </div>

      <TransactionDetail transaction={detailTx} onClose={() => setDetailTx(null)} />
    </div>
  );
}
