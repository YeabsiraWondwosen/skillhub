import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldExclamationIcon, ExclamationTriangleIcon, CheckCircleIcon,
  XCircleIcon, PlayIcon, EyeIcon, FunnelIcon, SparklesIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useFraudAlerts, useRunFraudDetection, useResolveFraudAlert } from '@/hooks/useAdvancedAnalytics';
import { clsx } from 'clsx';

const SEVERITY_CONFIG = {
  low: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600', dot: 'bg-yellow-500' },
  high: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600', dot: 'bg-orange-500' },
  critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600', dot: 'bg-red-500' },
};

const STATUS_CONFIG = {
  detected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600' },
  investigating: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600' },
  confirmed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700' },
  false_positive: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600' },
  resolved: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600' },
};

const TYPE_LABELS = {
  suspicious_login: 'Suspicious Login', rapid_transactions: 'Rapid Transactions',
  fake_reviews: 'Fake Reviews', identity_mismatch: 'Identity Mismatch',
  payment_fraud: 'Payment Fraud', account_takeover: 'Account Takeover',
  money_laundering: 'Money Laundering', multi_account: 'Multi-Account',
  bot_activity: 'Bot Activity', price_manipulation: 'Price Manipulation',
  escrow_abuse: 'Escrow Abuse', chargeback_fraud: 'Chargeback Fraud',
};

function AlertCard({ alert, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [resolution, setResolution] = useState({ status: 'resolved', resolution: '', actionTaken: 'none' });

  const severity = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
  const status = STATUS_CONFIG[alert.status] || STATUS_CONFIG.detected;

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="card p-4 transition-all hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', severity.bg)}>
          <ShieldExclamationIcon className={clsx('w-4 h-4', severity.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {TYPE_LABELS[alert.type] || alert.type}
            </h4>
            <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', severity.bg, severity.text)}>
              {alert.severity}
            </span>
            <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', status.bg, status.text)}>
              {alert.status?.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-gray-400">{Math.round((alert.confidence || 0) * 100)}% confidence</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">{alert.description}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded(!expanded)} className="p-1 text-gray-400 hover:text-primary-600">
            <EyeIcon className="w-4 h-4" />
          </button>
          {alert.status === 'detected' && (
            <button onClick={() => setShowResolve(!showResolve)} className="p-1 text-gray-400 hover:text-green-600">
              <CheckCircleIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 ml-12">
            {alert.aiReasoning && (
              <div className="bg-purple-50/30 dark:bg-purple-900/10 rounded-lg p-3">
                <p className="text-[10px] font-medium text-purple-600 mb-1">AI Reasoning</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{alert.aiReasoning}</p>
              </div>
            )}
            {alert.evidence?.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-gray-500 mb-1">Evidence</p>
                <div className="space-y-1">
                  {alert.evidence.map((e, i) => (
                    <div key={i} className="text-[10px] bg-gray-50 dark:bg-gray-800 rounded p-2 font-mono">
                      <span className="text-gray-400">{e.type}:</span>{' '}
                      {typeof e.data === 'object' ? JSON.stringify(e.data) : e.data}
                    </div>
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
                  <option value="resolved">Resolved</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="false_positive">False Positive</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Action</label>
                <select value={resolution.actionTaken} onChange={e => setResolution(p => ({ ...p, actionTaken: e.target.value }))}
                  className="input-field w-full text-xs">
                  <option value="none">None</option>
                  <option value="warning">Warning</option>
                  <option value="suspension">Suspension</option>
                  <option value="ban">Ban</option>
                  <option value="flag_account">Flag Account</option>
                </select>
              </div>
            </div>
            <textarea value={resolution.resolution} onChange={e => setResolution(p => ({ ...p, resolution: e.target.value }))}
              className="input-field w-full text-xs resize-none" rows={2} placeholder="Resolution notes..." />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowResolve(false)} className="btn-outline btn-sm text-xs">Cancel</button>
              <button onClick={() => { onResolve(alert._id, resolution); setShowResolve(false); }}
                className="btn-primary btn-sm text-xs">Save Resolution</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FraudDetection() {
  const [filters, setFilters] = useState({ status: '', severity: '' });
  const { data, isLoading } = useFraudAlerts(filters);
  const { mutate: runScan, isPending: scanning } = useRunFraudDetection();
  const { mutate: resolveAlert } = useResolveFraudAlert();

  const alerts = Array.isArray(data) ? data : (data?.alerts || []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldExclamationIcon className="w-4 h-4 text-red-500" />
            Fraud Alerts ({data?.total || alerts.length})
          </h3>
          <div className="flex gap-1">
            <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
              className="input-field text-xs py-1">
              <option value="">All Status</option>
              <option value="detected">Detected</option>
              <option value="investigating">Investigating</option>
              <option value="confirmed">Confirmed</option>
              <option value="false_positive">False Positive</option>
            </select>
            <select value={filters.severity} onChange={e => setFilters(p => ({ ...p, severity: e.target.value }))}
              className="input-field text-xs py-1">
              <option value="">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        <button onClick={() => runScan()} disabled={scanning} className="btn-primary btn-sm flex items-center gap-1.5">
          {scanning ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <SparklesIcon className="w-3.5 h-3.5" />}
          {scanning ? 'Scanning...' : 'Run AI Fraud Scan'}
        </button>
      </div>

      {/* Alerts */}
      {isLoading ? (
        <div className="card p-8 text-center"><span className="text-xs text-gray-400">Loading...</span></div>
      ) : alerts.length === 0 ? (
        <div className="card p-8 text-center">
          <ShieldExclamationIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No fraud alerts detected. Run a scan to check for suspicious activity.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <AlertCard key={alert._id} alert={alert} onResolve={resolveAlert} />
          ))}
        </div>
      )}
    </div>
  );
}
