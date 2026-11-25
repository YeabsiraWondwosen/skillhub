import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  BriefcaseIcon, CalendarIcon, ChatBubbleOvalLeftIcon, CurrencyDollarIcon,
  DocumentTextIcon, EyeIcon, FolderIcon, MagnifyingGlassIcon, PauseIcon,
  PaperAirplaneIcon, PencilSquareIcon, PlayIcon, ShieldExclamationIcon,
  TrashIcon, UserGroupIcon, XCircleIcon,
} from '@heroicons/react/24/outline';
import { format, formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';

import { useMyJobs, usePauseJob, useResumeJob, useCancelJob, useDeleteJob } from '@/hooks/useJobs';
import { messageService } from '@/services/message.service';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import { formatCurrency, formatRateRange } from '@/utils/currency';

const PAGE_SIZE = 10;

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];
const TAB_LABELS = Object.fromEntries(TABS.map((t) => [t.value, t.label]));

const LIFECYCLE_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  draft: 'Draft',
};

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'budget_high', label: 'Highest Budget' },
  { value: 'budget_low', label: 'Lowest Budget' },
  { value: 'proposals', label: 'Most Proposals' },
  { value: 'deadline', label: 'Deadline' },
];

const PAYMENT_TONES = {
  'Not Funded': 'draft',
  'Pending Payment': 'pending',
  'Funded': 'funded',
  'Released': 'released',
  'Refunded': 'refunded',
  'Disputed': 'disputed',
};

const PROJECT_LABELS = {
  pending_payment: 'Pending Payment',
  active: 'Active',
  pending_delivery: 'Pending Delivery',
  in_review: 'In Review',
  delivery_review: 'In Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

const MILESTONE_LABELS = {
  pending: 'Milestone: Unpaid',
  funded: 'Milestone: Funded',
  in_progress: 'Milestone: In progress',
  submitted: 'Delivery: Submitted',
  released: 'Milestone: Approved',
  approved: 'Milestone: Approved',
};

const budgetLabel = (job) => {
  const b = job.budget || {};
  const fin = job.financial || {};
  // Once a contract exists the agreed amount is the real money figure; the
  // posted budget range max is only the listing's upper bound.
  if (fin.agreedAmount) return `${formatCurrency(fin.agreedAmount, fin.currency)}${b.type === 'hourly' ? '/hr' : ''}`;
  if (b.type === 'hourly') return formatRateRange(b.minAmount, b.maxAmount, b.currency) || '—';
  return formatCurrency(b.maxAmount, b.currency) || '—';
};

const deadlineLabel = (job) => {
  if (!job.deadline) return 'No deadline';
  return format(new Date(job.deadline), 'MMM d, yyyy');
};

const fullName = (user) => (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Freelancer');

export default function ManageJobsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') || 'all';

  const [activeTab, setActiveTab] = useState(() => (TABS.some((t) => t.value === urlStatus) ? urlStatus : 'all'));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);

  // Modal state
  const [pauseId, setPauseId] = useState(null);
  const [resumeId, setResumeId] = useState(null);
  const [cancelId, setCancelId] = useState(null);
  const [blockedJob, setBlockedJob] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [messagingId, setMessagingId] = useState(null);

  // Keep tab in sync with the ?status= URL param (deep links, back/forward)
  useEffect(() => {
    const next = TABS.some((t) => t.value === urlStatus) ? urlStatus : 'all';
    setActiveTab(next);
    setPage(1);
  }, [urlStatus]);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError } = useMyJobs({
    status: activeTab === 'all' ? undefined : activeTab,
    search: search || undefined,
    sortBy,
    page,
    limit: PAGE_SIZE,
  });

  const { mutate: pauseJob, isPending: pausing } = usePauseJob();
  const { mutate: resumeJob, isPending: resuming } = useResumeJob();
  const { mutate: cancelJob, isPending: cancelling } = useCancelJob();
  const { mutate: deleteJob, isPending: deleting } = useDeleteJob();

  const jobs = data?.data ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const start = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = total ? Math.min(page * PAGE_SIZE, total) : 0;

  const handleTab = (value) => {
    setActiveTab(value);
    setPage(1);
    if (value === 'all') setSearchParams({}, { replace: true });
    else setSearchParams({ status: value }, { replace: true });
  };

  const openCancel = (job) => {
    const hasContract = !!job.project || !!job.hiredFreelancer || !!job.escrow || ['pending', 'funded'].includes(job.rawPaymentStatus);
    if (hasContract) setBlockedJob(job);
    else setCancelId(job._id);
  };

  const handleMessage = async (job) => {
    setMessagingId(job._id);
    try {
      const res = await messageService.startConversation(job.hiredFreelancer._id);
      const conv = res.data?.data || res.data;
      navigate(`/messages/${conv._id}`);
    } catch (e) {
      toast.error('Failed to start conversation');
    }
    setMessagingId(null);
  };

  const renderPrimaryCta = (job, item) => {
    if (!item) return null;
    const classes = clsx('btn-primary btn-sm whitespace-nowrap', item.icon && 'inline-flex items-center gap-1.5');
    const content = (
      <>
        {item.icon && <item.icon className="w-4 h-4" />}
        {item.label}
      </>
    );
    return item.to
      ? <Link to={item.to} className={classes}>{content}</Link>
      : (
        <button onClick={item.onClick} disabled={item.key === 'message' && messagingId === job._id} className={classes}>
          {content}
        </button>
      );
  };

  const renderSecondary = (item, job) => {
    const classes = clsx(
      'btn-ghost btn-sm inline-flex items-center gap-1.5',
      item.danger && 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10',
    );
    const content = (
      <>
        {item.icon && <item.icon className="w-3.5 h-3.5" />}
        {item.label}
      </>
    );
    return item.to
      ? <Link key={item.key} to={item.to} className={classes}>{content}</Link>
      : (
        <button key={item.key} onClick={item.onClick} disabled={item.key === 'message' && messagingId === job._id} className={classes}>
          {content}
        </button>
      );
  };

  const buildActions = (job) => {
    const a = job.allowedActions || {};
    const items = [];
    const push = (key, label, to, onClick, icon, opts = {}) => items.push({ key, label, to, onClick, icon, ...opts });

    if (a.viewProject && job.project) push('project', 'View Project', `/projects/${job.project._id}`, null, FolderIcon, { primary: true });
    if (a.viewContract && job.project) push('contract', 'View Contract', '/client/contracts', null, DocumentTextIcon);
    if (a.messageFreelancer) push('message', 'Message', null, () => handleMessage(job), ChatBubbleOvalLeftIcon, { primary: true });
    if (a.viewReview) push('review', 'View Review', '/client/reviews', null, PaperAirplaneIcon, { primary: true });
    if (a.viewProposals) {
      if (job.proposalCount > 0) {
        push('proposals', `View ${job.proposalCount === 1 ? 'Proposal' : 'Proposals'}`, `/client/jobs/${job._id}/applicants`, null, UserGroupIcon, { primary: true });
      } else {
        push('view', 'View Job', `/jobs/${job._id}`, null, EyeIcon);
      }
    }
    if (a.edit) push('edit', 'Edit', `/client/jobs/${job._id}/edit`, null, PencilSquareIcon);
    if (a.pause) push('pause', 'Pause', null, () => setPauseId(job._id), PauseIcon);
    if (a.resume) push('resume', 'Resume', null, () => setResumeId(job._id), PlayIcon);
    if (a.cancel) push('cancel', 'Cancel', null, () => openCancel(job), XCircleIcon, { danger: true });
    if (a.delete) push('delete', 'Delete', null, () => setDeleteId(job._id), TrashIcon, { danger: true });

    if (!items.length || (!items.some((i) => i.key === 'view') && !a.viewProposals)) {
      push('view', 'View Job', `/jobs/${job._id}`, null, EyeIcon);
    }
    return items;
  };

  const renderEmpty = () => {
    if (isError) {
      return (
        <div className="card p-8">
          <EmptyState icon={BriefcaseIcon} title="Could not load your jobs"
            description="Something went wrong. Please try again."
            action={<button onClick={() => window.location.reload()} className="btn-primary btn-sm">Retry</button>}
          />
        </div>
      );
    }
    if (search) {
      return (
        <div className="card p-8">
          <EmptyState icon={MagnifyingGlassIcon} title="No jobs match your search"
            description="Try a different keyword, or clear the search to see all your jobs."
            action={<button onClick={() => setSearchInput('')} className="btn-primary btn-sm">Clear search</button>}
          />
        </div>
      );
    }
    return (
      <div className="card p-8">
        <EmptyState icon={BriefcaseIcon}
          title={activeTab === 'all' ? 'No jobs yet' : `No ${TAB_LABELS[activeTab] || ''} jobs`}
          description="Post your first job to start hiring top freelancers."
          action={<Link to="/client/jobs/new" className="btn-primary btn-sm">Post a Job</Link>}
        />
      </div>
    );
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={BriefcaseIcon}
        title="My Jobs"
        subtitle="Manage your posted positions — proposals, contracts, and payments in one place"
        actions={<Link to="/client/jobs/new" className="btn-primary">+ Post New Job</Link>}
      />

      {/* Search + filters */}
      <div className="card p-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <label htmlFor="status-filter" className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Status</label>
          <div className="w-full lg:w-44">
            <select
              id="status-filter"
              value={activeTab}
              onChange={(e) => handleTab(e.target.value)}
              className="input"
            >
              {TABS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title, description, category, or skill…"
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <label htmlFor="sort-by" className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Sort by</label>
          <div className="w-full lg:w-52">
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="input"
            >
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      {!isLoading && total > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing <span className="font-semibold text-gray-700 dark:text-gray-200">{start}</span>–
          <span className="font-semibold text-gray-700 dark:text-gray-200">{end}</span> of{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-200">{total}</span> jobs
        </p>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : jobs.length === 0 ? (
        renderEmpty()
      ) : (
        <div className="space-y-4">
          {jobs.map((job, i) => {
            const isCompletedJob = job.lifecycleStatus === 'completed' || job.paymentStatus === 'Released' || job.project?.status === 'completed';
            const actions = buildActions(job);
            const primary = actions.find((a) => a.primary) || null;
            const secondary = actions.filter((a) => a !== primary);
            return (
              <motion.div key={job._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                className="card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <Badge status={isCompletedJob ? 'completed' : job.lifecycleStatus}>{LIFECYCLE_LABELS[isCompletedJob ? 'completed' : job.lifecycleStatus] || (isCompletedJob ? 'Completed' : job.lifecycleStatus)}</Badge>
                      <Badge status={PAYMENT_TONES[job.paymentStatus] || 'draft'}>{job.paymentStatus}</Badge>
                      {job.financial?.escrow > 0 && <Badge status="info">Escrow held: {formatCurrency(job.financial.escrow, job.financial.currency)}</Badge>}
                      {job.financial?.released > 0 && <Badge status="released">Released: {formatCurrency(job.financial.released, job.financial.currency)}</Badge>}
                      {job.financial?.pending > 0 && <Badge status="pending">Pending payment: {formatCurrency(job.financial.pending, job.financial.currency)}</Badge>}
                      {job.milestone && <Badge status="primary">{MILESTONE_LABELS[job.milestone.status] || job.milestone.status}</Badge>}
                      {job.isUrgent && <Badge status="urgent">Urgent</Badge>}
                      {job.isOverdue && <Badge status="revision_requested">Overdue</Badge>}
                    </div>

                    <Link to={`/jobs/${job._id}`}
                      className="text-lg font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                      {job.title}
                    </Link>
                    {job.description && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{job.description}</p>
                    )}

                    {/* Meta */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1.5"><CurrencyDollarIcon className="w-4 h-4" /> {budgetLabel(job)}{job.budget?.type === 'hourly' ? '/hr' : ''}</span>
                      {job.mainCategory && (
                        <span className="inline-flex items-center gap-1">
                          {job.mainCategory.name}{job.category ? <><span className="text-gray-300 dark:text-gray-600">/</span>{job.category.name}</> : null}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5"><CalendarIcon className="w-4 h-4" /> Deadline: {deadlineLabel(job)}</span>
                      <span>Posted {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                    </div>

                    {/* Proposals / hired freelancer */}
                    <div className="mt-4">
                      {job.hiredFreelancer ? (
                        <div className="flex items-center gap-3">
                          <Avatar src={job.hiredFreelancer.avatar} alt={fullName(job.hiredFreelancer)} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{fullName(job.hiredFreelancer)}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">Hired freelancer</span>
                              {job.project && (
                                <Badge status={job.project.status}>Contract: {PROJECT_LABELS[job.project.status] || job.project.status.replace(/_/g, ' ')}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        job.allowedActions?.viewProposals && (
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {job.proposalCount === 0 ? (
                                <span className="text-gray-400 dark:text-gray-500 italic">No proposals yet</span>
                              ) : (
                                <Badge status="primary">{job.proposalCount} {job.proposalCount === 1 ? 'Proposal' : 'Proposals'}</Badge>
                              )}
                            </div>
                            {job.proposalCount === 0 && (
                              <Link to={`/jobs/${job._id}`} className="btn-secondary btn-sm whitespace-nowrap">View Job</Link>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Primary CTA */}
                  {primary && (
                    <div className="flex-shrink-0">
                      {renderPrimaryCta(job, primary)}
                    </div>
                  )}
                </div>

                {/* Secondary actions */}
                {secondary.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center gap-2">
                    {secondary.map((item) => renderSecondary(item, job))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <Pagination meta={meta} onPageChange={setPage} />

      {/* ── Modals ─────────────────────────────────────── */}
      <ConfirmModal open={!!pauseId} onClose={() => setPauseId(null)}
        onConfirm={() => pauseJob(pauseId, { onSuccess: () => setPauseId(null) })}
        title="Pause Job" message="Pausing hides this job from public listings until you resume it. Proposals already received are kept safe."
        confirmLabel="Pause Job" loading={pausing} />

      <ConfirmModal open={!!resumeId} onClose={() => setResumeId(null)}
        onConfirm={() => resumeJob(resumeId, { onSuccess: () => setResumeId(null) })}
        title="Resume Job" message="Resuming makes this job visible to freelancers again. Continue receiving proposals."
        confirmLabel="Resume Job" loading={resuming} />

      <ConfirmModal open={!!cancelId} onClose={() => setCancelId(null)}
        onConfirm={() => cancelJob(cancelId, { onSuccess: () => setCancelId(null) })}
        title="Cancel Job" message="Cancelling closes this job and stops new proposals. This cannot be undone."
        confirmLabel="Cancel Job" danger loading={cancelling} />

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteJob(deleteId, { onSuccess: () => setDeleteId(null) })}
        title="Delete Job" message="Are you sure? This permanently deletes this job and all related data."
        confirmLabel="Delete Job" danger loading={deleting} />

      {/* Cancel blocked warning */}
      <Modal open={!!blockedJob} onClose={() => setBlockedJob(null)} title="Cannot cancel this job" size="sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-500/10">
            <ShieldExclamationIcon className="w-5 h-5" />
          </span>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This job has an active contract, payment, or escrow, so it can&apos;t be cancelled directly.
            Continue from the project workspace, or open a dispute if there&apos;s a conflict.
          </p>
        </div>
        <div className="flex justify-end gap-3 mt-6 flex-wrap">
          <button onClick={() => setBlockedJob(null)} className="btn-secondary">Close</button>
          {blockedJob?.project && (
            <Link to={`/projects/${blockedJob.project._id}`} className="btn-primary">Go to Project</Link>
          )}
          <Link to="/client/contracts" className="btn-secondary">View Contracts</Link>
        </div>
      </Modal>
    </div>
  );
}
