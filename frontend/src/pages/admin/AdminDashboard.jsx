import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminService } from '@/services/admin.service';
import { analyticsService } from '@/services/analytics.service';
import { adminFinanceService } from '@/services/adminFinance.service';
import { SkeletonStats } from '@/components/ui/Skeleton';
import PageHeader from '@/components/ui/PageHeader';
import Avatar from '@/components/ui/Avatar';
import StarRating from '@/components/ui/StarRating';
import { Line } from 'react-chartjs-2';
import {
  Chart, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Filler, Tooltip, Legend,
} from 'chart.js';
import {
  UsersIcon, BriefcaseIcon, CurrencyDollarIcon,
  FlagIcon, ShieldCheckIcon, ChartBarIcon, Squares2X2Icon,
  EyeIcon, EyeSlashIcon, CheckCircleIcon,
  ArrowRightIcon, TrophyIcon, BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';
import toast from 'react-hot-toast';
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PROJECT_STATUS_LABELS = {
  pending_delivery: 'dashboard.admin.projectStatus.pendingDelivery',
  active: 'dashboard.admin.projectStatus.active',
  completed: 'dashboard.admin.projectStatus.completed',
  pending_payment: 'dashboard.admin.projectStatus.pendingPayment',
  on_hold: 'dashboard.admin.projectStatus.onHold',
  in_revision: 'dashboard.admin.projectStatus.inRevision',
  cancelled: 'dashboard.admin.projectStatus.cancelled',
  disputed: 'dashboard.admin.projectStatus.disputed',
};

const STATUS_DOT_COLORS = {
  pending_delivery: 'bg-amber-400',
  active: 'bg-indigo-500',
  completed: 'bg-emerald-500',
  pending_payment: 'bg-yellow-400',
  on_hold: 'bg-orange-500',
  in_revision: 'bg-sky-500',
  cancelled: 'bg-red-500',
  disputed: 'bg-rose-600',
};

function SectionHeader({ title, subtitle, icon: Icon, action }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
        )}
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, bg, to, delay = 0, footer }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay * 0.04 }}>
      <Link to={to} className="stat-card relative overflow-hidden group hover:shadow-card-hover transition-all block">
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <p className="stat-value break-words">{value}</p>
        <p className="stat-label leading-snug">{label}</p>
        {footer}
      </Link>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminService.getDashboard().then(r => r.data),
  });
  const stats = dashboardData?.data;

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin', 'analytics', 'platform'],
    queryFn: () => analyticsService.getPlatform().then(r => r.data),
  });
  const a = analyticsData?.data;

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['admin', 'analytics', 'revenue', 'monthly'],
    queryFn: () => adminFinanceService.getRevenue({ period: 'monthly' }).then(r => r.data),
  });
  const monthlyRevenue = revenueData?.data?.revenue ?? [];

  const isLoading = dashboardLoading || analyticsLoading || revenueLoading;

  const [revenueVisible, setRevenueVisible] = useState(() => {
    try {
      return localStorage.getItem('skillhub:admin:revenueVisible') === 'true';
    } catch {
      toast.error('Failed to load dashboard data');
      return false;
    }
  });

  const toggleRevenueVisibility = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setRevenueVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('skillhub:admin:revenueVisible', String(next));
      } catch {
        toast.error('Failed to load dashboard data');
      }
      return next;
    });
  };

  const revenue = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const total = monthlyRevenue.reduce((sum, m) => sum + (m.total || 0), 0);
    const thisMonth = monthlyRevenue.find(m => m._id?.year === currentYear && m._id?.month === currentMonth)?.total ?? 0;
    return { total, thisMonth, hasData: monthlyRevenue.length > 0 };
  }, [monthlyRevenue]);

  const revenueChart = {
    labels: monthlyRevenue.map(m => `${MONTHS[m._id.month - 1]} '${String(m._id.year).slice(2)}`),
    datasets: [{
      label: 'Revenue (ETB)',
      data: monthlyRevenue.map(m => m.total),
      fill: true,
      borderColor: '#059669',
      backgroundColor: 'rgba(5,150,105,0.08)',
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: '#059669',
    }],
  };

  const projectStatuses = Object.entries(stats?.projects ?? {})
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ status, count }));

  const totalProjects = projectStatuses.reduce((sum, s) => sum + s.count, 0);

  const cards = [
    { label: t('dashboard.admin.cards.totalUsers'),       value: a?.overview?.totalUsers ?? 0,       icon: UsersIcon,        color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20',     to: '/admin/users' },
    { label: t('dashboard.admin.cards.freelancers'),       value: a?.overview?.totalFreelancers ?? 0, icon: ShieldCheckIcon,  color: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-900/20', to: '/admin/users?role=freelancer' },
    { label: t('dashboard.admin.cards.clients'),           value: a?.overview?.totalClients ?? 0,     icon: UsersIcon,        color: 'text-green-600',   bg: 'bg-green-50 dark:bg-green-900/20',    to: '/admin/users?role=client' },
    { label: t('dashboard.admin.cards.totalJobs'),        value: a?.overview?.totalJobs ?? 0,        icon: BriefcaseIcon,    color: 'text-sky-600',     bg: 'bg-sky-50 dark:bg-sky-900/20',        to: '/admin/jobs' },
    { label: t('dashboard.admin.cards.openJobs'),         value: a?.overview?.openJobs ?? 0,         icon: BriefcaseIcon,    color: 'text-yellow-600',  bg: 'bg-yellow-50 dark:bg-yellow-900/20',  to: '/admin/jobs?status=open' },
    { label: t('dashboard.admin.cards.activeProjects'),   value: stats?.projects?.active ?? 0,       icon: ChartBarIcon,     color: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-900/20',  to: '/admin/projects?status=active' },
    { label: t('dashboard.admin.cards.completedProjects'), value: a?.overview?.completedProjects ?? 0, icon: CheckCircleIcon, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', to: '/admin/projects?status=completed' },
    { label: t('dashboard.admin.cards.platformRevenue'),  value: formatCurrency(revenue.total),      icon: CurrencyDollarIcon, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20', to: '/admin/finance' },
    { label: t('dashboard.admin.cards.pendingReports'),   value: stats?.pendingReports ?? 0,         icon: FlagIcon,         color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/20',        to: '/admin/reports' },
    { label: t('dashboard.admin.cards.newUsersMonth'), value: stats?.newUsersThisMonth ?? 0,      icon: UsersIcon,        color: 'text-teal-600',    bg: 'bg-teal-50 dark:bg-teal-900/20',      to: '/admin/users?period=month' },
  ];

  const quickActions = [
    { label: 'Manage Users', to: '/admin/users', desc: 'Users & roles' },
    { label: 'Review Reports', to: '/admin/reports', desc: 'Pending reports' },
    { label: 'Moderate Jobs', to: '/admin/jobs', desc: 'Job listings' },
    { label: 'View Payments', to: '/admin/payments', desc: 'Transactions' },
    { label: 'Moderate Reviews', to: '/admin/reviews', desc: 'Reviews & ratings' },
    { label: 'Financial Dashboard', to: '/admin/finance', desc: 'Revenue & escrow' },
  ];

  return (
    <div className="page-container space-y-8">
      <PageHeader
        icon={Squares2X2Icon}
        title={t('dashboard.admin.title')}
        subtitle={t('dashboard.admin.subtitle')}
      />

      {isLoading ? <SkeletonStats /> : (
        <>
          {/* ── Overview KPIs ─────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader
              icon={ChartBarIcon}
              title="Overview"
              subtitle="Platform activity at a glance"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {cards.map((c, i) => {
                const isRevenue = c.label === 'Platform Revenue';
                return (
                  <KpiCard
                    key={c.label}
                    label={c.label}
                    value={isRevenue ? (revenueVisible ? c.value : '********') : c.value}
                    icon={c.icon}
                    color={c.color}
                    bg={c.bg}
                    to={c.to}
                    delay={i}
                    footer={isRevenue ? (
                      <button
                        type="button"
                        onClick={toggleRevenueVisibility}
                        aria-label={revenueVisible ? t('dashboard.admin.revenue.hide') : t('dashboard.admin.revenue.show')}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                      >
                        {revenueVisible ? (
                          <>
                            <EyeSlashIcon className="w-3.5 h-3.5" />
                            {t('dashboard.admin.revenue.hide')}
                          </>
                        ) : (
                          <>
                            <EyeIcon className="w-3.5 h-3.5" />
                            {t('dashboard.admin.revenue.show')}
                          </>
                        )}
                      </button>
                    ) : undefined}
                  />
                );
              })}
            </div>
          </section>

          {/* ── Project Status + Revenue Analytics ─────────── */}
          <section className="grid md:grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                  Project Status
                </h2>
                {totalProjects > 0 && (
                  <span className="chip">{totalProjects} total</span>
                )}
              </div>
              {projectStatuses.length > 0 ? (
                <div className="space-y-1">
                  {projectStatuses.map(({ status, count }) => (
                    <Link
                      key={status}
                      to={`/admin/projects?status=${encodeURIComponent(status)}`}
                      className="flex items-center justify-between text-sm rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300 capitalize">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[status] ?? 'bg-gray-400'}`} />
                        {t(PROJECT_STATUS_LABELS[status]) || status.replace('_', ' ')}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">No project data</p>
              )}
            </div>

            <div className="card p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                  Revenue Analytics
                </h2>
                <Link to="/admin/finance" className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                  View all
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
              {revenue.hasData ? (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl bg-gray-50 dark:bg-dark-700 p-3">
                      <p className="text-xs text-gray-400">Total Revenue</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                        {revenueVisible ? formatCurrency(revenue.total) : '********'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50 dark:bg-dark-700 p-3">
                      <p className="text-xs text-gray-400">Monthly Revenue</p>
                      <p className="text-base font-bold text-primary-600 mt-0.5">
                        {revenueVisible ? formatCurrency(revenue.thisMonth) : '********'}
                      </p>
                    </div>
                  </div>
                  <div className="h-28 flex-1">
                    <Line data={revenueChart} options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: { y: { beginAtZero: true }, x: { grid: { display: false } } },
                    }} />
                  </div>
                </>
              ) : (
                <div className="h-32 flex items-center justify-center text-xs text-gray-400">
                  No revenue data available
                </div>
              )}
            </div>
          </section>

          {/* ── Top Freelancers + Top Clients ──────────────── */}
          <section className="grid lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrophyIcon className="w-5 h-5 text-amber-500" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Top Freelancers</h2>
              </div>
              {a?.topFreelancers?.length ? (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        <th className="py-2 pr-2 font-semibold">#</th>
                        <th className="py-2 px-2 font-semibold">Freelancer</th>
                        <th className="py-2 pl-2 text-right font-semibold">Earnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.topFreelancers.slice(0, 5).map((f, i) => (
                        <tr key={f._id} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="py-3 pr-2 text-gray-400 font-medium w-6">{i + 1}</td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-3">
                              <Avatar src={f.avatar?.url} alt={`${f.firstName}`} size="sm" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{f.firstName} {f.lastName}</p>
                                <StarRating value={f.stats?.averageRating ?? 0} readonly size="sm" />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pl-2 text-right font-semibold text-primary-600 dark:text-primary-400 whitespace-nowrap">
                            {formatCurrency(f.totalEarnings)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">No data</p>
              )}
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BuildingStorefrontIcon className="w-5 h-5 text-emerald-500" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Top Clients</h2>
              </div>
              {a?.topClients?.length ? (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        <th className="py-2 pr-2 font-semibold">#</th>
                        <th className="py-2 px-2 font-semibold">Client</th>
                        <th className="py-2 pl-2 text-right font-semibold">Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.topClients.slice(0, 5).map((c, i) => (
                        <tr key={c._id} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="py-3 pr-2 text-gray-400 font-medium w-6">{i + 1}</td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-3">
                              <Avatar src={c.avatar?.url} alt={`${c.firstName}`} size="sm" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.firstName} {c.lastName}</p>
                                <p className="text-xs text-gray-400">{c.stats?.completedProjects ?? 0} projects</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pl-2 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {formatCurrency(c.totalSpent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">No data</p>
              )}
            </div>
          </section>

          {/* ── Quick Actions ──────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader
              icon={Squares2X2Icon}
              title="Quick Actions"
              subtitle="Shortcuts to the most common admin tasks"
            />
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {quickActions.map(act => (
                <Link
                  key={act.to}
                  to={act.to}
                  className="card p-4 flex flex-col justify-center items-start gap-0.5 hover:shadow-card-hover hover:border-primary-200 dark:hover:border-primary-700 transition-all group"
                >
                  <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {act.label}
                  </span>
                  <span className="text-xs text-gray-400">{act.desc}</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}