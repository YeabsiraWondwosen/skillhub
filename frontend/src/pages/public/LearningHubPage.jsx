import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AcademicCapIcon, SparklesIcon, ArrowRightIcon, BookOpenIcon, ChartBarIcon,
  PlusIcon, TrashIcon, PauseIcon, PlayIcon, CheckCircleIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import {
  useDashboardStats, useLearningPlans, useCreateLearningPlan,
  useUpdatePlanStatus, useDeleteLearningPlan,
} from '@/hooks/useLearningHub';
import SkillGapAnalysis from '@/components/learning-hub/SkillGapAnalysis';
import CourseRecommendations from '@/components/learning-hub/CourseRecommendations';
import CertificationPath from '@/components/learning-hub/CertificationPath';
import LearningResourceCard from '@/components/learning-hub/LearningResourceCard';
import { useSkillGapAnalysis, useCourseRecommendations, useCertificationRecommendations, useLearningResources } from '@/hooks/useLearningHub';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useConfirm } from '@/components/ui/DialogProvider';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';

const STATUS_BADGE = {
  active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  completed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  paused: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  archived: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
};

export default function LearningHubPage() {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [planGoal, setPlanGoal] = useState('');
  const [planTitle, setPlanTitle] = useState('');

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: plansData, isLoading: plansLoading } = useLearningPlans({ limit: 10 });
  const { data: analysis, isLoading: analysisLoading } = useSkillGapAnalysis({});
  const { data: courses, isLoading: coursesLoading } = useCourseRecommendations({});
  const { data: certs, isLoading: certsLoading } = useCertificationRecommendations({});
  const { data: resources, isLoading: resourcesLoading } = useLearningResources({});

  const { mutate: createPlan, isPending: creating } = useCreateLearningPlan();
  const { mutate: updateStatus } = useUpdatePlanStatus();
  const { mutate: deletePlan } = useDeleteLearningPlan();

  const plans = plansData?.data || [];

  const handleCreatePlan = () => {
    createPlan(
      { targetRole, goal: planGoal, title: planTitle || undefined },
      {
        onSuccess: (res) => {
          toast.success('Learning plan generated!');
          setShowCreateModal(false);
          setTargetRole('');
          setPlanGoal('');
          setPlanTitle('');
        },
        onError: () => toast.error('Failed to generate plan'),
      }
    );
  };

  const handleToggleStatus = (planId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    updateStatus({ planId, status: newStatus });
  };

  const handleDelete = async (planId) => {
    const ok = await confirm({
      title: 'Delete learning plan',
      message: 'Delete this learning plan? This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deletePlan(planId, { onSuccess: () => toast.success('Plan deleted') });
  };

  return (
    <div className="page-container max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <AcademicCapIcon className="w-7 h-7 text-primary-600" />
            Learning Hub
          </h1>
          <p className="section-sub">AI-powered skill gap analysis and personalized learning plans</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <SparklesIcon className="w-4 h-4" />
          Generate Learning Plan
        </button>
      </div>

      {/* Dashboard Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Active Plans', value: stats.activePlans, icon: BookOpenIcon, color: 'text-blue-600' },
            { label: 'Completed', value: stats.completedPlans, icon: CheckCircleIcon, color: 'text-green-600' },
            { label: 'Total Courses', value: stats.totalCourses, icon: AcademicCapIcon, color: 'text-purple-600' },
            { label: 'Courses Done', value: stats.completedCourses, icon: CheckCircleIcon, color: 'text-green-600' },
            { label: 'Avg Progress', value: `${stats.averageProgress}%`, icon: ChartBarIcon, color: 'text-primary-600' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card p-4 text-center"
            >
              <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
              <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{s.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'analysis', label: 'Skill Gaps' },
          { key: 'courses', label: 'Courses' },
          { key: 'certifications', label: 'Certifications' },
          { key: 'resources', label: 'Resources' },
          { key: 'plans', label: 'My Plans' },
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
        <div className="space-y-6">
          {analysisLoading ? (
            <SkeletonCard />
          ) : analysis && (
            <SkillGapAnalysis analysis={analysis} />
          )}
          {coursesLoading ? (
            <SkeletonCard />
          ) : (
            <CourseRecommendations courses={courses || []} />
          )}
          {certsLoading ? (
            <SkeletonCard />
          ) : (
            <CertificationPath certifications={certs || []} />
          )}
        </div>
      )}

      {activeTab === 'analysis' && (
        analysisLoading ? <SkeletonCard /> : <SkillGapAnalysis analysis={analysis} />
      )}

      {activeTab === 'courses' && (
        coursesLoading ? <SkeletonCard /> : (
          <CourseRecommendations courses={courses || []} />
        )
      )}

      {activeTab === 'certifications' && (
        certsLoading ? <SkeletonCard /> : (
          <CertificationPath certifications={certs || []} />
        )
      )}

      {activeTab === 'resources' && (
        resourcesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : resources && resources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {resources.map((r, i) => (
              <LearningResourceCard key={r._id || i} resource={r} />
            ))}
          </div>
        ) : (
          <EmptyState icon={BookOpenIcon} title="No resources" description="Generate a learning plan to get curated resources." />
        )
      )}

      {activeTab === 'plans' && (
        plansLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={AcademicCapIcon}
            title="No learning plans"
            description="Create your first AI-powered learning plan to start improving your skills."
            action={{ label: 'Create Plan', onClick: () => setShowCreateModal(true) }}
          />
        ) : (
          <div className="space-y-3">
            {plans.map((plan, i) => (
              <motion.div
                key={plan._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{plan.title}</h3>
                      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', STATUS_BADGE[plan.status])}>
                        {plan.status}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{plan.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{plan.progress?.percentage || 0}% complete</span>
                      <span>{plan.progress?.completedItems || 0}/{plan.progress?.totalItems || 0} items</span>
                      <span>{plan.skillGaps?.length || 0} skill gaps</span>
                      {plan.aiAnalysis?.estimatedCompletionWeeks && (
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" />
                          ~{plan.aiAnalysis.estimatedCompletionWeeks}w
                        </span>
                      )}
                      <span>{formatDistanceToNow(new Date(plan.createdAt), { addSuffix: true })}</span>
                    </div>
                    {plan.progress?.percentage > 0 && (
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all"
                          style={{ width: `${plan.progress.percentage}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                    <Link to={`/learning-hub/plans/${plan._id}`} className="btn-secondary btn-sm text-xs">
                      View
                    </Link>
                    <button
                      onClick={() => handleToggleStatus(plan._id, plan.status)}
                      className="btn-icon btn-ghost text-gray-400 hover:text-primary-600"
                      title={plan.status === 'active' ? 'Pause' : 'Resume'}
                    >
                      {plan.status === 'active' ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(plan._id)}
                      className="btn-icon btn-ghost text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-primary-500" />
              Generate Learning Plan
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              AI will analyze your skills and create a personalized learning path
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Target Role (optional)</label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={e => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Full-Stack Developer"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Plan Title (optional)</label>
                <input
                  type="text"
                  value={planTitle}
                  onChange={e => setPlanTitle(e.target.value)}
                  placeholder="e.g. 2024 Skill Growth Plan"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Goal (optional)</label>
                <textarea
                  value={planGoal}
                  onChange={e => setPlanGoal(e.target.value)}
                  placeholder="What do you want to achieve?"
                  rows={2}
                  className="input-field w-full resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreatePlan} disabled={creating} className="btn-primary flex items-center gap-2">
                {creating ? 'Generating...' : 'Generate Plan'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
