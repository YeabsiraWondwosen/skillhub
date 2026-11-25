import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowTrendingUpIcon, UsersIcon, UserGroupIcon, ArrowPathIcon,
  CalendarDaysIcon, ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useUserGrowth } from '@/hooks/useAdvancedAnalytics';
import { clsx } from 'clsx';

function MetricCard({ label, value, subtext, color }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={clsx('w-2 h-2 rounded-full', color)} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {subtext && <p className="text-[10px] text-gray-400 mt-0.5">{subtext}</p>}
    </div>
  );
}

function GrowthChart({ data, height = 180 }) {
  if (!data || data.length === 0) return <div className="h-[180px] flex items-center justify-center text-xs text-gray-400">No data</div>;
  const max = Math.max(...data.map(d => d.total || 0), 1);

  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-0 flex items-end gap-0.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
            <motion.div initial={{ height: 0 }} animate={{ height: `${((d.total || 0) / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.02 }}
              className="w-full bg-green-500 dark:bg-green-400 rounded-t-sm min-h-[1px] relative opacity-80 group-hover:opacity-100"
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[8px] font-medium text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white dark:bg-gray-800 px-1 rounded shadow">
                +{d.total} ({d.freelancers || 0}F / {d.clients || 0}C)
              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RetentionGrid({ data }) {
  if (!data || data.length === 0) return null;
  const months = ['Month 0', 'Month 1', 'Month 2', 'Month 3', 'Month 6', 'Month 12'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr>
            <th className="text-left text-gray-500 py-1 px-2">Cohort</th>
            {months.map(m => <th key={m} className="text-center text-gray-500 py-1 px-2">{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 8).map((row, i) => (
            <tr key={i}>
              <td className="text-gray-600 dark:text-gray-400 py-1 px-2 font-medium">
                {row.cohortMonth ? new Date(row.cohortMonth).toLocaleDateString('en', { month: 'short', year: '2-digit' }) : '—'}
              </td>
              {[row.month0, row.month1, row.month2, row.month3, row.month6, row.month12].map((val, j) => {
                const pct = val || 0;
                const intensity = pct > 70 ? 'bg-green-500' : pct > 40 ? 'bg-yellow-400' : pct > 0 ? 'bg-orange-400' : 'bg-gray-100 dark:bg-gray-800';
                return (
                  <td key={j} className="text-center py-1 px-2">
                    <span className={clsx('inline-block w-8 py-0.5 rounded text-white font-medium', intensity)}>
                      {pct > 0 ? `${pct}%` : '—'}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayOfWeekChart({ data }) {
  if (!data || data.length === 0) return null;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const max = Math.max(...data.map(d => d.count || 0), 1);

  return (
    <div className="flex items-end gap-1 h-[100px]">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <motion.div initial={{ height: 0 }} animate={{ height: `${((d.count || 0) / max) * 100}%` }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="w-full bg-primary-500 dark:bg-primary-400 rounded-t-sm min-h-[2px]"
          />
          <span className="text-[9px] text-gray-400">{days[d._id - 1] || d._id}</span>
        </div>
      ))}
    </div>
  );
}

export default function UserGrowthAnalytics() {
  const [period, setPeriod] = useState('daily');
  const { data, isLoading } = useUserGrowth({ period });

  const summary = data?.summary || {};
  const growth = data?.growth || [];
  const cohortData = data?.cohortData || [];
  const activeByDay = data?.activeByDay || [];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Users" value={summary.totalUsers?.toLocaleString() || 0} color="bg-blue-500" />
        <MetricCard label="New Users" value={`+${summary.newUsers?.toLocaleString() || 0}`} color="bg-green-500" subtext="in selected period" />
        <MetricCard label="Retention Rate" value={`${summary.retentionRate || 100}%`} color="bg-purple-500" />
        <MetricCard label="DAU/MAU" value={`${summary.dauMauRatio || 0}%`} color="bg-orange-500"
          subtext={`DAU: ${summary.dau || 0} / MAU: ${summary.mau || 0}`} />
      </div>

      {/* Growth Chart */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-500">User Growth</h4>
          <div className="flex gap-1">
            {['daily', 'weekly', 'monthly'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={clsx('px-2 py-1 text-[10px] font-medium rounded transition-all',
                  period === p ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'text-gray-400')}>
                {p}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="h-[180px] flex items-center justify-center"><span className="text-xs text-gray-400">Loading...</span></div>
        ) : (
          <GrowthChart data={growth} />
        )}
        <div className="flex items-center gap-4 mt-2 justify-center">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />Freelancers + Clients
          </span>
        </div>
      </div>

      {/* Active by Day of Week */}
      {activeByDay.length > 0 && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-500 mb-3">Active Users by Day of Week</h4>
          <DayOfWeekChart data={activeByDay} />
        </div>
      )}

      {/* Cohort Retention */}
      {cohortData.length > 0 && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-500 mb-3">Cohort Retention</h4>
          <RetentionGrid data={cohortData} />
        </div>
      )}
    </div>
  );
}
