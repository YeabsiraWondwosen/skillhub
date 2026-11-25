import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  Star, Rocket, Gem, BadgeCheck, Wallet, Zap, Heart,
  Sprout, BookOpen, Target, Crown,
} from 'lucide-react';

const BADGE_CONFIG = {
  top_rated: { label: 'Top Rated', icon: Star, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', ring: 'ring-yellow-400' },
  rising_talent: { label: 'Rising Talent', icon: Rocket, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', ring: 'ring-blue-400' },
  expert_vetted: { label: 'Expert Vetted', icon: Gem, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', ring: 'ring-purple-400' },
  skill_verified: { label: 'Skill Verified', icon: BadgeCheck, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', ring: 'ring-green-400' },
  top_earner: { label: 'Top Earner', icon: Wallet, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', ring: 'ring-emerald-400' },
  fast_responder: { label: 'Fast Responder', icon: Zap, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', ring: 'ring-orange-400' },
  client_favorite: { label: 'Client Favorite', icon: Heart, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', ring: 'ring-red-400' },
};

const LEVEL_CONFIG = {
  newcomer: { label: 'Newcomer', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', icon: Sprout },
  intermediate: { label: 'Intermediate', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: BookOpen },
  experienced: { label: 'Experienced', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', icon: BookOpen },
  expert: { label: 'Expert', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: Target },
  top_rated_plus: { label: 'Top Rated Plus', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: Crown },
};

export function FreelancerBadge({ badge, size = 'sm', showLabel = true }) {
  const config = BADGE_CONFIG[badge.type] || BADGE_CONFIG.skill_verified;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        config.color,
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        size === 'lg' && 'px-4 py-1.5 text-sm'
      )}
    >
      <span>{config.icon && <config.icon size={16} className="inline" aria-hidden="true" />}</span>
      {showLabel && <span>{config.label}</span>}
      {badge.skill && <span className="opacity-75">({badge.skill})</span>}
    </span>
  );
}

export function FreelancerLevel({ level, progress = 0, size = 'md', showProgress = true }) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.newcomer;

  return (
    <div className={clsx('inline-flex flex-col items-center', size === 'sm' && 'gap-0.5', size === 'md' && 'gap-1')}>
      <span className={clsx('inline-flex items-center gap-1.5 rounded-full font-semibold', config.bg, config.color,
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        size === 'lg' && 'px-4 py-1.5 text-base',
      )}>
        <span>{config.icon && <config.icon size={16} className="inline" aria-hidden="true" />}</span>
        {config.label}
      </span>
      {showProgress && progress > 0 && (
        <div className="w-full">
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={clsx('h-full rounded-full', level === 'newcomer' ? 'bg-gray-400' : 'bg-gradient-to-r from-primary-500 to-secondary-500')}
            />
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-0.5">{progress}% to next level</p>
        </div>
      )}
    </div>
  );
}

export function BadgeShowcase({ badges = [], size = 'sm' }) {
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge, i) => (
        <FreelancerBadge key={`${badge.type}-${i}`} badge={badge} size={size} />
      ))}
    </div>
  );
}
