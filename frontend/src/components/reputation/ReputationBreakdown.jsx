import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  Star, CircleCheck, Timer, MessageSquare, ShieldCheck, ChartColumn,
} from 'lucide-react';

const COMPONENT_LABELS = {
  ratings: { label: 'Ratings', icon: Star, description: 'Weighted average from reviews with time decay' },
  projectSuccess: { label: 'Project Success', icon: CircleCheck, description: 'Completion rate with dispute penalties' },
  completionRate: { label: 'On-Time Delivery', icon: Timer, description: 'On-time completion rate with cancellation penalties' },
  communication: { label: 'Communication', icon: MessageSquare, description: 'Average communication rating from reviews' },
  verification: { label: 'Verification', icon: ShieldCheck, description: 'Identity, GitHub, portfolio, and skill verifications' },
};

function ComponentBar({ name, score, weight, weightedScore, dataPoints, details, index }) {
  const config = COMPONENT_LABELS[name] || { label: name, icon: ChartColumn, description: '' };

  const barColor = score >= 80
    ? 'from-green-400 to-emerald-500'
    : score >= 60
    ? 'from-blue-400 to-blue-600'
    : score >= 40
    ? 'from-yellow-400 to-orange-500'
    : score > 0
    ? 'from-orange-400 to-red-500'
    : 'from-gray-300 to-gray-400';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm flex items-center"><config.icon size={14} aria-hidden="true" /></span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{config.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {dataPoints > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {dataPoints} {dataPoints === 1 ? 'point' : 'points'}
            </span>
          )}
          <span className="text-sm font-semibold text-gray-900 dark:text-white min-w-[2rem] text-right">
            {score}
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.1 }}
            className={clsx('h-full rounded-full bg-gradient-to-r', barColor)}
          />
        </div>
        <div
          className="absolute top-0 h-2.5 bg-black/10 dark:bg-white/10 rounded-full"
          style={{ width: `${weight * 100}%`, left: 0 }}
        />
      </div>

      <div className="flex items-center justify-between mt-0.5">
        <p className="text-[10px] text-gray-400 dark:text-gray-500">{config.description}</p>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          Weight: {Math.round(weight * 100)}% → {weightedScore}pts
        </span>
      </div>
    </motion.div>
  );
}

export function ReputationBreakdown({ components = {}, trustScore = 0, trustTier = 'unrated', rawMetrics = {} }) {
  const componentEntries = Object.entries(components);

  if (componentEntries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
        <p className="text-sm">No reputation data available yet.</p>
        <p className="text-xs mt-1">Complete projects and receive reviews to build your trust score.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trust Score Breakdown</h3>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{trustScore}</span>
          <span className="text-sm text-gray-400">/100</span>
        </div>
      </div>

      <div className="space-y-3">
        {componentEntries.map(([name, data], index) => (
          <ComponentBar
            key={name}
            name={name}
            score={data.score || 0}
            weight={data.weight || 0}
            weightedScore={data.weightedScore || 0}
            dataPoints={data.dataPoints || 0}
            details={data.details || {}}
            index={index}
          />
        ))}
      </div>

      {rawMetrics && Object.keys(rawMetrics).length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Raw Metrics
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {rawMetrics.averageRating > 0 && (
              <MetricItem label="Avg Rating" value={`${rawMetrics.averageRating}/5`} />
            )}
            {rawMetrics.totalReviews > 0 && (
              <MetricItem label="Total Reviews" value={rawMetrics.totalReviews} />
            )}
            {rawMetrics.completedProjects > 0 && (
              <MetricItem label="Completed" value={rawMetrics.completedProjects} />
            )}
            {rawMetrics.onTimeRate > 0 && (
              <MetricItem label="On-Time Rate" value={`${rawMetrics.onTimeRate}%`} />
            )}
            {rawMetrics.disputeCount > 0 && (
              <MetricItem label="Disputes" value={rawMetrics.disputeCount} accent="red" />
            )}
            {rawMetrics.cancellationCount > 0 && (
              <MetricItem label="Cancellations" value={rawMetrics.cancellationCount} accent="red" />
            )}
            {rawMetrics.verificationCount > 0 && (
              <MetricItem label="Verified" value={`${rawMetrics.verificationCount}/4`} />
            )}
            {rawMetrics.accountAgeDays > 0 && (
              <MetricItem label="Account Age" value={`${rawMetrics.accountAgeDays}d`} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricItem({ label, value, accent = 'default' }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={clsx(
        'text-sm font-semibold',
        accent === 'red' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white',
      )}>
        {value}
      </p>
    </div>
  );
}
