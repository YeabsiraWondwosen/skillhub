import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CurrencyDollarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
  CalendarDaysIcon, BanknotesIcon, CreditCardIcon,
} from '@heroicons/react/24/outline';
import { useRevenueReport } from '@/hooks/useAdvancedAnalytics';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/currency';

const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

function StatCard({ label, value, icon: Icon, color, prefix = '', suffix = '' }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</p>
        <p className="text-[11px] text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function BarChart({ data, height = 200, labelKey, valueKey }) {
  if (!data || data.length === 0) return <div className="h-[200px] flex items-center justify-center text-xs text-gray-400">No data</div>;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);

  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-0 flex items-end gap-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${((d[valueKey] || 0) / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.02 }}
              className="w-full bg-primary-500 dark:bg-primary-400 rounded-t-sm min-h-[2px] relative"
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-medium text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {formatCurrency(d[valueKey])}
              </div>
            </motion.div>
          </div>
        ))}
      </div>
      {data.length <= 30 && (
        <div className="absolute bottom-0 left-0 right-0 flex gap-1 -mb-5">
          {data.map((d, i) => (
            <div key={i} className="flex-1 text-center">
              <span className="text-[8px] text-gray-400 rotate-45 origin-left inline-block">
                {d[labelKey] || ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderBreakdown({ data }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + (d.total || 0), 0);

  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const pct = total > 0 ? ((d.total / total) * 100) : 0;
        const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
        return (
          <div key={i} className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{d._id || 'Other'}</span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">{formatCurrency(d.total)}</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className={clsx('h-full rounded-full', colors[i % colors.length])} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RevenueChart() {
  const [period, setPeriod] = useState('daily');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const { data, isLoading } = useRevenueReport({ period, ...dateRange });

  const summary = data?.summary || {};
  const chartData = data?.revenueByPeriod || [];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Revenue" value={formatCurrency(summary.totalRevenue)} icon={CurrencyDollarIcon}
          color="bg-green-100 dark:bg-green-900/30 text-green-600" />
        <StatCard label="Commissions" value={formatCurrency(summary.totalCommissions)} icon={BanknotesIcon}
          color="bg-primary-100 dark:bg-primary-900/30 text-primary-600" />
        <StatCard label="Avg Transaction" value={formatCurrency(summary.avgTransaction)} icon={CreditCardIcon}
          color="bg-blue-100 dark:bg-blue-900/30 text-blue-600" />
        <StatCard label="Success Rate" value={`${summary.successRate || 0}%`} icon={ArrowTrendingUpIcon}
          color="bg-purple-100 dark:bg-purple-900/30 text-purple-600" />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={clsx('px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                period === p.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500')}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateRange.startDate} onChange={e => setDateRange(p => ({ ...p, startDate: e.target.value }))}
            className="input-field text-xs py-1.5" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={dateRange.endDate} onChange={e => setDateRange(p => ({ ...p, endDate: e.target.value }))}
            className="input-field text-xs py-1.5" />
        </div>
      </div>

      {/* Chart */}
      <div className="card p-4">
        <h4 className="text-xs font-semibold text-gray-500 mb-3">Revenue Over Time</h4>
        <div className="pb-6">
          {isLoading ? (
            <div className="h-[200px] flex items-center justify-center"><span className="text-xs text-gray-400">Loading...</span></div>
          ) : (
            <BarChart data={chartData} height={200} labelKey="date" valueKey="totalRevenue" />
          )}
        </div>
      </div>

      {/* Provider Breakdown */}
      {data?.revenueByProvider?.length > 0 && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-500 mb-3">Revenue by Payment Provider</h4>
          <ProviderBreakdown data={data.revenueByProvider} />
        </div>
      )}
    </div>
  );
}
