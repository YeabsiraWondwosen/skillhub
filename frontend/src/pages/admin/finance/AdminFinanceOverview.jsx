import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { adminFinanceService } from '@/services/adminFinance.service';
import { KPICard, SectionHeader, DateRangeFilter, LiveIndicator, DataTable, SelectFilter, SearchInput, ActionModal, GatewayIcon } from './components';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { getSocket } from '@/services/socket';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import {
  CurrencyDollarIcon, ShieldCheckIcon,
  BanknotesIcon, UsersIcon, DocumentTextIcon, ArrowDownIcon, ArrowUpIcon,
  CheckCircleIcon, ArrowUturnLeftIcon,
  FireIcon, CreditCardIcon, ReceiptPercentIcon, CalendarDaysIcon,
  EyeIcon, ArrowLeftIcon, DocumentArrowDownIcon, ClockIcon, ChartBarIcon,
  ArrowTrendingUpIcon, Squares2X2Icon, ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart, ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { formatCurrency } from '@/utils/currency';

Chart.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const SOURCES = ['All', 'Jobs', 'Projects', 'Services', 'Service Orders', 'Contracts', 'Deposits', 'Escrow', 'Other'];

const USER_ROLES = ['All', 'Client', 'Freelancer'];

const TX_TYPES = [
  { label: 'All', value: '' },
  { label: 'Payment', value: 'payment' },
  { label: 'Deposit', value: 'deposit' },
  { label: 'Withdrawal', value: 'withdrawal' },
  { label: 'Escrow', value: 'escrow' },
  { label: 'Refund', value: 'refund' },
  { label: 'Commission', value: 'commission' },
];

const TX_STATUSES = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Success', value: 'success' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Refunded', value: 'refunded' },
  { label: 'Disputed', value: 'disputed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const PAYMENT_METHODS = [
  { label: 'All', value: '' },
  { label: 'Chapa', value: 'chapa' },
  { label: 'Stripe', value: 'stripe' },
  { label: 'Bank', value: 'bank' },
  { label: 'Other', value: 'other' },
];

const DRILLDOWN_DATE_PRESETS = [
  { label: 'Today', value: () => ({ start: format(startOfDay(new Date()), 'yyyy-MM-dd'), end: format(endOfDay(new Date()), 'yyyy-MM-dd') }) },
  { label: '7 Days', value: () => ({ start: format(subDays(new Date(), 7), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
  { label: '30 Days', value: () => ({ start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'This Month', value: () => ({ start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') }) },
  { label: 'Last Month', value: () => ({ start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd') }) },
];

const SOURCE_META = {
  Jobs: { color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20' },
  Projects: { color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  Services: { color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  'Service Orders': { color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  Contracts: { color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
  Deposits: { color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  Escrow: { color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  Other: { color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-900/20' },
};

const userFullName = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '—' : '—');

const resolveSource = (p) => {
  const type = p?.type || '';
  const isOrder = !!(p?.serviceOrder?._id || p?.serviceOrder);
  const hasProject = !!(p?.project?._id || p?.project);
  if (isOrder || type === 'service_order_payment') return 'Service Orders';
  if (type === 'deposit') return 'Deposits';
  if (type === 'refund') return 'Other';
  if (type === 'commission') return 'Other';
  if (type === 'withdrawal') return 'Other';
  if (type === 'milestone_payment') return hasProject ? 'Projects' : 'Jobs';
  if (type === 'project_payment') return 'Projects';
  if (type === 'escrow' || type === 'escrow_release') return 'Contracts';
  return 'Other';
};

const providerMatches = (provider, filter) => {
  if (!filter) return true;
  if (filter === 'bank') return ['telebirr', 'cbe_birr', 'bank_transfer'].includes(provider);
  if (filter === 'other') return !['chapa', 'stripe', 'telebirr', 'cbe_birr', 'bank_transfer'].includes(provider);
  return provider === filter;
};

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

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[11px] text-gray-400 uppercase font-medium shrink-0">{label}</span>
      <span className="text-xs text-gray-900 dark:text-white text-right break-all">{value ?? '—'}</span>
    </div>
  );
}

function TimelineEvent({ date, label, icon: Icon, color }) {
  return (
    <div className="flex items-start gap-3">
      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', color?.bg || 'bg-gray-50 dark:bg-dark-700')}>
        <Icon className={clsx('w-3.5 h-3.5', color?.text || 'text-gray-500')} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-900 dark:text-white capitalize">{label}</p>
        <p className="text-[11px] text-gray-400">{date ? format(new Date(date), 'MMM d, yyyy HH:mm:ss') : '—'}</p>
      </div>
    </div>
  );
}

function TransactionDetailModal({ transaction, onClose }) {
  if (!transaction) return null;
  const t = transaction;

  const netAmount = (t.amount || 0) - (t.commission || 0) - (t.gatewayFee || 0);
  const projectTitle = t.project?.title;
  const order = t.serviceOrder;
  const service = order?.service?.title ? order.service : null;
  const contractTitle = order?.title || projectTitle;
  const invoice = t.invoiceNumber || t.invoiceUrl;

  const timeline = [
    { label: 'Created', date: t.createdAt, icon: DocumentTextIcon, color: { text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' } },
    { label: 'Paid', date: t.processedAt || (t.status === 'completed' ? t.createdAt : null), icon: CheckCircleIcon, color: { text: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' } },
    { label: 'Escrowed', date: t.escrowHeldAt, icon: ShieldCheckIcon, color: { text: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' } },
    { label: 'Released', date: t.escrowReleasedAt, icon: ArrowUpIcon, color: { text: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20' } },
    { label: 'Refunded', date: t.refundedAt, icon: ArrowUturnLeftIcon, color: { text: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' } },
  ].filter(e => e.date);

  return (
    <ActionModal isOpen={!!transaction} onClose={onClose} title="Transaction Details" size="lg">
      <div className="space-y-5">
        {/* Transaction Information */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Transaction Information</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <p className="text-[11px] text-gray-400 uppercase font-medium">Transaction ID</p>
              <p className="text-xs font-mono text-gray-900 dark:text-white mt-1">{t.reference}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <p className="text-[11px] text-gray-400 uppercase font-medium">Payment ID</p>
              <p className="text-xs font-mono text-gray-900 dark:text-white mt-1">{t._id}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <p className="text-[11px] text-gray-400 uppercase font-medium">Date</p>
              <p className="text-xs text-gray-900 dark:text-white mt-1">{format(new Date(t.createdAt), 'MMM d, yyyy HH:mm:ss')}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <p className="text-[11px] text-gray-400 uppercase font-medium">Status</p>
              <div className="mt-1"><Badge status={t.status} /></div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <p className="text-[11px] text-gray-400 uppercase font-medium">Type</p>
              <p className="text-xs font-medium text-gray-900 dark:text-white mt-1 capitalize">{t.type?.replace(/_/g, ' ')}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <p className="text-[11px] text-gray-400 uppercase font-medium">Amount</p>
              <p className="text-xs font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(t.amount, t.currency)}</p>
            </div>
          </div>
        </div>

        {/* Participants */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Participants</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <p className="text-[11px] text-gray-400 uppercase font-medium">Client</p>
              <p className="text-xs font-medium text-gray-900 dark:text-white mt-1">{userFullName(t.payer)}</p>
              <p className="text-[11px] text-gray-400">{t.payer?.email || '—'}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <p className="text-[11px] text-gray-400 uppercase font-medium">Freelancer</p>
              <p className="text-xs font-medium text-gray-900 dark:text-white mt-1">{t.payee?._id ? userFullName(t.payee) : '—'}</p>
              <p className="text-[11px] text-gray-400">{t.payee?.email || '—'}</p>
            </div>
          </div>
        </div>

        {/* Related Work */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Related Work</p>
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/40">
            <DetailRow label="Job" value={t.project?.job?.title || (t.project?._id ? 'Linked via project' : null)} />
            <DetailRow label="Project" value={projectTitle} />
            <DetailRow label="Service" value={service?.title} />
            <DetailRow label="Service Order" value={order?.orderNumber ? `${order.orderNumber}${order.title ? ` · ${order.title}` : ''}` : null} />
            <DetailRow label="Contract" value={contractTitle} />
          </div>
        </div>

        {/* Financial Breakdown */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Financial Breakdown</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <p className="text-[11px] text-green-600 uppercase font-medium">Gross Amount</p>
              <p className="text-sm font-bold text-green-700 dark:text-green-400 mt-1">{formatCurrency(t.amount, t.currency)}</p>
            </div>
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-center">
              <p className="text-[11px] text-primary-600 uppercase font-medium">Platform Commission</p>
              <p className="text-sm font-bold text-primary-700 dark:text-primary-400 mt-1">{formatCurrency(t.commission, t.currency)}</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
              <p className="text-[11px] text-blue-600 uppercase font-medium">Net Amount</p>
              <p className="text-sm font-bold text-blue-700 dark:text-blue-400 mt-1">{formatCurrency(netAmount, t.currency)}</p>
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
              <p className="text-[11px] text-yellow-600 uppercase font-medium">Escrow Amount</p>
              <p className="text-sm font-bold text-yellow-700 dark:text-yellow-400 mt-1">{t.isEscrow ? formatCurrency(t.amount, t.currency) : '—'}</p>
            </div>
          </div>
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-red-500 uppercase font-medium">Refund Amount</p>
              <p className="text-xs font-bold text-red-600">{t.type === 'refund' || t.status === 'refunded' ? formatCurrency(t.amount, t.currency) : '—'}</p>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Payment</p>
          <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/40">
            <DetailRow label="Payment Method" value={t.provider ? <span className="inline-flex items-center gap-1 capitalize"><GatewayIcon provider={t.provider} className="w-3.5 h-3.5" /> {t.provider.replace(/_/g, ' ')}</span> : null} />
            <DetailRow label="Payment Provider" value={t.provider} />
            <DetailRow label="Payment Reference" value={t.providerTransactionRef || t.providerPaymentId} />
            <DetailRow label="Invoice" value={invoice ? <button onClick={() => downloadInvoice(t._id)} className="text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"><DocumentArrowDownIcon className="w-3.5 h-3.5" /> {t.invoiceNumber || 'Download'}</button> : null} />
          </div>
        </div>

        {/* Timeline */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase mb-3">Timeline</p>
          <div className="space-y-3">
            {timeline.map((e, i) => <TimelineEvent key={i} {...e} />)}
            {timeline.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No timeline events</p>}
          </div>
        </div>
      </div>
    </ActionModal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVENUE & TRANSACTION ANALYSIS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function SourceStat({ label, total, count }) {
  const meta = SOURCE_META[label] || SOURCE_META.Other;
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', meta.bg)}>
          <CurrencyDollarIcon className={clsx('w-4 h-4', meta.color)} />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-white">{formatCurrency(total)}</p>
          <p className="text-[11px] text-gray-400">{label} · {count} txns</p>
        </div>
      </div>
    </div>
  );
}

function HeaderDropdown({ label, value, options, onSelect }) {
  return (
    <select value={value || ''} onChange={e => onSelect(e.target.value || undefined)}
      className="px-2 py-1 rounded-md text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 capitalize">
      <option value="">{label}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function DateHeaderDropdown({ dateRange, onChange }) {
  const active = DRILLDOWN_DATE_PRESETS.find(p => {
    const v = p.value();
    return dateRange.startDate === v.start && dateRange.endDate === v.end;
  });
  const isCustom = !!(dateRange.startDate || dateRange.endDate) && !active;
  return (
    <select
      value={active ? active.label : isCustom ? '__custom' : ''}
      onChange={e => {
        if (e.target.value === '__custom') return;
        const p = DRILLDOWN_DATE_PRESETS.find(x => x.label === e.target.value);
        onChange(p ? p.value() : { startDate: '', endDate: '' });
      }}
      className="px-2 py-1 rounded-md text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300">
      <option value="">All Dates</option>
      {DRILLDOWN_DATE_PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
      {isCustom && <option value="__custom">Custom Range</option>}
    </select>
  );
}

function RevenueAnalysis({ onBack, openDetails, sourceFilter, setSourceFilter, roleFilter, setRoleFilter, typeFilter, setTypeFilter, statusFilter, setStatusFilter, methodFilter, setMethodFilter, dateRange, setDateRange, searchQuery, setSearchQuery }) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const navigate = useNavigate();

  const applyDateRange = useCallback((next) => { setDateRange(next); setPage(1); }, [setDateRange]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const queryFilters = useMemo(() => {
    const f = { limit: 100 };
    if (dateRange.startDate) f.startDate = dateRange.startDate;
    if (dateRange.endDate) f.endDate = dateRange.endDate;
    if (typeFilter) f.type = typeFilter === 'escrow' ? 'escrow' : typeFilter;
    if (statusFilter) f.status = statusFilter === 'success' ? 'completed' : statusFilter;
    return f;
  }, [dateRange, typeFilter, statusFilter]);

  const commissionMode = typeFilter === 'commission';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-finance-drilldown', queryFilters, searchQuery],
    queryFn: () => {
      if (commissionMode) {
        return adminFinanceService.getCommissionHistory({ limit: 100, startDate: dateRange.startDate || undefined, endDate: dateRange.endDate || undefined }).then(r => r.data);
      }
      const params = { ...queryFilters };
      if (searchQuery) return adminFinanceService.searchPayments({ ...params, q: searchQuery }).then(r => r.data);
      return adminFinanceService.getPayments(params).then(r => r.data);
    },
  });

  const payments = useMemo(() => {
    if (!commissionMode) return data?.data ?? [];
    const rows = (data?.data ?? []).map(c => ({
      _id: c._id,
      reference: c.reference,
      type: 'commission',
      amount: c.amount,
      currency: c.currency,
      status: c.status,
      createdAt: c.createdAt,
      processedAt: c.processedAt,
      commission: c.amount,
      gatewayFee: c.fee || 0,
      description: c.description,
      provider: null,
      payer: null,
      payee: c.user || null,
      project: c.projectId ? { _id: c.projectId._id, title: c.projectId.title } : null,
      serviceOrder: null,
      invoiceNumber: null,
      invoiceUrl: null,
    }));
    if (!searchQuery) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(r =>
      (r.reference || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.project?.title || '').toLowerCase().includes(q) ||
      userFullName(r.payee).toLowerCase().includes(q)
    );
  }, [commissionMode, data, searchQuery]);

  const meta = data?.meta;

  const filtered = useMemo(() => {
    let rows = [...payments];
    if (sourceFilter) rows = rows.filter(p => resolveSource(p) === sourceFilter);
    if (roleFilter) {
      const role = roleFilter.toLowerCase();
      rows = rows.filter(p => (role === 'client' && p.payer?.role === 'client') || (role === 'freelancer' && p.payee?.role === 'freelancer'));
    }
    if (methodFilter) rows = rows.filter(p => providerMatches(p.provider, methodFilter));
    rows.sort((a, b) => {
      const av = sortKey === 'amount' ? (a.amount || 0) : sortKey === 'commission' ? (a.commission || 0) : new Date(a.createdAt || 0).getTime();
      const bv = sortKey === 'amount' ? (b.amount || 0) : sortKey === 'commission' ? (b.commission || 0) : new Date(b.createdAt || 0).getTime();
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return rows;
  }, [payments, sourceFilter, roleFilter, methodFilter, sortKey, sortDir]);

  const sourceBreakdown = useMemo(() => {
    const completed = filtered.filter(p => p.status === 'completed');
    const map = { Jobs: 0, Projects: 0, Services: 0, 'Service Orders': 0, Contracts: 0, Deposits: 0, Escrow: 0, Other: 0 };
    completed.forEach(p => {
      const s = resolveSource(p);
      map[s] = (map[s] || 0) + (p.amount || 0);
    });
    return map;
  }, [filtered]);

  const topPeople = useMemo(() => {
    const clients = new Map();
    const freelancers = new Map();
    filtered.forEach(p => {
      if (p.payer?._id) {
        const cur = clients.get(p.payer._id.toString()) || { name: userFullName(p.payer), total: 0, count: 0 };
        cur.total += p.amount || 0;
        cur.count += 1;
        clients.set(p.payer._id.toString(), cur);
      }
      if (p.payee?._id) {
        const cur = freelancers.get(p.payee._id.toString()) || { name: userFullName(p.payee), total: 0, count: 0 };
        cur.total += p.amount || 0;
        cur.count += 1;
        freelancers.set(p.payee._id.toString(), cur);
      }
    });
    const topClients = [...clients.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    const topFreelancers = [...freelancers.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    return { topClients, topFreelancers };
  }, [filtered]);

  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const totalAmount = filtered.reduce((s, p) => s + (p.amount || 0), 0);

  const SortHeader = ({ label, k, className }) => (
    <button onClick={() => toggleSort(k)} className={clsx('inline-flex items-center gap-1 uppercase hover:text-gray-700 dark:hover:text-gray-300', className)}>
      {label}
      {sortKey === k && (sortDir === 'asc' ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />)}
    </button>
  );

  const columns = [
    {
      key: 'reference', label: 'Transaction',
      render: (r) => (
        <div>
          <p className="text-xs font-mono font-medium text-gray-900 dark:text-white">{r.reference}</p>
          <p className="text-[11px] text-gray-400 font-mono">{r._id?.slice(-10)}</p>
        </div>
      ),
    },
    {
      key: 'createdAt', label: 'Date',
      render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy')}</span>,
      header: () => <DateHeaderDropdown dateRange={dateRange} onChange={applyDateRange} />,
    },
    { key: 'source', label: 'Source', render: (r) => {
      const s = resolveSource(r);
      const meta = SOURCE_META[s] || SOURCE_META.Other;
      return <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium', meta.bg, meta.color)}>{s}</span>;
    } },
    { key: 'payer', label: 'Client', render: (r) => <span className="text-xs text-gray-600 dark:text-gray-400">{userFullName(r.payer)}</span> },
    { key: 'payee', label: 'Freelancer', render: (r) => <span className="text-xs text-gray-600 dark:text-gray-400">{r.payee?._id ? userFullName(r.payee) : '—'}</span> },
    { key: 'work', label: 'Job/Service', render: (r) => <span className="text-xs text-gray-600 dark:text-gray-400">{r.serviceOrder?.title || r.serviceOrder?.service?.title || r.project?.title || '—'}</span> },
    {
      key: 'amount', label: 'Amount', align: 'right',
      render: (r) => (
        <div className="text-right">
          <p className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(r.amount, r.currency)}</p>
          <p className="text-[11px] text-gray-400 capitalize">{r.type?.replace(/_/g, ' ')}</p>
        </div>
      ),
      header: () => <SortHeader label="Amount" k="amount" />,
    },
    {
      key: 'commission', label: 'Commission', align: 'right',
      render: (r) => <span className="text-xs font-semibold text-green-600">{formatCurrency(r.commission, r.currency)}</span>,
      header: () => <SortHeader label="Commission" k="commission" />,
    },
    { key: 'status', label: 'Status', header: () => <HeaderDropdown label="Status" value={statusFilter} options={TX_STATUSES.filter(o => o.value)} onSelect={(v) => { setStatusFilter(v); setPage(1); }} />, render: (r) => <Badge status={r.status} /> },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.invoiceNumber && (
            <button onClick={() => downloadInvoice(r._id)} title="Download invoice"
              className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
              <DocumentArrowDownIcon className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => openDetails(r)} title="View Details"
            className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
            <EyeIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const hasActiveFilters = sourceFilter || roleFilter || typeFilter || statusFilter || methodFilter || searchQuery || dateRange.startDate || dateRange.endDate;

  const resetFilters = () => {
    setSourceFilter(undefined);
    setRoleFilter(undefined);
    setTypeFilter(undefined);
    setStatusFilter(undefined);
    setMethodFilter(undefined);
    setSearchQuery('');
    setDateRange({ startDate: '', endDate: '' });
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" title="Back to overview">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revenue & Transaction Analysis</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Where did this revenue come from?</p>
          </div>
        </div>
        <button onClick={() => navigate('/admin/finance/transactions')}
          className="px-3 py-2 rounded-lg text-xs font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors flex items-center gap-1">
          <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> View full transaction management
        </button>
      </div>

      {/* Money-movement clarity legend */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Revenue', desc: 'Actual platform revenue', icon: CurrencyDollarIcon, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
          { label: 'Transaction Volume', desc: 'Total amount processed', icon: ChartBarIcon, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Platform Commission', desc: 'Commission collected by SkillHub', icon: ReceiptPercentIcon, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' },
          { label: 'Escrow', desc: 'Money held for projects/orders', icon: ShieldCheckIcon, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' },
          { label: 'Withdrawals / Refunds', desc: 'Paid out / returned to users', icon: BanknotesIcon, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', item.color)}>
              <item.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">{item.label}</p>
              <p className="text-[11px] text-gray-400">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(1); }}
            placeholder="Search TX ID, client/freelancer, job/project/service..." />
          <SelectFilter label="All Sources" value={sourceFilter} onChange={(v) => { setSourceFilter(v); setPage(1); }} options={SOURCES.filter(s => s !== 'All')} />
          <SelectFilter label="All Roles" value={roleFilter} onChange={(v) => { setRoleFilter(v); setPage(1); }} options={USER_ROLES.filter(r => r !== 'All')} />
          <SelectFilter label="All Types" value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} options={TX_TYPES.filter(o => o.value)} />
          <SelectFilter label="All Statuses" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={TX_STATUSES.filter(o => o.value)} />
          <SelectFilter label="All Methods" value={methodFilter} onChange={(v) => { setMethodFilter(v); setPage(1); }} options={PAYMENT_METHODS.filter(o => o.value)} />
          {hasActiveFilters && (
            <button onClick={resetFilters} className="px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              Clear Filters
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] text-gray-400 uppercase font-medium">Date:</span>
          <DateHeaderDropdown dateRange={dateRange} onChange={applyDateRange} />
          <input type="date" value={dateRange.startDate || ''} onChange={e => applyDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={dateRange.endDate || ''} onChange={e => applyDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300" />
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-bold text-gray-900 dark:text-white">{filtered.length.toLocaleString()}</span> transactions matching filters
          {meta?.total ? ` (of ${meta.total.toLocaleString()} total)` : ''}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Transaction volume: <span className="font-bold text-blue-600">{formatCurrency(totalAmount)}</span>
        </p>
      </div>

      {/* Revenue by Source */}
      <div className="card p-6">
        <SectionHeader title="Revenue by Source" icon={ChartBarIcon} subtitle="Completed transactions grouped by source" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
          {Object.keys(sourceBreakdown).map(s => (
            <SourceStat key={s} label={s} total={sourceBreakdown[s]} count={filtered.filter(p => p.status === 'completed' && resolveSource(p) === s).length} />
          ))}
        </div>
      </div>

      {/* Top Clients & Freelancers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <SectionHeader title="Top Clients" icon={UsersIcon} subtitle="By transaction volume" />
          <div className="mt-4 space-y-3">
            {topPeople.topClients.length > 0 ? topPeople.topClients.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-600">
                  {c.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-900 dark:text-white">{c.name}</p>
                  <p className="text-[11px] text-gray-400">{c.count} transactions</p>
                </div>
                <span className="text-xs font-bold text-primary-600">{formatCurrency(c.total)}</span>
              </div>
            )) : <p className="text-center text-sm text-gray-400 py-8">No client transaction data</p>}
          </div>
        </div>
        <div className="card p-6">
          <SectionHeader title="Top Freelancers" icon={UsersIcon} subtitle="By transaction volume" />
          <div className="mt-4 space-y-3">
            {topPeople.topFreelancers.length > 0 ? topPeople.topFreelancers.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600">
                  {f.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-900 dark:text-white">{f.name}</p>
                  <p className="text-[11px] text-gray-400">{f.count} transactions</p>
                </div>
                <span className="text-xs font-bold text-green-600">{formatCurrency(f.total)}</span>
              </div>
            )) : <p className="text-center text-sm text-gray-400 py-8">No freelancer transaction data</p>}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Transactions</h3>
          </div>
          <span className="text-xs text-gray-400">{filtered.length.toLocaleString()} records</span>
        </div>
        <DataTable loading={isLoading} columns={columns} data={pageRows} emptyMessage="No transactions found for the selected filters" />
        {filtered.length > pageSize && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <Pagination meta={{ total: filtered.length, page: safePage, totalPages, hasNextPage: safePage < totalPages, hasPrevPage: safePage > 1 }} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminFinanceOverview() {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [liveConnected, setLiveConnected] = useState(false);
  const [live, setLive] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [detailTx, setDetailTx] = useState(null);

  const [analysisSearch, setAnalysisSearch] = useState('');
  const [analysisSource, setAnalysisSource] = useState(undefined);
  const [analysisRole, setAnalysisRole] = useState(undefined);
  const [analysisType, setAnalysisType] = useState(undefined);
  const [analysisStatus, setAnalysisStatus] = useState(undefined);
  const [analysisMethod, setAnalysisMethod] = useState(undefined);
  const [analysisDate, setAnalysisDate] = useState({ startDate: '', endDate: '' });

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const dateParams = useMemo(() => {
    const p = {};
    if (dateRange.startDate) p.startDate = dateRange.startDate;
    if (dateRange.endDate) p.endDate = dateRange.endDate;
    return p;
  }, [dateRange]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleConnect = () => setLiveConnected(true);
    const handleDisconnect = () => setLiveConnected(false);
    const handlePayment = () => queryClient.invalidateQueries(['admin-finance-overview']);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('payment:completed', handlePayment);
    if (socket.connected) setLiveConnected(true);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('payment:completed', handlePayment);
    };
  }, [queryClient]);

  const { data: liveStats } = useQuery({
    queryKey: ['admin-finance-live', live],
    queryFn: () => adminFinanceService.getLiveStats().then(r => r.data),
    refetchInterval: live ? 5000 : 30000,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin-finance-overview', dateParams],
    queryFn: () => adminFinanceService.getOverview(dateParams).then(r => r.data),
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['admin-finance-revenue', dateParams],
    queryFn: () => adminFinanceService.getRevenue({ ...dateParams, period: 'daily' }).then(r => r.data),
  });

  const { data: categoryRevenue, isLoading: categoryLoading } = useQuery({
    queryKey: ['admin-finance-cat-rev', dateParams],
    queryFn: () => adminFinanceService.getCategoryRevenue(dateParams).then(r => r.data),
  });

  const revenueChart = useMemo(() => {
    const rev = revenueData?.data?.revenue ?? [];
    const comm = revenueData?.data?.commissions ?? [];
    const keyOf = (g) => {
      if (!g?._id) return '';
      const { year, month, day } = g._id;
      return `${year}-${String(month).padStart(2, '0')}-${String(day ?? 1).padStart(2, '0')}`;
    };
    const revMap = new Map(rev.map(r => [keyOf(r), r.total]));
    const commMap = new Map(comm.map(c => [keyOf(c), c.total]));
    const keys = [...new Set([...revMap.keys(), ...commMap.keys()])].sort();
    return {
      labels: keys.map(k => format(new Date(`${k}T00:00:00`), 'MMM d')),
      revenue: keys.map(k => revMap.get(k) || 0),
      commissions: keys.map(k => commMap.get(k) || 0),
    };
  }, [revenueData]);

  const categoryChart = useMemo(() => {
    const rows = categoryRevenue?.data ?? [];
    const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#f97316', '#ec4899'];
    return { rows, colors };
  }, [categoryRevenue]);

  const ov = overview?.data;

  const openAnalysis = useCallback((overrides = {}) => {
    setAnalysisSource(overrides.source ?? undefined);
    setAnalysisRole(overrides.role ?? undefined);
    setAnalysisType(overrides.type ?? undefined);
    setAnalysisStatus(overrides.status ?? undefined);
    setAnalysisMethod(overrides.method ?? undefined);
    setAnalysisDate(overrides.date ?? { startDate: '', endDate: '' });
    setAnalysisSearch(overrides.search ?? '');
    setShowAnalysis(true);
  }, []);
  const openTxns = useCallback(() => navigate('/admin/finance/transactions'), [navigate]);

  if (showAnalysis) {
    return (
      <>
        <RevenueAnalysis
          onBack={() => setShowAnalysis(false)}
          openDetails={setDetailTx}
          sourceFilter={analysisSource} setSourceFilter={setAnalysisSource}
          roleFilter={analysisRole} setRoleFilter={setAnalysisRole}
          typeFilter={analysisType} setTypeFilter={setAnalysisType}
          statusFilter={analysisStatus} setStatusFilter={setAnalysisStatus}
          methodFilter={analysisMethod} setMethodFilter={setAnalysisMethod}
          dateRange={analysisDate} setDateRange={setAnalysisDate}
          searchQuery={analysisSearch} setSearchQuery={setAnalysisSearch}
        />
        <TransactionDetailModal transaction={detailTx} onClose={() => setDetailTx(null)} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Platform financial management & analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator active={liveConnected || live} />
          <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} live={live} onLiveToggle={() => setLive(v => !v)} />
        </div>
      </div>

      {overviewLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 * 0.05 }}
              onClick={() => openAnalysis()}
              className="card p-5 relative overflow-hidden group hover:shadow-card-hover transition-shadow cursor-pointer">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-[3rem] bg-green-50 dark:bg-green-900/20 opacity-50 -mr-6 -mt-6 group-hover:scale-110 transition-transform" />
              <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-3 relative z-10">
                <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white relative z-10">{formatCurrency(ov?.revenue?.total)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 relative z-10">Total Revenue</p>
              <div className="flex items-center gap-2 mt-1.5 relative z-10">
                <button onClick={(e) => { e.stopPropagation(); openTxns(); }}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-0.5">
                  {ov?.revenue?.transactionCount || 0} txns
                </button>
                <span className="text-[11px] text-gray-300">·</span>
                <span className="text-[11px] text-gray-400 inline-flex items-center gap-0.5">Analyze <EyeIcon className="w-3 h-3" /></span>
              </div>
            </motion.div>
            <KPICard label="Platform Commission" value={formatCurrency(ov?.commissions?.total)} icon={ReceiptPercentIcon} color="text-primary-600" bg="bg-primary-50 dark:bg-primary-900/20" sub={`${ov?.commissions?.count || 0} collected`} delay={1} onClick={() => openAnalysis({ type: 'commission' })} />
            <KPICard label="Platform Balance" value={formatCurrency(ov?.wallets?.totalBalance)} icon={BanknotesIcon} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-900/20" sub={`${ov?.wallets?.walletCount || 0} wallets`} delay={2} onClick={openTxns} />
            <KPICard label="Active Escrow" value={formatCurrency(ov?.escrows?.activeAmount)} icon={ShieldCheckIcon} color="text-yellow-600" bg="bg-yellow-50 dark:bg-yellow-900/20" sub={`${ov?.escrows?.activeCount || 0} held`} delay={3} onClick={() => navigate('/admin/finance/escrow?status=active')} />
            <KPICard label="Monthly Revenue" value={formatCurrency(ov?.revenue?.monthlyRecurring)} icon={CalendarDaysIcon} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-900/20" sub="Current month" trend={ov?.revenue?.growthPercent} delay={4} onClick={() => openAnalysis({ date: { startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'), endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd') } })} />
          </div>

          {/* Revenue Trend & Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="card p-6 lg:col-span-3">
              <SectionHeader title="Revenue Trend" icon={ChartBarIcon} subtitle="Daily completed payments vs commissions" />
              {revenueLoading ? (
                <SkeletonCard />
              ) : revenueChart.labels.length > 0 ? (
                <div className="mt-4 h-72">
                  <Line
                    data={{
                      labels: revenueChart.labels,
                      datasets: [
                        { label: 'Revenue', data: revenueChart.revenue, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.12)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#22c55e' },
                        { label: 'Commission', data: revenueChart.commissions, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#6366f1' },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: { mode: 'index', intersect: false },
                      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true, font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } } },
                      scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatCurrency(v) } } },
                    }}
                  />
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400 py-16">No revenue data for the selected range</p>
              )}
            </div>
            <div className="card p-6 lg:col-span-2">
              <SectionHeader title="Revenue by Category" icon={Squares2X2Icon} subtitle="Top earning categories" />
              {categoryLoading ? (
                <SkeletonCard />
              ) : categoryChart.rows.length > 0 ? (
                <>
                  <div className="mt-4 flex justify-center h-44">
                    <Doughnut
                      data={{
                        labels: categoryChart.rows.slice(0, 8).map(c => c._id),
                        datasets: [{ data: categoryChart.rows.slice(0, 8).map(c => c.totalRevenue), backgroundColor: categoryChart.rows.slice(0, 8).map((_, i) => categoryChart.colors[i % categoryChart.colors.length]), borderWidth: 0 }],
                      }}
                      options={{ cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}` } } } }}
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    {categoryChart.rows.slice(0, 6).map((c, i) => {
                      const max = categoryChart.rows[0]?.totalRevenue || 1;
                      return (
                        <div key={c._id} className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoryChart.colors[i % categoryChart.colors.length] }} />
                          <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{c._id}</span>
                          <div className="hidden sm:block w-24 h-1.5 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min((c.totalRevenue / max) * 100, 100)}%`, backgroundColor: categoryChart.colors[i % categoryChart.colors.length] }} />
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-white w-24 text-right">{formatCurrency(c.totalRevenue)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-gray-400 py-16">No category data for the selected range</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <SectionHeader title="Live Transactions" icon={FireIcon} subtitle="Last 5 minutes" action={<LiveIndicator active={liveConnected || live} />} />
              <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
                {liveStats?.data?.recentTransactions?.length > 0 ? liveStats.data.recentTransactions.map(tx => (
                  <div key={tx._id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/40 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center',
                        ['deposit', 'escrow_release', 'refund'].includes(tx.type) ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20')}>
                        {['deposit', 'escrow_release', 'refund'].includes(tx.type)
                          ? <ArrowDownIcon className="w-3.5 h-3.5 text-green-600" />
                          : <ArrowUpIcon className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-900 dark:text-white capitalize">{tx.type?.replace(/_/g, ' ')}</p>
                        <p className="text-[11px] text-gray-400">{tx.user?.firstName} {tx.user?.lastName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={clsx('text-xs font-bold', ['deposit', 'escrow_release', 'refund'].includes(tx.type) ? 'text-green-600' : 'text-red-500')}>
                        {formatCurrency(tx.amount, tx.currency)}
                      </p>
                      <p className="text-[11px] text-gray-400">{format(new Date(tx.createdAt), 'HH:mm:ss')}</p>
                    </div>
                  </div>
                )) : <p className="text-center text-xs text-gray-400 py-8">No recent transactions</p>}
              </div>
            </div>

            <div className="card p-6">
              <SectionHeader title="Recent Payments" icon={CreditCardIcon} subtitle="Click a payment to view details" />
              <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
                {ov?.recentPayments?.length > 0 ? ov.recentPayments.map(p => (
                  <button key={p._id} onClick={() => setDetailTx(p)} className="w-full flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/40 last:border-0 text-left hover:bg-gray-50/60 dark:hover:bg-dark-700/50 rounded-lg px-2 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center',
                        ['deposit', 'escrow_release', 'refund'].includes(p.type) ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20')}>
                        {['deposit', 'escrow_release', 'refund'].includes(p.type)
                          ? <ArrowDownIcon className="w-3.5 h-3.5 text-green-600" />
                          : <ArrowUpIcon className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-900 dark:text-white capitalize">{p.type?.replace(/_/g, ' ')}</p>
                        <p className="text-[11px] text-gray-400">{p.payer?.firstName} {p.payer?.lastName} · {p.reference?.slice(0, 16)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={clsx('text-xs font-bold', ['deposit', 'escrow_release', 'refund'].includes(p.type) ? 'text-green-600' : 'text-red-500')}>
                        {formatCurrency(p.amount, p.currency)}
                      </p>
                      <p className="text-[11px] text-gray-400">{format(new Date(p.createdAt), 'MMM d, HH:mm')}</p>
                    </div>
                  </button>
                )) : <p className="text-center text-xs text-gray-400 py-8">No recent payments</p>}
              </div>
            </div>
          </div>

          <div className="card p-6 group cursor-pointer hover:shadow-card-hover transition-shadow" onClick={() => navigate('/admin/finance/wallets')} title="Manage wallets">
            <SectionHeader title="Wallet Overview" icon={BanknotesIcon} subtitle="Platform-wide wallet statistics"
              action={
                <span className="text-xs font-medium text-primary-600 inline-flex items-center gap-1">
                  Manage wallets <ArrowRightIcon className="w-3.5 h-3.5" />
                </span>
              } />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
              {[
                { label: 'Total Balance', value: formatCurrency(ov?.wallets?.totalBalance) },
                { label: 'In Escrow', value: formatCurrency(ov?.wallets?.totalEscrow) },
                { label: 'Total Earned', value: formatCurrency(ov?.wallets?.totalEarned) },
                { label: 'Total Withdrawn', value: formatCurrency(ov?.wallets?.totalWithdrawn) },
                { label: 'Active Wallets', value: ov?.wallets?.walletCount || 0 },
              ].map(w => (
                <div key={w.label} className="text-center p-4 bg-gray-50 dark:bg-dark-700 rounded-xl group-hover:bg-primary-50/50 dark:group-hover:bg-dark-800 transition-colors">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{w.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{w.label}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <TransactionDetailModal transaction={detailTx} onClose={() => setDetailTx(null)} />
    </div>
  );
}
