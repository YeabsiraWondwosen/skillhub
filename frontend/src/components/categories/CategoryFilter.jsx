import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon, XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { FolderKanban } from 'lucide-react';
import { useCategoryTree } from '@/hooks/useCategories';
import CategoryIcon from '@/utils/categoryIcons';
import { clsx } from 'clsx';

/**
 * Upwork-style category + subcategory filter.
 *
 * Rendered through a portal to document.body with fixed positioning so it is
 * never trapped inside an ancestor stacking context (cards with backdrop-filter
 * in dark mode) and never clipped by overflow or overlapped by later DOM cards.
 *
 * Props:
 *   categoryId    {string}   – controlled selected main-category _id
 *   subcategoryId {string}   – controlled selected subcategory _id
 *   onChange      {function} – ({ categoryId, subcategoryId }) => void
 *   className     {string}   – extra wrapper classes
 */
export default function CategoryFilter({ categoryId = '', subcategoryId = '', onChange, className = '' }) {
  const { data: treeData, isLoading } = useCategoryTree();
  const parents = treeData?.data ?? [];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);

  const selectedMain = parents.find(c => c._id === categoryId) ?? null;
  const subs = selectedMain?.subcategories ?? [];
  const selectedSub = subs.find(s => s._id === subcategoryId) ?? null;

  // Compute fixed position relative to the trigger button. Recompute on
  // resize/scroll while open so the panel always stays in view.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelW = Math.min(480, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelW - 8));
      const maxHeight = Math.min(400, window.innerHeight - rect.bottom - 24);
      setPos({ top: rect.bottom + 8, left, width: panelW, maxHeight: Math.max(200, maxHeight) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const selectCategory = (id) => {
    onChange({ categoryId: id, subcategoryId: '' });
    // keep panel open so user can pick a subcategory
  };

  const selectSub = (id) => {
    onChange({ categoryId, subcategoryId: id });
    setOpen(false);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange({ categoryId: '', subcategoryId: '' });
    setOpen(false);
  };

  const triggerLabel = selectedSub
    ? `${selectedMain?.icon ?? ''} ${selectedSub.name}`
    : selectedMain
    ? `${selectedMain.icon ?? ''} ${selectedMain.name}`
    : null;

  const triggerText = isLoading ? 'Loading…' : triggerLabel ?? 'Category';

  const panel = open && (
    <>
      {/* Full-screen click-away backdrop */}
      <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />

      {/* Dropdown panel */}
      <div
        role="listbox"
        aria-label="Category filter"
        className="fixed z-[90] flex rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 shadow-2xl overflow-hidden"
        style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
      >
        {/* Left column — main categories */}
        <div className="w-52 flex-shrink-0 border-r border-gray-100 dark:border-gray-700 py-2 overflow-y-auto">
          <p className="px-3 pb-1.5 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Categories
          </p>
          <button
            type="button"
            onClick={() => { onChange({ categoryId: '', subcategoryId: '' }); setOpen(false); }}
            className={clsx(
              'w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors',
              !categoryId
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'
            )}
          >
            <span className="w-6 text-center text-base flex items-center justify-center"><FolderKanban size={18} aria-hidden="true" /></span>
            <span>All Categories</span>
          </button>

          {parents.map(cat => (
            <button
              key={cat._id}
              type="button"
              onClick={() => selectCategory(cat._id)}
              className={clsx(
                'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors',
                categoryId === cat._id
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'
              )}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <CategoryIcon icon={cat.icon} size={16} className="w-6 text-center flex-shrink-0" />
                <span className="truncate">{cat.name}</span>
              </span>
              {cat.subcategories?.length > 0 && (
                <ChevronDownIcon className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 -rotate-90" />
              )}
            </button>
          ))}
        </div>

        {/* Right column — subcategories */}
        <div className="flex-1 py-2 px-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-8 px-4">
              <p className="text-sm text-gray-400">Loading categories…</p>
            </div>
          ) : selectedMain ? (
            <>
              <div className="px-3 pb-2 pt-0.5 border-b border-gray-100 dark:border-gray-700 mb-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <CategoryIcon icon={selectedMain.icon} size={18} />
                  <span>{selectedMain.name}</span>
                </p>
                {selectedMain.description && (
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{selectedMain.description}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => { onChange({ categoryId, subcategoryId: '' }); setOpen(false); }}
                className={clsx(
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-0.5',
                  !subcategoryId
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'
                )}
              >
                All in {selectedMain.name}
              </button>

              {subs.length > 0 && (
                <div className="mt-1">
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Specializations
                  </p>
                  {subs.map(sub => (
                    <button
                      key={sub._id}
                      type="button"
                      onClick={() => selectSub(sub._id)}
                      className={clsx(
                        'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                        subcategoryId === sub._id
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'
                      )}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-8 px-4 text-center gap-2">
              <FolderKanban size={32} className="text-gray-300 dark:text-gray-600" aria-hidden="true" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select a category to see specializations
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className={clsx('relative', className)}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all',
          open || categoryId
            ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
        )}
      >
        <FunnelIcon className="w-4 h-4 flex-shrink-0" />
        <span className="max-w-[160px] truncate">{triggerText}</span>
        {categoryId ? (
          <span
            onClick={clear}
            className="ml-1 p-0.5 rounded-full hover:bg-primary-200 dark:hover:bg-primary-800 cursor-pointer"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
          </span>
        ) : (
          <ChevronDownIcon className={clsx('w-4 h-4 flex-shrink-0 transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {createPortal(panel, document.body)}
    </div>
  );
}
