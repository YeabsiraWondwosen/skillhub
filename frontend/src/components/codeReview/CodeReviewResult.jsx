import { useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useCodeReview } from '@hooks/useCodeReview';
import {
  Circle, Bug, Lock, Zap, CircleCheck, Wrench, Palette,
  FileText, CircleX, TriangleAlert, ChartColumn, ChevronRight, Check,
} from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400', icon: <Circle size={14} className="text-red-600 dark:text-red-400" fill="currentColor" aria-hidden="true" />, label: 'Critical' },
  high: { color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400', icon: <Circle size={14} className="text-orange-600 dark:text-orange-400" fill="currentColor" aria-hidden="true" />, label: 'High' },
  medium: { color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400', icon: <Circle size={14} className="text-yellow-600 dark:text-yellow-400" fill="currentColor" aria-hidden="true" />, label: 'Medium' },
  low: { color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400', icon: <Circle size={14} className="text-blue-600 dark:text-blue-400" fill="currentColor" aria-hidden="true" />, label: 'Low' },
  info: { color: 'text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400', icon: <Circle size={14} className="text-gray-500 dark:text-gray-400" fill="currentColor" aria-hidden="true" />, label: 'Info' },
};

const CATEGORY_CONFIG = {
  bug: { label: 'Bugs', icon: Bug, color: 'text-red-500' },
  security: { label: 'Security', icon: Lock, color: 'text-orange-500' },
  performance: { label: 'Performance', icon: Zap, color: 'text-yellow-500' },
  best_practice: { label: 'Best Practices', icon: CircleCheck, color: 'text-green-500' },
  maintainability: { label: 'Maintainability', icon: Wrench, color: 'text-blue-500' },
  style: { label: 'Style', icon: Palette, color: 'text-purple-500' },
};

function ScoreGauge({ score }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s) => {
    if (s >= 80) return 'text-green-500';
    if (s >= 60) return 'text-blue-500';
    if (s >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="relative inline-flex items-center justify-center w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200 dark:text-gray-700" />
        <motion.circle
          cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className={getColor(score)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={clsx('text-2xl font-bold', getColor(score))}>{score}</span>
        <span className="text-[10px] text-gray-400">/100</span>
      </div>
    </div>
  );
}

function CategoryScoreBar({ label, icon, score }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-5 text-center flex items-center justify-center">{icon && <icon size={14} aria-hidden="true" />}</span>
      <span className="text-xs text-gray-600 dark:text-gray-400 w-28">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={clsx(
            'h-full rounded-full',
            score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500',
          )}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-8 text-right">{score}</span>
    </div>
  );
}

function IssueCard({ issue }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info;
  const cat = CATEGORY_CONFIG[issue.category] || CATEGORY_CONFIG.bug;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-sm flex items-center">{sev.icon}</span>
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', sev.color)}>{sev.label}</span>
        <span className={clsx('text-sm flex items-center', cat.color)}><cat.icon size={14} aria-hidden="true" /></span>
        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{issue.message}</span>
        {issue.line && (
          <span className="text-xs text-gray-400 whitespace-nowrap">L{issue.line}</span>
        )}
        <svg className={clsx('w-4 h-4 text-gray-400 transition-transform', expanded && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-100 dark:border-gray-800"
          >
            <div className="px-4 py-3 space-y-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Rule</p>
                <p className="text-sm font-mono text-gray-700 dark:text-gray-300">{issue.rule}</p>
              </div>
              {issue.suggestion && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Suggestion</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{issue.suggestion}</p>
                </div>
              )}
              {issue.codeSnippet && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Code</p>
                  <pre className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">{issue.codeSnippet}</pre>
                </div>
              )}
              {issue.fixSnippet && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Suggested Fix</p>
                  <pre className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3 text-xs font-mono text-green-700 dark:text-green-300 overflow-x-auto">{issue.fixSnippet}</pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FileSection({ fileAnalysis, index }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText size={16} className="text-gray-500 dark:text-gray-400" aria-hidden="true" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fileAnalysis.fileName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500">{fileAnalysis.language}</span>
          <span className="text-xs text-gray-400">{fileAnalysis.lineCount} lines</span>
        </div>
        <div className="flex items-center gap-2">
          {fileAnalysis.issues?.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
              {fileAnalysis.issues.length} issue{fileAnalysis.issues.length !== 1 ? 's' : ''}
            </span>
          )}
          <svg className={clsx('w-4 h-4 text-gray-400 transition-transform', expanded && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="p-4 space-y-2">
              {fileAnalysis.issues?.length > 0 ? (
                fileAnalysis.issues
                  .sort((a, b) => (SEVERITY_ORDER[a.severity] || 5) - (SEVERITY_ORDER[b.severity] || 5))
                  .map((issue, i) => <IssueCard key={issue._id || i} issue={issue} />)
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No issues found in this file</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export default function CodeReviewResult({ reviewId }) {
  const { data: review, isLoading, error } = useCodeReview(reviewId);
  const [activeFilter, setActiveFilter] = useState('all');

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
          <p className="text-sm text-gray-500">Analyzing your code...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
        <CircleX size={40} className="mx-auto mb-3 text-red-500" aria-hidden="true" />
        <p className="text-sm text-red-500">Failed to load review</p>
      </div>
    );
  }

  if (!review) return null;

  if (review.status === 'analyzing' || review.status === 'pending') {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
          <p className="text-sm text-gray-500">AI is analyzing your code...</p>
          <p className="text-xs text-gray-400">This usually takes 10-30 seconds</p>
        </div>
      </div>
    );
  }

  if (review.status === 'failed') {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
        <TriangleAlert size={40} className="mx-auto mb-3 text-red-500" aria-hidden="true" />
        <p className="text-sm text-red-500">Analysis failed: {review.errorMessage || 'Unknown error'}</p>
      </div>
    );
  }

  const allIssues = review.fileAnalyses?.flatMap(fa => fa.issues || []) || [];
  const filteredIssues = activeFilter === 'all'
    ? allIssues
    : allIssues.filter(i => i.category === activeFilter);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Code Review Results</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {review.sourceFiles?.length || review.fileAnalyses?.length || 0} file(s) analyzed
            {review.analysisDuration > 0 && ` in ${(review.analysisDuration / 1000).toFixed(1)}s`}
          </p>
        </div>
        <ScoreGauge score={review.overallScore} />
      </div>

      {/* Summary */}
      {review.summary && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">{review.summary}</p>
        </div>
      )}

      {/* Issue Counts */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { count: review.criticalCount, ...SEVERITY_CONFIG.critical },
          { count: review.highCount, ...SEVERITY_CONFIG.high },
          { count: review.mediumCount, ...SEVERITY_CONFIG.medium },
          { count: review.lowCount, ...SEVERITY_CONFIG.low },
          { count: review.infoCount, ...SEVERITY_CONFIG.info },
        ].map((sev, i) => (
          <div key={i} className={clsx('text-center py-2 rounded-lg', sev.color)}>
            <p className="text-lg font-bold">{sev.count || 0}</p>
            <p className="text-[10px] opacity-70">{sev.label}</p>
          </div>
        ))}
      </div>

      {/* Category Scores */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Category Scores</h4>
        <div className="space-y-2">
          {Object.entries(review.categoryScores || {}).map(([key, score]) => {
            const config = CATEGORY_CONFIG[key] || { label: key, icon: ChartColumn };
            return <CategoryScoreBar key={key} label={config.label} icon={config.icon} score={score} />;
          })}
        </div>
      </div>

      {/* Recommendations */}
      {review.recommendations?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recommendations</h4>
          <ul className="space-y-1.5">
            {review.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <ChevronRight size={14} className="text-primary-500 mt-0.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Strengths */}
      {review.strengths?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Strengths</h4>
          <ul className="space-y-1.5">
            {review.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issue Filters */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Issues ({filteredIssues.length})
          </h4>
          <div className="flex gap-1">
            {['all', 'bug', 'security', 'performance', 'best_practice', 'maintainability', 'style'].map(cat => {
              const count = cat === 'all' ? allIssues.length : allIssues.filter(i => i.category === cat).length;
              if (cat !== 'all' && count === 0) return null;
              const config = CATEGORY_CONFIG[cat] || { icon: ChartColumn, label: 'All' };
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={clsx(
                    'px-2 py-1 rounded text-xs font-medium transition-all inline-flex items-center gap-1',
                    activeFilter === cat
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200',
                  )}
                >
                  <config.icon size={12} aria-hidden="true" /> {count}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          {filteredIssues
            .sort((a, b) => (SEVERITY_ORDER[a.severity] || 5) - (SEVERITY_ORDER[b.severity] || 5))
            .map((issue, i) => (
              <IssueCard key={issue._id || i} issue={issue} />
            ))}
          {filteredIssues.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">No issues in this category</p>
          )}
        </div>
      </div>

      {/* File Breakdown */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">File Breakdown</h4>
        <div className="space-y-2">
          {review.fileAnalyses?.map((fa, i) => (
            <FileSection key={fa._id || i} fileAnalysis={fa} index={i} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-400">
          Powered by {review.aiModel || 'AI'} • {new Date(review.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
