import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SparklesIcon, CurrencyDollarIcon, ClockIcon, UsersIcon,
  ArrowPathIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon,
  ExclamationTriangleIcon, LightBulbIcon, CheckCircleIcon,
  CodeBracketIcon, ChartBarIcon, ShieldCheckIcon, RocketLaunchIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useCreateEstimate, useMyEstimates, useDeleteEstimate } from '@/hooks/useCostEstimator';
import { formatCurrency } from '@/utils/currency';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { clsx } from 'clsx';

const COMPLEXITY_COLORS = {
  low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
  high: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

function getComplexityLevel(score) {
  if (score <= 3) return { label: 'Low', ...COMPLEXITY_COLORS.low };
  if (score <= 6) return { label: 'Medium', ...COMPLEXITY_COLORS.medium };
  return { label: 'High', ...COMPLEXITY_COLORS.high };
}

const IMPACT_COLORS = {
  low: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-300',
  medium: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300',
  high: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300',
};

const CATEGORY_COLORS = {
  frontend: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  backend: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  database: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  devops: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  mobile: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  ai_ml: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
};

function BudgetCard({ budget }) {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <CurrencyDollarIcon className="w-5 h-5 text-green-500" />
        Budget Estimate
      </h3>
      <div className="text-center mb-4">
        <p className="text-4xl font-black text-gray-900 dark:text-white">
          {formatCurrency(budget.recommended, budget.currency)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Recommended Budget</p>
      </div>
      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-gray-500 dark:text-gray-400">Range</span>
        <span className="font-semibold text-gray-900 dark:text-white">
          {formatCurrency(budget.min, budget.currency)} — {formatCurrency(budget.max, budget.currency)}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2 mb-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${budget.confidence}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-2 rounded-full bg-green-500"
        />
      </div>
      <p className="text-xs text-gray-400 text-right">{budget.confidence}% confidence</p>
    </div>
  );
}

function TimelineCard({ timeline }) {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <ClockIcon className="w-5 h-5 text-blue-500" />
        Development Timeline
      </h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
          <p className="text-xl font-black text-green-600 dark:text-green-400">{timeline.optimistic}</p>
          <p className="text-xs text-gray-500">Optimistic</p>
          <p className="text-[10px] text-gray-400">{timeline.unit}</p>
        </div>
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
          <p className="text-xl font-black text-blue-600 dark:text-blue-400">{timeline.realistic}</p>
          <p className="text-xs text-gray-500">Realistic</p>
          <p className="text-[10px] text-gray-400">{timeline.unit}</p>
        </div>
        <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
          <p className="text-xl font-black text-orange-600 dark:text-orange-400">{timeline.pessimistic}</p>
          <p className="text-xs text-gray-500">Pessimistic</p>
          <p className="text-[10px] text-gray-400">{timeline.unit}</p>
        </div>
      </div>
      {timeline.phases?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phases</p>
          {timeline.phases.map((phase, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-dark-900 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{phase.name}</p>
                {phase.description && (
                  <p className="text-xs text-gray-400 truncate">{phase.description}</p>
                )}
              </div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
                {phase.duration} {phase.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamCard({ team }) {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <UsersIcon className="w-5 h-5 text-purple-500" />
        Recommended Team
      </h3>
      <div className="text-center mb-4">
        <p className="text-4xl font-black text-purple-600 dark:text-purple-400">{team.size}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">People</p>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-4">{team.composition}</p>
      {team.roles?.length > 0 && (
        <div className="space-y-2">
          {team.roles.map((role, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-900 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{role.role}</span>
                <span className="text-xs text-gray-400">x{role.count}</span>
                <Badge status={role.skillLevel}>{role.skillLevel}</Badge>
              </div>
              {role.hourlyRateRange && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {role.hourlyRateRange.min}-{role.hourlyRateRange.max} ETB/hr
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TechnologiesCard({ technologies }) {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <CodeBracketIcon className="w-5 h-5 text-cyan-500" />
        Recommended Technologies
      </h3>
      <div className="space-y-2">
        {technologies.map((tech, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-dark-900 rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{tech.name}</span>
                <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', CATEGORY_COLORS[tech.category])}>
                  {tech.category}
                </span>
                {tech.essential && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300">
                    essential
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tech.purpose}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CostBreakdownCard({ breakdown }) {
  const items = [
    { label: 'Development', value: breakdown.development, color: 'bg-blue-500' },
    { label: 'Design', value: breakdown.design, color: 'bg-purple-500' },
    { label: 'Testing & QA', value: breakdown.testing, color: 'bg-green-500' },
    { label: 'Project Management', value: breakdown.projectManagement, color: 'bg-yellow-500' },
    { label: 'Infrastructure', value: breakdown.infrastructure, color: 'bg-orange-500' },
    { label: 'Third-Party Services', value: breakdown.thirdPartyServices, color: 'bg-pink-500' },
    { label: 'Contingency', value: breakdown.contingency, color: 'bg-red-500' },
  ];

  const maxValue = Math.max(...items.map(i => i.value), 1);

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <ChartBarIcon className="w-5 h-5 text-amber-500" />
        Cost Breakdown
      </h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
              <span className="text-xs font-semibold text-gray-900 dark:text-white">{formatCurrency(item.value)}</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / maxValue) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
                className={clsx('h-full rounded-full', item.color)}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-900 dark:text-white">Total</span>
        <span className="text-lg font-black text-gray-900 dark:text-white">{formatCurrency(breakdown.total)}</span>
      </div>
    </div>
  );
}

function RisksCard({ risks }) {
  if (!risks?.length) return null;

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
        Risk Assessment
      </h3>
      <div className="space-y-3">
        {risks.map((risk, i) => (
          <div key={i} className="p-3 bg-gray-50 dark:bg-dark-900 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{risk.title}</span>
              <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', IMPACT_COLORS[risk.impact])}>
                {risk.impact}
              </span>
              <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', IMPACT_COLORS[risk.probability])}>
                {risk.probability} probability
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{risk.description}</p>
            {risk.mitigation && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircleIcon className="w-3 h-3" />
                {risk.mitigation}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsCard({ reasoning, assumptions, suggestions }) {
  const [openSection, setOpenSection] = useState('reasoning');

  const sections = [
    { id: 'reasoning', label: 'Analysis', icon: SparklesIcon, items: reasoning, color: 'text-primary-500' },
    { id: 'assumptions', label: 'Assumptions', icon: DocumentTextIcon, items: assumptions, color: 'text-gray-500' },
    { id: 'suggestions', label: 'Suggestions', icon: LightBulbIcon, items: suggestions, color: 'text-amber-500' },
  ];

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <ShieldCheckIcon className="w-5 h-5 text-indigo-500" />
        AI Insights
      </h3>
      <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-dark-700">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setOpenSection(section.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              openSection === section.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <section.icon className={clsx('w-4 h-4', section.color)} />
            {section.label}
            {section.items?.length > 0 && (
              <span className="text-xs bg-gray-200 dark:bg-dark-700 px-1.5 py-0.5 rounded-full">{section.items.length}</span>
            )}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {sections.find(s => s.id === openSection)?.items?.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <CheckCircleIcon className={clsx('w-4 h-4 mt-0.5 shrink-0', sections.find(s => s.id === openSection)?.color)} />
            <span className="text-gray-700 dark:text-gray-300">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EstimateResult({ estimate, onDelete }) {
  const [showHistory, setShowHistory] = useState(false);
  const data = estimate?.data;
  if (!data) return null;

  const complexity = getComplexityLevel(data.complexityScore);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Complexity Badge */}
      <div className="flex items-center gap-3">
        <span className={clsx('text-xs font-bold px-3 py-1 rounded-full', complexity.bg, complexity.text)}>
          Complexity: {complexity.label} ({data.complexityScore}/10)
        </span>
        <span className="text-xs text-gray-400">
          Estimated {new Date(data.estimatedAt).toLocaleDateString()}
        </span>
      </div>

      {/* Main Metrics */}
      <div className="grid md:grid-cols-3 gap-6">
        <BudgetCard budget={data.budget} />
        <TimelineCard timeline={data.timeline} />
        <TeamCard team={data.team} />
      </div>

      {/* Technologies */}
      <TechnologiesCard technologies={data.technologies} />

      {/* Cost Breakdown */}
      <CostBreakdownCard breakdown={data.costBreakdown} />

      {/* Risks */}
      <RisksCard risks={data.risks} />

      {/* AI Insights */}
      <InsightsCard
        reasoning={data.reasoning}
        assumptions={data.assumptions}
        suggestions={data.suggestions}
      />
    </motion.div>
  );
}

export default function CostEstimatorPage() {
  const [description, setDescription] = useState('');
  const [projectName, setProjectName] = useState('');
  const [activeEstimate, setActiveEstimate] = useState(null);
  const createEstimate = useCreateEstimate();
  const { data: historyData, isLoading: historyLoading } = useMyEstimates();
  const deleteEstimate = useDeleteEstimate();
  const [showHistory, setShowHistory] = useState(false);

  const history = historyData?.data || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (description.length < 20) return;

    createEstimate.mutate(
      { projectDescription: description, projectName: projectName || undefined },
      {
        onSuccess: (res) => {
          setActiveEstimate(res);
        },
      }
    );
  };

  const handleSelectHistory = (estimate) => {
    setActiveEstimate({ data: estimate });
  };

  const handleDelete = (estimateId) => {
    deleteEstimate.mutate(estimateId, {
      onSuccess: () => {
        if (activeEstimate?.data?._id === estimateId) setActiveEstimate(null);
      },
    });
  };

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <SparklesIcon className="w-6 h-6 text-primary-500" />
          AI Cost Estimator
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
          Get AI-powered budget, timeline, team, and technology estimates for your project
        </p>
      </motion.div>

      {/* Input Form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
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
              placeholder="Describe your project in detail. Include features, requirements, target audience, preferred tech stack (if any), and any constraints. The more detail you provide, the more accurate the estimate will be."
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
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              loading={createEstimate.isPending}
              disabled={description.length < 20 || createEstimate.isPending}
            >
              {createEstimate.isPending ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-1 animate-spin" />
                  Analyzing Project...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4 mr-1" />
                  Generate Estimate
                </>
              )}
            </Button>
            {createEstimate.isError && (
              <span className="text-sm text-red-500">Failed to generate estimate. Please try again.</span>
            )}
          </div>
        </form>
      </motion.div>

      {/* Processing overlay */}
      <AnimatePresence>
        {createEstimate.isPending && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="card p-12 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
              <ArrowPathIcon className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Generating Your Estimate</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Our AI is analyzing your project description to estimate budget, timeline, technologies, and team composition...
            </p>
            <div className="mt-6 flex justify-center gap-8 text-xs text-gray-400">
              <span className="flex items-center gap-1"><CurrencyDollarIcon className="w-3.5 h-3.5" /> Budget</span>
              <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5" /> Timeline</span>
              <span className="flex items-center gap-1"><UsersIcon className="w-3.5 h-3.5" /> Team</span>
              <span className="flex items-center gap-1"><CodeBracketIcon className="w-3.5 h-3.5" /> Tech</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {activeEstimate && !createEstimate.isPending && (
        <EstimateResult
          estimate={activeEstimate}
          onDelete={(id) => handleDelete(id)}
        />
      )}

      {/* Empty State */}
      {!activeEstimate && !createEstimate.isPending && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
            <SparklesIcon className="w-8 h-8 text-primary-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Describe Your Project</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Enter a detailed project description above and our AI will analyze it to provide budget estimates,
            technology recommendations, timeline projections, and team size suggestions.
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
              Previous Estimates ({history.length})
            </h3>
            {showHistory ? (
              <ChevronUpIcon className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            )}
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
                  {history.map((h) => {
                    const complexity = getComplexityLevel(h.complexityScore);
                    return (
                      <div key={h._id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-900 transition-colors">
                        <button
                          onClick={() => handleSelectHistory(h)}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {h.projectName || 'Untitled Project'}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{h.projectDescription}</p>
                            </div>
                          </div>
                        </button>
                        <div className="flex items-center gap-3 ml-4">
                          {h.budget && (
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {formatCurrency(h.budget.recommended, h.budget.currency)}
                            </span>
                          )}
                          <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', complexity.bg, complexity.text)}>
                            {complexity.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(h.createdAt).toLocaleDateString()}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(h._id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
