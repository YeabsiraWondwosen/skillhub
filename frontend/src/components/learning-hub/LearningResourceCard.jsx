import { motion } from 'framer-motion';
import {
  BookOpenIcon, PlayIcon, WrenchIcon, BookMarkedIcon, ArrowTopRightOnSquareIcon,
  CheckCircleIcon, BookmarkIcon, DocumentTextIcon, MicrophoneIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid, StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { clsx } from 'clsx';

const TYPE_ICON = {
  article: DocumentTextIcon,
  video: PlayIcon,
  tutorial: BookOpenIcon,
  book: BookMarkedIcon,
  documentation: DocumentTextIcon,
  podcast: MicrophoneIcon,
  tool: WrenchIcon,
  practice: WrenchIcon,
};

const TYPE_COLOR = {
  article: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  video: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  tutorial: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  book: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  documentation: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  podcast: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  tool: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  practice: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
};

export default function LearningResourceCard({ resource, onComplete, onBookmark, compact = false }) {
  const Icon = TYPE_ICON[resource.type] || BookOpenIcon;
  const iconColor = TYPE_COLOR[resource.type] || TYPE_COLOR.article;

  if (compact) {
    return (
      <div className={clsx(
        'flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50',
        resource.isCompleted && 'bg-green-50/30 dark:bg-green-900/10 border-green-200 dark:border-green-800',
        !resource.isCompleted && 'border-gray-200 dark:border-gray-700',
      )}>
        <div className={clsx('p-1.5 rounded-lg flex-shrink-0', iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{resource.title}</p>
          <p className="text-[10px] text-gray-400">{resource.source} · {resource.type}</p>
        </div>
        {resource.url && (
          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary-500 flex-shrink-0">
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={clsx(
      'card p-4',
      resource.isCompleted && 'bg-green-50/30 dark:bg-green-900/10 border-green-200 dark:border-green-800',
    )}>
      <div className="flex items-start gap-3">
        <div className={clsx('p-2 rounded-lg flex-shrink-0', iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{resource.title}</h4>
            {resource.isCompleted && <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{resource.source} · {resource.type}</p>
          {resource.description && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">{resource.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
            {resource.duration && <span>{resource.duration}</span>}
            {resource.isFree !== undefined && (
              <span className={clsx(
                'px-1.5 py-0.5 rounded-full font-medium',
                resource.isFree ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              )}>
                {resource.isFree ? 'Free' : 'Paid'}
              </span>
            )}
            {resource.rating && (
              <span className="inline-flex items-center gap-1">
                <StarSolid className="w-3.5 h-3.5 text-yellow-400" aria-hidden="true" />
                {resource.rating}
              </span>
            )}
          </div>
          {resource.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {resource.skills.map(s => (
                <span key={s} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-[10px]">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        {resource.url ? (
          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm flex items-center gap-1 text-xs">
            <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            Open
          </a>
        ) : (
          <button disabled className="btn-secondary btn-sm text-xs opacity-50 cursor-not-allowed">No link</button>
        )}
        {onBookmark && (
          <button
            onClick={() => onBookmark(resource._id)}
            className={clsx(
              'btn-icon btn-ghost',
              resource.isBookmarked ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
            )}
            title={resource.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            {resource.isBookmarked ? <BookmarkSolid className="w-4 h-4" /> : <BookmarkIcon className="w-4 h-4" />}
          </button>
        )}
        {onComplete && !resource.isCompleted && (
          <button onClick={() => onComplete(resource._id)} className="btn-primary btn-sm text-xs">
            Mark Complete
          </button>
        )}
      </div>
    </div>
  );
}
