import { motion } from 'framer-motion';
import { ArrowRightIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

const GAP_COLORS = {
  urgent: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', bar: 'bg-red-500' },
  high: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-500' },
  medium: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-500' },
  low: { bg: 'bg-gray-50 dark:bg-gray-800/40', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-600 dark:text-gray-400', bar: 'bg-gray-400' },
};

const LEVEL_WIDTH = { none: '0%', beginner: '25%', intermediate: '50%', advanced: '75%', expert: '100%' };

function LevelBar({ current, target, color }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-gray-500 dark:text-gray-400">{current}</span>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
        <motion.div
          className={clsx('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: LEVEL_WIDTH[current] || '0%' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        {target && (
          <div
            className="absolute top-0 h-full border-r-2 border-dashed border-gray-500 dark:border-gray-400"
            style={{ left: LEVEL_WIDTH[target] }}
          />
        )}
      </div>
      <ArrowRightIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
      <span className="w-20 text-gray-500 dark:text-gray-400">{target}</span>
    </div>
  );
}

export default function SkillGapAnalysis({ analysis }) {
  if (!analysis) return null;

  const { skillGaps = [], strengths = [], weaknesses = [], demandedSkills = [] } = analysis;
  const urgentCount = skillGaps.filter(g => g.priority === 'urgent').length;
  const highCount = skillGaps.filter(g => g.priority === 'high').length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{skillGaps.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Skill Gaps</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{urgentCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Urgent</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{highCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">High Priority</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{strengths.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Strengths</p>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-500" />
            Your Strengths
          </h3>
          {strengths.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {strengths.map(s => (
                <span key={s} className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Add more skills to your profile to identify strengths.</p>
          )}
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-orange-500" />
            Areas to Improve
          </h3>
          {weaknesses.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {weaknesses.map(w => (
                <span key={w} className="px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium">
                  {w}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No weaknesses identified yet.</p>
          )}
        </div>
      </div>

      {/* Skill Gaps */}
      {skillGaps.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Skill Gap Analysis</h3>
          <div className="space-y-2">
            {skillGaps.map((gap, i) => {
              const colors = GAP_COLORS[gap.priority] || GAP_COLORS.low;
              return (
                <motion.div
                  key={gap.skill}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={clsx('card p-4 border-l-4', colors.border, colors.bg)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{gap.skill}</h4>
                      <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-bold uppercase', colors.text)}>
                        {gap.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>Demand: {gap.demandScore}%</span>
                      <span>~{gap.estimatedWeeks || '?'}w</span>
                    </div>
                  </div>
                  <LevelBar current={gap.currentLevel} target={gap.targetLevel} color={colors.bar} />
                  {gap.reason && (
                    <p className="text-[11px] text-gray-400 mt-2">{gap.reason}</p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Market Demand */}
      {demandedSkills.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Top Demanded Skills in Market</h3>
          <div className="flex flex-wrap gap-2">
            {demandedSkills.slice(0, 10).map(s => (
              <span key={s.name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs">
                <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{s.name}</span>
                <span className="text-gray-400">{s.demand}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
