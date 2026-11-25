import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminFinanceService } from '@/services/adminFinance.service';
import {
  DataTable, DateRangeFilter, SearchInput, SelectFilter,
  KPICard, GatewayIcon, GATEWAYS,
} from './components';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import { format } from 'date-fns';
import { ArrowDownIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';

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

export default function AdminDeposits() {
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [gatewayFilter, setGatewayFilter] = useState(undefined);

  const dateParams = useMemo(() => {
    const p = { type: 'deposit' };
    if (dateRange.startDate) p.startDate = dateRange.startDate;
    if (dateRange.endDate) p.endDate = dateRange.endDate;
    return p;
  }, [dateRange]);

  const filters = useMemo(() => {
    const f = { type: 'deposit' };
    if (statusFilter) f.status = statusFilter;
    if (gatewayFilter) f.provider = gatewayFilter;
    return f;
  }, [statusFilter, gatewayFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-finance-deposits', page, filters, searchQuery, dateParams],
    queryFn: () => {
      if (searchQuery) return adminFinanceService.searchPayments({ page, limit: 15, q: searchQuery, ...filters, ...dateParams }).then(r => r.data);
      return adminFinanceService.getPayments({ page, limit: 15, ...filters, ...dateParams }).then(r => r.data);
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-finance-deposit-stats', dateParams],
    queryFn: () => adminFinanceService.getPaymentStats({ type: 'deposit', ...dateParams }).then(r => r.data),
  });

  const payments = data?.data ?? [];
  const meta = data?.meta;
  const st = stats?.data;

  const columns = [
    {
      key: 'reference', label: 'TX ID',
      render: (r) => <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{r.reference?.slice(-12)}</span>,
    },
    {
      key: 'payer', label: 'User',
      render: (r) => (
        <div>
          <p className="text-xs font-medium text-gray-900 dark:text-white">{r.payer?.firstName} {r.payer?.lastName}</p>
          <p className="text-[11px] text-gray-400">{r.payer?.email}</p>
        </div>
      ),
    },
    {
      key: 'provider', label: 'Gateway',
      render: (r) => <span className="text-xs inline-flex items-center gap-1"><GatewayIcon provider={r.provider} className="w-3.5 h-3.5" /> {r.provider}</span>,
    },
    {
      key: 'amount', label: 'Amount', align: 'right',
      render: (r) => <span className="text-xs font-bold text-green-600">{formatCurrency(r.amount, r.currency)}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (r) => <Badge status={r.status} />,
    },
    {
      key: 'createdAt', label: 'Date',
      render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy HH:mm')}</span>,
    },
    {
      key: 'actions', label: 'Actions', align: 'right',
      render: (r) => r.invoiceNumber ? (
        <button onClick={() => downloadInvoice(r._id)} title="Download PDF"
          className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 justify-end">
          <DocumentArrowDownIcon className="w-3.5 h-3.5" /> Download PDF
        </button>
      ) : <span className="text-[11px] text-gray-300">—</span>,
    },
  ];

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter(undefined);
    setGatewayFilter(undefined);
    setDateRange({ startDate: '', endDate: '' });
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deposits</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All incoming deposits and wallet top-ups</p>
        </div>
        <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />
      </div>

      {st && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Total Deposits" value={st.total || 0} icon={ArrowDownIcon} color="text-green-600" bg="bg-green-50 dark:bg-green-900/20" delay={0}
            onClick={() => { setStatusFilter(undefined); setPage(1); }} />
          <KPICard label="Completed" value={st.completed || 0} icon={ArrowDownIcon} color="text-green-600" bg="bg-green-50 dark:bg-green-900/20" delay={1}
            onClick={() => { setStatusFilter('completed'); setPage(1); }} />
          <KPICard label="Pending" value={st.pending || 0} icon={ArrowDownIcon} color="text-yellow-600" bg="bg-yellow-50 dark:bg-yellow-900/20" delay={2}
            onClick={() => { setStatusFilter('pending'); setPage(1); }} />
          <KPICard label="Failed" value={st.failed || 0} icon={ArrowDownIcon} color="text-red-600" bg="bg-red-50 dark:bg-red-900/20" delay={3}
            onClick={() => { setStatusFilter('failed'); setPage(1); }} />
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(1); }} placeholder="Search deposits..." />
          <SelectFilter label="All Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[{ value: 'completed', label: 'Completed' }, { value: 'pending', label: 'Pending' }, { value: 'processing', label: 'Processing' }, { value: 'failed', label: 'Failed' }]} />
          <SelectFilter label="All Gateways" value={gatewayFilter} onChange={(v) => { setGatewayFilter(v); setPage(1); }} options={GATEWAYS} />
          {resetFilters && (searchQuery || statusFilter || gatewayFilter || dateRange.startDate || dateRange.endDate) && (
            <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-primary-600 transition-colors">
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <DataTable loading={isLoading} columns={columns} data={payments} emptyMessage="No deposits found" />
        {meta && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
