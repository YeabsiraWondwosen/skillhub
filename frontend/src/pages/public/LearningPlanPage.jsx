import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon, SparklesIcon, CheckCircleIcon, ClockIcon, BookOpenIcon,
  AcademicCapIcon, LightBulbIcon, ChartBarIcon,
} from '@heroicons/react/24/outline';
import {
  useLearningPlan, useUpdateCourseProgress, useUpdateCertProgress,
  useUpdateResourceProgress, useToggleBookmark,
} from '@/hooks/useLearningHub';
import SkillGapAnalysis from '@/components/learning-hub/SkillGapAnalysis';
import CourseRecommendations from '@/components/learning-hub/CourseRecommendations';
import CertificationPath from '@/components/learning-hub/CertificationPath';
import LearningResourceCard from '@/components/learning-hub/LearningResourceCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { clsx } from 'clsx';

export default function LearningPlanPage() {
  const { planId } = useParams();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: plan, isLoading } = useLearningPlan(planId);
  const { mutate: updateCourse } = useUpdateCourseProgress();
  const { mutate: updateCert } = useUpdateCertProgress();
  const { mutate: updateResource } = useUpdateResourceProgress();
  const { mutate: toggleBookmark } = useToggleBookmark();

  if (isLoading) return <div className="page-container max-w-5xl space-y-4"><SkeletonCard /><SkeletonCard /></div>;
  if (!plan) return <div className="page-container text-center py-20 text-gray-500">Plan not found.</div>;

  const { aiAnalysis, skillGaps, courses, certifications, resources, progress } = plan;

  const handleCourseComplete = (courseId) => {
    updateCourse({ planId, courseId, data: { isCompleted: true } });
  };

  const handleCertComplete = (certId) => {
    updateCert({ planId, certId, data: { isCompleted: true } });
  };

  const handleResourceComplete = (resourceId) => {
    updateResource({ planId, resourceId, data: { isCompleted: true } });
  };

  const handleBookmark = (resourceId) => {
    toggleBookmark({ planId, resourceId });
  };

  return (
    <div className="page-container max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/learning-hub" className="btn-icon btn-ghost mt-1">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="section-title">{plan.title}</h1>
          {plan.description && <p className="section-sub">{plan.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx(
            'px-3 py-1 rounded-full text-xs font-semibold',
            plan.status === 'active' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
            plan.status === 'completed' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
            plan.status === 'paused' && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
          )}>
            {plan.status}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Progress</span>
          <span className="text-sm font-bold text-primary-600">{progress?.percentage || 0}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress?.percentage || 0}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{progress?.completedItems || 0} of {progress?.totalItems || 0} items completed</span>
          {aiAnalysis?.estimatedCompletionWeeks && (
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              Est. {aiAnalysis.estimatedCompletionWeeks} weeks remaining
            </span>
          )}
        </div>
      </div>

      {/* AI Insights */}
      {aiAnalysis && (
        <div className="card p-4 bg-primary-50/30 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800">
          <div className="flex items-center gap-2 mb-2">
            <SparklesIcon className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI Insights</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">Readiness Score</p>
              <p className="text-lg font-bold text-primary-600">{aiAnalysis.overallReadiness}%</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">Market Demand</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{aiAnalysis.marketDemand || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">Focus Areas</p>
              <div className="flex flex-wrap gap-1">
                {(aiAnalysis.focusAreas || []).map(f => (
                  <span key={f} className="px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-[10px]">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {aiAnalysis.careerAdvice && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 italic flex items-start gap-1.5">
              <LightBulbIcon className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              {aiAnalysis.careerAdvice}
            </p>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {[
          { key: 'overview', label: 'Skill Gaps' },
          { key: 'courses', label: `Courses (${courses?.length || 0})` },
          { key: 'certifications', label: `Certifications (${certifications?.length || 0})` },
          { key: 'resources', label: `Resources (${resources?.length || 0})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {skillGaps && skillGaps.length > 0 ? (
            <SkillGapAnalysis analysis={{ skillGaps, strengths: aiAnalysis?.strengths || [], weaknesses: aiAnalysis?.weaknesses || [], demandedSkills: [] }} />
          ) : (
            <div className="card p-8 text-center">
              <CheckCircleIcon className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">No skill gaps identified!</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">You're well-positioned for your target role.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'courses' && (
        <CourseRecommendations courses={courses || []} onComplete={handleCourseComplete} />
      )}

      {activeTab === 'certifications' && (
        <CertificationPath certifications={certifications || []} onComplete={handleCertComplete} />
      )}

      {activeTab === 'resources' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(resources || []).map((r, i) => (
            <LearningResourceCard
              key={r._id || i}
              resource={r}
              onComplete={handleResourceComplete}
              onBookmark={handleBookmark}
            />
          ))}
        </div>
      )}
    </div>
  );
}
