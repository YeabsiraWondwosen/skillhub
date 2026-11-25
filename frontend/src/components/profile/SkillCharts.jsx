import { useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { profileService } from '@/services/profile.service';
import { AcademicCapIcon, ArrowTrendingUpIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Filler, Tooltip, Legend,
);

const CHART_COLORS = {
  primary: 'rgba(99, 102, 241, 0.8)',
  primaryBorder: 'rgba(99, 102, 241, 1)',
  secondary: 'rgba(236, 72, 153, 0.8)',
  secondaryBorder: 'rgba(236, 72, 153, 1)',
  green: 'rgba(34, 197, 94, 0.8)',
  greenBorder: 'rgba(34, 197, 94, 1)',
  yellow: 'rgba(234, 179, 8, 0.8)',
  yellowBorder: 'rgba(234, 179, 8, 1)',
  blue: 'rgba(59, 130, 246, 0.8)',
  blueBorder: 'rgba(59, 130, 246, 1)',
};

const DOUGHNUT_PALETTE = [
  'rgba(99,102,241,0.8)', 'rgba(236,72,153,0.8)', 'rgba(34,197,94,0.8)',
  'rgba(234,179,8,0.8)', 'rgba(59,130,246,0.8)', 'rgba(168,85,247,0.8)',
  'rgba(249,115,22,0.8)', 'rgba(20,184,166,0.8)',
];

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
};

function SkillBarChart({ skills }) {
  const data = useMemo(() => ({
    labels: skills?.map((s) => s.name) || [],
    datasets: [{
      data: skills?.map((s) => s.level || s.yearsOfExperience || 0) || [],
      backgroundColor: skills?.map((_, i) => DOUGHNUT_PALETTE[i % DOUGHNUT_PALETTE.length]) || [],
      borderRadius: 4,
      barThickness: 16,
    }],
  }), [skills]);

  if (!skills?.length) return null;

  return (
    <div className="h-48">
      <Bar
        data={data}
        options={{
          ...CHART_DEFAULTS,
          indexAxis: 'y',
          scales: {
            x: { display: false, max: 100 },
            y: {
              grid: { display: false },
              ticks: { font: { size: 11 }, color: '#6b7280' },
            },
          },
        }}
      />
    </div>
  );
}

function EarningsLineChart({ earnings }) {
  const data = useMemo(() => ({
    labels: earnings?.map((m) => m.month || m.label) || [],
    datasets: [{
      data: earnings?.map((m) => m.amount || m.value || 0) || [],
      borderColor: CHART_COLORS.primaryBorder,
      backgroundColor: 'rgba(99,102,241,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: CHART_COLORS.primaryBorder,
    }],
  }), [earnings]);

  if (!earnings?.length) return null;

  return (
    <div className="h-40">
      <Line
        data={data}
        options={{
          ...CHART_DEFAULTS,
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#9ca3af' } },
            y: { grid: { color: 'rgba(229,231,235,0.3)' }, ticks: { font: { size: 10 }, color: '#9ca3af', callback: (v) => `$${v}` } },
          },
        }}
      />
    </div>
  );
}

function SkillChartSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl" />
    </div>
  );
}

export default function SkillCharts({ userId, className }) {
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['profile-analytics', userId],
    queryFn: () => profileService.getAnalytics(userId).then((r) => r.data),
    enabled: !!userId,
  });

  const analytics = analyticsData?.data;

  if (analyticsLoading) {
    return (
      <div className={clsx('space-y-4', className)}>
        <SkillChartSkeleton />
        <SkillChartSkeleton />
      </div>
    );
  }

  const performanceMetrics = [
    {
      label: 'On-Time Delivery',
      value: analytics?.completedProjects > 0 ? `${analytics?.onTimeDelivery ?? 0}%` : '—',
      color: 'text-green-600',
    },
    {
      label: 'Success Rate',
      value: analytics?.successRate ? `${analytics.successRate}%` : '—',
      color: 'text-blue-600',
    },
    {
      label: 'Avg Project Value',
      value: analytics?.avgProjectValue ? `$${Math.round(analytics.avgProjectValue)}` : '—',
      color: 'text-purple-600',
    },
    {
      label: 'Repeat Clients',
      value: analytics?.repeatClients ? analytics.repeatClients : '—',
      color: 'text-orange-600',
    },
  ];
  const hasPerformance = performanceMetrics.some((m) => m.value !== '—');

  return (
    <div className={clsx('space-y-5', className)}>
      {/* Skill Proficiency */}
      {analytics?.skills?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-gray-700/30 p-4"
        >
          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <AcademicCapIcon className="w-4 h-4" /> Skill Proficiency
          </h4>
          <SkillBarChart skills={analytics.skills} />
        </motion.div>
      )}

      {/* Performance Metrics */}
      {hasPerformance && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-gray-700/30 p-4"
        >
          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <BriefcaseIcon className="w-4 h-4" /> Performance
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {performanceMetrics.map((m) => (
              <div key={m.label} className="bg-gray-50 dark:bg-dark-700/50 rounded-lg p-3 text-center">
                <p className={clsx('text-lg font-bold', m.color)}>{m.value}</p>
                <p className="text-[10px] text-gray-400 uppercase">{m.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Earnings Trend */}
      {analytics?.earningsHistory?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-gray-700/30 p-4"
        >
          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <ArrowTrendingUpIcon className="w-4 h-4" /> Earnings Trend
          </h4>
          <EarningsLineChart earnings={analytics.earningsHistory} />
        </motion.div>
      )}
    </div>
  );
}
