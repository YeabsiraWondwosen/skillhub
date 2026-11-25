import { motion } from 'framer-motion';
import { AcademicCapIcon, ClockIcon, CheckCircleIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

const DIFF_BADGE = {
  beginner: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  intermediate: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  advanced: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  expert: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

const PRIORITY_DOT = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-gray-400',
};

export default function CertificationPath({ certifications = [], onComplete, completedIds = [] }) {
  if (certifications.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <AcademicCapIcon className="w-4 h-4 text-primary-500" />
        Certification Paths
      </h3>
      <div className="space-y-2">
        {certifications.map((cert, i) => {
          const isCompleted = cert.isCompleted || completedIds.includes(cert._id);
          return (
            <motion.div
              key={cert._id || i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={clsx(
                'card p-4',
                isCompleted && 'bg-green-50/30 dark:bg-green-900/10 border-green-200 dark:border-green-800'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  <span className={clsx('w-2.5 h-2.5 rounded-full block', PRIORITY_DOT[cert.priority])} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{cert.name}</h4>
                    {isCompleted && <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{cert.issuingOrg}</p>
                  {cert.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">{cert.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {cert.difficulty && (
                      <span className={clsx('px-2 py-0.5 rounded-full font-medium', DIFF_BADGE[cert.difficulty])}>
                        {cert.difficulty}
                      </span>
                    )}
                    {cert.estimatedHours && (
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        ~{cert.estimatedHours}h
                      </span>
                    )}
                    {cert.validityPeriod && <span>Valid: {cert.validityPeriod}</span>}
                  </div>
                  {cert.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {cert.skills.map(s => (
                        <span key={s} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-[10px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {cert.prerequisites?.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">Prerequisites: {cert.prerequisites.join(', ')}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 ml-5">
                {cert.url ? (
                  <a href={cert.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm flex items-center gap-1 text-xs">
                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                    Details
                  </a>
                ) : (
                  <button disabled className="btn-secondary btn-sm text-xs opacity-50 cursor-not-allowed">No link</button>
                )}
                {onComplete && !isCompleted && (
                  <button onClick={() => onComplete(cert._id)} className="btn-primary btn-sm text-xs">
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
