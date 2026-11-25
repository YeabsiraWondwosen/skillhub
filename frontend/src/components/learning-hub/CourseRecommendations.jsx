import { motion } from 'framer-motion';
import { StarIcon, ClockIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const LEVEL_BADGE = {
  beginner: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  intermediate: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  advanced: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  expert: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

export default function CourseRecommendations({ courses = [], onComplete, completedIds = [] }) {
  if (courses.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recommended Courses</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {courses.map((course, i) => {
          const isCompleted = course.isCompleted || completedIds.includes(course._id);
          return (
            <motion.div
              key={course._id || i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={clsx(
                'card p-4 flex flex-col',
                isCompleted && 'bg-green-50/30 dark:bg-green-900/10 border-green-200 dark:border-green-800'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{course.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{course.provider}</p>
                </div>
                {isCompleted && <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />}
              </div>

              {course.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{course.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-gray-500 dark:text-gray-400">
                {course.level && (
                  <span className={clsx('px-2 py-0.5 rounded-full font-medium', LEVEL_BADGE[course.level])}>
                    {course.level}
                  </span>
                )}
                {course.duration && (
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" />
                    {course.duration}
                  </span>
                )}
                {course.rating && (
                  <span className="flex items-center gap-1">
                    <StarIcon className="w-3 h-3 text-yellow-500" />
                    {course.rating}
                  </span>
                )}
                {course.price && <span>{course.price}</span>}
              </div>

              {course.skills?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {course.skills.map(s => (
                    <span key={s} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-[10px]">
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mt-auto">
                {course.url ? (
                  <a
                    href={course.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary btn-sm flex items-center gap-1 text-xs"
                  >
                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                    Open
                  </a>
                ) : (
                  <button disabled className="btn-secondary btn-sm text-xs opacity-50 cursor-not-allowed">
                    No link
                  </button>
                )}
                {onComplete && !isCompleted && (
                  <button
                    onClick={() => onComplete(course._id)}
                    className="btn-primary btn-sm text-xs"
                  >
                    Mark Complete
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
