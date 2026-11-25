import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SparklesIcon, ClockIcon, CheckCircleIcon, ArrowPathIcon,
  TrashIcon, ChevronDownIcon, ChevronUpIcon, ChevronRightIcon,
  ExclamationTriangleIcon, LightBulbIcon, CalendarIcon,
  CodeBracketIcon, UsersIcon, CurrencyDollarIcon, DocumentTextIcon,
  BoltIcon, FlagIcon, ListBulletIcon, RectangleStackIcon,
} from '@heroicons/react/24/outline';
import { useCreatePlan, useMyPlans, useDeletePlan } from '@/hooks/useProjectPlanner';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { clsx } from 'clsx';
import { getMinDateValue, isDateOnlyInPast } from '@/utils/dateValidation';

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const TAG_COLORS = {
  frontend: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  backend: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  design: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  testing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  devops: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  planning: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  setup: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
  integration: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  development: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

const EFFORT_COLORS = {
  planning: 'bg-indigo-500',
  design: 'bg-purple-500',
  development: 'bg-blue-500',
  testing: 'bg-yellow-500',
  deployment: 'bg-green-500',
};

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xl font-black text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function EffortBreakdownChart({ breakdown }) {
  const total = breakdown.total || 1;
  const items = [
    { label: 'Planning', value: breakdown.planning, color: EFFORT_COLORS.planning },
    { label: 'Design', value: breakdown.design, color: EFFORT_COLORS.design },
    { label: 'Development', value: breakdown.development, color: EFFORT_COLORS.development },
    { label: 'Testing', value: breakdown.testing, color: EFFORT_COLORS.testing },
    { label: 'Deployment', value: breakdown.deployment, color: EFFORT_COLORS.deployment },
  ];

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <ChartBarIcon className="w-5 h-5 text-primary-500" />
        Effort Breakdown
      </h3>
      <div className="flex h-4 rounded-full overflow-hidden mb-4">
        {items.map((item, i) => (
          item.value > 0 && (
            <motion.div
              key={item.label}
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / total) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className={clsx('h-full', item.color)}
              title={`${item.label}: ${item.value}h`}
            />
          )
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={clsx('w-3 h-3 rounded-full', item.color)} />
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">{item.value}h</p>
              <p className="text-[10px] text-gray-400">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneTimeline({ milestones, expandedMilestones, toggleMilestone }) {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <RectangleStackIcon className="w-5 h-5 text-amber-500" />
        Milestones ({milestones.length})
      </h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-dark-700" />

        <div className="space-y-1">
          {milestones.map((milestone, i) => {
            const isExpanded = expandedMilestones.has(milestone._id || i);
            const totalHours = milestone.tasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);

            return (
              <div key={milestone._id || i} className="relative pl-12">
                {/* Timeline dot */}
                <div className={clsx(
                  'absolute left-3 top-4 w-4 h-4 rounded-full border-2 border-white dark:border-dark-800 z-10',
                  i === 0 ? 'bg-green-500' : i === milestones.length - 1 ? 'bg-blue-500' : 'bg-primary-500'
                )} />

                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-gray-50 dark:bg-dark-900 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => toggleMilestone(milestone._id || i)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {milestone.title}
                        </h4>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        {milestone.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-3 shrink-0">
                      <span className="text-xs font-semibold text-gray-500">
                        {totalHours}h
                      </span>
                      <span className="text-xs text-gray-400">
                        {milestone.estimatedDuration} {milestone.durationUnit}
                      </span>
                      <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                        {milestone.tasks.length} tasks
                      </span>
                      {isExpanded ? (
                        <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2">
                          {milestone.keyDeliverables?.length > 0 && (
                            <div className="mb-3">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Key Deliverables</p>
                              <div className="flex flex-wrap gap-1.5">
                                {milestone.keyDeliverables.map((d, di) => (
                                  <span key={di} className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
                                    {d}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {milestone.tasks.map((task, ti) => (
                            <div
                              key={task._id || ti}
                              className="flex items-start gap-3 p-3 bg-white dark:bg-dark-800 rounded-lg border border-gray-100 dark:border-dark-700"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {task.title}
                                  </span>
                                  <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', PRIORITY_COLORS[task.priority])}>
                                    {task.priority}
                                  </span>
                                </div>
                                {task.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                    {task.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {task.tags?.map(tag => (
                                    <span
                                      key={tag}
                                      className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', TAG_COLORS[tag] || TAG_COLORS.planning)}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                  {task.dependencies?.length > 0 && (
                                    <span className="text-[10px] text-gray-400">
                                      Depends on: {task.dependencies.join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                  {task.estimatedHours}h
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InsightsSection({ reasoning, assumptions, criticalPath, riskFactors }) {
  const [activeTab, setActiveTab] = useState('reasoning');

  const tabs = [
    { id: 'reasoning', label: 'Analysis', icon: SparklesIcon, items: reasoning, color: 'text-primary-500' },
    { id: 'assumptions', label: 'Assumptions', icon: DocumentTextIcon, items: assumptions, color: 'text-gray-500' },
    { id: 'criticalPath', label: 'Critical Path', icon: FlagIcon, items: criticalPath, color: 'text-red-500' },
    { id: 'riskFactors', label: 'Risks', icon: ExclamationTriangleIcon, items: riskFactors, color: 'text-orange-500' },
  ];

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <BoltIcon className="w-5 h-5 text-indigo-500" />
        AI Insights
      </h3>
      <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-dark-700 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <tab.icon className={clsx('w-4 h-4', tab.color)} />
            {tab.label}
            {tab.items?.length > 0 && (
              <span className="text-xs bg-gray-200 dark:bg-dark-700 px-1.5 py-0.5 rounded-full">{tab.items.length}</span>
            )}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {tabs.find(t => t.id === activeTab)?.items?.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <CheckCircleIcon className={clsx('w-4 h-4 mt-0.5 shrink-0', tabs.find(t => t.id === activeTab)?.color)} />
            <span className="text-gray-700 dark:text-gray-300">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartBarIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

function PlanResult({ plan }) {
  const [expandedMilestones, setExpandedMilestones] = useState(new Set());

  const toggleMilestone = (id) => {
    setExpandedMilestones(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (expandedMilestones.size === plan.milestones.length) {
      setExpandedMilestones(new Set());
    } else {
      setExpandedMilestones(new Set(plan.milestones.map((_, i) => i)));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={RectangleStackIcon} label="Milestones" value={plan.totalMilestones} color="bg-primary-500" />
        <StatCard icon={ListBulletIcon} label="Tasks" value={plan.totalTasks} color="bg-blue-500" />
        <StatCard icon={ClockIcon} label="Total Hours" value={`${plan.totalEstimatedHours}h`} color="bg-amber-500" />
        <StatCard icon={CalendarIcon} label="Timeline" value={`${plan.estimatedTimelineWeeks}w`} color="bg-green-500" sub={`${Math.ceil(plan.estimatedTimelineWeeks * 7)} days`} />
      </div>

      {/* Effort Breakdown */}
      <EffortBreakdownChart breakdown={plan.effortBreakdown} />

      {/* Milestones */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <div />
          <Button variant="ghost" size="sm" onClick={expandAll}>
            {expandedMilestones.size === plan.milestones.length ? 'Collapse All' : 'Expand All'}
          </Button>
        </div>
      </div>
      <MilestoneTimeline
        milestones={plan.milestones}
        expandedMilestones={expandedMilestones}
        toggleMilestone={toggleMilestone}
      />

      {/* AI Insights */}
      <InsightsSection
        reasoning={plan.reasoning}
        assumptions={plan.assumptions}
        criticalPath={plan.criticalPath}
        riskFactors={plan.riskFactors}
      />
    </motion.div>
  );
}

export default function ProjectPlannerPage() {
  const [description, setDescription] = useState('');
  const [projectName, setProjectName] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [activePlan, setActivePlan] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const createPlan = useCreatePlan();
  const { data: historyData } = useMyPlans();
  const deletePlan = useDeletePlan();
  const [showHistory, setShowHistory] = useState(false);

  const history = historyData?.data || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (description.length < 20) return;

    createPlan.mutate(
      {
        projectDescription: description,
        projectName: projectName || undefined,
        budget: budget ? Number(budget) : undefined,
        deadline: deadline || undefined,
        teamSize: teamSize ? Number(teamSize) : undefined,
      },
      {
        onSuccess: (res) => setActivePlan(res),
      }
    );
  };

  const handleSelectHistory = (plan) => setActivePlan({ data: plan });

  const handleDelete = (planId) => {
    deletePlan.mutate(planId, {
      onSuccess: () => {
        if (activePlan?.data?._id === planId) setActivePlan(null);
      },
    });
  };

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <SparklesIcon className="w-6 h-6 text-primary-500" />
          AI Project Planner
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
          Describe your project and get AI-generated milestones, tasks, timelines, and effort estimates
        </p>
      </motion.div>

      {/* Input Form */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Project Name (optional)</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="input"
              placeholder="e.g. E-commerce Platform Redesign"
              maxLength={200}
            />
          </div>
          <div>
            <label className="label">Project Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="input resize-none"
              placeholder="Describe your project in detail. Include features, requirements, target audience, preferred tech stack, and any constraints. The more detail you provide, the more accurate the plan will be."
              maxLength={5000}
              required
            />
            <div className="flex items-center justify-between mt-1">
              <p className={clsx('text-xs', description.length < 20 ? 'text-red-500' : 'text-green-500')}>
                {description.length < 20 ? `${20 - description.length} more characters needed` : 'Good to go'}
              </p>
              <span className="text-xs text-gray-400">{description.length}/5000</span>
            </div>
          </div>

          {/* Advanced Options */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
            >
              {showAdvanced ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
              {showAdvanced ? 'Hide' : 'Show'} Options (Budget, Deadline, Team Size)
            </button>
          </div>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Budget (ETB)</label>
                    <input
                      type="number"
                      min={0}
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="input"
                      placeholder="e.g. 5000"
                    />
                  </div>
                  <div>
                    <label className="label">Deadline</label>
                    <input
                      type="date"
                      min={getMinDateValue()}
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Team Size</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={teamSize}
                      onChange={(e) => setTeamSize(e.target.value)}
                      className="input"
                      placeholder="e.g. 3"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              loading={createPlan.isPending}
              disabled={description.length < 20 || createPlan.isPending}
            >
              {createPlan.isPending ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-1 animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4 mr-1" />
                  Generate Project Plan
                </>
              )}
            </Button>
            {createPlan.isError && (
              <span className="text-sm text-red-500">Failed to generate plan. Please try again.</span>
            )}
          </div>
        </form>
      </motion.div>

      {/* Processing overlay */}
      <AnimatePresence>
        {createPlan.isPending && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="card p-12 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
              <ArrowPathIcon className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Generating Your Project Plan</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Our AI is analyzing your project to create milestones, tasks, and timeline estimates...
            </p>
            <div className="mt-6 flex justify-center gap-8 text-xs text-gray-400">
              <span className="flex items-center gap-1"><RectangleStackIcon className="w-3.5 h-3.5" /> Milestones</span>
              <span className="flex items-center gap-1"><ListBulletIcon className="w-3.5 h-3.5" /> Tasks</span>
              <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5" /> Timeline</span>
              <span className="flex items-center gap-1"><ChartBarIcon className="w-3.5 h-3.5" /> Effort</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {activePlan && !createPlan.isPending && (
        <PlanResult plan={activePlan.data} />
      )}

      {/* Empty State */}
      {!activePlan && !createPlan.isPending && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
            <SparklesIcon className="w-8 h-8 text-primary-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Describe Your Project</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Enter a detailed project description above and our AI will break it down into milestones,
            tasks, timelines, and effort estimates.
          </p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="card">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Previous Plans ({history.length})
            </h3>
            {showHistory ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-gray-100 dark:border-dark-700 divide-y divide-gray-100 dark:divide-dark-700">
                  {history.map((h) => (
                    <div key={h._id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-900 transition-colors">
                      <button onClick={() => handleSelectHistory(h)} className="flex-1 text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{h.projectName || 'Untitled Project'}</p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{h.projectDescription}</p>
                      </button>
                      <div className="flex items-center gap-3 ml-4">
                        <span className="text-xs font-semibold text-gray-500">{h.totalMilestones} milestones</span>
                        <span className="text-xs font-semibold text-gray-500">{h.totalTasks} tasks</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{h.totalEstimatedHours}h</span>
                        <span className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(h._id); }}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
