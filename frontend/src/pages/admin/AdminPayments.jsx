import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { format } from 'date-fns';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';

export default function AdminPayments() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payments', page],
    queryFn: () => adminService.getPayments({ page, limit: 15 }).then(r => r.data),
  });
  const payments = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={CurrencyDollarIcon}
        title="Payment Management"
        subtitle="Review all platform payments and issue invoices"
      />

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : payments.length === 0 ? (
          <div className="p-8">
            <EmptyState icon={CurrencyDollarIcon} title="No payments yet"
              description="Payments processed on the platform will appear here." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  {['Reference', 'Payer', 'Type', 'Amount', 'Status', 'Date', ''].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p._id}>
                    <td className="font-mono text-xs text-gray-500">{p.reference?.slice(-10)}</td>
                    <td className="text-gray-700 dark:text-gray-200">
                      {p.payer?.firstName} {p.payer?.lastName}
                    </td>
                    <td><Badge status={p.type}>{p.type?.replace(/_/g, ' ')}</Badge></td>
                    <td className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(p.amount, p.currency)}
                    </td>
                    <td><Badge status={p.status} /></td>
                    <td className="text-xs text-gray-400">
                      {format(new Date(p.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td>
                      <Link to={`/payments/invoices/${p._id}`} target="_blank"
                        className="text-primary-600 hover:underline text-xs">
                        Invoice
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
