import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon, UsersIcon, ChartBarIcon, PlusIcon,
  BriefcaseIcon, FunnelIcon, ArrowTrendingUpIcon, SparklesIcon,
  UserGroupIcon, CheckBadgeIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import {
  usePipelines, useCreatePipeline, useDeletePipeline, useRecruiterAnalytics,
} from '@/hooks/useRecruiter';
import FreelancerSearch from '@/components/recruiter/FreelancerSearch';
import CandidateComparison from '@/components/recruiter/CandidateComparison';
import HiringPipeline from '@/components/recruiter/HiringPipeline';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { useConfirm } from '@/components/ui/DialogProvider';

export default function RecruiterDashboardPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('search');
  const [compareIds, setCompareIds] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDesc, setPipelineDesc] = useState('');

  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines({});
  const { data: analytics, isLoading: analyticsLoading } = useRecruiterAnalytics();
  const { mutate: createPipeline, isPending: creating } = useCreatePipeline();
  const { mutate: deletePipeline } = useDeletePipeline();

  const pipelineList = Array.isArray(pipelines) ? pipelines : (pipelines?.data || []);

  const handleToggleCompare = (id) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 5) { toast.error(t('dashboard.recruiter.errors.maxCompare')); return prev; }
      return [...prev, id];
    });
  };

  const handleCreatePipeline = () => {
    if (!pipelineName.trim()) return;
    createPipeline({ name: pipelineName, description: pipelineDesc }, {
      onSuccess: () => { setShowCreateModal(false); setPipelineName(''); setPipelineDesc(''); },
    });
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: t('dashboard.recruiter.confirm.deletePipeline'),
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deletePipeline(id);
  };

  return (
    <div className="page-container max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <BriefcaseIcon className="w-7 h-7 text-primary-600" />
            {t('dashboard.recruiter.title')}
          </h1>
          <p className="section-sub">{t('dashboard.recruiter.subtitle')}</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          {t('dashboard.recruiter.actions.newPipeline')}
        </button>
      </div>

      {/* Analytics cards */}
      {!analyticsLoading && analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: t('dashboard.recruiter.stats.activePipelines'), value: analytics.pipelineSummary?.activePipelines ?? 0, icon: FunnelIcon, color: 'text-blue-600' },
            { label: t('dashboard.recruiter.stats.totalCandidates'), value: analytics.pipelineSummary?.totalCandidates ?? 0, icon: UsersIcon, color: 'text-purple-600' },
            { label: t('dashboard.recruiter.stats.avgMatchScore'), value: `${analytics.avgMatchScore ?? 0}%`, icon: ArrowTrendingUpIcon, color: 'text-green-600' },
            { label: t('dashboard.recruiter.stats.hired'), value: analytics.stageBreakdown?.hired ?? 0, icon: CheckBadgeIcon, color: 'text-primary-600' },
            { label: t('dashboard.recruiter.stats.inPipeline'), value: (analytics.stageBreakdown?.sourcing ?? 0) + (analytics.stageBreakdown?.screening ?? 0) + (analytics.stageBreakdown?.interview ?? 0), icon: ChartBarIcon, color: 'text-orange-600' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-4 text-center">
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
          { key: 'search', label: t('dashboard.recruiter.tabs.search'), icon: MagnifyingGlassIcon },
          { key: 'pipelines', label: t('dashboard.recruiter.tabs.pipelines'), icon: FunnelIcon },
          { key: 'compare', label: t('dashboard.recruiter.tabs.compare', { count: compareIds.length }), icon: UsersIcon },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={clsx('px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5',
              activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400')}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'search' && (
        <FreelancerSearch
          selectedIds={compareIds}
          onToggleSelect={handleToggleCompare}
          onAddToPipeline={(f) => toast.success(`${f.firstName} ${f.lastName} selected for comparison`)}
        />
      )}

      {activeTab === 'pipelines' && (
        <div className="space-y-4">
          {selectedPipeline ? (
            <HiringPipeline pipelineId={selectedPipeline} onClose={() => setSelectedPipeline(null)} />
          ) : pipelinesLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card p-4 animate-pulse h-20 bg-gray-100 dark:bg-gray-800" />)}</div>
          ) : pipelineList.length === 0 ? (
            <div className="card p-12 text-center text-gray-500">
              <FunnelIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium mb-1">{t('dashboard.recruiter.empty.pipelines.title')}</p>
              <p className="text-xs text-gray-400">{t('dashboard.recruiter.empty.pipelines.description')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pipelineList.map((p, i) => (
                <motion.div key={p._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="card p-4 flex items-center justify-between cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                  onClick={() => setSelectedPipeline(p._id)}>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('dashboard.recruiter.pipelineCard.candidates', { count: p.candidates?.length || 0 })}
                      {p.job?.title && <> · {p.job.title}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{p.status}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p._id); }}
                      className="btn-icon btn-ghost text-gray-400 hover:text-red-500">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'compare' && (
        compareIds.length < 2 ? (
          <div className="card p-12 text-center text-gray-500">
            <UsersIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium mb-1">{t('dashboard.recruiter.compare.empty.title')}</p>
            <p className="text-xs text-gray-400">{t('dashboard.recruiter.compare.empty.description')}</p>
          </div>
        ) : (
          <CandidateComparison candidateIds={compareIds} onRemove={(id) => setCompareIds(prev => prev.filter(x => x !== id))} onClose={() => setCompareIds([])} />
        )
      )}

      {/* Create Pipeline Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('dashboard.recruiter.modal.title')}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dashboard.recruiter.modal.pipelineName.label')}</label>
                <input type="text" value={pipelineName} onChange={e => setPipelineName(e.target.value)}
                  placeholder={t('dashboard.recruiter.modal.pipelineName.placeholder')} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dashboard.recruiter.modal.description.label')}</label>
                <textarea value={pipelineDesc} onChange={e => setPipelineDesc(e.target.value)}
                  placeholder={t('dashboard.recruiter.modal.description.placeholder')} rows={2} className="input-field w-full resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary">{t('dashboard.recruiter.modal.cancel')}</button>
              <button onClick={handleCreatePipeline} disabled={creating} className="btn-primary">
                {creating ? t('dashboard.recruiter.modal.creating') : t('dashboard.recruiter.modal.create')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
