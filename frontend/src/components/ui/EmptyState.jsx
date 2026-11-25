import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('empty-state', className)}
    >
      {Icon && (
        <div className="relative mb-5">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary-500/15 to-secondary-500/15 blur-xl" aria-hidden="true" />
          <div className="relative w-16 h-16 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-700 flex items-center justify-center">
            <Icon className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-5">{description}</p>}
      {action}
    </motion.div>
  );
}
