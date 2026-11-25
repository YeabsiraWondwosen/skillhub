import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LightBulbIcon, SparklesIcon, ArrowPathIcon, CheckCircleIcon,
  ExclamationTriangleIcon, TrendingUpIcon, ShieldCheckIcon,
  EyeIcon, ChevronDownIcon, ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { useInsights, useGenerateInsights, useMarkInsightViewed } from '@/hooks/useAdvancedAnalytics';
import { clsx } from 'clsx';

const TYPE_CONFIG = {
  revenue_forecast: { icon: TrendingUpIcon, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  market_trend: { icon: TrendingUpIcon, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  user_segment: { icon: EyeIcon, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  growth_opportunity: { icon: SparklesIcon, color: 'text-primary-600', bg: 'bg-primary-100 dark:bg-primary-900/30' },
  risk_alert: { icon: ExclamationTriangleIcon, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
  performance_benchmark: { icon: CheckCircleIcon, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/30' },
  competitive_analysis: { icon: EyeIcon, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  demand_forecast: { icon: TrendingUpIcon, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  pricing_insight: { icon: TrendingUpIcon, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  retention_insight: { icon: ShieldCheckIcon, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
};

const IMPACT_BADGE = {
  low: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600',
  high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600',
  critical: 'bg-red-100 dark:bg-red-900/30 text-red-600',
};

function InsightCard({ insight, onViewed }) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = TYPE_CONFIG[insight.type] || TYPE_CONFIG.market_trend;
  const Icon = typeConfig.icon;
  const isViewed = insight.viewedBy?.length > 0;

  const handleExpand = () => {
    setExpanded(!expanded);
    if (!isViewed) onViewed(insight._id);
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={clsx('card p-4 transition-all hover:shadow-md', !isViewed && 'border-l-2 border-l-primary-500')}>
      <div className="flex items-start gap-3 cursor-pointer" onClick={handleExpand}>
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', typeConfig.bg)}>
          <Icon className={clsx('w-4 h-4', typeConfig.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{insight.title}</h4>
            <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', IMPACT_BADGE[insight.impact])}>
              {insight.impact}
            </span>
            {insight.confidence && (
              <span className="text-[10px] text-gray-400">{Math.round(insight.confidence * 100)}%</span>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">{insight.summary}</p>
        </div>
        <div className="flex-shrink-0">
          {expanded ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 ml-12 space-y-3">
            {insight.details && (
              <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{insight.details}</p>
            )}
            {insight.recommendations?.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-gray-500 mb-1">Recommendations</p>
                <ul className="space-y-1">
                  {insight.recommendations.map((r, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                      <SparklesIcon className="w-3 h-3 text-primary-500 mt-0.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {insight.metrics && Object.keys(insight.metrics).length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-gray-500 mb-1">Metrics</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(insight.metrics).map(([key, val]) => (
                    <div key={key} className="text-[10px] bg-gray-50 dark:bg-gray-800 rounded p-2">
                      <span className="text-gray-400">{key.replace(/_/g, ' ')}:</span>{' '}
                      <span className="font-medium text-gray-700 dark:text-gray-300">{typeof val === 'number' ? val.toLocaleString() : String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[9px] text-gray-400">
              Generated {insight.generatedAt ? new Date(insight.generatedAt).toLocaleDateString() : '—'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function BusinessInsights() {
  const [typeFilter, setTypeFilter] = useState('');
  const [impactFilter, setImpactFilter] = useState('');
  const { data, isLoading } = useInsights({ type: typeFilter, impact: impactFilter });
  const { mutate: generateInsights, isPending: generating } = useGenerateInsights();
  const { mutate: markViewed } = useMarkInsightViewed();

  const insights = Array.isArray(data) ? data : (data?.insights || []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <LightBulbIcon className="w-4 h-4 text-yellow-500" />
            Business Insights ({data?.total || insights.length})
          </h3>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-field text-xs py-1">
            <option value="">All Types</option>
            {Object.keys(TYPE_CONFIG).map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select value={impactFilter} onChange={e => setImpactFilter(e.target.value)} className="input-field text-xs py-1">
            <option value="">All Impact</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <button onClick={() => generateInsights()} disabled={generating}
          className="btn-primary btn-sm flex items-center gap-1.5">
          {generating ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <SparklesIcon className="w-3.5 h-3.5" />}
          {generating ? 'Generating...' : 'Generate AI Insights'}
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center"><span className="text-xs text-gray-400">Loading...</span></div>
      ) : insights.length === 0 ? (
        <div className="card p-8 text-center">
          <LightBulbIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">No business insights generated yet.</p>
          <button onClick={() => generateInsights()} disabled={generating} className="btn-primary btn-sm">
            {generating ? 'Generating...' : 'Generate First Insights'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map(insight => (
            <InsightCard key={insight._id} insight={insight} onViewed={markViewed} />
          ))}
        </div>
      )}
    </div>
  );
}
