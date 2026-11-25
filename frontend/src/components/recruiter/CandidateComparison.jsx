import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  XMarkIcon, StarIcon, CheckBadgeIcon, ArrowTrendingUpIcon, SparklesIcon,
  GlobeAltIcon, BriefcaseIcon, AcademicCapIcon, CodeBracketIcon,
} from '@heroicons/react/24/outline';
import { useCompareCandidates } from '@/hooks/useRecruiter';
import { clsx } from 'clsx';
import { formatRate } from '@/utils/currency';

const TIER_COLORS = {
  elite: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  trusted: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  reliable: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  emerging: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  unrated: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
};

const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced', 'expert'];
const levelIdx = (l) => Math.max(0, LEVEL_ORDER.indexOf(l));

export default function CandidateComparison({ candidateIds, onRemove, onClose }) {
  const { data, isLoading } = useCompareCandidates(candidateIds);
  const [activeTab, setActiveTab] = useState('overview');

  const candidates = data?.candidates || [];
  const aiInsight = data?.aiInsight;

  if (isLoading) {
    return (
      <div className="card p-8 text-center">
        <div className="animate-pulse text-gray-400">Analyzing candidates...</div>
      </div>
    );
  }

  if (candidates.length < 2) {
    return (
      <div className="card p-8 text-center text-gray-500">
        Select at least 2 candidates to compare.
      </div>
    );
  }

  const allSkills = [...new Set(candidates.flatMap(c => c.skills.map(s => s.name)))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Comparing {candidates.length} Candidates
        </h3>
        <button onClick={onClose} className="btn-icon btn-ghost text-gray-400">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {['overview', 'skills', 'scores'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors capitalize',
              activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* AI Insight */}
      {aiInsight && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4 bg-primary-50/30 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800"
        >
          <div className="flex items-center gap-2 mb-2">
            <SparklesIcon className="w-4 h-4 text-primary-500" />
            <span className="text-xs font-semibold text-gray-900 dark:text-white">AI Recommendation</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{aiInsight.recommendation}</p>
          {aiInsight.ranking && (
            <div className="flex flex-wrap gap-2">
              {aiInsight.ranking.map((r, i) => (
                <span key={r.id} className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-[10px] font-medium text-gray-700 dark:text-gray-300">
                  #{i + 1} {candidates.find(c => c._id === r.id)?.name} ({r.score}%)
                </span>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">Metric</th>
              {candidates.map(c => (
                <th key={c._id} className="text-center py-2 px-2 min-w-[140px]">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-xs mb-1">
                      {c.name?.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">{c.name}</span>
                    <span className={clsx('px-1.5 py-0.5 rounded text-[9px] font-semibold mt-0.5', TIER_COLORS[c.trustTier])}>
                      {c.trustTier}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeTab === 'overview' && (
              <>
                <Row label="Hourly Rate" values={candidates.map(c => formatRate(c.hourlyRate) ?? '—')} />
                <Row label="Rating" values={candidates.map(c => (
                  <span className="flex items-center justify-center gap-1">
                    <StarIcon className="w-3 h-3 text-yellow-500" />
                    {c.rating.toFixed(1)} ({c.totalReviews})
                  </span>
                ))} />
                <Row label="Projects" values={candidates.map(c => c.completedProjects)} />
                <Row label="Reputation" values={candidates.map(c => (
                  <span className="font-semibold">{c.reputationScore}/100</span>
                ))} />
                <Row label="Success Rate" values={candidates.map(c => `${c.successRate}%`)} />
                <Row label="Response Time" values={candidates.map(c => c.responseTime ? `${c.responseTime}h` : '—')} />
                <Row label="Availability" values={candidates.map(c => (
                  <span className="capitalize">{c.availability?.replace('_', ' ')}</span>
                ))} />
                <Row label="Level" values={candidates.map(c => (
                  <span className="capitalize">{c.freelancerLevel?.replace('_', ' ')}</span>
                ))} />
                <Row label="Location" values={candidates.map(c => c.location?.country || '—')} />
                <Row label="Languages" values={candidates.map(c => c.languages?.map(l => l.name).join(', ') || '—')} />
                <Row label="Badges" values={candidates.map(c => (
                  <span>{c.badges?.length || 0} badges</span>
                ))} />
              </>
            )}

            {activeTab === 'skills' && (
              allSkills.map(skill => (
                <Row
                  key={skill}
                  label={skill}
                  values={candidates.map(c => {
                    const s = c.skills?.find(sk => sk.name === skill);
                    if (!s) return <span className="text-gray-300 dark:text-gray-600">—</span>;
                    const width = `${((levelIdx(s.level) + 1) / 4) * 100}%`;
                    return (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-500 rounded-full" style={{ width }} />
                        </div>
                        <span className="text-[10px] capitalize">{s.level} · {s.years}y</span>
                      </div>
                    );
                  })}
                />
              ))
            )}

            {activeTab === 'scores' && candidates[0]?.componentScores && (
              Object.keys(candidates[0].componentScores).map(key => (
                <Row
                  key={key}
                  label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                  values={candidates.map(c => {
                    const comp = c.componentScores?.[key];
                    return comp ? (
                      <div className="flex flex-col items-center">
                        <span className="font-semibold">{comp.score}/100</span>
                        <span className="text-[9px] text-gray-400">w: {(comp.weight * 100).toFixed(0)}%</span>
                      </div>
                    ) : '—';
                  })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Remove buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {candidates.map(c => (
          <button
            key={c._id}
            onClick={() => onRemove(c._id)}
            className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1"
          >
            <XMarkIcon className="w-3 h-3" />
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Row({ label, values }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-2 px-2 text-center text-gray-700 dark:text-gray-300">{v}</td>
      ))}
    </tr>
  );
}
