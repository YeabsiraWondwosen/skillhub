import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  CheckBadgeIcon, ShieldCheckIcon, CodeBracketIcon,
  BriefcaseIcon, UserIcon, CheckCircleIcon, MinusCircleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { Crown } from 'lucide-react';

const VERIFICATION_CONFIG = {
  identity: {
    label: 'Identity Verified',
    icon: UserIcon,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    ring: 'ring-blue-400',
    description: 'Government ID verified',
  },
  github: {
    label: 'GitHub Verified',
    icon: CodeBracketIcon,
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    ring: 'ring-gray-400',
    description: 'GitHub profile confirmed',
  },
  portfolio: {
    label: 'Portfolio Verified',
    icon: BriefcaseIcon,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    ring: 'ring-purple-400',
    description: 'Portfolio reviewed & approved',
  },
};

const TRUST_LEVEL_CONFIG = {
  unverified: { label: 'Unverified', color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', icon: MinusCircleIcon },
  basic: { label: 'Basic', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: CheckCircleIcon },
  verified: { label: 'Verified', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', icon: ShieldCheckIcon },
  trusted: { label: 'Trusted', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: StarIcon },
  elite: { label: 'Elite', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: Crown },
};

export function VerificationBadge({ type, size = 'sm', showLabel = true, verified = true }) {
  const config = VERIFICATION_CONFIG[type];
  if (!config || !verified) return null;

  const Icon = config.icon;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        config.color,
        size === 'xs' && 'px-1.5 py-0.5 text-[10px]',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        size === 'lg' && 'px-4 py-1.5 text-sm'
      )}
    >
      <Icon className={clsx(
        size === 'xs' && 'w-3 h-3',
        size === 'sm' && 'w-3.5 h-3.5',
        size === 'md' && 'w-4 h-4',
        size === 'lg' && 'w-5 h-5',
      )} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export function VerificationBadgeGroup({ verifications = [], size = 'sm' }) {
  const approvedTypes = verifications
    .filter(v => v.status === 'approved')
    .map(v => v.type);

  if (approvedTypes.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {approvedTypes.map(type => (
        <VerificationBadge key={type} type={type} size={size} />
      ))}
    </div>
  );
}

export function TrustLevelBadge({ trustLevel = 'unverified', size = 'md', showProgress = false, score = 0 }) {
  const config = TRUST_LEVEL_CONFIG[trustLevel] || TRUST_LEVEL_CONFIG.unverified;

  return (
    <div className={clsx('inline-flex flex-col items-center', size === 'sm' && 'gap-0.5', size === 'md' && 'gap-1')}>
      <span className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-semibold',
        config.bg, config.color,
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        size === 'lg' && 'px-4 py-1.5 text-base',
      )}>
        <span className="inline-flex"><config.icon className="w-4 h-4" aria-hidden="true" /></span>
        {config.label}
      </span>
      {showProgress && (
        <div className="w-full">
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(score, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-secondary-500"
            />
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-0.5">{score}/100 trust score</p>
        </div>
      )}
    </div>
  );
}

export function VerificationShield({ trustLevel = 'unverified', size = 64 }) {
  const colors = {
    unverified: { bg: 'bg-gray-100 dark:bg-gray-800', icon: 'text-gray-300', ring: 'ring-gray-200' },
    basic: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-400', ring: 'ring-blue-200' },
    verified: { bg: 'bg-green-50 dark:bg-green-900/20', icon: 'text-green-500', ring: 'ring-green-200' },
    trusted: { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'text-purple-500', ring: 'ring-purple-200' },
    elite: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: 'text-yellow-500', ring: 'ring-yellow-200' },
  };

  const c = colors[trustLevel] || colors.unverified;

  return (
    <div
      className={clsx('rounded-full flex items-center justify-center ring-2', c.bg, c.ring)}
      style={{ width: size, height: size }}
    >
      {trustLevel === 'elite' ? (
        <ShieldCheckIcon className={clsx(c.icon)} style={{ width: size * 0.55, height: size * 0.55 }} />
      ) : (
        <CheckBadgeIcon className={clsx(c.icon)} style={{ width: size * 0.55, height: size * 0.55 }} />
      )}
    </div>
  );
}
