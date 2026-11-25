import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartBarIcon, CurrencyDollarIcon, ShieldExclamationIcon,
  NoSymbolIcon, UsersIcon, LightBulbIcon, SparklesIcon,
  ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon,
  UserGroupIcon, BriefcaseIcon, StarIcon, HeartIcon,
} from '@heroicons/react/24/outline';
import {
  useAnalyticsDashboard, usePlatformStats,
} from '@/hooks/useAdvancedAnalytics';
import RevenueChart from '@/components/analytics/RevenueChart';
import FraudDetection from '@/components/analytics/FraudDetection';
import SpamDetection from '@/components/analytics/SpamDetection';
import UserGrowthAnalytics from '@/components/analytics/UserGrowthAnalytics';
import BusinessInsights from '@/components/analytics/BusinessInsights';
import { clsx } from 'clsx';

const TABS = [
  { key: 'overview', label: 'Overview', icon: ChartBarIcon },
  { key: 'revenue', label: 'Revenue', icon: CurrencyDollarIcon },
  { key: 'fraud', label: 'Fraud', icon: ShieldExclamationIcon },
  { key: 'spam', label: 'Spam', icon: NoSymbolIcon },
  { key: 'growth', label: 'Growth', icon: UsersIcon },
  { key: 'insights', label: 'Insights', icon: LightBulbIcon },
];

function StatCard({ label, value, icon: Icon, color, trend, subtext }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="card p-4 flex items-center gap-3">
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-[11px] text-gray-500">{label}</p>
        {subtext && <p className="text-[9px] text-gray-400">{subtext}</p>}
      </div>
      {trend !== undefined && (
        <span className={clsx('text-[10px] font-medium', trend >= 0 ? 'text-green-600' : 'text-red-600')}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </motion.div>
  );
}

function OverviewTab({ dashboard, stats }) {
  return (
    <div className="space-y-4">
      {/* Platform Health */}
      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Users" value={stats.users?.total?.toLocaleString() || 0}
              icon={UserGroupIcon} color="bg-blue-100 dark:bg-blue-900/30 text-blue-600"
              subtext={`${stats.users?.freelancers || 0} freelancers / ${stats.users?.clients || 0} clients`} />
            <StatCard label="Active Jobs" value={stats.jobs?.active || 0}
              icon={BriefcaseIcon} color="bg-green-100 dark:bg-green-900/30 text-green-600"
              subtext={`${stats.jobs?.total || 0} total`} />
            <StatCard label="Avg Rating" value={stats.reviews?.average || 0}
              icon={StarIcon} color="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600"
              subtext={`${stats.reviews?.total || 0} reviews`} />
            <StatCard label="Health Score" value={`${stats.healthScore || 0}/100`}
              icon={HeartIcon} color="bg-red-100 dark:bg-red-900/30 text-red-600" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="New Users (30d)" value={`+${stats.users?.newLast30Days || 0}`}
              icon={UsersIcon} color="bg-primary-100 dark:bg-primary-900/30 text-primary-600" />
            <StatCard label="Completed Projects" value={stats.projects?.completed || 0}
              icon={CheckCircleIcon} color="bg-purple-100 dark:bg-purple-900/30 text-purple-600"
               subtext={`Avg ${stats.projects?.avgValue?.toFixed(0) || 0} ETB`} />
            <StatCard label="Verified Freelancers" value={stats.users?.verifiedFreelancers || 0}
              icon={CheckCircleIcon} color="bg-teal-100 dark:bg-teal-900/30 text-teal-600" />
          </div>
        </>
      )}

      {/* Alerts Summary */}
      {dashboard?.alertsSummary && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 border-l-2 border-l-red-500">
            <div className="flex items-center gap-2">
              <ShieldExclamationIcon className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{dashboard.alertsSummary.fraudDetected}</p>
                <p className="text-xs text-gray-500">Fraud Alerts</p>
              </div>
            </div>
          </div>
          <div className="card p-4 border-l-2 border-l-orange-500">
            <div className="flex items-center gap-2">
              <NoSymbolIcon className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{dashboard.alertsSummary.spamPending}</p>
                <p className="text-xs text-gray-500">Spam Flags</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Fraud Alerts */}
      {dashboard?.recentFraudAlerts?.length > 0 && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-500 mb-3">Recent Fraud Alerts</h4>
          <div className="space-y-2">
            {dashboard.recentFraudAlerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-3 text-xs bg-red-50/30 dark:bg-red-900/5 rounded-lg p-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="font-medium text-gray-900 dark:text-white">{alert.type?.replace(/_/g, ' ')}</span>
                <span className={clsx('px-1.5 py-0.5 rounded text-[9px] font-medium',
                  alert.severity === 'critical' ? 'bg-red-100 text-red-600' :
                  alert.severity === 'high' ? 'bg-orange-100 text-orange-600' : 'bg-yellow-100 text-yellow-600'
                )}>
                  {alert.severity}
                </span>
                <span className="text-gray-500 truncate flex-1">{alert.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdvancedAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const { data: dashboard, isLoading: dashLoading } = useAnalyticsDashboard();
  const { data: stats } = usePlatformStats();

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <ChartBarIcon className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Advanced Analytics</h1>
              <p className="text-xs text-gray-500">Revenue, fraud detection, growth, and business intelligence</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-200 dark:border-gray-700 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                activeTab === t.key
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              )}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <OverviewTab dashboard={dashboard} stats={stats} />
            </motion.div>
          )}
          {activeTab === 'revenue' && (
            <motion.div key="revenue" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <RevenueChart />
            </motion.div>
          )}
          {activeTab === 'fraud' && (
            <motion.div key="fraud" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <FraudDetection />
            </motion.div>
          )}
          {activeTab === 'spam' && (
            <motion.div key="spam" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <SpamDetection />
            </motion.div>
          )}
          {activeTab === 'growth' && (
            <motion.div key="growth" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <UserGrowthAnalytics />
            </motion.div>
          )}
          {activeTab === 'insights' && (
            <motion.div key="insights" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <BusinessInsights />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
