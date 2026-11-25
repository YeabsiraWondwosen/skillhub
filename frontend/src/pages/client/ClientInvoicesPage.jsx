import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DocumentTextIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { usePaymentHistory } from '@/hooks/usePayments';
import { paymentService } from '@/services/payment.service';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/currency';

const PAGE_SIZE = 10;

const typeLabel = (type) => (type ?? '').replace(/_/g, ' ');

export default function ClientInvoicesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePaymentHistory({ page: 1, limit: 200 });
  const payments = data?.data ?? [];

  const invoices = useMemo(() =>
    payments
      .filter(p => p.status === 'completed')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  [payments]);

  const total = invoices.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDownload = async (payment) => {
    try {
      const response = await paymentService.downloadInvoicePdf(payment._id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SkillHub-Invoice-${payment.invoiceNumber || payment._id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Invoice downloaded!');
    } catch (err) {
      toast.error('Failed to download invoice');
    }
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={DocumentTextIcon}
        title="Invoices"
        subtitle="Receipts for your completed payments"
      />

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
          </div>
        ) : total === 0 ? (
          <EmptyState icon={DocumentTextIcon} title="No invoices yet"
            description="Invoices are generated automatically for your completed payments." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-dark-700">
                <tr>
                  {['Invoice #', 'Description', 'Type', 'Amount', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
                {current.map(p => (
                  <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {p.invoiceNumber || p._id}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{p.project?.title || p.milestone?.title || p.description || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-xs font-medium text-gray-700 dark:text-gray-200">{typeLabel(p.type)}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{format(new Date(p.createdAt), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/payments/invoices/${p._id}`} className="btn-secondary btn-sm">
                          View
                        </Link>
                        <button onClick={() => handleDownload(p)} title="Download PDF"
                          className="btn-icon btn-ghost">
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                      </div>
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

      <p className="text-xs text-gray-400">
        Only completed payments generate invoices. View them any time from your transaction history.
      </p>
    </div>
  );
}
