import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { adminFinanceService } from '@/services/adminFinance.service';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { useConfirm, usePrompt } from '@/components/ui/DialogProvider';
import toast from 'react-hot-toast';
import {
  CurrencyDollarIcon, ShieldCheckIcon,
  BanknotesIcon, UsersIcon, DocumentTextIcon, ArrowDownIcon, ArrowUpIcon,
  ChartBarIcon, ClockIcon, ExclamationTriangleIcon, CheckCircleIcon,
  XCircleIcon, MagnifyingGlassIcon, FunnelIcon, ArrowPathIcon,
  DocumentArrowDownIcon, EyeIcon, ArrowUturnLeftIcon, HandRaisedIcon,
  FireIcon, CreditCardIcon, BanknotesIcon as WalletIcon, ReceiptPercentIcon,
  ScaleIcon, CogIcon, BellIcon, FlagIcon, CalendarDaysIcon,
  Squares2X2Icon, ListBulletIcon, AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { clsx } from 'clsx';
import { getSocket } from '@/services/socket';
import api from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { CreditCard, ShieldCheck, Smartphone, Landmark, Building2, Wallet, User, FlaskConical } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'overview', labelKey: 'dashboard.adminFinance.tabs.overview', icon: Squares2X2Icon },
  { id: 'analytics', labelKey: 'dashboard.adminFinance.tabs.analytics', icon: ChartBarIcon },
  { id: 'escrow', labelKey: 'dashboard.adminFinance.tabs.escrow', icon: ShieldCheckIcon },
  { id: 'payments', labelKey: 'dashboard.adminFinance.tabs.payments', icon: CreditCardIcon },
  { id: 'withdrawals', labelKey: 'dashboard.adminFinance.tabs.withdrawals', icon: BanknotesIcon },
  { id: 'commissions', labelKey: 'dashboard.adminFinance.tabs.commissions', icon: ReceiptPercentIcon },
  { id: 'refunds', labelKey: 'dashboard.adminFinance.tabs.refunds', icon: ScaleIcon },
  { id: 'reports', labelKey: 'dashboard.adminFinance.tabs.reports', icon: DocumentArrowDownIcon },
  { id: 'audit', labelKey: 'dashboard.adminFinance.tabs.audit', icon: FlagIcon },
  { id: 'settings', labelKey: 'dashboard.adminFinance.tabs.settings', icon: CogIcon },
];

const DATE_PRESETS = [
  { labelKey: 'dashboard.adminFinance.datePresets.today', value: () => ({ start: format(new Date(), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
  { labelKey: 'dashboard.adminFinance.datePresets.sevenDays', value: () => ({ start: format(subDays(new Date(), 7), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
  { labelKey: 'dashboard.adminFinance.datePresets.thirtyDays', value: () => ({ start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
  { labelKey: 'dashboard.adminFinance.datePresets.thisMonth', value: () => ({ start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') }) },
  { labelKey: 'dashboard.adminFinance.datePresets.lastMonth', value: () => ({ start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd') }) },
];

const GATEWAY_ICONS = {
  stripe: CreditCard,
  chapa: ShieldCheck,
  telebirr: Smartphone,
  cbe_birr: Landmark,
  bank_transfer: Building2,
  wallet: Wallet,
  manual: User,
  demo: FlaskConical,
};

// ═══════════════════════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function KPICard({ label, value, icon: Icon, color, bg, sub, delay = 0, trend }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.05 }} className="card p-5 relative overflow-hidden group hover:shadow-card-hover transition-shadow">
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-[3rem] ${bg} opacity-50 -mr-6 -mt-6 group-hover:scale-110 transition-transform`} />
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3 relative z-10`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white relative z-10">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 relative z-10">{label}</p>
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-2 mt-1.5 relative z-10">
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
          {trend !== undefined && (
            <span className={clsx('text-xs font-semibold flex items-center gap-0.5', trend >= 0 ? 'text-green-600' : 'text-red-500')}>
              {trend >= 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

function SectionHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {Icon && <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center"><Icon className="w-4 h-4 text-primary-600" /></div>}
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function DateRangeFilter({ dateRange, setDateRange, presets }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map(p => (
        <button key={p.label} onClick={() => { const v = p.value(); setDateRange({ startDate: v.start, endDate: v.end }); }}
          className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            dateRange.startDate === p.value().start ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600')}>
          {p.label}
        </button>
      ))}
      <input type="date" value={dateRange.startDate || ''} onChange={e => setDateRange(p => ({ ...p, startDate: e.target.value }))}
        className="px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300" />
      <span className="text-gray-400 text-xs">to</span>
      <input type="date" value={dateRange.endDate || ''} onChange={e => setDateRange(p => ({ ...p, endDate: e.target.value }))}
        className="px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300" />
    </div>
  );
}

function DataTable({ columns, data, loading, emptyMessage = 'No data found' }) {
  if (loading) return <div className="p-4"><SkeletonText lines={8} /></div>;
  if (!data?.length) return <p className="text-center text-sm text-gray-400 py-12">{emptyMessage}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-dark-700">
          <tr>{columns.map(col => (
            <th key={col.key} className={clsx('px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase', col.align === 'right' && 'text-right')}>{col.label}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
          {data.map((row, i) => (
            <tr key={row._id || i} className="hover:bg-gray-50/50 dark:hover:bg-dark-700/50 transition-colors">
              {columns.map(col => (
                <td key={col.key} className={clsx('px-4 py-3', col.align === 'right' && 'text-right')}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionModal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div className="p-5">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function LiveIndicator({ active }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium">
      <span className={clsx('w-2 h-2 rounded-full', active ? 'bg-green-500 animate-pulse' : 'bg-gray-300')} />
      {active ? 'Live' : 'Offline'}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminFinanceDashboard() {
  const [tab, setTab] = useState('overview');
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const queryClient = useQueryClient();

  const dateParams = useMemo(() => {
    const p = {};
    if (dateRange.startDate) p.startDate = dateRange.startDate;
    if (dateRange.endDate) p.endDate = dateRange.endDate;
    return p;
  }, [dateRange]);

  // ─── Socket.io live updates ─────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleConnect = () => setLiveConnected(true);
    const handleDisconnect = () => setLiveConnected(false);
    const handlePayment = () => queryClient.invalidateQueries(['admin-finance-overview']);
    const handleEscrow = () => queryClient.invalidateQueries(['admin-finance-escrows']);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('payment:completed', handlePayment);
    socket.on('escrow:updated', handleEscrow);

    if (socket.connected) setLiveConnected(true);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('payment:completed', handlePayment);
      socket.off('escrow:updated', handleEscrow);
    };
  }, [queryClient]);

  // Live polling (every 30s)
  const { data: liveStats } = useQuery({
    queryKey: ['admin-finance-live'],
    queryFn: () => adminFinanceService.getLiveStats().then(r => r.data),
    refetchInterval: 30000,
    enabled: tab === 'overview',
  });

  // ─── Queries ────────────────────────────────────────────────────────────
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin-finance-overview', dateParams],
    queryFn: () => adminFinanceService.getOverview(dateParams).then(r => r.data),
    enabled: tab === 'overview',
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['admin-finance-revenue', dateParams],
    queryFn: () => adminFinanceService.getRevenue({ ...dateParams, period: 'daily' }).then(r => r.data),
    enabled: tab === 'analytics',
  });

  const { data: trendsData } = useQuery({
    queryKey: ['admin-finance-trends', dateParams],
    queryFn: () => adminFinanceService.getTrends(dateParams).then(r => r.data),
    enabled: tab === 'analytics',
  });

  const { data: categoryRevenue } = useQuery({
    queryKey: ['admin-finance-cat-rev', dateParams],
    queryFn: () => adminFinanceService.getCategoryRevenue(dateParams).then(r => r.data),
    enabled: tab === 'analytics',
  });

  const { data: topFreelancers } = useQuery({
    queryKey: ['admin-finance-top-fl', dateParams],
    queryFn: () => adminFinanceService.getTopFreelancers({ ...dateParams, limit: 10 }).then(r => r.data),
    enabled: tab === 'analytics',
  });

  const { data: topClients } = useQuery({
    queryKey: ['admin-finance-top-cl', dateParams],
    queryFn: () => adminFinanceService.getTopClients({ ...dateParams, limit: 10 }).then(r => r.data),
    enabled: tab === 'analytics',
  });

  const { data: heatMap } = useQuery({
    queryKey: ['admin-finance-heatmap', dateParams],
    queryFn: () => adminFinanceService.getHeatMap(dateParams).then(r => r.data),
    enabled: tab === 'analytics',
  });

  const { data: escrowData, isLoading: escrowLoading } = useQuery({
    queryKey: ['admin-finance-escrows', page, filters],
    queryFn: () => adminFinanceService.getEscrows({ page, limit: 15, ...filters, ...dateParams }).then(r => r.data),
    enabled: tab === 'escrow',
  });

  const { data: escrowStats } = useQuery({
    queryKey: ['admin-finance-escrow-stats'],
    queryFn: () => adminFinanceService.getEscrowStats().then(r => r.data),
    enabled: tab === 'escrow',
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['admin-finance-payments', page, filters, searchQuery],
    queryFn: () => {
      if (searchQuery) return adminFinanceService.searchPayments({ page, limit: 15, q: searchQuery, ...filters, ...dateParams }).then(r => r.data);
      return adminFinanceService.getPayments({ page, limit: 15, ...filters, ...dateParams }).then(r => r.data);
    },
    enabled: tab === 'payments',
  });

  const { data: withdrawalsData, isLoading: withdrawalsLoading } = useQuery({
    queryKey: ['admin-finance-withdrawals', page, filters],
    queryFn: () => adminFinanceService.getWithdrawals({ page, limit: 15, ...filters, ...dateParams }).then(r => r.data),
    enabled: tab === 'withdrawals',
  });

  const { data: withdrawalStats } = useQuery({
    queryKey: ['admin-finance-wd-stats'],
    queryFn: () => adminFinanceService.getWithdrawalStats().then(r => r.data),
    enabled: tab === 'withdrawals',
  });

  const { data: commissionHistory, isLoading: commissionLoading } = useQuery({
    queryKey: ['admin-finance-commission', page, dateParams],
    queryFn: () => adminFinanceService.getCommissionHistory({ page, limit: 15, ...dateParams }).then(r => r.data),
    enabled: tab === 'commissions',
  });

  const { data: commissionSettings } = useQuery({
    queryKey: ['admin-finance-commission-settings'],
    queryFn: () => adminFinanceService.getCommissionSettings().then(r => r.data),
    enabled: tab === 'settings',
  });

  const { data: refundData } = useQuery({
    queryKey: ['admin-finance-refunds'],
    queryFn: () => adminFinanceService.getRefundDashboard().then(r => r.data),
    enabled: tab === 'refunds',
  });

  const { data: disputesData } = useQuery({
    queryKey: ['admin-finance-disputes', page],
    queryFn: () => adminFinanceService.getDisputes({ page, limit: 15 }).then(r => r.data),
    enabled: tab === 'refunds',
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['admin-finance-audit', page, dateParams],
    queryFn: () => adminFinanceService.getAuditLogs({ page, limit: 15, ...dateParams }).then(r => r.data),
    enabled: tab === 'audit',
  });

  const { data: suspiciousData } = useQuery({
    queryKey: ['admin-finance-suspicious'],
    queryFn: () => adminFinanceService.getSuspiciousActivity().then(r => r.data),
    enabled: tab === 'audit',
  });

  const ov = overview?.data;

  // ─── Tab change resets page ────────────────────────────────────────────
  const handleTabChange = useCallback((t) => { setTab(t); setPage(1); setSearchQuery(''); setFilters({}); }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Finance Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Platform financial management & analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator active={liveConnected} />
          <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto pb-px">
        {TABS.map(item => (
          <button key={item.id} onClick={() => handleTabChange(item.id)}
            className={clsx('flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              tab === item.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
            <item.icon className="w-4 h-4" />
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab === 'overview' && (
        <>
          {overviewLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <>
              {/* Primary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                <KPICard label="Total Revenue" value={formatCurrency(ov?.revenue?.total)} icon={CurrencyDollarIcon} color="text-green-600" bg="bg-green-50 dark:bg-green-900/20" sub={`${ov?.revenue?.transactionCount || 0} txns`} trend={ov?.revenue?.growthPercent} delay={0} />
                <KPICard label="Platform Commission" value={formatCurrency(ov?.commissions?.total)} icon={ReceiptPercentIcon} color="text-primary-600" bg="bg-primary-50 dark:bg-primary-900/20" sub={`${ov?.commissions?.count || 0} collected`} delay={1} />
                <KPICard label="Platform Balance" value={formatCurrency(ov?.wallets?.totalBalance)} icon={WalletIcon} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-900/20" sub={`${ov?.wallets?.walletCount || 0} wallets`} delay={2} />
                <KPICard label="Active Escrow" value={formatCurrency(ov?.escrows?.activeAmount)} icon={ShieldCheckIcon} color="text-yellow-600" bg="bg-yellow-50 dark:bg-yellow-900/20" sub={`${ov?.escrows?.activeCount || 0} held`} delay={3} />
                <KPICard label="Monthly Revenue" value={formatCurrency(ov?.revenue?.monthlyRecurring)} icon={CalendarDaysIcon} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-900/20" sub="Current month" trend={ov?.revenue?.growthPercent} delay={4} />
              </div>

              {/* Secondary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                <KPICard label="Total Transactions" value={ov?.payments?.total || 0} icon={DocumentTextIcon} color="text-gray-600" bg="bg-gray-50 dark:bg-gray-900/20" sub={`${ov?.payments?.successful || 0} success`} delay={6} />
                <KPICard label="Pending Withdrawals" value={ov?.withdrawals?.pending || 0} icon={BanknotesIcon} color="text-orange-600" bg="bg-orange-50 dark:bg-orange-900/20" delay={7} />
                <KPICard label="Completed Withdrawals" value={ov?.withdrawals?.completed || 0} icon={CheckCircleIcon} color="text-green-600" bg="bg-green-50 dark:bg-green-900/20" sub={`${formatCurrency(ov?.withdrawals?.totalAmount)}`} delay={8} />
                <KPICard label="Failed Withdrawals" value={ov?.withdrawals?.failed || 0} icon={XCircleIcon} color="text-red-600" bg="bg-red-50 dark:bg-red-900/20" delay={9} />
                <KPICard label="Disputed Escrow" value={formatCurrency(ov?.escrows?.disputedAmount)} icon={ExclamationTriangleIcon} color="text-red-600" bg="bg-red-50 dark:bg-red-900/20" sub={`${ov?.escrows?.disputedCount || 0} disputes`} delay={10} />
                <KPICard label="Total Refunds" value={formatCurrency(ov?.refunds?.totalAmount)} icon={ArrowUturnLeftIcon} color="text-pink-600" bg="bg-pink-50 dark:bg-pink-900/20" sub={`${ov?.refunds?.pending || 0} pending`} delay={11} />
                <KPICard label="Active Contracts" value={ov?.contracts?.active || 0} icon={DocumentTextIcon} color="text-indigo-600" bg="bg-indigo-50 dark:bg-indigo-900/20" sub={`${formatCurrency(ov?.contracts?.activeEscrow)}`} delay={12} />
              </div>

              {/* User Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <KPICard label="New Users Today" value={ov?.users?.newToday || 0} icon={UsersIcon} color="text-cyan-600" bg="bg-cyan-50 dark:bg-cyan-900/20" delay={13} />
                <KPICard label="Active Freelancers" value={ov?.users?.activeFreelancers || 0} icon={UsersIcon} color="text-teal-600" bg="bg-teal-50 dark:bg-teal-900/20" delay={14} />
                <KPICard label="Active Clients" value={ov?.users?.activeClients || 0} icon={UsersIcon} color="text-sky-600" bg="bg-sky-50 dark:bg-sky-900/20" delay={15} />
              </div>

              {/* Live Transactions & Recent Payments */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Live Transactions */}
                <div className="card p-6">
                  <SectionHeader title="Live Transactions" icon={FireIcon} subtitle="Last 5 minutes" action={<LiveIndicator active={liveConnected} />} />
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

                {/* Recent Payments */}
                <div className="card p-6">
                  <SectionHeader title="Recent Payments" icon={CreditCardIcon} subtitle="Latest platform payments" />
                  <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
                    {ov?.recentPayments?.length > 0 ? ov.recentPayments.map(p => (
                      <div key={p._id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/40 last:border-0">
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
                      </div>
                    )) : <p className="text-center text-xs text-gray-400 py-8">No recent payments</p>}
                  </div>
                </div>
              </div>

              {/* Wallet Overview */}
              <div className="card p-6">
                <SectionHeader title="Wallet Overview" icon={WalletIcon} subtitle="Platform-wide wallet statistics" />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                  {[
                    { label: 'Total Balance', value: formatCurrency(ov?.wallets?.totalBalance) },
                    { label: 'In Escrow', value: formatCurrency(ov?.wallets?.totalEscrow) },
                    { label: 'Total Earned', value: formatCurrency(ov?.wallets?.totalEarned) },
                    { label: 'Total Withdrawn', value: formatCurrency(ov?.wallets?.totalWithdrawn) },
                    { label: 'Active Wallets', value: ov?.wallets?.walletCount || 0 },
                  ].map(w => (
                    <div key={w.label} className="text-center p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{w.value}</p>
                      <p className="text-xs text-gray-400 mt-1">{w.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ ANALYTICS TAB ═══ */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {revenueLoading ? <SkeletonCard /> : (
            <>
              {/* Revenue Chart (text-based representation) */}
              <div className="card p-6">
                <SectionHeader title="Revenue Trend" icon={ChartBarIcon} subtitle="Daily completed payments" />
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                  {revenueData?.data?.revenue?.length > 0 ? revenueData.data.revenue.slice(-30).map((r, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-20 shrink-0">{r._id.day ? `${r._id.month}/${r._id.day}` : r._id.month ? `${r._id.year}/${r._id.month}` : r._id.year}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-dark-700 rounded-full h-5 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((r.total / Math.max(...revenueData.data.revenue.map(x => x.total))) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-24 text-right">{formatCurrency(r.total)}</span>
                      <span className="text-[11px] text-gray-400 w-12 text-right">{r.count}x</span>
                    </div>
                  )) : <p className="text-center text-sm text-gray-400 py-8">No revenue data</p>}
                </div>
              </div>

              {/* Category Revenue */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-6">
                  <SectionHeader title="Revenue by Category" icon={Squares2X2Icon} />
                  <div className="mt-4 space-y-3">
                    {categoryRevenue?.data?.length > 0 ? categoryRevenue.data.slice(0, 10).map((c, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-900 dark:text-white">{c._id}</span>
                          <span className="text-[11px] text-gray-400">({c.count} txns)</span>
                        </div>
                        <span className="text-xs font-bold text-primary-600">{formatCurrency(c.totalRevenue)}</span>
                      </div>
                    )) : <p className="text-center text-sm text-gray-400 py-8">No category data</p>}
                  </div>
                </div>

                {/* Heat Map */}
                <div className="card p-6">
                  <SectionHeader title="Transaction Heat Map" icon={FireIcon} subtitle="Activity by day & hour" />
                  <div className="mt-4 grid grid-cols-7 gap-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="text-center text-[10px] font-medium text-gray-400 pb-1">{d}</div>
                    ))}
                    {Array.from({ length: 7 }).map((_, day) =>
                      Array.from({ length: 24 }).map((_, hour) => {
                        const point = heatMap?.data?.find(h => h._id.dayOfWeek === day + 1 && h._id.hour === hour);
                        const intensity = point ? Math.min(point.count / 50, 1) : 0;
                        return (
                          <div key={`${day}-${hour}`} title={`Day ${day + 1}, Hour ${hour}: ${point?.count || 0} txns`}
                            className="aspect-square rounded-sm transition-colors"
                            style={{ backgroundColor: intensity > 0 ? `rgba(99, 102, 241, ${0.1 + intensity * 0.9})` : 'rgba(229, 231, 235, 0.3)' }} />
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Top Freelancers & Clients */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-6">
                  <SectionHeader title="Top Freelancers" icon={UsersIcon} subtitle="By earnings" />
                  <div className="mt-4 space-y-3">
                    {topFreelancers?.data?.length > 0 ? topFreelancers.data.map((f, i) => (
                      <div key={f._id} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600">
                          {f.user?.firstName?.[0]}{f.user?.lastName?.[0]}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-900 dark:text-white">{f.user?.firstName} {f.user?.lastName}</p>
                          <p className="text-[11px] text-gray-400">{f.transactionCount} transactions</p>
                        </div>
                        <span className="text-xs font-bold text-green-600">{formatCurrency(f.totalEarned)}</span>
                      </div>
                    )) : <p className="text-center text-sm text-gray-400 py-8">No data</p>}
                  </div>
                </div>
                <div className="card p-6">
                  <SectionHeader title="Top Clients" icon={UsersIcon} subtitle="By spending" />
                  <div className="mt-4 space-y-3">
                    {topClients?.data?.length > 0 ? topClients.data.map((c, i) => (
                      <div key={c._id} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-600">
                          {c.user?.firstName?.[0]}{c.user?.lastName?.[0]}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-900 dark:text-white">{c.user?.firstName} {c.user?.lastName}</p>
                          <p className="text-[11px] text-gray-400">{c.transactionCount} transactions</p>
                        </div>
                        <span className="text-xs font-bold text-primary-600">{formatCurrency(c.totalSpent)}</span>
                      </div>
                    )) : <p className="text-center text-sm text-gray-400 py-8">No data</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ ESCROW TAB ═══ */}
      {tab === 'escrow' && (
        <div className="space-y-6">
          {/* Escrow Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {escrowStats?.data?.map(s => (
              <KPICard key={s._id} label={s._id?.replace(/_/g, ' ')} value={formatCurrency(s.total)} icon={ShieldCheckIcon}
                color={s._id === 'released' ? 'text-green-600' : s._id === 'disputed' ? 'text-red-600' : 'text-yellow-600'}
                bg={s._id === 'released' ? 'bg-green-50 dark:bg-green-900/20' : s._id === 'disputed' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}
                sub={`${s.count} contracts`} />
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
              {['', 'pending', 'funded', 'in_progress', 'submitted', 'released', 'refunded', 'disputed', 'cancelled'].map(s => (
                <button key={s} onClick={() => { setFilters(f => s ? { ...f, status: s } : (({ status, ...rest }) => rest)(f)); setPage(1); }}
                  className={clsx('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    (s === '' && !filters.status) || filters.status === s ? 'bg-white dark:bg-dark-800 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
                  {s ? s.replace(/_/g, ' ') : 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Escrow Table */}
          <div className="card overflow-hidden">
            <DataTable loading={escrowLoading}
              columns={[
                { key: 'client', label: 'Client', render: (r) => <div><p className="font-medium text-gray-900 dark:text-white text-xs">{r.client?.firstName} {r.client?.lastName}</p><p className="text-[11px] text-gray-400">{r.client?.email}</p></div> },
                { key: 'freelancer', label: 'Freelancer', render: (r) => <div><p className="font-medium text-gray-900 dark:text-white text-xs">{r.freelancer?.firstName} {r.freelancer?.lastName}</p><p className="text-[11px] text-gray-400">{r.freelancer?.email}</p></div> },
                { key: 'project', label: 'Project', render: (r) => <span className="text-xs text-gray-600 dark:text-gray-400">{r.project?.title || '—'}</span> },
                { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-bold text-xs">{formatCurrency(r.amount, r.currency)}</span> },
                { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                { key: 'actions', label: '', align: 'right', render: (r) => (
                  <div className="flex items-center justify-end gap-1">
                    {['funded', 'in_progress', 'submitted'].includes(r.status) && (
                      <>
                        <EscrowActionButton escrow={r} action="release" label="Release" icon={CheckCircleIcon} color="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" />
                        <EscrowActionButton escrow={r} action="hold" label="Hold" icon={HandRaisedIcon} color="text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20" />
                        <EscrowActionButton escrow={r} action="refund" label="Refund" icon={ArrowUturnLeftIcon} color="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" />
                      </>
                    )}
                    {r.status === 'disputed' && (
                      <EscrowActionButton escrow={r} action="resolve" label="Resolve" icon={ScaleIcon} color="text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20" />
                    )}
                    <EscrowTimelineButton escrowId={r._id} />
                  </div>
                )},
              ]}
              data={escrowData?.data || []}
              emptyMessage="No escrows found"
            />
            {escrowData?.meta && <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700"><Pagination meta={escrowData.meta} onPageChange={setPage} /></div>}
          </div>
        </div>
      )}

      {/* ═══ PAYMENTS TAB ═══ */}
      {tab === 'payments' && (
        <div className="space-y-6">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search by TX ID, invoice, description..." value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <select value={filters.status || ''} onChange={e => { setFilters(f => e.target.status ? { ...f, status: e.target.value } : (({ status, ...rest }) => rest)(f)); setPage(1); }}
              className="px-3 py-2 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300">
              <option value="">All Status</option>
              {['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.provider || ''} onChange={e => { setFilters(f => e.target.provider ? { ...f, provider: e.target.value } : (({ provider, ...rest }) => rest)(f)); setPage(1); }}
              className="px-3 py-2 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300">
              <option value="">All Gateways</option>
              {['stripe', 'chapa', 'telebirr', 'cbe_birr', 'wallet', 'manual', 'demo'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={filters.type || ''} onChange={e => { setFilters(f => e.target.type ? { ...f, type: e.target.value } : (({ type, ...rest }) => rest)(f)); setPage(1); }}
              className="px-3 py-2 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300">
              <option value="">All Types</option>
              {['deposit', 'withdrawal', 'milestone_payment', 'project_payment', 'escrow', 'refund', 'commission'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          {/* Payments Table */}
          <div className="card overflow-hidden">
            <DataTable loading={paymentsLoading}
              columns={[
                { key: 'reference', label: 'TX ID', render: (r) => <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{r.reference?.slice(0, 18)}</span> },
                { key: 'provider', label: 'Gateway', render: (r) => { const Icon = GATEWAY_ICONS[r.provider] || CreditCard; return <span className="text-xs inline-flex items-center gap-1"><Icon className="w-3.5 h-3.5" aria-hidden="true" /> {r.provider}</span>; } },
                { key: 'type', label: 'Type', render: (r) => <span className="text-xs capitalize">{r.type?.replace(/_/g, ' ')}</span> },
                { key: 'payer', label: 'Client', render: (r) => <span className="text-xs text-gray-600 dark:text-gray-400">{r.payer?.firstName} {r.payer?.lastName}</span> },
                { key: 'payee', label: 'Freelancer', render: (r) => <span className="text-xs text-gray-600 dark:text-gray-400">{r.payee?.firstName ? `${r.payee.firstName} ${r.payee.lastName}` : '—'}</span> },
                { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-bold text-xs">{formatCurrency(r.amount, r.currency)}</span> },
                { key: 'commission', label: 'Commission', align: 'right', render: (r) => <span className="text-xs text-green-600">{formatCurrency(r.commission, r.currency)}</span> },
                { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                { key: 'createdAt', label: 'Date', render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy')}</span> },
                { key: 'actions', label: '', align: 'right', render: (r) => r.invoiceNumber && (
                  <button onClick={() => downloadInvoice(r._id)} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                    <DocumentArrowDownIcon className="w-3.5 h-3.5" /> Invoice
                  </button>
                )},
              ]}
              data={paymentsData?.data || []}
              emptyMessage="No payments found"
            />
            {paymentsData?.meta && <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700"><Pagination meta={paymentsData.meta} onPageChange={setPage} /></div>}
          </div>
        </div>
      )}

      {/* ═══ WITHDRAWALS TAB ═══ */}
      {tab === 'withdrawals' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {withdrawalStats?.data?.byStatus?.map(s => (
              <KPICard key={s._id} label={s._id?.replace(/_/g, ' ')} value={formatCurrency(s.total)} icon={BanknotesIcon}
                color={s._id === 'completed' ? 'text-green-600' : s._id === 'failed' ? 'text-red-600' : 'text-yellow-600'}
                bg={s._id === 'completed' ? 'bg-green-50 dark:bg-green-900/20' : s._id === 'failed' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}
                sub={`${s.count} requests`} />
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
              {['', 'pending', 'processing', 'completed', 'failed', 'cancelled'].map(s => (
                <button key={s} onClick={() => { setFilters(f => s ? { ...f, status: s } : (({ status, ...rest }) => rest)(f)); setPage(1); }}
                  className={clsx('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    (s === '' && !filters.status) || filters.status === s ? 'bg-white dark:bg-dark-800 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
                  {s ? s.replace(/_/g, ' ') : 'All'}
                </button>
              ))}
            </div>
            <select value={filters.method || ''} onChange={e => { setFilters(f => e.target.method ? { ...f, method: e.target.value } : (({ method, ...rest }) => rest)(f)); setPage(1); }}
              className="px-3 py-2 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300">
              <option value="">All Methods</option>
              {['bank_transfer', 'paypal', 'stripe', 'chapa', 'telebirr', 'cbe_birr'].map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          {/* Withdrawals Table */}
          <div className="card overflow-hidden">
            <DataTable loading={withdrawalsLoading}
              columns={[
                { key: 'user', label: 'User', render: (r) => <div><p className="font-medium text-gray-900 dark:text-white text-xs">{r.user?.firstName} {r.user?.lastName}</p><p className="text-[11px] text-gray-400">{r.user?.email}</p></div> },
                { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-bold text-xs">{formatCurrency(r.amount, r.currency)}</span> },
                { key: 'method', label: 'Method', render: (r) => { const Icon = GATEWAY_ICONS[r.method] || CreditCard; return <span className="text-xs capitalize inline-flex items-center gap-1"><Icon className="w-3.5 h-3.5" aria-hidden="true" /> {(r.method || '').replace(/_/g, ' ')}</span>; } },
                { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                { key: 'createdAt', label: 'Date', render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy')}</span> },
                { key: 'actions', label: '', align: 'right', render: (r) => <WithdrawalActionButtons withdrawal={r} /> },
              ]}
              data={withdrawalsData?.data || []}
              emptyMessage="No withdrawals found"
            />
            {withdrawalsData?.meta && <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700"><Pagination meta={withdrawalsData.meta} onPageChange={setPage} /></div>}
          </div>
        </div>
      )}

      {/* ═══ COMMISSIONS TAB ═══ */}
      {tab === 'commissions' && (
        <div className="space-y-6">
          <div className="card p-6">
            <SectionHeader title="Commission History" icon={ReceiptPercentIcon} subtitle="All platform commission transactions" />
            <div className="mt-4">
              <DataTable loading={commissionLoading}
                columns={[
                  { key: 'user', label: 'User', render: (r) => <span className="text-xs font-medium text-gray-900 dark:text-white">{r.user?.firstName} {r.user?.lastName}</span> },
                  { key: 'amount', label: 'Commission', align: 'right', render: (r) => <span className="text-xs font-bold text-green-600">{formatCurrency(r.amount, r.currency)}</span> },
                  { key: 'reference', label: 'Reference', render: (r) => <span className="text-xs font-mono text-gray-400">{r.reference?.slice(0, 18)}</span> },
                  { key: 'description', label: 'Description', render: (r) => <span className="text-xs text-gray-500">{r.description}</span> },
                  { key: 'createdAt', label: 'Date', render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy')}</span> },
                ]}
                data={commissionHistory?.data || []}
                emptyMessage="No commission records"
              />
              {commissionHistory?.meta && <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700"><Pagination meta={commissionHistory.meta} onPageChange={setPage} /></div>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ REFUNDS & DISPUTES TAB ═══ */}
      {tab === 'refunds' && (
        <div className="space-y-6">
          {/* Refund Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {refundData?.data?.stats?.map(s => (
              <KPICard key={s._id} label={s._id === 'completed' ? 'Approved Refunds' : s._id === 'failed' ? 'Rejected Refunds' : `Refunds (${s._id})`}
                value={formatCurrency(s.total)} icon={ArrowUturnLeftIcon}
                color={s._id === 'completed' ? 'text-green-600' : s._id === 'failed' ? 'text-red-600' : 'text-yellow-600'}
                bg={s._id === 'completed' ? 'bg-green-50 dark:bg-green-900/20' : s._id === 'failed' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}
                sub={`${s.count} requests`} />
            ))}
          </div>

          {/* Pending Refunds */}
          <div className="card p-6">
            <SectionHeader title="Pending Refunds" icon={ClockIcon} subtitle="Awaiting admin review" />
            <div className="mt-4 space-y-3">
              {refundData?.data?.pending?.length > 0 ? refundData.data.pending.map(r => (
                <div key={r._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-gray-900 dark:text-white">{r.payer?.firstName} {r.payer?.lastName}</p>
                    <p className="text-[11px] text-gray-400">{r.reference} · {r.description}</p>
                  </div>
                  <span className="text-xs font-bold text-red-600">{formatCurrency(r.amount, r.currency)}</span>
                </div>
              )) : <p className="text-center text-sm text-gray-400 py-6">No pending refunds</p>}
            </div>
          </div>

          {/* Disputes */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Active Disputes</h3>
            </div>
            <DataTable loading={false}
              columns={[
                { key: 'client', label: 'Client', render: (r) => <span className="text-xs">{r.client?.firstName} {r.client?.lastName}</span> },
                { key: 'freelancer', label: 'Freelancer', render: (r) => <span className="text-xs">{r.freelancer?.firstName} {r.freelancer?.lastName}</span> },
                { key: 'project', label: 'Project', render: (r) => <span className="text-xs text-gray-500">{r.project?.title || '—'}</span> },
                { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-bold text-xs text-red-600">{formatCurrency(r.amount, r.currency)}</span> },
                { key: 'disputeReason', label: 'Reason', render: (r) => <span className="text-xs text-gray-500 truncate max-w-[200px] block">{r.disputeReason || '—'}</span> },
                { key: 'createdAt', label: 'Opened', render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.disputeOpenedAt || r.createdAt), 'MMM d, yyyy')}</span> },
                { key: 'actions', label: '', align: 'right', render: (r) => (
                  <EscrowActionButton escrow={r} action="resolve" label="Resolve" icon={ScaleIcon} color="text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20" />
                )},
              ]}
              data={disputesData?.data || []}
              emptyMessage="No active disputes"
            />
          </div>
        </div>
      )}

      {/* ═══ REPORTS TAB ═══ */}
      {tab === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { type: 'revenue', label: 'Revenue Report', icon: CurrencyDollarIcon, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
              { type: 'commission', label: 'Commission Report', icon: ReceiptPercentIcon, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' },
              { type: 'escrow', label: 'Escrow Report', icon: ShieldCheckIcon, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' },
              { type: 'payment', label: 'Payment Report', icon: CreditCardIcon, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
              { type: 'withdrawal', label: 'Withdrawal Report', icon: BanknotesIcon, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' },
              { type: 'refund', label: 'Refund Report', icon: ArrowUturnLeftIcon, color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/20' },
            ].map(r => (
              <div key={r.type} className="card p-5 hover:shadow-card-hover transition-shadow cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', r.color)}>
                    <r.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{r.label}</h3>
                    <p className="text-xs text-gray-400">Generate downloadable report</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => generateReport(r.type, 'json')} className="flex-1 px-3 py-2 text-xs font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors">View JSON</button>
                  <button onClick={() => generateReport(r.type, 'csv')} className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 dark:bg-dark-700 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors flex items-center justify-center gap-1">
                    <DocumentArrowDownIcon className="w-3.5 h-3.5" /> CSV
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ AUDIT & SECURITY TAB ═══ */}
      {tab === 'audit' && (
        <div className="space-y-6">
          {/* Suspicious Activity Alerts */}
          {suspiciousData?.data?.length > 0 && (
            <div className="card p-6 border-l-4 border-red-500">
              <SectionHeader title="Suspicious Activity Detected" icon={ExclamationTriangleIcon} subtitle="AI-powered fraud detection alerts" />
              <div className="mt-4 space-y-3">
                {suspiciousData.data.slice(0, 5).map(a => (
                  <div key={a._id} className="flex items-start gap-3 p-3 bg-red-50/50 dark:bg-red-900/10 rounded-lg">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">{a.type?.replace(/_/g, ' ')}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{a.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge status={a.severity} />
                        <span className="text-[11px] text-gray-400">Confidence: {(a.confidence * 100).toFixed(0)}%</span>
                        <Badge status={a.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Logs */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Audit Logs</h3>
              <div className="flex items-center gap-2">
                {['', 'payment', 'wallet', 'escrow', 'withdrawal', 'commission', 'refund', 'admin'].map(c => (
                  <button key={c} onClick={() => { setFilters(f => c ? { ...f, category: c } : (({ category, ...rest }) => rest)(f)); setPage(1); }}
                    className={clsx('px-2 py-1 rounded text-[11px] font-medium transition-colors',
                      (c === '' && !filters.category) || filters.category === c ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-400 hover:text-gray-600')}>
                    {c || 'All'}
                  </button>
                ))}
              </div>
            </div>
            <DataTable loading={auditLoading}
              columns={[
                { key: 'action', label: 'Action', render: (r) => <span className="text-xs font-medium text-gray-900 dark:text-white">{r.action}</span> },
                { key: 'category', label: 'Category', render: (r) => <Badge status={r.category} /> },
                { key: 'user', label: 'User', render: (r) => <span className="text-xs text-gray-500">{r.user ? `${r.user.firstName} ${r.user.lastName}` : 'System'}</span> },
                { key: 'amount', label: 'Amount', render: (r) => <span className="text-xs">{r.amount ? formatCurrency(r.amount, r.currency) : '—'}</span> },
                { key: 'status', label: 'Status', render: (r) => (
                  <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium',
                    r.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      r.status === 'failure' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400')}>{r.status}</span>
                )},
                { key: 'ipAddress', label: 'IP', render: (r) => <span className="text-[11px] text-gray-400 font-mono">{r.ipAddress || '—'}</span> },
                { key: 'createdAt', label: 'Date', render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, HH:mm')}</span> },
              ]}
              data={auditData?.data || []}
              emptyMessage="No audit logs"
            />
            {auditData?.meta && <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700"><Pagination meta={auditData.meta} onPageChange={setPage} /></div>}
          </div>
        </div>
      )}

      {/* ═══ SETTINGS TAB ═══ */}
      {tab === 'settings' && (
        <div className="space-y-6">
          <div className="card p-6 max-w-2xl">
            <SectionHeader title="Commission Settings" icon={CogIcon} subtitle="Configure platform commission rates" />
            <CommissionSettingsForm settings={commissionSettings?.data} />
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function EscrowActionButton({ escrow, action, label, icon: Icon, color }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (action === 'release') return adminFinanceService.releaseEscrow(escrow._id, { adminNotes: notes });
      if (action === 'hold') return adminFinanceService.holdEscrow(escrow._id, { adminNotes: notes });
      if (action === 'refund') return adminFinanceService.refundEscrow(escrow._id, { adminNotes: notes });
      if (action === 'resolve') return adminFinanceService.resolveDispute(escrow._id, { resolution: action, releaseTo: 'client', adminNotes: notes });
    },
    onSuccess: () => { queryClient.invalidateQueries(['admin-finance-escrows']); setOpen(false); setNotes(''); },
  });

  return (
    <>
      <button onClick={() => setOpen(true)} className={clsx('p-1.5 rounded-md transition-colors', color)} title={label}>
        <Icon className="w-3.5 h-3.5" />
      </button>
      <ActionModal isOpen={open} onClose={() => setOpen(false)} title={`${label} Escrow`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Escrow: {formatCurrency(escrow.amount, escrow.currency)}</p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Admin notes (optional)"
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white resize-none" rows={3} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Processing...' : `Confirm ${label}`}
            </Button>
          </div>
        </div>
      </ActionModal>
    </>
  );
}

function EscrowTimelineButton({ escrowId }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['escrow-timeline', escrowId],
    queryFn: () => adminFinanceService.getEscrowTimeline(escrowId).then(r => r.data),
    enabled: open,
  });

  return (
    <>
      <button onClick={() => setOpen(true)} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors" title={t('dashboard.adminFinance.audit.timeline')}>
        <ClockIcon className="w-3.5 h-3.5" />
      </button>
      <ActionModal isOpen={open} onClose={() => setOpen(false)} title={t('dashboard.adminFinance.audit.timeline')}>
        <div className="space-y-4">
          {data?.data?.timeline?.map((t, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white capitalize">{t.event?.replace(/_/g, ' ')}</p>
                <p className="text-[11px] text-gray-400">{t.details}</p>
                <p className="text-[11px] text-gray-400">{format(new Date(t.date), 'MMM d, yyyy HH:mm')}</p>
              </div>
            </div>
          ))}
          {(!data?.data?.timeline || data.data.timeline.length === 0) && <p className="text-center text-sm text-gray-400 py-4">{t('dashboard.adminFinance.audit.noTimeline')}</p>}
        </div>
      </ActionModal>
    </>
  );
}

function WithdrawalActionButtons({ withdrawal }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const prompt = usePrompt();

  const processMutation = useMutation({
    mutationFn: ({ action, adminNotes, failureReason }) =>
      adminFinanceService.processWithdrawal(withdrawal._id, { action, adminNotes, failureReason }),
    onSuccess: () => queryClient.invalidateQueries(['admin-finance-withdrawals']),
  });

  const retryMutation = useMutation({
    mutationFn: () => adminFinanceService.retryWithdrawal(withdrawal._id),
    onSuccess: () => queryClient.invalidateQueries(['admin-finance-withdrawals']),
  });

  const handleApprove = async () => {
    const notes = await prompt({
      title: 'Approve withdrawal',
      message: `Approve this withdrawal of ${formatCurrency(withdrawal.amount, withdrawal.currency)}? The freelancer will be paid out.`,
      label: 'Approval notes (optional)',
      placeholder: 'Approved',
      confirmLabel: 'Approve',
    });
    if (notes === null) return;
    processMutation.mutate({ action: 'approve', adminNotes: notes.trim() || 'Approved' });
  };

  const handleReject = async () => {
    const reason = await prompt({
      title: 'Reject withdrawal',
      message: `Reject this withdrawal of ${formatCurrency(withdrawal.amount, withdrawal.currency)}? The funds will be returned to the freelancer's balance.`,
      label: 'Rejection reason',
      placeholder: 'e.g. Invalid payout account details',
      required: true,
      requiredMessage: 'A rejection reason is required.',
      multiline: true,
      rows: 3,
      confirmLabel: 'Continue',
      destructive: true,
    });
    if (reason === null) return;

    const notes = await prompt({
      title: 'Admin notes',
      message: 'Add any internal notes about this decision (optional).',
      label: 'Admin notes (optional)',
      multiline: true,
      rows: 3,
      confirmLabel: 'Reject withdrawal',
      destructive: true,
    });
    if (notes === null) return;

    processMutation.mutate({ action: 'reject', adminNotes: notes.trim(), failureReason: reason.trim() });
  };

  const handleRetry = async () => {
    const ok = await confirm({
      title: 'Retry withdrawal',
      message: 'Retry this failed withdrawal?',
      confirmLabel: 'Retry',
    });
    if (ok) retryMutation.mutate();
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {['pending', 'processing'].includes(withdrawal.status) && (
        <>
          <button onClick={handleApprove} disabled={processMutation.isPending}
            className="px-2 py-1 text-[11px] font-medium text-green-600 bg-green-50 dark:bg-green-900/20 rounded-md hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-50">Approve</button>
          <button onClick={handleReject} disabled={processMutation.isPending}
            className="px-2 py-1 text-[11px] font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50">Reject</button>
        </>
      )}
      {withdrawal.status === 'failed' && (
        <button onClick={handleRetry} disabled={retryMutation.isPending}
          className="px-2 py-1 text-[11px] font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/20 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900/40 disabled:opacity-50">Retry</button>
      )}
    </div>
  );
}

function CommissionSettingsForm({ settings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    defaultRate: settings?.defaultRate ? (settings.defaultRate * 100).toFixed(0) : '10',
    clientFee: settings?.clientFee || '0',
    withdrawalFee: settings?.withdrawalFee || '0',
    vat: settings?.vat || '0',
  });

  const mutation = useMutation({
    mutationFn: (data) => adminFinanceService.updateCommissionSettings({
      defaultRate: parseFloat(data.defaultRate) / 100,
      clientFee: parseFloat(data.clientFee),
      withdrawalFee: parseFloat(data.withdrawalFee),
      vat: parseFloat(data.vat),
    }),
    onSuccess: () => queryClient.invalidateQueries(['admin-finance-commission-settings']),
  });

  if (!settings) return <SkeletonText lines={4} />;

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Default Commission Rate (%)</label>
          <input type="number" value={form.defaultRate} onChange={e => setForm(f => ({ ...f, defaultRate: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Client Fee (ETB)</label>
          <input type="number" value={form.clientFee} onChange={e => setForm(f => ({ ...f, clientFee: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Withdrawal Fee (ETB)</label>
          <input type="number" value={form.withdrawalFee} onChange={e => setForm(f => ({ ...f, withdrawalFee: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">VAT / Tax (%)</label>
          <input type="number" value={form.vat} onChange={e => setForm(f => ({ ...f, vat: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white" />
        </div>
      </div>

      {/* Gateway Fee Display */}
      <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Gateway Fees</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {settings.gatewayFees && Object.entries(settings.gatewayFees).map(([g, f]) => (
            <div key={g} className="text-center">
              <p className="text-[11px] text-gray-400 capitalize">{g.replace(/_/g, ' ')}</p>
              <p className="text-xs font-bold text-gray-900 dark:text-white">{(f * 100).toFixed(1)}%</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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

async function generateReport(type, format) {
  try {
    const response = await adminFinanceService.generateReport({ type, format });
    if (format === 'csv') {
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  } catch (err) {
    toast.error('Failed to generate report');
  }
}
