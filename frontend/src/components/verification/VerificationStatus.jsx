import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  CheckCircleIcon, XCircleIcon, ClockIcon,
  ExclamationCircleIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { Check, X } from 'lucide-react';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', icon: ClockIcon },
  submitted: { label: 'Submitted', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: ClockIcon },
  under_review: { label: 'Under Review', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: ExclamationCircleIcon },
  approved: { label: 'Approved', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircleIcon },
  rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', icon: XCircleIcon },
  expired: { label: 'Expired', color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/50', icon: ClockIcon },
};

export function VerificationStatus({ status, size = 'sm' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-full font-medium',
      config.bg, config.color,
      size === 'xs' && 'px-1.5 py-0.5 text-[10px]',
      size === 'sm' && 'px-2 py-0.5 text-xs',
      size === 'md' && 'px-3 py-1 text-sm',
    )}>
      <Icon className={clsx(
        size === 'xs' && 'w-3 h-3',
        size === 'sm' && 'w-3.5 h-3.5',
        size === 'md' && 'w-4 h-4',
      )} />
      {config.label}
    </span>
  );
}

export function VerificationSteps({ verifications = [] }) {
  const steps = [
    { type: 'identity', label: 'Identity', description: 'Upload government ID' },
    { type: 'github', label: 'GitHub', description: 'Verify your GitHub profile' },
    { type: 'portfolio', label: 'Portfolio', description: 'Submit portfolio project' },
  ];

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const v = verifications.find(v => v.type === step.type);
        const status = v?.status || 'pending';

        return (
          <motion.div
            key={step.type}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={clsx(
              'flex items-center gap-3 p-3 rounded-lg border transition-colors',
              status === 'approved'
                ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                : status === 'rejected'
                ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800'
            )}
          >
            <div className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
              status === 'approved' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
              status === 'rejected' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
              status === 'submitted' || status === 'under_review' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
              'bg-gray-100 text-gray-400 dark:bg-gray-800'
            )}>
              {status === 'approved' ? <Check size={14} strokeWidth={3} /> : status === 'rejected' ? <X size={14} strokeWidth={3} /> : index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{step.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{step.description}</p>
            </div>
            <VerificationStatus status={status} />
          </motion.div>
        );
      })}
    </div>
  );
}

export function VerificationScoreBar({ scores = {}, overallScore = 0, trustLevel = 'unverified' }) {
  const scoreEntries = [
    { key: 'identity', label: 'Identity', color: 'bg-blue-500' },
    { key: 'github', label: 'GitHub', color: 'bg-gray-500' },
    { key: 'portfolio', label: 'Portfolio', color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">Verification Score</span>
        <span className="text-lg font-black text-primary-600">{overallScore}/100</span>
      </div>
      <div className="space-y-2">
        {scoreEntries.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${scores[key] || 0}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={clsx('h-full rounded-full', color)}
              />
            </div>
            <span className="text-xs font-medium text-gray-500 w-8 text-right">{scores[key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
