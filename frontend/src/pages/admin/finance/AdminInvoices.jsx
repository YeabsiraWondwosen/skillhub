import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminFinanceService } from '@/services/adminFinance.service';
import { DataTable, DateRangeFilter, SearchInput, SelectFilter } from './components';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import { format } from 'date-fns';
import { DocumentArrowDownIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
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

export default function AdminInvoices() {
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);

  const dateParams = useMemo(() => {
    const p = {};
    if (dateRange.startDate) p.startDate = dateRange.startDate;
    if (dateRange.endDate) p.endDate = dateRange.endDate;
    return p;
  }, [dateRange]);

  const filters = useMemo(() => {
    const f = {};
    if (statusFilter) f.status = statusFilter;
    return f;
  }, [statusFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-finance-invoices', page, filters, searchQuery, dateParams],
    queryFn: () => {
      if (searchQuery) return adminFinanceService.searchPayments({ page, limit: 15, q: searchQuery, ...filters, ...dateParams }).then(r => r.data);
      return adminFinanceService.getPayments({ page, limit: 15, hasInvoice: true, ...filters, ...dateParams }).then(r => r.data);
    },
  });

  const payments = data?.data ?? [];
  const invoices = payments.filter(p => p.invoiceNumber);
  const meta = data?.meta;

  const columns = [
    {
      key: 'invoiceNumber', label: 'Invoice #',
      render: (r) => (
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="w-4 h-4 text-primary-500" />
          <span className="text-xs font-semibold text-primary-600">{r.invoiceNumber || '—'}</span>
        </div>
      ),
    },
    {
      key: 'reference', label: 'TX Reference',
      render: (r) => <span className="text-xs font-mono text-gray-500">{r.reference?.slice(-12)}</span>,
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
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {r.payee?.firstName ? `${r.payee.firstName} ${r.payee.lastName}` : '—'}
        </span>
      ),
    },
    {
      key: 'type', label: 'Type',
      render: (r) => <span className="text-xs capitalize">{r.type?.replace(/_/g, ' ')}</span>,
    },
    {
      key: 'amount', label: 'Amount', align: 'right',
      render: (r) => <span className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(r.amount, r.currency)}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (r) => <Badge status={r.status} />,
    },
    {
      key: 'createdAt', label: 'Date',
      render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy')}</span>,
    },
    {
      key: 'actions', label: 'Download', align: 'right',
      render: (r) => r.invoiceNumber ? (
        <button onClick={() => downloadInvoice(r._id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors">
          <DocumentArrowDownIcon className="w-3.5 h-3.5" /> PDF
        </button>
      ) : <span className="text-[11px] text-gray-300">—</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View and download all platform invoices</p>
        </div>
        <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(1); }} placeholder="Search invoices..." />
          <SelectFilter label="All Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[{ value: 'completed', label: 'Completed' }, { value: 'pending', label: 'Pending' }, { value: 'processing', label: 'Processing' }]} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <DataTable loading={isLoading} columns={columns} data={invoices} emptyMessage="No invoices found" />
        {meta && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
