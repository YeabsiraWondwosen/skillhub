import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon, CreditCardIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { usePaymentHistory } from '@/hooks/usePayments';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import Select from '@/components/ui/Select';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/currency';

const PAGE_SIZE = 12;

const FILTERS = ['all', 'completed', 'pending', 'processing', 'failed', 'refunded', 'cancelled'];

const typeLabel = (type) => (type ?? '').replace(/_/g, ' ');
const providerLabel = (provider) => (provider ?? '').toUpperCase();

export default function ClientPaymentsPage() {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePaymentHistory({ page: 1, limit: 200 });
  const payments = data?.data ?? [];

  const filtered = useMemo(() => (filter ? payments.filter(p => p.status === filter) : payments), [payments, filter]);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const summary = useMemo(() => ({
    total: payments.length,
    completed: payments.filter(p => p.status === 'completed').length,
    pending: payments.filter(p => ['pending', 'processing'].includes(p.status)).length,
    amount: payments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0),
  }), [payments]);

  const handleTab = (value) => { setFilter(value); setPage(1); };

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={CreditCardIcon}
        title="Payments"
        subtitle="Every payment you have made or received on SkillHub"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Payments', value: summary.total },
          { label: 'Completed', value: summary.completed },
          { label: 'Pending', value: summary.pending },
          { label: 'Completed Value', value: formatCurrency(summary.amount) },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <p className="stat-value">{s.value}</p>
            <p className="stat-label">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Select
          aria-label="Filter payments by status"
          value={filter}
          onChange={(e) => handleTab(e.target.value)}
          className="w-full sm:w-64"
        >
          {FILTERS.map(t => (
            <option key={t} value={t === 'all' ? '' : t}>{t === 'all' ? 'All' : t}</option>
          ))}
        </Select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState icon={CreditCardIcon} title="No payments yet"
            description="Your payments will appear here once you fund a milestone or purchase a service." />
        ) : current.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-16">No {filter} payments found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-dark-700">
                <tr>
                  {['Reference', 'Description', 'Type', 'Amount', 'Status', 'Provider', 'Date', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
                {current.map(p => (
                  <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50">
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono text-gray-500">{p.reference}</p>
                      {p.invoiceNumber && <p className="text-[10px] text-gray-400">Inv {p.invoiceNumber}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{p.project?.title || p.milestone?.title || p.description || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-xs font-medium text-gray-700 dark:text-gray-200">{typeLabel(p.type)}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(p.amount, p.currency)}</td>
                    <td className="px-4 py-3"><Badge status={p.status} className="text-[10px]" /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{providerLabel(p.provider)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{format(new Date(p.createdAt), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3">
                      {p.status === 'completed' && (
                        <Link to={`/payments/invoices/${p._id}`} title="View invoice"
                          className="text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
                          <DocumentTextIcon className="w-4 h-4" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
            <Pagination meta={{ page, totalPages, total, hasPrevPage: page > 1, hasNextPage: page < totalPages }} onPageChange={setPage} />
          </div>
        )}
      </div>

      <Link to="/payments/transactions" className="text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
        <ArrowDownTrayIcon className="w-4 h-4" /> View detailed transaction history
      </Link>
    </div>
  );
}
