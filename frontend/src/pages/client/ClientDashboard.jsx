import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import {
  BriefcaseIcon, FolderIcon, CheckCircleIcon,
  CurrencyDollarIcon, ClockIcon, UserGroupIcon, ShoppingBagIcon,
  StarIcon, InformationCircleIcon, BanknotesIcon, CubeIcon,
  ChatBubbleLeftRightIcon, ArrowRightIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { useClientDashboard } from '@/hooks/useClientDashboard';
import { SkeletonStats } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { formatCurrency } from '@/utils/currency';

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip);

const STAT_CARDS = [
  { key: 'activeJobs', labelKey: 'dashboard.client.stats.activeJobs', icon: BriefcaseIcon, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', to: '/client/jobs?status=open' },
  { key: 'activeProjects', labelKey: 'dashboard.client.stats.activeProjects', icon: FolderIcon, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', to: '/client/contracts?status=active' },
  { key: 'completedProjects', labelKey: 'dashboard.client.stats.completedProjects', icon: CheckCircleIcon, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', to: '/client/contracts?status=completed' },
  { key: 'serviceOrders', labelKey: 'dashboard.client.stats.serviceOrders', icon: ShoppingBagIcon, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20', to: '/client/service-orders' },
  { key: 'totalSpent', labelKey: 'dashboard.client.stats.totalSpent', icon: CurrencyDollarIcon, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20', to: '/payments/wallet', money: true },
  { key: 'pendingReviews', labelKey: 'dashboard.client.stats.pendingReviews', icon: ClockIcon, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', to: '/client/reviews?status=pending' },
  { key: 'totalJobsPosted', labelKey: 'dashboard.client.stats.totalJobsPosted', icon: UserGroupIcon, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-700', to: '/client/jobs' },
];

const ATTENTION_META = {
  info: { icon: InformationCircleIcon, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  payment: { icon: BanknotesIcon, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  delivery: { icon: CubeIcon, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20' },
  review: { icon: StarIcon, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
};

function SectionHeader({ title, icon: Icon, to }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-gray-400" />}
        {title}
      </h2>
      {to && (
        <Link to={to} className="text-sm text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1">
          View all <ArrowRightIcon className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

export default function ClientDashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data, isLoading } = useClientDashboard();
  const d = data;

  const stats = d?.stats || {};
  const summary = d?.spendingSummary || {};
  const monthlySpending = d?.monthlySpending || [];
  const attention = d?.attention || [];
  const recentMessages = d?.recentMessages || [];

  const statCards = STAT_CARDS.map((c) => ({
    ...c,
    label: t(c.labelKey),
    value: c.money ? formatCurrency(stats[c.key] ?? 0) : (stats[c.key] ?? 0),
  }));

  const chartData = {
    labels: monthlySpending.map((m) => `${m.label} '${String(m.year).slice(2)}`),
    datasets: [{
      label: t('dashboard.client.spendingChartLabel'),
      data: monthlySpending.map((m) => m.spent),
      backgroundColor: 'rgba(99,102,241,0.7)',
      hoverBackgroundColor: 'rgba(99,102,241,0.9)',
      borderRadius: 6,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} ${d?.recentOrders?.[0]?.currency || 'ETB'}`,
        },
      },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.12)' } },
      x: { grid: { display: false } },
    },
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={BriefcaseIcon}
        title={t('dashboard.client.welcomeBack', { name: d?.user?.firstName || user?.firstName })}
        subtitle={t('dashboard.client.subtitle')}
        actions={<Link to="/client/jobs/new" className="btn-primary">{t('dashboard.client.actions.postJob')}</Link>}
      />

      {isLoading ? (
        <SkeletonStats />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={s.to} className="stat-card block hover:shadow-card-hover transition-all duration-200">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <p className="stat-value">{s.value}</p>
                <p className="stat-label">{s.label}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Spending Analytics */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <SectionHeader title={t('dashboard.client.sections.spendingAnalytics')} icon={CurrencyDollarIcon} to="/client/analytics" />
          {isLoading ? (
            <div className="h-64 skeleton rounded-lg" />
          ) : monthlySpending.some((m) => m.spent > 0) ? (
            <Bar data={chartData} options={chartOptions} />
          ) : (
            <EmptyState
              icon={CurrencyDollarIcon}
              title={t('dashboard.client.empty.spending.title')}
              description={t('dashboard.client.empty.spending.description')}
              className="py-10"
            />
          )}
        </div>

        <div className="card p-5">
          <SectionHeader title={t('dashboard.client.sections.walletOverview')} icon={BanknotesIcon} to="/payments/wallet" />
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 skeleton rounded-lg" />)}</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              <SummaryRow label={t('dashboard.client.wallet.totalSpent')} value={formatCurrency(summary.totalSpent)} />
              <SummaryRow label={t('dashboard.client.wallet.thisMonth')} value={formatCurrency(summary.thisMonth)} />
              <SummaryRow label={t('dashboard.client.wallet.escrowHeld')} value={formatCurrency(summary.escrowHeld)} />
              <SummaryRow label={t('dashboard.client.wallet.completedPayments')} value={String(summary.completedPayments ?? 0)} />
              <SummaryRow label={t('dashboard.client.wallet.refunds')} value={formatCurrency(summary.refunds)} />
            </div>
          )}
        </div>
      </div>

      {/* Active Projects + Recent Orders */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <SectionHeader title={t('dashboard.client.sections.activeProjects')} icon={FolderIcon} to="/client/contracts?status=active" />
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 skeleton rounded-lg" />)}</div>
          ) : d?.activeProjects?.length ? (
            <div className="space-y-4">
              {d.activeProjects.map((p) => (
                <Link key={p._id} to={`/projects/${p._id}`} className="flex items-center gap-3 group">
                  <Avatar src={p.freelancer?.avatar?.url} alt={`${p.freelancer?.firstName} ${p.freelancer?.lastName}`} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-primary-600">{p.title}</p>
                      <Badge status={p.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      <span>{p.freelancer ? `${p.freelancer.firstName} ${p.freelancer.lastName}` : '—'}</span>
                      <span>·</span>
                      <span>{formatCurrency(p.amount, p.currency)}</span>
                      {p.deadline && (<><span>·</span><span>Due {format(new Date(p.deadline), 'MMM d')}</span></>)}
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                      <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, p.progress || 0)}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FolderIcon}
              title={t('dashboard.client.empty.activeProjects.title')}
              description={t('dashboard.client.empty.activeProjects.description')}
              action={<Link to="/client/jobs/new" className="btn-primary btn-sm">{t('dashboard.client.actions.postJob')}</Link>}
              className="py-8"
            />
          )}
        </div>

        <div className="card p-5">
          <SectionHeader title={t('dashboard.client.sections.recentOrders')} icon={ShoppingBagIcon} to="/client/service-orders" />
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 skeleton rounded-lg" />)}</div>
          ) : d?.recentOrders?.length ? (
            <div className="space-y-4">
              {d.recentOrders.map((o) => (
                <Link key={o._id} to={`/services/orders/${o._id}`} className="flex items-center gap-3 group">
                  <Avatar src={o.freelancer?.avatar?.url} alt={`${o.freelancer?.firstName} ${o.freelancer?.lastName}`} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-primary-600">{o.title}</p>
                      <Badge status={o.status} />
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {o.orderNumber} · {o.service?.title || o.tier?.title || 'Service'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      <span>{formatCurrency(o.amount, o.currency)}</span>
                      {o.expectedDelivery && (<><span>·</span><span>Due {format(new Date(o.expectedDelivery), 'MMM d')}</span></>)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ShoppingBagIcon}
              title={t('dashboard.client.empty.recentOrders.title')}
              description={t('dashboard.client.empty.recentOrders.description')}
              action={<Link to="/catalogs" className="btn-primary btn-sm">{t('dashboard.client.actions.browseServices')}</Link>}
              className="py-8"
            />
          )}
        </div>
      </div>

      {/* Recent Jobs + Needs Your Attention */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <SectionHeader title={t('dashboard.client.sections.recentJobs')} icon={BriefcaseIcon} to="/client/jobs" />
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 skeleton rounded-lg" />)}</div>
          ) : d?.recentJobs?.length ? (
            <div className="space-y-4">
              {d.recentJobs.map((j) => (
                <Link key={j._id} to={`/client/jobs/${j._id}/applicants`} className="flex items-center gap-3 group">
                  <div className={`w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center shrink-0`}>
                    <BriefcaseIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-primary-600">{j.title}</p>
                      <Badge status={j.status} />
                    </div>
                    <p className="text-xs text-gray-400">
                      {j.applicationsCount ?? 0} application{j.applicationsCount === 1 ? '' : 's'} · Posted {format(new Date(j.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BriefcaseIcon}
              title={t('dashboard.client.empty.recentJobs.title')}
              description={t('dashboard.client.empty.recentJobs.description')}
              action={<Link to="/client/jobs/new" className="btn-primary btn-sm">{t('dashboard.client.actions.postJob')}</Link>}
              className="py-8"
            />
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-primary-500" />
              Needs Your Attention
            </h2>
          </div>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 skeleton rounded-lg" />)}</div>
          ) : attention.length ? (
            <div className="space-y-3">
              {attention.map((item) => {
                const meta = ATTENTION_META[item.type] || ATTENTION_META.info;
                return (
                  <Link key={item.key} to={item.href} className="flex items-start gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover:border-primary-200 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                    <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <meta.icon className={`w-5 h-5 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.detail}</p>
                    </div>
                    <ArrowRightIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 mt-1 shrink-0" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={CheckCircleIcon}
              title={t('dashboard.client.empty.attention.title')}
              description={t('dashboard.client.empty.attention.description')}
              className="py-8"
            />
          )}
        </div>
      </div>

      {/* Recent Messages */}
      <div className="card p-5">
        <SectionHeader title={t('dashboard.client.sections.recentMessages')} icon={ChatBubbleLeftRightIcon} to="/messages" />
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 skeleton rounded-lg" />)}</div>
        ) : recentMessages.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentMessages.map((m) => (
              <Link key={m.conversationId} to={`/messages/${m.conversationId}`} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover:border-primary-200 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                <Avatar src={m.user?.avatar?.url} alt={`${m.user?.firstName} ${m.user?.lastName}`} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {m.user ? `${m.user.firstName} ${m.user.lastName}` : 'Unknown user'}
                    </p>
                    {m.unreadCount > 0 && (
                      <span className="badge badge-danger shrink-0">{m.unreadCount}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.preview}</p>
                  {m.lastMessageAt && (
                    <p className="text-xs text-gray-400 mt-0.5">{formatDistanceToNow(new Date(m.lastMessageAt), { addSuffix: true })}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ChatBubbleLeftRightIcon}
            title={t('dashboard.client.empty.recentMessages.title')}
            description={t('dashboard.client.empty.recentMessages.description')}
            className="py-8"
          />
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{value ?? 0}</span>
    </div>
  );
}
