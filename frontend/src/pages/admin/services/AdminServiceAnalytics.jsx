import { Line, Bar } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import {
  Chart, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import StarRating from '@/components/ui/StarRating';
import { SkeletonStats, SkeletonCard } from '@/components/ui/Skeleton';
import { formatCurrency, formatNumber } from '@/utils/currency';
import { formatDistanceToNow } from 'date-fns';
import {
  ChartBarIcon, CommandLineIcon, ShoppingBagIcon,
  BanknotesIcon, SparklesIcon, StarIcon,
} from '@heroicons/react/24/outline';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AdminServiceAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'services', 'analytics'],
    queryFn: () => adminService.getServiceAnalytics().then(r => r.data),
  });
  const a = data?.data;

  const statCards = [
    { label: 'Total Services', value: formatNumber(a?.catalogStats?.total), icon: CommandLineIcon, to: '/admin/services/catalogs' },
    { label: 'Active Services', value: formatNumber(a?.catalogStats?.active), icon: CommandLineIcon, to: '/admin/services/catalogs?status=active' },
    { label: 'Total Orders', value: formatNumber(a?.orderStats?.total), icon: ShoppingBagIcon, to: '/admin/services/orders' },
    { label: 'Active Orders', value: formatNumber(a?.orderStats?.active), icon: ShoppingBagIcon, to: '/admin/services/orders?status=active' },
    { label: 'Completed Orders', value: formatNumber(a?.orderStats?.completed), icon: ShoppingBagIcon, to: '/admin/services/orders?status=completed' },
    { label: 'Service Revenue', value: formatCurrency(a?.revenue), icon: BanknotesIcon, to: '/admin/finance' },
    { label: 'Avg Rating', value: a?.rating ? `${a.rating}` : '—', icon: StarIcon, to: '/admin/services/catalogs?sortBy=highest-rated' },
    { label: 'Featured', value: formatNumber(a?.featuredCount), icon: SparklesIcon, to: '/admin/services/catalogs?featured=true' },
  ];

  const monthlyChart = {
    labels: a?.monthlyOrders?.map(m => `${MONTHS[m._id.month - 1]} ${m._id.year}`) ?? [],
    datasets: [{
      label: 'Orders',
      data: a?.monthlyOrders?.map(m => m.count) ?? [],
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.15)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#6366f1',
    }],
  };

  const revenueChart = {
    labels: a?.monthlyOrders?.map(m => `${MONTHS[m._id.month - 1]} ${m._id.year}`) ?? [],
    datasets: [{
      label: 'Revenue (ETB)',
      data: a?.monthlyOrders?.map(m => m.revenue) ?? [],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.12)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#10b981',
    }],
  };

  const categoryChart = {
    labels: a?.topCategories?.map(c => c.category?.name || 'Uncategorized') ?? [],
    datasets: [{
      label: 'Orders',
      data: a?.topCategories?.map(c => c.orders) ?? [],
      backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'],
    }],
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={ChartBarIcon}
        title="Service Analytics"
        subtitle="Live performance metrics for marketplace services"
      />

      {isLoading ? (
        <SkeletonStats />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(s => (
            <Link key={s.label} to={s.to} className="stat-card cursor-pointer transition-all hover:shadow-card-hover">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="stat-value">{s.value}</p>
                  <p className="stat-label">{s.label}</p>
                </div>
                <s.icon className="w-6 h-6 text-gray-300 dark:text-dark-500 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Services Draft', value: a?.catalogStats?.draft, to: '/admin/services/catalogs?status=draft' },
          { label: 'Services Paused', value: a?.catalogStats?.paused, to: '/admin/services/catalogs?status=paused' },
          { label: 'Services Archived', value: a?.catalogStats?.archived, to: '/admin/services/catalogs?status=archived' },
          { label: 'Open Reports', value: a?.reportedCount, to: '/admin/services/catalogs?status=reported' },
        ].map(s => (
          <Link key={s.label} to={s.to} className="card p-4 block cursor-pointer transition-all hover:shadow-card-hover">
            <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(s.value)}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Orders (last 6 months)</h2>
          {monthlyChart.labels.length > 0 ? (
            <Line data={monthlyChart} options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
            }} />
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">No order data yet</div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Revenue (last 6 months)</h2>
          {revenueChart.labels.length > 0 ? (
            <Line data={revenueChart} options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true }, x: { grid: { display: false } } },
            }} />
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">No revenue data yet</div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Top Categories by Orders</h2>
          {categoryChart.labels.length > 0 ? (
            <Bar data={categoryChart} options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
            }} />
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">No category data yet</div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Top Selling Services</h2>
          {a?.topSelling?.length ? (
            <div className="space-y-3">
              {a.topSelling.map((s, i) => (
                <div key={s._id} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-4">{i + 1}</span>
                  {s.images?.[0]?.url ? (
                    <img src={s.images[0].url} alt="" className="w-9 h-9 rounded-lg object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                      <CommandLineIcon className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.title}</p>
                    <p className="text-xs text-gray-400">{s.freelancer?.firstName} {s.freelancer?.lastName} · {s.stats?.orders} orders</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-primary-600">{formatCurrency(s.startingPrice)}</p>
                    <StarRating value={s.stats?.avgRating ?? 0} readonly size="sm" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No data</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Top Freelancers by Orders</h2>
          {a?.topFreelancers?.length ? (
            <div className="space-y-3">
              {a.topFreelancers.map((f, i) => (
                <div key={f._id} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-4">{i + 1}</span>
                  <Avatar src={f.avatar?.url} alt={`${f.firstName}`} size="sm" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{f.firstName} {f.lastName}</p>
                    <p className="text-xs text-gray-400">{f.orders} orders</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">{formatCurrency(f.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No data</p>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Orders</h2>
          {a?.recentOrders?.length ? (
            <div className="space-y-3">
              {a.recentOrders.map(o => (
                <div key={o._id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{o.title}</p>
                    <p className="text-xs text-gray-400">
                      {o.client?.firstName} {o.client?.lastName} · {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge status={o.status} />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">
                    {formatCurrency(o.budget?.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={ShoppingBagIcon} title="No recent orders" />
          )}
        </div>
      </div>

      {isLoading && (
        <div className="grid lg:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
    </div>
  );
}
