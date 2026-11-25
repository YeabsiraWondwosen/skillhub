import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { paymentService } from '@/services/payment.service';
import { SkeletonText } from '@/components/ui/Skeleton';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';
import { ArrowLeft } from 'lucide-react';

export default function InvoicePage() {
  const { paymentId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['invoice', paymentId],
    queryFn: () => paymentService.getInvoice(paymentId).then(r => r.data),
    enabled: !!paymentId,
  });
  const payment = data?.data;

  if (isLoading) return <div className="page-container max-w-2xl"><SkeletonText lines={10} /></div>;
  if (!payment) return <div className="page-container"><p className="text-gray-500">Invoice not found.</p></div>;

  const handleDownloadPDF = async () => {
    try {
      const response = await paymentService.downloadInvoicePdf(paymentId);
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
    <div className="page-container max-w-2xl">
      <Link to="/payments/transactions" className="text-sm text-gray-400 hover:text-primary-600 inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Transactions
      </Link>

      <div className="card p-8 mt-4 print:shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="mb-1">
              <img src="/images/skillhub-logo-dark.png" alt="SkillHub" className="h-9 w-auto object-contain dark:hidden" />
              <img src="/images/skillhub-logo-light.png" alt="SkillHub" className="h-9 w-auto object-contain hidden dark:block" />
            </div>
            <p className="text-xs text-gray-400">The Multi-Category Freelance Marketplace</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Invoice #</p>
            <p className="font-bold text-gray-900 dark:text-white">{payment.invoiceNumber ?? payment._id}</p>
            <p className="text-xs text-gray-400 mt-1">{format(new Date(payment.createdAt), 'MMM d, yyyy')}</p>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {[
            { title: 'From', person: payment.payer },
            { title: 'To', person: payment.payee },
          ].map(({ title, person }) => person && (
            <div key={title}>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{title}</p>
              <p className="font-semibold text-gray-900 dark:text-white">{person.firstName} {person.lastName}</p>
              <p className="text-sm text-gray-500">{person.email}</p>
            </div>
          ))}
        </div>

        {/* Details */}
        <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-dark-700">
              <tr>
                {['Description', 'Type', 'Amount'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{payment.description || payment.type}</td>
                <td className="px-4 py-3"><Badge status={payment.type} /></td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(payment.amount, payment.currency)}</td>
              </tr>
              {payment.commission > 0 && (
                <tr className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3 text-gray-500">Platform Commission ({(payment.commissionRate * 100).toFixed(0)}%)</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-red-500">-{formatCurrency(payment.commission, payment.currency)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="flex justify-end">
          <div className="text-right space-y-1">
            <div className="flex justify-between gap-8 text-sm">
              <span className="text-gray-400">Subtotal</span>
              <span className="font-medium">{formatCurrency(payment.amount, payment.currency)}</span>
            </div>
            {payment.commission > 0 && (
              <div className="flex justify-between gap-8 text-sm">
                <span className="text-gray-400">Commission</span>
                <span className="text-red-500">-{formatCurrency(payment.commission, payment.currency)}</span>
              </div>
            )}
            <div className="flex justify-between gap-8 font-bold text-lg border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
              <span>Net Amount</span>
              <span className="text-primary-600">{formatCurrency(payment.netAmount, payment.currency)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
          <Badge status={payment.status} />
          <div className="flex gap-2">
            <button onClick={handleDownloadPDF} className="btn-secondary btn-sm">
              <DocumentArrowDownIcon className="w-4 h-4 inline mr-1" /> Download PDF
            </button>
            <button onClick={() => window.print()} className="btn-secondary btn-sm">Print Invoice</button>
          </div>
        </div>
      </div>
    </div>
  );
}
