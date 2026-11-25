import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { adminService } from '@/services/admin.service';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonCard } from '@/components/ui/Skeleton';
import PageHeader from '@/components/ui/PageHeader';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import { formatDistanceToNow, format } from 'date-fns';
import { clsx } from 'clsx';
import { formatCurrencyRange } from '@/utils/currency';
import {
  BriefcaseIcon, ChevronDownIcon, MagnifyingGlassIcon,
  ShieldCheckIcon, ArrowTopRightOnSquareIcon, ClockIcon,
  UsersIcon,
  CheckCircleIcon, XCircleIcon, ArrowPathIcon, TagIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

const JOB_STATUSES = [
  'draft', 'open', 'proposals_received', 'freelancer_selected', 'payment_pending',
  'funded', 'in_progress', 'delivery_submitted', 'client_review',
  'completed', 'cancelled', 'paused',
];

const STATUS_LABELS = {
  draft: 'Draft',
  open: 'Open',
  proposals_received: 'Proposals Received',
  freelancer_selected: 'Freelancer Selected',
  payment_pending: 'Payment Required',
  funded: 'Funded',
  in_progress: 'In Progress',
  delivery_submitted: 'Delivery Submitted',
  client_review: 'Client Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
  paused: 'Paused',
};

const APPROVAL_OPTIONS = [
  { value: 'all', label: 'All Jobs' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Needs Review / Hidden' },
];

const MODAL_TABS = [
  { key: 'review', label: 'Moderation', icon: ShieldCheckIcon },
  { key: 'activity', label: 'Activity', icon: ClockIcon },
];

function ActionsMenu({ job, onReview, onViewActivity, onPublish, onHide }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const toggle = (e) => {
    if (open) { setOpen(false); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: Math.max(8, r.right - 224) });
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !pos) return;
    const menu = menuRef.current;
    if (!menu) return;
    const mh = menu.getBoundingClientRect().height;
    if (pos.top + mh > window.innerHeight - 8) {
      setPos(p => ({ ...p, top: Math.max(8, window.innerHeight - mh - 8) }));
    }
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (e) => {
      const inBtn = btnRef.current && btnRef.current.contains(e.target);
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!inBtn && !inMenu) setOpen(false);
    };
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('mousedown', outside);
    return () => {
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('mousedown', outside);
    };
  }, [open]);

  const hideRestricted = job.isApproved && job.canHide === false;
  const hideRestrictionReason = job.hideRestrictionReason
    || 'This job can no longer be hidden because a freelancer has been hired or work is already under way.';

  const actions = [
    { key: 'review', label: 'Review Job', icon: ShieldCheckIcon, onClick: onReview },
    { key: 'activity', label: 'View Activity', icon: ClockIcon, onClick: onViewActivity },
    ...(job.isApproved
      ? [{
          key: 'hide',
          label: 'Hide / Unpublish',
          icon: XCircleIcon,
          onClick: onHide,
          disabled: hideRestricted,
          disabledReason: hideRestrictionReason,
        }]
      : [{ key: 'publish', label: 'Publish / Restore', icon: ArrowPathIcon, onClick: onPublish }]),
  ];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={clsx(
          'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
          open
            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
            : 'bg-white dark:bg-dark-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-600'
        )}
      >
        Actions
        <ChevronDownIcon className={clsx('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-50 w-56 bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden"
        >
          {actions.map(a => (
            <button
              key={a.key}
              type="button"
              disabled={a.disabled}
              title={a.disabled ? a.disabledReason : undefined}
              onClick={() => { if (a.disabled) return; setOpen(false); a.onClick(); }}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors',
                a.disabled
                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : a.key === 'hide'
                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700/60'
              )}
            >
              <a.icon className={clsx(
                'w-4 h-4',
                a.disabled ? 'text-gray-300 dark:text-gray-600' : a.key === 'hide' ? 'text-red-500' : 'text-gray-400'
              )} />
              <span>{a.label}</span>
              {a.disabled && (
                <LockClosedIcon className="w-3.5 h-3.5 ml-auto text-gray-300 dark:text-gray-600" />
              )}
            </button>
          ))}
          {hideRestricted && (
            <p className="px-3.5 py-2.5 text-[11px] leading-snug text-amber-600 dark:text-amber-400 border-t border-gray-100 dark:border-gray-700">
              {hideRestrictionReason}
            </p>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function ActivityItem({ icon: Icon, title, when, detail }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="w-7 h-7 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary-600 dark:text-primary-300" />
        </span>
        <span className="w-px flex-1 bg-gray-100 dark:bg-gray-700 my-1" />
      </div>
      <div className="pb-5 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
        {detail && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{detail}</p>}
        {when && <p className="text-xs text-gray-400 mt-0.5">{when}</p>}
      </div>
    </div>
  );
}

function JobDetailsModal({ job, initialTab = 'review', onClose, moderating, onModerate }) {
  const [tab, setTab] = useState(initialTab);
  const [confirmAction, setConfirmAction] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const safeDate = (d) => (d && !isNaN(new Date(d)) ? new Date(d) : null);
  const createdAt = safeDate(job?.createdAt);
  const updatedAt = safeDate(job?.updatedAt);

  const hideRestricted = job?.isApproved && job?.canHide === false;
  const hideRestrictionReason = job?.hideRestrictionReason
    || 'This job can no longer be hidden because a freelancer has been hired or work is already under way.';

  return (
    <Modal open onClose={onClose} title="Job Details" size="lg">
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge status={job.status}>{STATUS_LABELS[job.status] || job.status}</Badge>
            {job.isApproved
              ? <Badge status="approved">Approved</Badge>
              : <Badge status={job.rejectionReason ? 'rejected' : 'pending'}>{job.rejectionReason ? 'Hidden' : 'Needs Review'}</Badge>}
            {job.isUrgent && <Badge status="urgent">Urgent</Badge>}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-snug">{job.title}</h3>
          {createdAt && <p className="text-xs text-gray-400 mt-1">Posted {formatDistanceToNow(createdAt, { addSuffix: true })}</p>}
        </div>

        <div className="flex gap-1 border-b border-gray-100 dark:border-gray-700">
          {MODAL_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.key
                  ? 'border-primary-500 text-primary-600 dark:text-primary-300'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'review' && (
          <div className="space-y-4">
            <div className={clsx(
              'rounded-xl p-4 border',
              job.isApproved
                ? 'bg-green-50/60 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                : 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
            )}>
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                {job.isApproved
                  ? <><CheckCircleIcon className="w-4 h-4 text-green-600" /> Job is published and visible in the marketplace</>
                  : <><XCircleIcon className="w-4 h-4 text-amber-600" /> Job is hidden from the marketplace</>}
              </p>
              {!job.isApproved && job.rejectionReason && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Reason: {job.rejectionReason}
                </p>
              )}
            </div>

            {!confirmAction ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  {job.isApproved ? (
                    <button
                      type="button"
                      onClick={() => { if (hideRestricted) return; setReasonError(''); setReason(''); setConfirmAction('hide'); }}
                      disabled={moderating || hideRestricted}
                      title={hideRestricted ? hideRestrictionReason : undefined}
                      className={clsx('btn btn-danger', hideRestricted && 'opacity-50 cursor-not-allowed')}
                    >
                      {hideRestricted
                        ? <LockClosedIcon className="w-4 h-4 mr-1.5" />
                        : <XCircleIcon className="w-4 h-4 mr-1.5" />} Hide / Unpublish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmAction('publish')}
                      disabled={moderating}
                      className="btn btn-primary"
                    >
                      <ArrowPathIcon className="w-4 h-4 mr-1.5" /> Publish / Restore
                    </button>
                  )}
                  <button onClick={onClose} className="btn-secondary">Close</button>
                </div>
                {job.isApproved && hideRestricted && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <LockClosedIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{hideRestrictionReason}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-dark-700/40 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {confirmAction === 'hide' ? 'Hide this job?' : 'Publish this job?'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {confirmAction === 'hide'
                    ? 'This will remove the job from the public marketplace until you publish it again.'
                    : 'This will restore the job to the public marketplace.'}
                </p>
                {confirmAction === 'hide' && (
                  <div>
                    <Textarea
                      label="Reason (required)"
                      rows={3}
                      placeholder="Explain why this job is being hidden…"
                      value={reason}
                      onChange={(e) => { setReason(e.target.value); setReasonError(''); }}
                    />
                    {reasonError && <p className="text-xs text-red-500 mt-1">{reasonError}</p>}
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setConfirmAction(null); setReason(''); setReasonError(''); }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmAction === 'hide' && !reason.trim()) {
                        setReasonError('Please provide a reason.');
                        return;
                      }
                      onModerate(job, confirmAction === 'hide'
                        ? { isApproved: false, rejectionReason: reason.trim() }
                        : { isApproved: true });
                      setConfirmAction(null);
                      setReason('');
                      setReasonError('');
                    }}
                    disabled={moderating}
                    className={clsx('btn', confirmAction === 'hide' ? 'btn-danger' : 'btn-primary')}
                  >
                    {moderating ? 'Processing…' : (confirmAction === 'hide' ? 'Hide Job' : 'Publish Job')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <div>
            <ActivityItem icon={TagIcon} title={`Job posted as "${STATUS_LABELS[job.status] || job.status}"`}
              when={createdAt ? format(createdAt, 'MMM d, yyyy · HH:mm') : null} />
            <ActivityItem icon={job.isApproved ? CheckCircleIcon : XCircleIcon}
              title={job.isApproved ? 'Moderation: Approved' : `Moderation: ${job.rejectionReason ? 'Hidden' : 'Needs Review'}`}
              detail={job.isApproved ? 'Published in the public marketplace' : (job.rejectionReason || 'Awaiting admin review')}
              when={updatedAt ? `Last updated ${formatDistanceToNow(updatedAt, { addSuffix: true })}` : null} />
            <ActivityItem icon={UsersIcon} title={`${job.applicationsCount ?? 0} proposals received`}
              when={job.hiredFreelancer?.firstName
                ? `Freelancer selected · ${job.hiredFreelancer.firstName} ${job.hiredFreelancer.lastName || ''}`.trim()
                : null} />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function AdminJobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const q = searchParams.get('q') ?? '';
  const approval = searchParams.get('approval') ?? 'all';
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState(q);
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState('');

  useEffect(() => setSearchInput(q), [q]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === q) return;
      const params = new URLSearchParams(searchParams);
      if (searchInput) params.set('q', searchInput);
      else params.delete('q');
      params.set('page', '1');
      setSearchParams(params);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'jobs', { page, status, q, approval }],
    queryFn: () => adminService.getJobs({
      page,
      limit: 15,
      status: status || undefined,
      search: q || undefined,
      isApproved: approval === 'all' ? undefined : approval === 'approved',
    }).then(r => r.data),
  });
  const jobs = data?.data ?? [];
  const meta = data?.meta;

  const detailId = viewing?.job?._id;
  const { data: detailData } = useQuery({
    queryKey: ['admin', 'job', detailId],
    queryFn: () => adminService.getJob(detailId).then(r => r.data),
    enabled: !!detailId,
    staleTime: 30_000,
  });
  const detailJob = detailData?.data || viewing?.job;

  const { mutate: moderate, isPending: moderating } = useMutation({
    mutationFn: ({ id, data }) => adminService.moderateJob(id, data),
    onSuccess: (resp, { id }) => {
      const updated = resp?.data?.data;
      toast.success(updated?.isApproved
        ? 'Job published and visible in the marketplace'
        : 'Job hidden from the marketplace');
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['admin', 'job', id] });
      qc.setQueryData(['admin', 'job', id], (old) =>
        old ? { ...old, data: { ...old.data, ...updated } } : old
      );
      if (updated && viewing?.job?._id === id) {
        setViewing(v => (v ? { ...v, job: { ...v.job, ...updated } } : v));
      }
    },
    onError: e => toast.error(e.response?.data?.message || 'Moderation failed'),
  });

  const setFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    setSearchParams(params);
  };

  const requestHide = (job) => { setReason(''); setConfirm({ type: 'hide', job }); };
  const requestPublish = (job) => setConfirm({ type: 'publish', job });
  const openModal = (job, tab) => setViewing({ job, tab });
  const handleModerate = (job, payload) => moderate({ id: job._id, data: payload });

  const confirmHide = () => {
    if (!reason.trim()) { toast.error('Please provide a reason'); return; }
    moderate({ id: confirm.job._id, data: { isApproved: false, rejectionReason: reason.trim() } });
    setConfirm(null);
  };
  const confirmPublish = () => {
    moderate({ id: confirm.job._id, data: { isApproved: true } });
    setConfirm(null);
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader icon={BriefcaseIcon} title="Manage Jobs" subtitle="Review and moderate job listings" />

      <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-dark-800 rounded-xl p-3 shadow-sm">
        <div className="flex-1 min-w-56">
          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
            <MagnifyingGlassIcon className="w-3 h-3 inline mr-1" />Search
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title, description or skill…"
              className="input pl-9 text-sm w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="input text-sm w-48"
          >
            <option value="">All Statuses</option>
            {JOB_STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s] || s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Moderation</label>
          <select
            value={approval}
            onChange={(e) => setFilter('approval', e.target.value)}
            className="input text-sm w-48"
          >
            {APPROVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {(status || q || approval !== 'all') && (
          <button
            onClick={() => { setFilter('status', ''); setFilter('q', ''); setFilter('approval', 'all'); setSearchInput(''); }}
            className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing <span className="font-semibold text-gray-900 dark:text-white">{jobs.length}</span> of{' '}
        <span className="font-semibold text-gray-900 dark:text-white">{meta?.total ?? 0}</span> job(s)
        {status && <> with status <Badge status={status}>{STATUS_LABELS[status] || status}</Badge></>}
        {approval !== 'all' && <> · {APPROVAL_OPTIONS.find(o => o.value === approval)?.label.toLowerCase()}</>}
        {q && <> · matching “{q}”</>}
      </p>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : jobs.length === 0 ? (
          <EmptyState icon={BriefcaseIcon} title="No jobs found"
            description={status || q || approval !== 'all'
              ? 'No jobs matched your filters. Try clearing them.'
              : 'Jobs will appear here once users start posting.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  {['Job', 'Client', 'Budget', 'Proposals', 'Posted', 'Status', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                    <td>
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-52">{job.title}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {job.isApproved
                          ? <Badge status="approved">Approved</Badge>
                          : <Badge status={job.rejectionReason ? 'rejected' : 'pending'}>{job.rejectionReason ? 'Hidden' : 'Needs Review'}</Badge>}
                        {job.isUrgent && <Badge status="urgent">Urgent</Badge>}
                      </div>
                    </td>
                    <td className="text-sm text-gray-600 dark:text-gray-300">
                      {job.client?.firstName} {job.client?.lastName || '—'}
                    </td>
                    <td className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      {formatCurrencyRange(job.budget?.minAmount, job.budget?.maxAmount, job.budget?.currency)}
                    </td>
                    <td className="text-sm text-gray-600 dark:text-gray-300">{job.applicationsCount ?? 0}</td>
                    <td className="text-xs text-gray-400 whitespace-nowrap">
                      {job.createdAt && !isNaN(new Date(job.createdAt))
                        ? formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })
                        : '—'}
                    </td>
                    <td><Badge status={job.status}>{STATUS_LABELS[job.status] || job.status}</Badge></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link to={`/admin/jobs/${job._id}`} className="btn-icon btn-ghost" title="Open detail page">
                          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        </Link>
                        <ActionsMenu
                          job={job}
                          onReview={() => openModal(job, 'review')}
                          onViewActivity={() => openModal(job, 'activity')}
                          onPublish={() => requestPublish(job)}
                          onHide={() => requestHide(job)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <Pagination meta={meta} onPageChange={(p) => setFilter('page', String(p))} />
        </div>
      </div>

      {viewing && (
        <JobDetailsModal
          job={detailJob}
          initialTab={viewing.tab}
          onClose={() => setViewing(null)}
          moderating={moderating}
          onModerate={handleModerate}
        />
      )}

      <ConfirmModal
        open={confirm?.type === 'hide'}
        onClose={() => setConfirm(null)}
        title="Hide Job?"
        message="This will remove the job from the public marketplace until you publish it again."
        confirmLabel="Hide Job"
        danger
        loading={moderating}
        onConfirm={confirmHide}
      >
        <Textarea
          label="Reason"
          rows={3}
          placeholder="Explain why this job is being hidden…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmModal>

      <ConfirmModal
        open={confirm?.type === 'publish'}
        onClose={() => setConfirm(null)}
        title="Publish Job?"
        message="This will restore the job to the public marketplace."
        confirmLabel="Publish"
        loading={moderating}
        onConfirm={confirmPublish}
      />
    </div>
  );
}
