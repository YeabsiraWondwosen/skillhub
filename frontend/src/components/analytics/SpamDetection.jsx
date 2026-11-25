import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  NoSymbolIcon, CheckCircleIcon, EyeIcon, FunnelIcon,
  ExclamationTriangleIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import { useSpamFlags, useResolveSpamFlag } from '@/hooks/useAdvancedAnalytics';
import { clsx } from 'clsx';

const SEVERITY_CONFIG = {
  low: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600' },
  high: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600' },
};

const STATUS_CONFIG = {
  pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600', label: 'Pending' },
  reviewing: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600', label: 'Reviewing' },
  confirmed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600', label: 'Confirmed' },
  dismissed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600', label: 'Dismissed' },
  actioned: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600', label: 'Actioned' },
};

const REASON_LABELS = {
  repetitive_content: 'Repetitive Content', promotional_spam: 'Promotional Spam',
  fake_review: 'Fake Review', inappropriate_language: 'Inappropriate Language',
  scam_attempt: 'Scam Attempt', phishing: 'Phishing',
  keyword_stuffing: 'Keyword Stuffing', link_stuffing: 'Link Stuffing',
  ai_generated_suspicious: 'AI Generated Suspicious', review_farming: 'Review Farming',
  fake_portfolio: 'Fake Portfolio', impersonation: 'Impersonation',
};

function FlagCard({ flag, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [resolution, setResolution] = useState({ status: 'dismissed', action: 'none' });

  const severity = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.low;
  const status = STATUS_CONFIG[flag.status] || STATUS_CONFIG.pending;

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="card p-4 transition-all hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', severity.bg)}>
          <NoSymbolIcon className={clsx('w-4 h-4', severity.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{flag.contentType}</h4>
            <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', severity.bg, severity.text)}>
              {flag.severity}
            </span>
            <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', status.bg, status.text)}>
              {status.label}
            </span>
            <span className="text-[10px] text-gray-400">{Math.round((flag.confidence || 0) * 100)}%</span>
          </div>
          <p className="text-xs text-gray-500">Reason: {REASON_LABELS[flag.reason] || flag.reason}</p>
          {flag.content && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2 bg-gray-50 dark:bg-gray-800 rounded p-2">
              "{flag.content}"
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded(!expanded)} className="p-1 text-gray-400 hover:text-primary-600">
            <EyeIcon className="w-4 h-4" />
          </button>
          {flag.status === 'pending' && (
            <button onClick={() => setShowResolve(!showResolve)} className="p-1 text-gray-400 hover:text-green-600">
              <CheckCircleIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && flag.aiAnalysis && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 ml-12">
            {flag.aiAnalysis.reasoning && (
              <div className="bg-purple-50/30 dark:bg-purple-900/10 rounded-lg p-3">
                <p className="text-[10px] font-medium text-purple-600 mb-1">AI Analysis</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{flag.aiAnalysis.reasoning}</p>
              </div>
            )}
            {flag.aiAnalysis.patterns?.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-gray-500 mb-1">Detected Patterns</p>
                <div className="flex flex-wrap gap-1">
                  {flag.aiAnalysis.patterns.map((p, i) => (
                    <span key={i} className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-1.5 py-0.5 rounded">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResolve && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 ml-12 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Status</label>
                <select value={resolution.status} onChange={e => setResolution(p => ({ ...p, status: e.target.value }))}
                  className="input-field w-full text-xs">
                  <option value="dismissed">Dismissed</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="actioned">Actioned</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Action</label>
                <select value={resolution.action} onChange={e => setResolution(p => ({ ...p, action: e.target.value }))}
                  className="input-field w-full text-xs">
                  <option value="none">None</option>
                  <option value="remove_content">Remove Content</option>
                  <option value="warn_user">Warn User</option>
                  <option value="suspend_user">Suspend User</option>
                  <option value="ban_user">Ban User</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowResolve(false)} className="btn-outline btn-sm text-xs">Cancel</button>
              <button onClick={() => { onResolve(flag._id, resolution); setShowResolve(false); }}
                className="btn-primary btn-sm text-xs">Save</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function SpamDetection() {
  const [filters, setFilters] = useState({ status: '', severity: '' });
  const { data, isLoading } = useSpamFlags(filters);
  const { mutate: resolveFlag } = useResolveSpamFlag();

  const flags = Array.isArray(data) ? data : (data?.flags || []);
  const pendingCount = flags.filter(f => f.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <NoSymbolIcon className="w-4 h-4 text-orange-500" />
            Spam Flags ({data?.total || flags.length})
          </h3>
          {pendingCount > 0 && (
            <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 px-2 py-0.5 rounded-full font-medium">
              {pendingCount} pending
            </span>
          )}
          <div className="flex gap-1">
            <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
              className="input-field text-xs py-1">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="reviewing">Reviewing</option>
              <option value="confirmed">Confirmed</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <select value={filters.severity} onChange={e => setFilters(p => ({ ...p, severity: e.target.value }))}
              className="input-field text-xs py-1">
              <option value="">All Severity</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center"><span className="text-xs text-gray-400">Loading...</span></div>
      ) : flags.length === 0 ? (
        <div className="card p-8 text-center">
          <NoSymbolIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No spam flags found. Content looks clean.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map(flag => (
            <FlagCard key={flag._id} flag={flag} onResolve={resolveFlag} />
          ))}
        </div>
      )}
    </div>
  );
}
