import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTransactions, usePaymentHistory } from '@/hooks/usePayments';
import { paymentService } from '@/services/payment.service';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/EmptyState';
import { DocumentTextIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { formatCurrency } from '@/utils/currency';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const CREDIT_TYPES = ['escrow_release', 'deposit', 'refund', 'escrow_refund', 'bonus'];
const TYPES = ['', 'escrow_release', 'commission', 'withdrawal', 'escrow_hold', 'deposit'];
const INVOICE_PAGE_SIZE = 10;

const typeLabel = (type) => (type ?? '').replace(/_/g, ' ');

const TABS = [
  { id: 'transactions', label: 'Transaction History' },
  { id: 'invoices', label: 'Invoices' },
];

export default function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'invoices' ? 'invoices' : 'transactions';

  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [invoicePage, setInvoicePage] = useState(1);

  const { data, isLoading } = useTransactions({ page, limit: 15, type: type || undefined });
  const transactions = data?.data ?? [];
  const meta = data?.meta;

  const { data: historyData, isLoading: isLoadingInvoices } = usePaymentHistory({ page: 1, limit: 200 });
  const payments = historyData?.data ?? [];

  const invoices = useMemo(() =>
    payments
      .filter(p => p.status === 'completed')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  [payments]);

  const invoiceTotal = invoices.length;
  const invoiceTotalPages = Math.max(1, Math.ceil(invoiceTotal / INVOICE_PAGE_SIZE));
  const currentInvoices = invoices.slice((invoicePage - 1) * INVOICE_PAGE_SIZE, invoicePage * INVOICE_PAGE_SIZE);

  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'invoices') next.set('tab', 'invoices');
    else next.delete('tab');
    setSearchParams(next, { replace: true });
  };

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
      <div className="flex items-center justify-between">
        <div>
          <Link to="/freelancer/wallet" className="text-sm text-gray-400 hover:text-primary-600 inline-flex items-center gap-1"><ArrowLeft size={14} /> Wallet</Link>
          <h1 className="section-title mt-1">Transactions</h1>
          <p className="section-sub">Transaction history and invoices for all your payments</p>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-gray-100 dark:border-gray-700">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'transactions' ? (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Select
              aria-label="Filter transactions by type"
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}
              className="w-full sm:w-64"
            >
              {TYPES.map(t => (
                <option key={t || 'all'} value={t}>{t ? t.replace(/_/g, ' ') : 'All'}</option>
              ))}
            </Select>
          </div>

          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
              </div>
            ) : transactions.length === 0 ? (
              <EmptyState icon={DocumentTextIcon} title="No transactions found"
                description="Your transactions will appear here once you deposit, withdraw, or fund a milestone." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-dark-700">
                    <tr>
                      {['Reference', 'Project', 'Type', 'Gross Amount', 'Commission', 'Net Amount', 'Status', 'Date', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
                    {transactions.map(tx => {
                      const hasSnapshots = tx.balanceBefore != null && tx.balanceAfter != null;
                      const isNeutral = tx.type === 'escrow_release' && hasSnapshots && tx.balanceAfter <= tx.balanceBefore;
                      const isCredit = isNeutral ? false : CREDIT_TYPES.includes(tx.type);
                      const showCommission = tx.type === 'escrow_release' && tx.fee > 0;
                      return (
                        <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50">
                          <td className="px-4 py-3">
                            <p className="text-xs font-mono text-gray-500">{tx.reference}</p>
                            {tx.description && <p className="text-[10px] text-gray-400">{tx.description}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{tx.projectId?.title || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="capitalize text-xs font-medium text-gray-700 dark:text-gray-200">{typeLabel(tx.type)}</span>
                          </td>
                          <td className="px-4 py-3 font-medium">{formatCurrency(tx.amount)}</td>
                          <td className="px-4 py-3">
                            {showCommission ? (
                              <span className="text-red-500">{formatCurrency(tx.fee)}</span>
                            ) : tx.type === 'commission' ? (
                              <span className="text-orange-500">{formatCurrency(tx.amount)}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {isNeutral
                              ? <span className="text-gray-500">{formatCurrency(tx.netAmount)}</span>
                              : <span className={clsx('font-bold', isCredit ? 'text-green-600' : 'text-red-500')}>
                                  {isCredit ? '+' : '-'}{formatCurrency(tx.netAmount)}
                                </span>}
                          </td>
                          <td className="px-4 py-3"><Badge status={tx.status} className="text-[10px]" /></td>
                          <td className="px-4 py-3 text-xs text-gray-400">{format(new Date(tx.createdAt), 'MMM d, yyyy')}</td>
                          <td className="px-4 py-3">
                            {tx.type === 'escrow_release' && (
                              <Link to={`/payments/invoices/${tx.paymentId || tx._id}`} title="View invoice" className="text-primary-600 hover:text-primary-700">
                                <DocumentTextIcon className="w-4 h-4" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
              <Pagination meta={meta} onPageChange={setPage} />
            </div>
          </div>
        </>
      ) : (
        <div className="card overflow-hidden">
          {isLoadingInvoices ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
            </div>
          ) : invoiceTotal === 0 ? (
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
                  {currentInvoices.map(p => (
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
          {invoiceTotal > INVOICE_PAGE_SIZE && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
              <Pagination
                meta={{ page: invoicePage, totalPages: invoiceTotalPages, total: invoiceTotal, hasPrevPage: invoicePage > 1, hasNextPage: invoicePage < invoiceTotalPages }}
                onPageChange={setInvoicePage}
              />
            </div>
          )}
          <p className="text-xs text-gray-400 px-5 py-3 border-t border-gray-100 dark:border-gray-700">
            Only completed payments generate invoices. View them any time from your transaction history.
          </p>
        </div>
      )}
    </div>
  );
}
