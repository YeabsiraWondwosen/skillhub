import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart, ArcElement, CategoryScale, LinearScale,
  BarElement, Tooltip, Legend,
} from 'chart.js';
import { useClientAnalytics } from '@/hooks/useAnalytics';
import { useOrderStats } from '@/hooks/useOrders';
import { useMyJobs } from '@/hooks/useJobs';
import { useCategories } from '@/hooks/useCategories';
import CategoryIcon from '@/utils/categoryIcons';
import { SkeletonStats } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import {
  BriefcaseIcon, FolderIcon, CheckCircleIcon, CurrencyDollarIcon,
  ShoppingBagIcon, ChartBarIcon, TagIcon, ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';

Chart.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ClientAnalytics() {
  const { data, isLoading: analyticsLoading } = useClientAnalytics();
  const a = data?.data;

  const { data: orderStatsData, isLoading: ordersLoading } = useOrderStats('client');
  const orderStats = orderStatsData?.data || {};

  const { data: jobsCompletedData, isLoading: jobsCompletedLoading } = useMyJobs({ status: 'completed', page: 1, limit: 1 });
  const { data: jobsData, isLoading: jobsLoading } = useMyJobs({ page: 1, limit: 100 });
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.data ?? [];

  const loading = analyticsLoading || ordersLoading || jobsCompletedLoading || jobsLoading;

  const postedJobs = a?.postedJobs ?? 0;
  const jobsCompleted = jobsCompletedData?.meta?.total ?? 0;
  const totalSpent = a?.totalSpent ?? 0;
  const openContracts = a?.activeProjects ?? 0;
  const completedContracts = a?.completedProjects ?? 0;
  const activeServiceOrders = orderStats.active ?? 0;
  const averageProjectValue = completedContracts > 0 ? totalSpent / completedContracts : null;

  // Top categories from the client's real job history
  const topCategories = useMemo(() => {
    const jobs = jobsData?.data ?? [];
    const countMap = {};
    jobs.forEach(j => {
      if (j.category) countMap[j.category] = (countMap[j.category] || 0) + 1;
    });
    const byName = {};
    categories.forEach(c => { byName[c._id] = c; });
    return Object.entries(countMap)
      .map(([id, count]) => ({ id, count, name: byName[id]?.name || 'Other', color: byName[id]?.color || '#6366f1', icon: byName[id]?.icon }))
      .sort((x, y) => y.count - x.count)
      .slice(0, 6);
  }, [jobsData, categories]);

  const maxCategoryCount = topCategories.length ? topCategories[0].count : 0;

  const spendingChart = {
    labels: a?.monthlySpending?.map(m => MONTH_NAMES[m._id.month - 1]) ?? [],
    datasets: [{
      label: 'Spending (ETB)',
      data: a?.monthlySpending?.map(m => m.spent) ?? [],
      backgroundColor: 'rgba(99,102,241,0.75)',
      borderRadius: 6,
    }],
  };

  const projectStatusChart = {
    labels: ['Active', 'Completed', 'Cancelled'],
    datasets: [{
      data: [openContracts, completedContracts, 0],
      backgroundColor: ['#6366f1', '#22c55e', '#ef4444'],
      borderWidth: 0,
    }],
  };

  const stats = [
    { label: 'Jobs Posted',         value: postedJobs,              icon: BriefcaseIcon,      color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20', to: '/client/jobs' },
    { label: 'Jobs Completed',      value: jobsCompleted,           icon: CheckCircleIcon,    color: 'text-green-600',   bg: 'bg-green-50 dark:bg-green-900/20', to: '/client/jobs?status=completed' },
    { label: 'Money Spent',         value: formatCurrency(totalSpent), icon: CurrencyDollarIcon, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20', to: '/client/payments' },
    { label: 'Open Contracts',      value: openContracts,           icon: FolderIcon,         color: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-900/20', to: '/client/contracts' },
    { label: 'Completed Contracts', value: completedContracts,      icon: CheckCircleIcon,    color: 'text-teal-600',    bg: 'bg-teal-50 dark:bg-teal-900/20', to: '/client/contracts?status=completed' },
    { label: 'Active Service Orders', value: activeServiceOrders,   icon: ShoppingBagIcon,    color: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-900/20', to: '/client/service-orders' },
    { label: 'Avg Project Value',   value: averageProjectValue !== null ? formatCurrency(averageProjectValue) : '—', icon: ArrowTrendingUpIcon, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', to: '/client/payments' },
  ];

  return (
    <div className="page-container space-y-6">
      <div>
        <h1 className="section-title">Analytics</h1>
        <p className="section-sub">Overview of your hiring activity and spending</p>
      </div>

      {loading ? <SkeletonStats /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(s => (
            <Link key={s.label} to={s.to} className="stat-card block hover:shadow-card-hover transition-all duration-200">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="stat-value">{s.value}</p>
              <p className="stat-label">{s.label}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Monthly Spending</h2>
          {spendingChart.labels.length > 0 ? (
            <Bar data={spendingChart} options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true }, x: { grid: { display: false } } },
            }} />
          ) : (
            <EmptyState icon={CurrencyDollarIcon} title="No spending data yet"
              description="Your monthly spending will appear once you make your first payment." className="py-10" />
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Project Status</h2>
          {(openContracts + completedContracts) > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <Doughnut data={projectStatusChart} options={{
                responsive: true,
                cutout: '65%',
                plugins: { legend: { position: 'bottom' } },
              }} />
            </div>
          ) : (
            <EmptyState icon={FolderIcon} title="No project data yet"
              description="Contracts you create will be tracked here." className="py-10" />
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TagIcon className="w-4 h-4 text-gray-400" /> Top Categories
          </h2>
          {topCategories.length === 0 ? (
            <EmptyState icon={ChartBarIcon} title="No category data yet"
              description="Post jobs to see which categories you hire in most." className="py-10" />
          ) : (
            <div className="space-y-3">
              {topCategories.map(c => (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-200">
                      {c.icon && <CategoryIcon icon={c.icon} size={14} className="inline-flex" />} {c.name}
                    </span>
                    <span className="text-xs text-gray-400">{c.count} job{c.count > 1 ? 's' : ''}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${maxCategoryCount ? (c.count / maxCategoryCount) * 100 : 0}%`, backgroundColor: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Hiring Snapshot</h2>
          {postedJobs === 0 && activeServiceOrders === 0 ? (
            <EmptyState icon={BriefcaseIcon} title="No hiring activity yet"
              description="Your activity will be summarized here once you post jobs or order services." className="py-10" />
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Proposals pending review', value: a?.pendingApplicationsCount ?? 0, to: '/client/proposals' },
                { label: 'Total proposals received', value: jobsData?.data?.reduce((s, j) => s + (j.applicationsCount || 0), 0) ?? 0, to: '/client/proposals' },
                { label: 'Open jobs', value: a?.activeJobs ?? 0, to: '/client/jobs?status=open' },
              ].map(row => (
                <Link key={row.label} to={row.to}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-dark-700/50 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
                  <span className="text-sm text-gray-600 dark:text-gray-300">{row.label}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{row.value}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
