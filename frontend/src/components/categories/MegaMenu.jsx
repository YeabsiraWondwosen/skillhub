import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCategoryTree } from '@/hooks/useCategories';
import CategoryIcon from '@/utils/categoryIcons';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

export default function MegaMenu() {
  const [open, setOpen] = useState(false);
  const [activeMain, setActiveMain] = useState(null);
  const ref = useRef(null);
  const { data: tree } = useCategoryTree();
  const parents = tree?.data ?? [];

  const activeData = parents.find(p => p._id === activeMain);

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setActiveMain(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => { setOpen(false); setActiveMain(null); }}>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          'px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
          open
            ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700'
        )}
      >
        Categories
        <ChevronRightIcon className={clsx('w-3.5 h-3.5 transition-transform', open && 'rotate-90')} />
      </button>

      <AnimatePresence>
        {open && parents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1 w-[520px] flex bg-white dark:bg-dark-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="w-[200px] flex-shrink-0 border-r border-gray-100 dark:border-gray-700 py-2 max-h-[420px] overflow-y-auto">
              {parents.map(cat => (
                <button
                  key={cat._id}
                  onMouseEnter={() => setActiveMain(cat._id)}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    'w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors',
                    activeMain === cat._id
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <CategoryIcon icon={cat.icon} size={16} className="flex-shrink-0" />
                    <span className="truncate">{cat.name}</span>
                  </span>
                  <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                </button>
              ))}
            </div>

            <div className="flex-1 py-3 px-4 max-h-[420px] overflow-y-auto">
              {activeData ? (
                <div>
                  <Link
                    to={`/categories/${activeData.slug}`}
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline mb-3"
                  >
                    <CategoryIcon icon={activeData.icon} size={16} className="inline-flex mr-1" /> {activeData.name}
                  </Link>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {(activeData.subcategories || []).map(sub => (
                      <Link
                        key={sub._id}
                        to={`/categories/${sub.slug || sub._id}`}
                        onClick={() => setOpen(false)}
                        className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 py-1 truncate transition-colors"
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  Hover a category
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
