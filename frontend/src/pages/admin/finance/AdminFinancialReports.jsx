import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminFinanceService } from '@/services/adminFinance.service';
import { clsx } from 'clsx';
import {
  CurrencyDollarIcon, ReceiptPercentIcon, ShieldCheckIcon,
  CreditCardIcon, BanknotesIcon, ArrowUturnLeftIcon,
  DocumentArrowDownIcon, DocumentTextIcon, ArrowDownTrayIcon,
  EyeIcon, EllipsisVerticalIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  DataTable, DateRangeFilter, SelectFilter, ActionModal, GatewayIcon,
} from './components';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/currency';

const REPORT_TYPES = [
  { type: 'revenue', label: 'Revenue Report', icon: CurrencyDollarIcon, color: 'text-green-600 bg-green-50 dark:bg-green-900/20', description: 'Total platform revenue breakdown' },
  { type: 'commission', label: 'Commission Report', icon: ReceiptPercentIcon, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20', description: 'Platform commission earnings' },
  { type: 'escrow', label: 'Escrow Report', icon: ShieldCheckIcon, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20', description: 'Escrow fund movements' },
  { type: 'payment', label: 'Payment Report', icon: CreditCardIcon, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', description: 'All payment transactions' },
  { type: 'withdrawal', label: 'Withdrawal Report', icon: BanknotesIcon, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20', description: 'Withdrawal requests & processing' },
  { type: 'refund', label: 'Refund Report', icon: ArrowUturnLeftIcon, color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/20', description: 'Refund history & disputes' },
];

const TYPE_FILTERS = [
  { label: 'All Reports', value: '' },
  ...REPORT_TYPES.map(t => ({ label: t.label.replace(' Report', ''), value: t.type })),
];

const STATUS_OPTIONS = [
  'completed', 'pending', 'processing', 'funded', 'submitted',
  'released', 'refunded', 'disputed', 'failed', 'cancelled', 'expired',
];

const SOURCE_OPTIONS = [
  { label: 'Milestone', value: 'milestone' },
  { label: 'Project', value: 'project' },
  { label: 'Service Order', value: 'service_order' },
  { label: 'Deposit', value: 'deposit' },
  { label: 'Withdrawal', value: 'withdrawal' },
  { label: 'Escrow', value: 'escrow' },
  { label: 'Refund', value: 'refund' },
];

const SUMMARY_KEY = {
  revenue: 'revenue',
  commission: 'commission',
  escrow: 'escrow',
  payment: 'transactions',
  withdrawal: 'withdrawals',
  refund: 'refunds',
};

const KPI_TYPES = {
  revenue: 'revenue',
  commission: 'commission',
  transactions: 'payment',
  escrow: 'escrow',
  withdrawals: 'withdrawal',
  refunds: 'refund',
};

const downloadBlob = (data, fileName, mime) => {
  const blob = new Blob([data], { type: mime });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};

// ---------- shared cell renderers ----------
const fmtDate = (v) => (v ? format(new Date(v), 'MMM d, yyyy') : '—');
const fmtMoney = (v, c) => (v == null ? '—' : formatCurrency(v, c));

const nameCell = (v) => (v ? <span className="text-xs font-medium text-gray-900 dark:text-white">{v}</span> : <span className="text-xs text-gray-400">—</span>);

const refCell = (r) => {
  const ref = r.reference || r.invoiceNumber || r.transactionId || r.escrowId;
  return ref ? <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{ref}</span> : <span className="text-xs text-gray-300">—</span>;
};

const relatedCell = (r) => {
  if (!r.relatedLabel && !r.relatedName) return <span className="text-xs text-gray-400">—</span>;
  return (
    <div>
      <p className="text-xs font-medium text-gray-900 dark:text-white">{r.relatedName || '—'}</p>
      {r.relatedLabel && <p className="text-[11px] text-gray-400">{r.relatedLabel}</p>}
    </div>
  );
};

const moneyCell = (v, c, className) => <span className={clsx('text-xs font-semibold', className || 'text-gray-900 dark:text-white')}>{fmtMoney(v, c)}</span>;

const gatewayCell = (r) => {
  const name = r.provider || r.method;
  if (!name) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 capitalize">
      <GatewayIcon provider={name} className="w-3.5 h-3.5" />
      {name.replace(/_/g, ' ')}
    </span>
  );
};

const statusCell = (r) => <Badge status={r.status} />;

const COLUMNS = {
  revenue: [
    { key: 'reference', label: 'Transaction ID', render: refCell },
    { key: 'related', label: 'Source', render: relatedCell },
    { key: 'client', label: 'Client', render: (r) => nameCell(r.client) },
    { key: 'freelancer', label: 'Freelancer', render: (r) => nameCell(r.freelancer) },
    { key: 'provider', label: 'Gateway', render: gatewayCell },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => moneyCell(r.amount, r.currency) },
    { key: 'commission', label: 'Commission', align: 'right', render: (r) => moneyCell(r.commission, r.currency, 'text-primary-600') },
    { key: 'netAmount', label: 'Net', align: 'right', render: (r) => moneyCell(r.netAmount, r.currency, 'text-green-600') },
    { key: 'status', label: 'Status', render: statusCell },
    { key: 'date', label: 'Date', render: (r) => <span className="text-xs text-gray-500">{fmtDate(r.date)}</span> },
  ],
  payment: [
    { key: 'reference', label: 'Transaction ID', render: refCell },
    { key: 'related', label: 'Source', render: relatedCell },
    { key: 'client', label: 'Client', render: (r) => nameCell(r.client) },
    { key: 'freelancer', label: 'Freelancer', render: (r) => nameCell(r.freelancer) },
    { key: 'type', label: 'Type', render: (r) => <span className="text-xs capitalize text-gray-600 dark:text-gray-300">{r.type?.replace(/_/g, ' ') || '—'}</span> },
    { key: 'provider', label: 'Gateway', render: gatewayCell },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => moneyCell(r.amount, r.currency) },
    { key: 'commission', label: 'Commission', align: 'right', render: (r) => moneyCell(r.commission, r.currency, 'text-primary-600') },
    { key: 'gatewayFee', label: 'Fee', align: 'right', render: (r) => moneyCell(r.gatewayFee, r.currency, 'text-orange-600') },
    { key: 'netAmount', label: 'Net', align: 'right', render: (r) => moneyCell(r.netAmount, r.currency, 'text-green-600') },
    { key: 'status', label: 'Status', render: statusCell },
    { key: 'date', label: 'Date', render: (r) => <span className="text-xs text-gray-500">{fmtDate(r.date)}</span> },
  ],
  commission: [
    { key: 'reference', label: 'Commission Ref', render: refCell },
    { key: 'user', label: 'User', render: (r) => nameCell(r.user) },
    { key: 'related', label: 'Source', render: relatedCell },
    { key: 'originalAmount', label: 'Original Amount', align: 'right', render: (r) => moneyCell(r.originalAmount, r.currency) },
    { key: 'rate', label: 'Rate', align: 'right', render: (r) => <span className="text-xs font-medium text-gray-900 dark:text-white">{r.rate != null ? `${r.rate}%` : '—'}</span> },
    { key: 'amount', label: 'Commission', align: 'right', render: (r) => moneyCell(r.amount, r.currency, 'text-primary-600') },
    { key: 'status', label: 'Status', render: statusCell },
    { key: 'date', label: 'Date', render: (r) => <span className="text-xs text-gray-500">{fmtDate(r.date)}</span> },
  ],
  escrow: [
    { key: 'escrowId', label: 'Escrow ID', render: refCell },
    { key: 'client', label: 'Client', render: (r) => nameCell(r.client) },
    { key: 'freelancer', label: 'Freelancer', render: (r) => nameCell(r.freelancer) },
    { key: 'related', label: 'Project / Order', render: relatedCell },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => moneyCell(r.amount, r.currency) },
    { key: 'status', label: 'Status', render: statusCell },
    { key: 'expectedRelease', label: 'Expected Release', render: (r) => <span className="text-xs text-gray-500">{fmtDate(r.expectedRelease)}</span> },
    { key: 'date', label: 'Created', render: (r) => <span className="text-xs text-gray-500">{fmtDate(r.date)}</span> },
  ],
  withdrawal: [
    { key: 'reference', label: 'Withdrawal ID', render: refCell },
    { key: 'freelancer', label: 'Freelancer', render: (r) => nameCell(r.freelancer) },
    { key: 'method', label: 'Method', render: gatewayCell },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => moneyCell(r.amount, r.currency) },
    { key: 'status', label: 'Status', render: statusCell },
    { key: 'date', label: 'Requested', render: (r) => <span className="text-xs text-gray-500">{fmtDate(r.date)}</span> },
    { key: 'processedAt', label: 'Processed', render: (r) => <span className="text-xs text-gray-500">{fmtDate(r.processedAt)}</span> },
  ],
  refund: [
    { key: 'reference', label: 'Refund ID', render: refCell },
    { key: 'client', label: 'Client', render: (r) => nameCell(r.client) },
    { key: 'freelancer', label: 'Freelancer', render: (r) => nameCell(r.freelancer) },
    { key: 'related', label: 'Project / Order', render: relatedCell },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => moneyCell(r.amount, r.currency) },
    { key: 'reason', label: 'Reason', render: (r) => <span className="text-xs text-gray-600 dark:text-gray-300">{r.reason || '—'}</span> },
    { key: 'status', label: 'Status', render: statusCell },
    { key: 'date', label: 'Date', render: (r) => <span className="text-xs text-gray-500">{fmtDate(r.date)}</span> },
  ],
};

function MoreMenu({ onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} title="More export options"
        className="px-2.5 py-2 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 flex items-center transition-colors">
        <EllipsisVerticalIcon className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 w-44 bg-white dark:bg-dark-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-1.5 z-40">
            {[
              { key: 'pdf', label: 'Download PDF', icon: DocumentTextIcon },
              { key: 'csv', label: 'Download CSV', icon: DocumentArrowDownIcon },
              { key: 'json', label: 'Export JSON', icon: ArrowDownTrayIcon },
            ].map(item => (
              <button key={item.key} onClick={() => { setOpen(false); onSelect(item.key); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-lg transition-colors">
                <item.icon className="w-3.5 h-3.5" /> {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminFinancialReports() {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [reportType, setReportType] = useState('');
  const [status, setStatus] = useState(undefined);
  const [gateway, setGateway] = useState(undefined);
  const [source, setSource] = useState(undefined);
  const [viewType, setViewType] = useState(null);
  const [page, setPage] = useState(1);

  const filters = useMemo(() => {
    const f = {};
    if (dateRange.startDate) f.startDate = dateRange.startDate;
    if (dateRange.endDate) f.endDate = dateRange.endDate;
    if (status) f.status = status;
    if (gateway) f.provider = gateway;
    if (source) f.source = source;
    return f;
  }, [dateRange, status, gateway, source]);

  useEffect(() => { setPage(1); }, [filters]);

  const hasActiveFilters = !!(status || gateway || source || dateRange.startDate || dateRange.endDate);

  const clearFilters = () => {
    setStatus(undefined);
    setGateway(undefined);
    setSource(undefined);
    setDateRange({ startDate: '', endDate: '' });
  };

  const { data: summary } = useQuery({
    queryKey: ['admin-finance-report-summary', filters],
    queryFn: () => adminFinanceService.getReportSummary(filters).then(r => r.data),
  });

  const { data: rowsData, isLoading: rowsLoading } = useQuery({
    queryKey: ['admin-finance-report-rows', viewType, filters, page],
    queryFn: () => adminFinanceService.getReportRows({ ...filters, type: viewType, page, limit: 15 }).then(r => r.data),
    enabled: !!viewType,
  });

  const summaryData = summary?.data;
  const rows = rowsData?.data ?? [];
  const meta = rowsData?.meta;

  const activeReport = REPORT_TYPES.find(t => t.type === viewType);

  const openReport = (type) => {
    setViewType(type);
    setPage(1);
  };

  const exportReport = async (type, format) => {
    const label = REPORT_TYPES.find(t => t.type === type)?.label || type;
    try {
      const response = await adminFinanceService.getReportRows({ ...filters, type, format, limit: 5000 });
      const dateStr = new Date().toISOString().split('T')[0];
      if (format === 'pdf') downloadBlob(response.data, `${type}-report-${dateStr}.pdf`, 'application/pdf');
      else downloadBlob(response.data, `${type}-report-${dateStr}.csv`, 'text/csv');
      toast.success(`${label} exported`);
    } catch (e) {
      toast.error(e.response?.data?.message || `Failed to export ${label.toLowerCase()}`);
    }
  };

  const exportJson = async (type) => {
    const label = REPORT_TYPES.find(t => t.type === type)?.label || type;
    try {
      const response = await adminFinanceService.generateReport({
        type, format: 'json', startDate: filters.startDate, endDate: filters.endDate,
      });
      downloadBlob(JSON.stringify(response.data, null, 2), `${type}-report-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      toast.success(`${label} JSON exported`);
    } catch (e) {
      toast.error(e.response?.data?.message || `Failed to export ${label.toLowerCase()}`);
    }
  };

  const filterSummary = [
    dateRange.startDate || dateRange.endDate ? `${dateRange.startDate || '…'} → ${dateRange.endDate || '…'}` : 'All Time',
    status, gateway, source,
  ].filter(Boolean).join(' · ');

  const kpis = [
    { key: 'revenue', label: 'Total Revenue', icon: CurrencyDollarIcon, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    { key: 'commission', label: 'Commission Earned', icon: ReceiptPercentIcon, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20' },
    { key: 'transactions', label: 'Transactions', icon: CreditCardIcon, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { key: 'escrow', label: 'Escrow Funds', icon: ShieldCheckIcon, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    { key: 'withdrawals', label: 'Withdrawals', icon: BanknotesIcon, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { key: 'refunds', label: 'Refunds', icon: ArrowUturnLeftIcon, color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/20' },
  ];

  const visibleTypes = reportType ? REPORT_TYPES.filter(t => t.type === reportType) : REPORT_TYPES;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Summaries, transaction reports and exports across every financial activity</p>
        </div>
        <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1 flex-wrap">
            {TYPE_FILTERS.map(opt => (
              <button key={opt.value || 'all'}
                onClick={() => { setReportType(opt.value); setPage(1); }}
                className={clsx('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  (opt.value === '' && !reportType) || reportType === opt.value
                    ? 'bg-white dark:bg-dark-800 shadow-sm text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
                {opt.label}
              </button>
            ))}
          </div>
          <SelectFilter label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <SelectFilter label="Gateway" value={gateway} onChange={setGateway} options={['stripe', 'chapa', 'telebirr', 'cbe_birr', 'bank_transfer', 'wallet', 'manual', 'demo']} />
          <SelectFilter label="Source" value={source} onChange={setSource} options={SOURCE_OPTIONS} />
          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="px-3 py-2 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors inline-flex items-center gap-1">
              <XMarkIcon className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
        {hasActiveFilters && (
          <p className="text-[11px] text-gray-400">Filters apply to the summary cards and every report below. Reports default to completed revenue, commissions and withdrawals — matching the Financial Dashboard.</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(k => {
          const s = summaryData?.[k.key];
          const isTx = k.key === 'transactions';
          const value = isTx ? (s?.count ?? '—') : fmtMoney(s?.total);
          const sub = isTx ? 'payment records' : `${s?.count ?? 0} ${k.label.toLowerCase()}`;
          return (
            <button key={k.key} onClick={() => openReport(KPI_TYPES[k.key])} className="text-left group">
              <div className="card p-4 h-full hover:shadow-card-hover transition-all hover:-translate-y-0.5 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-[2.5rem] ${k.bg} opacity-60 -mr-5 -mt-5 group-hover:scale-110 transition-transform`} />
                <div className={`w-9 h-9 rounded-lg ${k.bg} flex items-center justify-center mb-2.5 relative z-10`}>
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white relative z-10">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 relative z-10">{k.label}</p>
                <p className="text-[11px] text-gray-400 relative z-10 mt-0.5">{sub}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleTypes.map(r => {
          const key = SUMMARY_KEY[r.type];
          const s = summaryData?.[key];
          const statValue = r.type === 'payment' ? (s?.count ?? '—') : fmtMoney(s?.total);
          const statSub = r.type === 'payment' ? `${s?.count ?? 0} records` : `${s?.count ?? 0} records`;
          return (
            <div key={r.type} className="card p-5 hover:shadow-card-hover transition-shadow group">
              <div className="flex items-center gap-3">
                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', r.color)}>
                  <r.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{r.label}</h3>
                  <p className="text-xs text-gray-400">{r.description}</p>
                </div>
              </div>
              <div className="flex items-end justify-between mt-4">
                <p className="text-xl font-bold text-gray-900 dark:text-white">{statValue}</p>
                <p className="text-xs text-gray-400">{statSub}</p>
              </div>
              <div className="flex items-center gap-1.5 mt-4">
                <button onClick={() => openReport(r.type)}
                  className="flex-1 px-3 py-2 text-xs font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors inline-flex items-center justify-center gap-1">
                  <EyeIcon className="w-3.5 h-3.5" /> View Report
                </button>
                <MoreMenu onSelect={(f) => (f === 'json' ? exportJson(r.type) : exportReport(r.type, f))} />
              </div>
            </div>
          );
        })}
      </div>

      <ActionModal isOpen={!!viewType} onClose={() => setViewType(null)} title={activeReport?.label || 'Report'} size="lg">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400">Filters: {filterSummary}</p>
              <p className="text-xs text-gray-400 mt-0.5">{rows?.length || 0} of {meta?.total ?? 0} records shown</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => exportReport(viewType, 'pdf')}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 dark:bg-dark-700 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors inline-flex items-center gap-1">
                <DocumentTextIcon className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={() => exportReport(viewType, 'csv')}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 dark:bg-dark-700 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors inline-flex items-center gap-1">
                <DocumentArrowDownIcon className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </div>

          {rowsLoading ? (
            <DataTable columns={COLUMNS[viewType]} data={[]} loading />
          ) : rows.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">No {activeReport?.label.replace(' Report', '').toLowerCase()} records found{hasActiveFilters ? ' for the current filters' : ''}.</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-3 px-4 py-2 text-xs font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <DataTable columns={COLUMNS[viewType]} data={rows} emptyMessage="No records found" />
          )}

          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      </ActionModal>
    </div>
  );
}
