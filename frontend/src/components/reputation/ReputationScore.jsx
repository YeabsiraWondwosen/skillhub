import { clsx } from 'clsx';
import { motion } from 'framer-motion';

const TIER_CONFIG = {
  unrated: {
    label: 'Unrated',
    color: 'text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-800',
    ring: 'ring-gray-300',
    gradient: 'from-gray-400 to-gray-500',
    icon: '○',
  },
  emerging: {
    label: 'Emerging',
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    ring: 'ring-blue-400',
    gradient: 'from-blue-400 to-blue-600',
    icon: '◔',
  },
  reliable: {
    label: 'Reliable',
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-900/20',
    ring: 'ring-green-400',
    gradient: 'from-green-400 to-green-600',
    icon: '◑',
  },
  trusted: {
    label: 'Trusted',
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    ring: 'ring-purple-400',
    gradient: 'from-purple-400 to-purple-600',
    icon: '◕',
  },
  elite: {
    label: 'Elite',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    ring: 'ring-yellow-400',
    gradient: 'from-yellow-400 to-amber-500',
    icon: '●',
  },
};

function ScoreRing({ score, size = 'md', tier = 'unrated' }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.unrated;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div className={clsx('relative inline-flex items-center justify-center', sizeClasses[size])}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-gray-200 dark:text-gray-700"
        />
        <motion.circle
          cx="50" cy="50" r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className={clsx(
            tier === 'elite' && 'text-yellow-500',
            tier === 'trusted' && 'text-purple-500',
            tier === 'reliable' && 'text-green-500',
            tier === 'emerging' && 'text-blue-500',
            tier === 'unrated' && 'text-gray-400',
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={clsx('font-bold leading-none', textSizes[size], config.color)}>
          {score}
        </span>
        {size !== 'sm' && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">/100</span>
        )}
      </div>
    </div>
  );
}

export function ReputationScore({ trustScore = 0, trustTier = 'unrated', size = 'md', showLabel = true }) {
  const config = TIER_CONFIG[trustTier] || TIER_CONFIG.unrated;

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <ScoreRing score={trustScore} size={size} tier={trustTier} />
      {showLabel && (
        <span className={clsx(
          'inline-flex items-center gap-1 rounded-full font-semibold px-2.5 py-0.5 text-xs',
          config.bg, config.color,
        )}>
          <span>{config.icon}</span>
          {config.label}
        </span>
      )}
    </div>
  );
}

export function ReputationBadge({ trustScore = 0, trustTier = 'unrated', size = 'sm' }) {
  const config = TIER_CONFIG[trustTier] || TIER_CONFIG.unrated;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        config.bg, config.color,
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
      )}
    >
      <span>{config.icon}</span>
      <span>{trustScore}</span>
      <span className="opacity-70">{config.label}</span>
    </span>
  );
}

export function ReputationInline({ trustScore = 0, trustTier = 'unrated' }) {
  const config = TIER_CONFIG[trustTier] || TIER_CONFIG.unrated;
  const barWidth = `${trustScore}%`;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: barWidth }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={clsx(
            'h-full rounded-full bg-gradient-to-r',
            config.gradient,
          )}
        />
      </div>
      <span className={clsx('text-sm font-semibold min-w-[2.5rem] text-right', config.color)}>
        {trustScore}
      </span>
    </div>
  );
}
