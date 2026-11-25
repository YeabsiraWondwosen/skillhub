import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  useProject,
  useProjectMilestones,
  useCreateMilestone,
  useFundMilestone,
  useApproveMilestone,
} from '@/hooks/useProjects';
import { milestoneService } from '@/services/milestone.service';
import { useAuthStore } from '@/store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import {
  FlagIcon, PlusIcon, CurrencyDollarIcon,
  CheckCircleIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import { format, isPast } from 'date-fns';
import { formatCurrency } from '@/utils/currency';
import { getMinDateValue, isDateOnlyInPast } from '@/utils/dateValidation';
import { ArrowLeft } from 'lucide-react';

const STATUS_STEPS = [
  'pending', 'funded', 'in_progress', 'submitted', 'approved', 'released',
];

function MilestoneTimeline({ status }) {
  const idx = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1 mt-2 flex-wrap">
      {STATUS_STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${i <= idx ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'}`} />
          {i < STATUS_STEPS.length - 1 && (
            <div className={`h-px w-4 ${i < idx ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function MilestonesPage() {
  const { projectId } = useParams();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [fundId, setFundId] = useState(null);
  const [approveId, setApproveId] = useState(null);
  const [submitId, setSubmitId] = useState(null);
  const [revisionId, setRevisionId] = useState(null);
  const [submitFiles, setSubmitFiles] = useState([]);

  const { data: projectData } = useProject(projectId);
  const { data: msData, isLoading } = useProjectMilestones(projectId);
  const { mutate: createMilestone, isPending: isCreating } = useCreateMilestone();
  const { mutate: fundMilestone, isPending: isFunding } = useFundMilestone();
  const { mutate: approveMilestone, isPending: isApproving } = useApproveMilestone();

  const { register: regAdd, handleSubmit: handleAdd, reset: resetAdd, formState: { errors: addErrors } } = useForm();
  const { register: regSubmit, handleSubmit: handleSubmitForm, reset: resetSubmit } = useForm();
  const { register: regRevision, handleSubmit: handleRevisionForm, reset: resetRevision } = useForm();

  const project = projectData?.data;
  const milestones = msData?.data ?? [];
  const isClient = project?.client?._id === user?._id || project?.client === user?._id;
  const isFreelancer = project?.freelancer?._id === user?._id || project?.freelancer === user?._id;

  const totalBudget = milestones.reduce((s, m) => s + (m.amount ?? 0), 0);
  const releasedAmount = milestones.filter(m => m.status === 'released').reduce((s, m) => s + (m.amount ?? 0), 0);

  const onAdd = (values) => {
    createMilestone({ projectId, data: values }, {
      onSuccess: () => { setAddOpen(false); resetAdd(); },
    });
  };

  const onSubmitMilestone = (values) => {
    const fd = new FormData();
    fd.append('note', values.note ?? '');
    submitFiles.forEach(f => fd.append('files', f));
    milestoneService.submit(submitId, fd)
      .then(() => {
        toast.success('Milestone submitted!');
        qc.invalidateQueries({ queryKey: ['projects', projectId, 'milestones'] });
        setSubmitId(null); resetSubmit(); setSubmitFiles([]);
      })
      .catch(e => toast.error(e.response?.data?.message ?? 'Failed'));
  };

  const onRequestRevision = (values) => {
    milestoneService.requestRevision(revisionId, values.note)
      .then(() => {
        toast.success('Revision requested');
        qc.invalidateQueries({ queryKey: ['projects', projectId, 'milestones'] });
        setRevisionId(null); resetRevision();
      })
      .catch(e => toast.error(e.response?.data?.message ?? 'Failed'));
  };

  return (
    <div className="page-container space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link to={`/projects/${projectId}`} className="text-sm text-gray-400 hover:text-primary-600 inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Project
          </Link>
          <h1 className="section-title mt-1">Milestones</h1>
          <p className="section-sub">{project?.title ?? ''}</p>
        </div>
        {isClient && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon className="w-4 h-4" /> Add Milestone
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Milestones', value: milestones.length, icon: FlagIcon },
          { label: 'Total Budget', value: formatCurrency(totalBudget), icon: CurrencyDollarIcon },
          { label: 'Released', value: formatCurrency(releasedAmount), icon: CheckCircleIcon },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <s.icon className="w-5 h-5 text-primary-500 mb-2" />
            <p className="stat-value">{s.value}</p>
            <p className="stat-label">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Milestone list */}
      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : milestones.length === 0 ? (
        <EmptyState
          icon={FlagIcon}
          title="No milestones yet"
          description="Break the project into milestones to track progress and manage payments."
          action={isClient ? <Button size="sm" onClick={() => setAddOpen(true)}>Add First Milestone</Button> : null}
        />
      ) : (
        <div className="space-y-4">
          {milestones.map((ms, i) => (
            <motion.div key={ms._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">{ms.title}</span>
                    <Badge status={ms.status} />
                    {ms.isOverdue && <Badge status="danger">Overdue</Badge>}
                  </div>
                  {ms.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 ml-8 mb-1">{ms.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400 ml-8">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {formatCurrency(ms.amount)}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-3.5 h-3.5" />
                      Due {ms.dueDate ? format(new Date(ms.dueDate), 'MMM d, yyyy') : '—'}
                    </span>
                  </div>
                  <div className="ml-8"><MilestoneTimeline status={ms.status} /></div>
                  {ms.deliveryNote && (
                    <div className="ml-8 mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dark-700 rounded p-2">
                      <span className="font-medium">Note:</span> {ms.deliveryNote}
                    </div>
                  )}
                  {ms.revisionNote && (
                    <div className="ml-8 mt-2 text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 rounded p-2">
                      <span className="font-medium">Revision:</span> {ms.revisionNote}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {isClient && ms.status === 'pending' && (
                    <Button size="sm" onClick={() => setFundId(ms._id)}>Fund</Button>
                  )}
                  {isFreelancer && ['funded', 'revision_requested'].includes(ms.status) && (
                    <Button size="sm" onClick={() => setSubmitId(ms._id)}>Submit</Button>
                  )}
                  {isClient && ms.status === 'submitted' && (
                    <>
                      <Button size="sm" onClick={() => setApproveId(ms._id)}>Approve & Pay</Button>
                      <Button size="sm" variant="secondary" onClick={() => setRevisionId(ms._id)}>
                        Request Revision
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Milestone Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Milestone" size="md">
        <form onSubmit={handleAdd(onAdd)} className="space-y-4">
          <Input label="Title" placeholder="e.g. Phase 1 — UI Design"
            error={addErrors.title?.message}
            {...regAdd('title', { required: 'Title required' })} />
          <Textarea label="Description (optional)" rows={2} {...regAdd('description')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount (ETB)" type="number" min={1} placeholder="500"
              error={addErrors.amount?.message}
              {...regAdd('amount', { required: 'Amount required', min: { value: 1, message: 'Min 1 ETB' } })} />
            <Input label="Due Date" type="date" min={getMinDateValue()}
              error={addErrors.dueDate?.message}
              {...regAdd('dueDate', { 
                required: 'Due date required',
                validate: (v) => isDateOnlyInPast(v).valid || isDateOnlyInPast(v).message,
              })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" loading={isCreating}>Create Milestone</Button>
          </div>
        </form>
      </Modal>

      {/* Fund Milestone Confirm */}
      <ConfirmModal open={!!fundId} onClose={() => setFundId(null)}
        onConfirm={() => fundMilestone(fundId, { onSuccess: () => setFundId(null) })}
        title="Fund Milestone"
        message="Funds will be held in escrow until you approve the delivery. Only approve once satisfied."
        confirmLabel="Fund & Hold in Escrow" loading={isFunding} />

      {/* Submit Milestone Modal */}
      <Modal open={!!submitId} onClose={() => { setSubmitId(null); resetSubmit(); }} title="Submit Milestone" size="md">
        <form onSubmit={handleSubmitForm(onSubmitMilestone)} className="space-y-4">
          <Textarea label="Delivery Note" rows={4} placeholder="Describe what you delivered…"
            {...regSubmit('note')} />
          <div>
            <label className="label">Attach Files (optional)</label>
            <input type="file" multiple onChange={e => setSubmitFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" size="sm" onClick={() => setSubmitId(null)}>Cancel</Button>
            <Button type="submit" size="sm">Submit</Button>
          </div>
        </form>
      </Modal>

      {/* Approve Milestone Confirm */}
      <ConfirmModal open={!!approveId} onClose={() => setApproveId(null)}
        onConfirm={() => approveMilestone(approveId, { onSuccess: () => setApproveId(null) })}
        title="Approve & Release Payment"
        message="This will release the escrowed funds to the freelancer. This action cannot be undone."
        confirmLabel="Approve & Release" loading={isApproving} />

      {/* Revision Modal */}
      <Modal open={!!revisionId} onClose={() => setRevisionId(null)} title="Request Revision" size="sm">
        <form onSubmit={handleRevisionForm(onRequestRevision)} className="space-y-4">
          <Textarea label="Revision Note" rows={3} placeholder="What needs to change?"
            {...regRevision('note', { required: true })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" size="sm" onClick={() => setRevisionId(null)}>Cancel</Button>
            <Button type="submit" size="sm" variant="danger">Request Revision</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
