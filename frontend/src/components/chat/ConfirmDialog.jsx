import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel, isPending }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter' && !isPending) onConfirm?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onConfirm, onCancel, isPending]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onCancel}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-sm p-5"
            role="dialog" aria-modal="true">
            <div className="flex items-start gap-3">
              <div className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                danger ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-primary-50 dark:bg-primary-900/20 text-primary-500'
              )}>
                <ExclamationTriangleIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
                {message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{message}</p>}
              </div>
              <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={onCancel} disabled={isPending}
                className="flex-1 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors disabled:opacity-50">
                {cancelLabel}
              </button>
              <button onClick={onConfirm} disabled={isPending}
                className={clsx(
                  'flex-1 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50',
                  danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'
                )}>
                {isPending ? 'Working...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
