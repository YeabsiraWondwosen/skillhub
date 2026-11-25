import { motion } from 'framer-motion';
import {
  DocumentTextIcon, SparklesIcon, CheckCircleIcon,
  ExclamationTriangleIcon, LightBulbIcon, StarIcon,
} from '@heroicons/react/24/outline';
import { useGenerateSummary } from '@/hooks/useInterviewAssistant';
import { clsx } from 'clsx';

function TimelineItem({ item, index }) {
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative pl-6 pb-4 last:pb-0">
      <div className="absolute left-0 top-0 w-2.5 h-2.5 rounded-full bg-primary-500 mt-1.5" />
      <div className="absolute left-1 top-3 w-px h-full bg-gray-200 dark:bg-gray-700 last:bg-transparent" />
      <div className="text-xs">
        <span className="font-medium text-gray-900 dark:text-white">{item.question}</span>
        <p className="text-gray-500 dark:text-gray-400 mt-0.5">{item.feedback}</p>
        {item.score !== null && item.score !== undefined && (
          <span className="inline-block mt-1 text-[10px] font-bold text-primary-600">{item.score}/10</span>
        )}
      </div>
    </motion.div>
  );
}

export default function InterviewSummary({ session, onSummaryGenerated }) {
  const { mutate: generateSummary, isLoading } = useGenerateSummary();
  const summary = session?.summary;

  const handleGenerate = () => {
    generateSummary(session._id, {
      onSuccess: (res) => onSummaryGenerated?.(res.data),
    });
  };

  if (!summary) {
    return (
      <div className="card p-8 text-center">
        <DocumentTextIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No summary generated yet.</p>
        <button onClick={handleGenerate} disabled={isLoading} className="btn-primary inline-flex items-center gap-2">
          <SparklesIcon className="w-4 h-4" />
          {isLoading ? 'Generating...' : 'Generate AI Summary'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Assessment */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <StarIcon className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Overall Assessment</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{summary.overallAssessment}</p>
            {summary.interviewDuration && (
              <span className="text-[10px] text-gray-400 mt-1 block">Duration: {summary.interviewDuration} min</span>
            )}
          </div>
        </div>
      </div>

      {/* Key Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summary.keyHighlights?.strengths?.length > 0 && (
          <div className="card p-4">
            <h4 className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1">
              <CheckCircleIcon className="w-3.5 h-3.5" /> Key Strengths
            </h4>
            <ul className="space-y-1.5">
              {summary.keyHighlights.strengths.map((s, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />{s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {summary.keyHighlights?.concerns?.length > 0 && (
          <div className="card p-4">
            <h4 className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
              <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Concerns
            </h4>
            <ul className="space-y-1.5">
              {summary.keyHighlights.concerns.map((c, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />{c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Interview Questions Breakdown */}
      {summary.interviewQuestions?.length > 0 && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Question-by-Question Review</h4>
          <div className="space-y-0">
            {summary.interviewQuestions.map((q, i) => (
              <TimelineItem key={i} item={q} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summary.recommendations?.nextSteps?.length > 0 && (
          <div className="card p-4">
            <h4 className="text-xs font-semibold text-primary-600 mb-2 flex items-center gap-1">
              <LightBulbIcon className="w-3.5 h-3.5" /> Next Steps
            </h4>
            <ul className="space-y-1.5">
              {summary.recommendations.nextSteps.map((s, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                  <span className="text-primary-500 font-bold">{i + 1}.</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {summary.recommendations?.furtherQuestions?.length > 0 && (
          <div className="card p-4">
            <h4 className="text-xs font-semibold text-orange-600 mb-2 flex items-center gap-1">
              <LightBulbIcon className="w-3.5 h-3.5" /> Follow-up Questions
            </h4>
            <ul className="space-y-1.5">
              {summary.recommendations.furtherQuestions.map((q, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />{q}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
