import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { adminService } from '@/services/admin.service';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Avatar from '@/components/ui/Avatar';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import {
  ClipboardDocumentListIcon, ChevronDownIcon, CheckIcon, EyeIcon,
  DocumentTextIcon, BanknotesIcon, ClockIcon, XMarkIcon,
  ArrowTopRightOnSquareIcon, ListBulletIcon, ShieldCheckIcon,
  CheckCircleIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';
import { format } from 'date-fns';
import { clsx } from 'clsx';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'pending_delivery', label: 'Pending Delivery' },
  { value: 'in_revision', label: 'In Revision' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'disputed', label: 'Disputed' },
];

const MODAL_TABS = [
  { key: 'overview', label: 'Overview', icon: EyeIcon },
  { key: 'contract', label: 'Contract', icon: DocumentTextIcon },
  { key: 'work', label: 'Work & Deliveries', icon: ListBulletIcon },
  { key: 'activity', label: 'Activity', icon: ClockIcon },
];

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = STATUS_OPTIONS.find(o => o.value === value) || STATUS_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative w-64">
      <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
        Status <ChevronDownIcon className="w-3 h-3 inline" />
      </label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'input flex items-center justify-between gap-2 text-sm w-full',
          open && 'border-primary-500 ring-2 ring-primary-500/20'
        )}
      >
        <span className={clsx(selected.value ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500')}>
          {selected.label}
        </span>
        <span className="flex items-center gap-1.5">
          {selected.value && <CheckIcon className="w-4 h-4 text-primary-600" />}
          <ChevronDownIcon className={clsx('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 mt-1.5 w-full bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden max-h-72 overflow-y-auto"
          >
            {STATUS_OPTIONS.map(opt => {
              const active = value === opt.value;
              return (
                <li key={opt.value || 'all'}>
                  <button
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={clsx(
                      'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-left transition-colors',
                      active
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700/60'
                    )}
                  >
                    <span>{opt.label}</span>
                    {active && <CheckIcon className="w-4 h-4 text-primary-600" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionsMenu({ project, onViewDetails, onReview, onViewActivity }) {
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

  const actions = [
    { key: 'details', label: 'View Details', icon: EyeIcon, onClick: onViewDetails },
    { key: 'review', label: 'Review', icon: ShieldCheckIcon, onClick: onReview },
    { key: 'contract', label: 'View Contract', icon: DocumentTextIcon, to: `/projects/${project._id}` },
    { key: 'milestones', label: 'View Milestones', icon: ListBulletIcon, to: `/projects/${project._id}/milestones` },
    { key: 'payment', label: 'View Payment/Escrow', icon: BanknotesIcon, to: '/admin/finance/escrow' },
    { key: 'activity', label: 'View Activity', icon: ClockIcon, onClick: onViewActivity },
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
            a.to ? (
              <Link
                key={a.key}
                to={a.to}
                target={a.to.startsWith('http') ? '_blank' : undefined}
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700/60 transition-colors"
              >
                <a.icon className="w-4 h-4 text-gray-400" />
                <span>{a.label}</span>
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 ml-auto text-gray-300" />
              </Link>
            ) : (
              <button
                key={a.key}
                type="button"
                onClick={() => { setOpen(false); a.onClick(); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700/60 transition-colors"
              >
                <a.icon className="w-4 h-4 text-gray-400" />
                <span>{a.label}</span>
              </button>
            )
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

function isOverdue(project) {
  if (project.status !== 'active') return false;
  if (!project.timeline?.deadline) return false;
  return new Date(project.timeline.deadline) < new Date();
}

function Field({ label, value }) {  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-900 dark:text-gray-200 mt-0.5">{value ?? '—'}</p>
    </div>
  );
}

function ModalSection({ icon: Icon, title, children }) {
  if (!children) return null;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        <Icon className="w-4 h-4" /> {title}
      </p>
      {children}
    </div>
  );
}

function ProjectDetailsModal({ project, initialTab = 'overview', onClose }) {
  const [tab, setTab] = useState(initialTab);

  const agreed = project.budget?.agreedAmount ?? 0;
  const paid = project.budget?.paidAmount ?? 0;
  const currency = project.budget?.currency || 'ETB';
  const overdue = project.status === 'active' && project.timeline?.deadline && new Date(project.timeline.deadline) < new Date();

  const activityEvents = [
    { time: project.createdAt, title: 'Project created', desc: `Status set to ${project.status.replace('_', ' ')}` },
    { time: project.timeline?.completedAt, title: 'Project completed', desc: 'Marked as completed' },
    { time: project.dispute?.raisedAt, title: 'Dispute raised', desc: project.dispute?.reason || 'A dispute was raised' },
    ...(project.deliveries || []).map(d => ({
      time: d.submittedAt,
      title: 'Delivery submitted',
      desc: d.status === 'approved' ? 'Delivery approved' : d.status === 'revision_requested' ? 'Revision requested' : 'Delivery pending review',
    })),
    { time: project.updatedAt, title: 'Last updated', desc: 'Project record was modified' },
  ].filter(e => e.time).sort((a, b) => new Date(b.time) - new Date(a.time));

  const isTab = t => tab === t;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 12 }}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between gap-3 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
              <ClipboardDocumentListIcon className="w-5 h-5 text-primary-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{project.title}</h3>
              <p className="text-xs text-gray-400">
                {project.client?.firstName} {project.client?.lastName} • {project.freelancer?.firstName} {project.freelancer?.lastName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge status={project.status} />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 flex gap-1 flex-wrap border-b border-gray-100 dark:border-gray-700">
          {MODAL_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                isTab(t.key)
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6">
          {isTab('overview') && (
            <>
              <ModalSection icon={EyeIcon} title="Project Summary">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Project Title" value={project.title} />
                  <Field label="Status" value={project.status.replace('_', ' ')} />
                  <Field label="Progress" value={`${project.progress ?? 0}%`} />
                  <Field label="Amount" value={formatCurrency(agreed, currency)} />
                  <Field label="Paid" value={formatCurrency(paid, currency)} />
                  <Field label="Currency" value={currency} />
                </div>
              </ModalSection>
              <ModalSection icon={EyeIcon} title="Parties">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-dark-900">
                    <Avatar src={project.client?.avatar?.url} alt={project.client?.firstName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Client</p>
                      <p className="text-xs text-gray-400 truncate">{project.client?.firstName} {project.client?.lastName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-dark-900">
                    <Avatar src={project.freelancer?.avatar?.url} alt={project.freelancer?.firstName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Freelancer</p>
                      <p className="text-xs text-gray-400 truncate">{project.freelancer?.firstName} {project.freelancer?.lastName}</p>
                    </div>
                  </div>
                </div>
              </ModalSection>
              <ModalSection icon={ClockIcon} title="Timeline">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Started" value={project.timeline?.startDate ? format(new Date(project.timeline.startDate), 'MMM d, yyyy') : null} />
                  <Field label="Deadline" value={project.timeline?.deadline ? format(new Date(project.timeline.deadline), 'MMM d, yyyy') : null} />
                  <Field label="Completed" value={project.timeline?.completedAt ? format(new Date(project.timeline.completedAt), 'MMM d, yyyy') : null} />
                </div>
                {overdue && (
                  <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5" /> Project is overdue
                  </p>
                )}
              </ModalSection>
              {project.description && (
                <ModalSection icon={DocumentTextIcon} title="Description">
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{project.description}</p>
                </ModalSection>
              )}
            </>
          )}

          {isTab('contract') && (
            <>
              <ModalSection icon={DocumentTextIcon} title="Contract Details">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Job" value={project.job?.title} />
                  <Field label="Agreed Amount" value={formatCurrency(agreed, currency)} />
                  <Field label="Paid Amount" value={formatCurrency(paid, currency)} />
                  <Field label="Currency" value={currency} />
                  <Field label="Revisions" value={project.revisionsAllowed != null ? `${project.revisionsUsed ?? 0} of ${project.revisionsAllowed} used` : null} />
                  <Field label="Escrow Ref" value={project.escrowPaymentId ? String(project.escrowPaymentId) : null} />
                </div>
              </ModalSection>
              <ModalSection icon={DocumentTextIcon} title="Notes">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Client Notes" value={project.clientNotes} />
                  <Field label="Freelancer Notes" value={project.freelancerNotes} />
                </div>
              </ModalSection>
              {project.dispute?.isDisputed && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">Dispute Active</p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{project.dispute.reason}</p>
                  {project.dispute.raisedAt && (
                    <p className="text-[10px] text-red-500/80 mt-1">{format(new Date(project.dispute.raisedAt), 'MMM d, yyyy h:mm a')}</p>
                  )}
                </div>
              )}
            </>
          )}

          {isTab('work') && (
            <>
              <ModalSection icon={ListBulletIcon} title={`Tasks (${(project.tasks || []).length})`}>
                {(project.tasks || []).length === 0 ? (
                  <p className="text-sm text-gray-400">No tasks created yet.</p>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700">
                    {project.tasks.map((task, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{task.title}</p>
                          <p className="text-xs text-gray-400 capitalize">{task.priority} priority</p>
                        </div>
                        <Badge status={task.status} />
                      </div>
                    ))}
                  </div>
                )}
              </ModalSection>
              <ModalSection icon={BanknotesIcon} title={`Deliveries (${(project.deliveries || []).length})`}>
                {(project.deliveries || []).length === 0 ? (
                  <p className="text-sm text-gray-400">No deliveries submitted yet.</p>
                ) : (
                  <div className="space-y-2">
                    {project.deliveries.map((d, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-dark-900">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{d.message}</p>
                          <p className="text-xs text-gray-400">
                            {d.submittedAt ? format(new Date(d.submittedAt), 'MMM d, yyyy h:mm a') : ''}
                            {d.files?.length ? ` • ${d.files.length} file(s)` : ''}
                          </p>
                        </div>
                        <Badge status={d.status === 'approved' ? 'accepted' : d.status === 'revision_requested' ? 'revision_requested' : 'pending'} />
                      </div>
                    ))}
                  </div>
                )}
              </ModalSection>
            </>
          )}

          {isTab('activity') && (
            <ModalSection icon={ClockIcon} title="Activity Timeline">
              {activityEvents.length === 0 ? (
                <p className="text-sm text-gray-400">No activity recorded.</p>
              ) : (
                <div className="relative pl-6 space-y-5">
                  <div className="absolute left-[10px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />
                  {activityEvents.map((e, i) => (
                    <div key={i} className="relative">
                      <span className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <CheckCircleIcon className="w-3 h-3 text-gray-500 dark:text-gray-300" />
                      </span>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{e.title}</p>
                      {e.desc && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{e.desc}</p>}
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(e.time).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </ModalSection>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-dark-800 border-t border-gray-100 dark:border-gray-700 px-6 py-4 flex justify-between items-center gap-3">
          <div className="text-xs text-gray-400">
            Created {project.createdAt ? format(new Date(project.createdAt), 'MMM d, yyyy') : '—'}
          </div>
          <div className="flex gap-2">
            <Link
              to={`/projects/${project._id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Open Workspace <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </Link>
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AdminProjects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const [viewing, setViewing] = useState(null);
  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

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
    queryKey: ['admin', 'projects', { page, status, q }],
    queryFn: () => adminService.getProjects({ page, limit: 15, status: status || undefined, search: q || undefined }).then(r => r.data),
  });
  const projects = data?.data ?? [];
  const meta = data?.meta;

  const setFilter = (nextStatus) => {
    const params = new URLSearchParams(searchParams);
    if (nextStatus) params.set('status', nextStatus);
    else params.delete('status');
    params.set('page', '1');
    setSearchParams(params);
  };
  const setPage = (next) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(next));
    setSearchParams(params);
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader icon={ClipboardDocumentListIcon} title="Project Management" subtitle="Review and manage all platform projects by status" />

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
              placeholder="Search by project title…"
              className="input pl-9 text-sm w-full"
            />
          </div>
        </div>
        <StatusDropdown value={status} onChange={setFilter} />
        {(status || q) && (
          <button
            onClick={() => { setFilter(''); setSearchInput(''); }}
            className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing <span className="font-semibold text-gray-900 dark:text-white">{projects.length}</span> of{' '}
        <span className="font-semibold text-gray-900 dark:text-white">{meta?.total ?? 0}</span> project(s)
        {status && <> with status <Badge status={status} /></>}
        {q && <> matching “{q}”</>}
      </p>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : projects.length === 0 ? (
          <EmptyState icon={ClipboardDocumentListIcon} title="No projects found"
            description={status || q
              ? 'No projects matched your filters. Try clearing them.'
              : 'Projects will appear here once clients and freelancers start working together.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  {['Project', 'Client', 'Freelancer', 'Amount', 'Due', 'Progress', 'Status', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map(project => (
                  <tr key={project._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                    <td>
                      <p className="font-medium text-sm text-gray-900 dark:text-white">{project.title}</p>
                      {project.job?.title && project.job.title !== project.title && (
                        <p className="text-xs text-gray-400 truncate max-w-48">{project.job.title}</p>
                      )}
                    </td>
                    <td className="text-sm text-gray-600 dark:text-gray-300">
                      {project.client?.firstName} {project.client?.lastName || '—'}
                    </td>
                    <td className="text-sm text-gray-600 dark:text-gray-300">
                      {project.freelancer?.firstName} {project.freelancer?.lastName || '—'}
                    </td>
                    <td className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(project.budget?.agreedAmount, project.budget?.currency)}
                    </td>
                    <td className="text-xs whitespace-nowrap">
                      {project.timeline?.deadline ? (
                        <span className={clsx(isOverdue(project) && 'text-red-600 dark:text-red-400 font-medium')}>
                          {format(new Date(project.timeline.deadline), 'MMM d, yyyy')}
                        </span>
                      ) : '—'}
                      {isOverdue(project) && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase">
                          <ClockIcon className="w-3 h-3" /> Overdue
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2 min-w-24">
                        <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(project.progress ?? 0, 100)}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-primary-600">{project.progress ?? 0}%</span>
                      </div>
                    </td>
                    <td><Badge status={project.status} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewing({ project, tab: 'overview' })}
                          className="btn-icon btn-ghost" title="View Details"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <ActionsMenu
                          project={project}
                          onViewDetails={() => setViewing({ project, tab: 'overview' })}
                          onReview={() => setViewing({ project, tab: 'overview' })}
                          onViewActivity={() => setViewing({ project, tab: 'activity' })}
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
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      </div>

      <AnimatePresence>
        {viewing && (
          <ProjectDetailsModal
            project={viewing.project}
            initialTab={viewing.tab}
            onClose={() => setViewing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
