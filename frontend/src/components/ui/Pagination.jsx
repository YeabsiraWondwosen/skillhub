import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

export default function Pagination({ meta, onPageChange }) {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, totalPages } = meta;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) pages.push(i);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button onClick={() => onPageChange(page - 1)} disabled={!meta.hasPrevPage} className="btn-icon btn-secondary disabled:opacity-40">
        <ChevronLeftIcon className="w-4 h-4" />
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={clsx('w-8 h-8 rounded-lg text-sm font-medium transition-colors', p === page ? 'bg-primary-600 text-white' : 'btn-ghost')}
          >
            {p}
          </button>
        )
      )}
      <button onClick={() => onPageChange(page + 1)} disabled={!meta.hasNextPage} className="btn-icon btn-secondary disabled:opacity-40">
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
