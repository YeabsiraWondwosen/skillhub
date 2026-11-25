import { useState } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutline } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

const SIZE_CLASSES = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
};

export default function StarRating({
  value = 0,
  onChange,
  readonly = false,
  size = 'md',
  showValue = true,
}) {
  const [hover, setHover] = useState(0);
  const starSize = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const display = Math.min(Math.max(numeric, 0), 5);

  if (readonly) {
    return (
      <div className="flex items-center gap-0.5" role="img" aria-label={`${display.toFixed(1)} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const full = display >= star - 1e-9;
          const partial = !full && display > star - 1 && display < star;
          const fill = full ? 100 : partial ? Math.round(Math.min(Math.max(display - (star - 1), 0), 1) * 100) : 0;
          return (
            <span key={star} className={clsx('relative inline-block', starSize)}>
              <StarOutline className={clsx(starSize, 'absolute inset-0 text-gray-300 dark:text-gray-600')} />
              {fill > 0 && (
                <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill}%` }}>
                  <StarIcon className={clsx('block', starSize, 'text-yellow-400')} />
                </span>
              )}
            </span>
          );
        })}
        {showValue && readonly && display > 0 && (
          <span className="ml-1 text-sm font-medium text-gray-600 dark:text-gray-400">{display.toFixed(1)}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (hover || display) >= star;
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            aria-label={`Rate ${star} out of 5 stars`}
            className={clsx('cursor-pointer hover:scale-110 transition-transform', 'focus:outline-none')}
          >
            {filled
              ? <StarIcon className={clsx(starSize, 'text-yellow-400')} />
              : <StarOutline className={clsx(starSize, 'text-gray-300 dark:text-gray-600')} />}
          </button>
        );
      })}
      {showValue && display > 0 && (
        <span className="ml-1 text-sm font-medium text-gray-600 dark:text-gray-400">{display.toFixed(1)}</span>
      )}
    </div>
  );
}