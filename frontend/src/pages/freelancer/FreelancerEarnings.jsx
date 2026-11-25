import { Link } from 'react-router-dom';
import { useEarnings, useEarningsChart } from '@/hooks/usePayments';
import { SkeletonStats } from '@/components/ui/Skeleton';
import { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js';
import { motion } from 'framer-motion';
import {
  CurrencyDollarIcon, ArrowDownIcon, ClockIcon,
  ChartBarIcon, BriefcaseIcon, CalculatorIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { formatCurrency } from '@/utils/currency';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const PERIODS = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '3m', label: '3 Months' },
  { key: '6m', label: '6 Months' },
  { key: '1y', label: '1 Year' },
];

const PERIOD_MAP = {
  '7d': 'weekly',
  '30d': 'monthly',
  '3m': 'monthly',
  '6m': 'monthly',
  '1y': 'yearly',
};

function formatCompact(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toFixed(2);
}

export default function FreelancerEarnings() {
  const [chartPeriod, setChartPeriod] = useState('30d');

  const { data: earningsData, isLoading: earningsLoading } = useEarnings();
  const { data: chartData } = useEarningsChart({ period: PERIOD_MAP[chartPeriod] || 'monthly' });

  const earnings = earningsData?.data;

  const grossEarnings = earnings?.grossEarnings ?? 0;
  const netEarnings = earnings?.netEarnings ?? 0;
  const totalFees = earnings?.totalFees ?? 0;
  const completedProjects = earnings?.completedProjects ?? 0;
  const avgProjectValue = earnings?.avgProjectValue ?? 0;
  const commissionRate = earnings?.commissionRate ?? 0.10;

  const pendingEarnings = earnings?.pendingEarnings ?? 0;

  const chartConfig = useMemo(() => {
    const labels = chartData?.data?.map(m => {
      if (m._id?.month) return MONTHS[(m._id.month - 1) % 12];
      if (m._id?.year) return m._id.year;
      return '';
    }) ?? [];

    return {
      labels,
      datasets: [
        {
          label: 'Gross Earnings',
          data: chartData?.data?.map(m => m.gross || m.earnings || 0) ?? [],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.08)',
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#6366f1',
        },
        {
          label: 'Net Earnings',
          data: chartData?.data?.map(m => m.net || 0) ?? [],
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#22c55e',
        },
        {
          label: 'Platform Fees',
          data: chartData?.data?.map(m => (m.gross || m.earnings || 0) - (m.net || 0)) ?? [],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.06)',
          fill: false,
          tension: 0.4,
          pointRadius: 2,
          pointBackgroundColor: '#ef4444',
          borderDash: [5, 3],
        },
      ],
    };
  }, [chartData]);

  const topCards = [
    { label: 'Gross Earnings', value: grossEarnings, icon: CurrencyDollarIcon, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20', desc: 'Total before commission' },
    { label: 'Platform Fees', value: totalFees, icon: CalculatorIcon, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', desc: `${(commissionRate * 100).toFixed(0)}% commission rate` },
    { label: 'Net Earnings', value: netEarnings, icon: ArrowDownIcon, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', desc: 'After platform fees' },
  ];

  const secondaryCards = [
    { label: 'Pending Earnings', value: pendingEarnings, icon: ClockIcon, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', desc: 'Held in active escrows' },
    { label: 'Completed Projects', value: completedProjects, icon: BriefcaseIcon, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', desc: 'Projects fully paid out', isCount: true },
    { label: 'Avg Project Value', value: avgProjectValue, icon: ChartBarIcon, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', desc: 'Average net per project' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-title">Earnings</h1>
          <p className="section-sub">Track your income, fees, and payout analytics</p>
        </div>
        <div className="flex gap-2">
          <Link to="/freelancer/wallet" className="btn-secondary btn-sm">Wallet</Link>
          <Link to="/payments/withdraw" className="btn-primary btn-sm">Withdraw</Link>
        </div>
      </div>

      {earningsLoading ? <SkeletonStats /> : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {topCards.map((c, i) => (
              <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }} className="stat-card">
                <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <p className="stat-value">{c.value.toFixed(2)} <span className="text-xs font-normal text-gray-400">ETB</span></p>
                <p className="stat-label">{c.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{c.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {secondaryCards.map((c, i) => (
              <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }} className="stat-card">
                <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <p className="stat-value">
                  {c.isCount ? c.value : `${c.value.toFixed(2)} `}
                  {!c.isCount && <span className="text-xs font-normal text-gray-400">ETB</span>}
                </p>
                <p className="stat-label">{c.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{c.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-5 gap-3">
            {[
              { label: 'Today', value: earnings?.today ?? 0, color: 'text-green-600' },
              { label: 'This Week', value: earnings?.thisWeek ?? 0, color: 'text-blue-600' },
              { label: 'This Month', value: earnings?.thisMonth ?? 0, color: 'text-primary-600' },
              { label: 'This Year', value: earnings?.thisYear ?? 0, color: 'text-purple-600' },
              { label: 'Lifetime Net', value: earnings?.netEarnings ?? 0, color: 'text-emerald-600' },
            ].map(e => (
              <div key={e.label} className="stat-card py-3 px-4">
                <p className="stat-label text-[11px]">{e.label}</p>
                <p className={`stat-value text-sm ${e.color}`}>{e.value.toFixed(2)} <span className="text-[10px] font-normal text-gray-400">ETB</span></p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">Earnings Trend</h2>
                <div className="flex gap-1">
                  {PERIODS.map(p => (
                    <button key={p.key} onClick={() => setChartPeriod(p.key)}
                      className={clsx('px-2.5 py-1 rounded text-xs font-medium transition-colors',
                        chartPeriod === p.key ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              {chartData?.data?.length > 0 ? (
                <div className="h-64">
                  <Line data={chartConfig} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } },
                    },
                    scales: {
                      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } },
                      x: { grid: { display: false } },
                    },
                  }} />
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-gray-400">No earnings data yet</div>
              )}
            </div>

            <div className="space-y-6">
              <div className="card p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Commission Breakdown</h2>
                <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Gross Earnings</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(grossEarnings)}</span>
                  </div>
                  <div className="flex justify-between text-red-500">
                    <span>Platform Commission ({(commissionRate * 100).toFixed(0)}%)</span>
                    <span>-{formatCurrency(totalFees)}</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between font-bold text-gray-900 dark:text-white">
                    <span>Net Earnings</span>
                    <span className="text-green-600">{formatCurrency(netEarnings)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    Commission rate is configured by the platform admin. You are charged only on completed escrow releases.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Earnings by Project</h2>
              {earnings?.byProject?.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {earnings.byProject.map((p, i) => (
                    <div key={p.projectId || i} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]">{p.title}</p>
                      <p className="text-sm font-bold text-green-600">{formatCurrency(p.earned)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-sm text-gray-400">No project earnings yet</div>
              )}
            </div>

            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Earnings by Client</h2>
              {earnings?.byClient?.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {earnings.byClient.map((c, i) => (
                    <div key={c.clientId || i} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[180px]">{c.name}</p>
                        <p className="text-[10px] text-gray-400">{c.projectCount} project{c.projectCount !== 1 ? 's' : ''}</p>
                      </div>
                      <p className="text-sm font-bold text-green-600">{formatCurrency(c.earned)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-sm text-gray-400">No client earnings yet</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}