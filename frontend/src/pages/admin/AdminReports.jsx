import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminService } from '@/services/admin.service';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Avatar from '@/components/ui/Avatar';
import { SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/currency';
import { format, formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import {
  FlagIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  EyeIcon,
  CheckCircleIcon,
  ShieldExclamationIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserMinusIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  BanknotesIcon,
  ArrowPathIcon,
  ScaleIcon,
  UserIcon,
  DocumentTextIcon,
  FunnelIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

// ─── Labels & helpers ─────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['pending', 'under_review', 'resolved', 'dismissed'];

const TYPE_LABELS = {
  catalog: 'Service',
  user: 'User',
  job: 'Job',
  review: 'Review',
  message: 'Message',
  project: 'Project',
};

const TYPE_BADGES = {
  catalog: 'badge-primary',
  user: 'badge-success',
  job: 'badge-warning',
  review: 'badge-primary',
  message: 'badge-gray',
  project: 'badge-gray',
};

const REASON_LABELS = {
  spam: 'Spam',
  fake_account: 'Fake account',
  inappropriate_content: 'Inappropriate content',
  harassment: 'Harassment',
  scam: 'Scam',
  copyright_violation: 'Copyright violation',
  false_information: 'False information',
  other: 'Other',
};

const PRIORITY_META = {
  low: { label: 'Low', dot: 'bg-gray-400', text: 'text-gray-500', badge: 'badge-gray' },
  medium: { label: 'Medium', dot: 'bg-yellow-400', text: 'text-yellow-600 dark:text-yellow-400', badge: 'badge-warning' },
  high: { label: 'High', dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', badge: 'badge-info' },
  urgent: { label: 'Urgent', dot: 'bg-red-500 animate-pulse', text: 'text-red-600 dark:text-red-400', badge: 'badge-danger' },
  critical: { label: 'Critical', dot: 'bg-red-600 animate-pulse', text: 'text-red-700 dark:text-red-500', badge: 'badge-danger' },
};

const ACTION_LABELS = {
  no_action: 'No Action',
  warning: 'Warning Issued',
  content_removed: 'Content Removed',
  account_suspended: 'Account Suspended',
  account_banned: 'Account Banned',
};

const HISTORY_LABELS = {
  created: 'Report created',
  status_changed: 'Status changed',
  priority_changed: 'Priority changed',
  assigned: 'Assignee changed',
  note_added: 'Internal note added',
  investigation_updated: 'Investigation updated',
  resolved: 'Report resolved',
  dismissed: 'Report dismissed',
  reopened: 'Report reopened',
  action_taken: 'Action taken',
};

const HUMAN_TYPE = { catalog: 'Service', user: 'User', job: 'Job', review: 'Review', message: 'Message', project: 'Project' };

const shortId = (id) => (id ? `#${String(id).slice(-8).toUpperCase()}` : '—');
const typeLabel = (r) => TYPE_LABELS[r?.resourceType] || r?.resourceType || '—';
const reasonLabel = (r) => REASON_LABELS[r?.reason] || r?.reason?.replace(/_/g, ' ') || '—';
const fullName = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—' : '—');
const fmtDate = (d) => (d ? format(new Date(d), 'MMM d, yyyy h:mm a') : '—');
const fmtRel = (d) => (d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '—');
const isUrgentPriority = (p) => p === 'urgent' || p === 'critical';

function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span className={`badge ${meta.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, tone = 'primary', to }) {
  const tones = {
    primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300',
    success: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-300',
    danger: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300',
    info: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-300',
    gray: 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300',
  };
  const body = (
    <div className="stat-card hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className={clsx('flex h-9 w-9 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        {to && <ChevronRightIcon className="h-4 w-4 text-gray-300 dark:text-gray-600" />}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

function Section({ icon: Icon, title, children, right, className }) {
  return (
    <section className={clsx('card p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          {Icon && <Icon className="w-4 h-4 text-primary-500" />}
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, mono, capitalize }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className={clsx('mt-1 text-sm text-gray-900 dark:text-white break-words', mono && 'font-mono text-xs', capitalize && 'capitalize')}>
        {value ?? '—'}
      </dd>
    </div>
  );
}

function UserBadge({ user, sub }) {
  if (!user) return <p className="text-sm text-gray-500 dark:text-gray-400">Not linked</p>;
  return (
    <div className="flex items-center gap-3">
      <Avatar src={user.avatar?.url} alt={fullName(user)} size="md" />
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          {fullName(user)}
          {user.isBanned && <span className="badge badge-danger">Banned</span>}
          {!user.isActive && !user.isBanned && <span className="badge badge-gray">Inactive</span>}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email || sub}</p>
        <p className="text-xs text-gray-400 capitalize">{user.role || ''}</p>
      </div>
    </div>
  );
}

// ─── Reported content views ────────────────────────────────────────────────────

function ResourceView({ report, onAction }) {
  const type = report?.resourceType;
  const resource = report?.resource?.data || null;

  if (!resource) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-dark-700/60 p-4 text-sm text-gray-500 dark:text-gray-400">
        <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-amber-500" />
        This {HUMAN_TYPE[type] || type} no longer exists or could not be loaded.
      </div>
    );
  }

  if (type === 'catalog') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-gray-900 dark:text-white">{resource.title}</span>
          <Badge status={resource.status} />
          {resource.isFeatured && <span className="badge badge-primary">Featured</span>}
          {!resource.isActive && <span className="badge badge-gray">Hidden</span>}
        </div>
        <Field label="Category" value={resource.category?.name || '—'} />
        <Field label="Starting price" value={resource.startingPrice ? formatCurrency(resource.startingPrice) : '—'} />
        <Field label="Orders" value={resource.stats?.orders ?? 0} />
        <Field label="Rating" value={resource.stats?.avgRating ? `${resource.stats.avgRating.toFixed(1)} ★` : '—'} />
        <Field label="Owner" value={fullName(resource.freelancer)} />
        <Field label="Created" value={fmtDate(resource.createdAt)} />
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Description</dt>
          <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-4">{resource.description || '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Moderation actions</h4>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => onAction?.('catalog', 'dismiss')}>
              <XMarkIcon className="w-4 h-4 mr-1" /> Dismiss
            </Button>
            <Button variant="outline" size="sm" onClick={() => onAction?.('catalog', 'warn')}>
              <ChatBubbleLeftRightIcon className="w-4 h-4 mr-1" /> Warn
            </Button>
            <Button variant="outline" size="sm" className="text-amber-600" onClick={() => onAction?.('catalog', 'remove')}>
              <TrashIcon className="w-4 h-4 mr-1" /> Remove
            </Button>
            <Button variant="outline" size="sm" className="text-red-600" onClick={() => onAction?.('catalog', 'suspend')}>
              <UserMinusIcon className="w-4 h-4 mr-1" /> Suspend
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'job') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-gray-900 dark:text-white">{resource.title}</span>
          <Badge status={resource.status} />
          {resource.isApproved
            ? <span className="badge badge-success">Approved</span>
            : <span className="badge badge-danger">Rejected</span>}
        </div>
        <Field label="Budget" value={resource.budget?.maxAmount ? formatCurrency(resource.budget.maxAmount, resource.budget.currency) : '—'} />
        <Field label="Budget type" value={resource.budget?.type || '—'} capitalize />
        <Field label="Client" value={fullName(resource.client)} />
        <Field label="Experience" value={resource.experienceLevel || '—'} capitalize />
        <Field label="Deadline" value={fmtDate(resource.deadline)} />
        <Field label="Created" value={fmtDate(resource.createdAt)} />
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Description</dt>
          <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-4">{resource.description || '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Moderation actions</h4>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="text-red-600" onClick={() => onAction?.('job', 'reject')}>
              <XMarkIcon className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button size="sm" onClick={() => onAction?.('job', 'approve')}>
              <CheckCircleIcon className="w-4 h-4 mr-1" /> Approve
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'project') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-gray-900 dark:text-white">{resource.title}</span>
          <Badge status={resource.status} />
        </div>
        <Field label="Client" value={fullName(resource.client)} />
        <Field label="Freelancer" value={fullName(resource.freelancer)} />
        <Field label="Agreed amount" value={resource.budget?.agreedAmount ? formatCurrency(resource.budget.agreedAmount, resource.budget.currency) : '—'} />
        <Field label="Paid" value={resource.budget?.paidAmount ? formatCurrency(resource.budget.paidAmount, resource.budget.currency) : '—'} />
        <Field label="Progress" value={resource.progress != null ? `${resource.progress}%` : '—'} />
        <Field label="Deadline" value={fmtDate(resource.timeline?.deadline)} />
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Description</dt>
          <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-4">{resource.description || '—'}</dd>
        </div>
      </div>
    );
  }

  if (type === 'user') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="sm:col-span-2"><UserBadge user={resource} /></div>
        <Field label="Role" value={resource.role} capitalize />
        <Field label="Email verified" value={resource.isEmailVerified ? 'Yes' : 'No'} />
        <Field label="Member since" value={fmtDate(resource.createdAt)} />
        <Field label="Freelancer verified" value={resource.isVerifiedFreelancer ? 'Yes' : 'No'} />
        {resource.banReason && <Field label="Ban reason" value={resource.banReason} />}
      </div>
    );
  }

  if (type === 'message') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <Field label="Sender" value={fullName(resource.sender)} />
        <Field label="Message type" value={resource.messageType} capitalize />
        <Field label="Sent" value={fmtDate(resource.createdAt)} />
        <Field label="Edited" value={resource.isEdited ? 'Yes' : 'No'} />
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Content</dt>
          <dd className="mt-1 rounded-lg bg-gray-50 dark:bg-dark-700/60 p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {resource.content || '(no text content)'}
          </dd>
        </div>
      </div>
    );
  }

  if (type === 'review') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <Field label="Reviewer" value={fullName(resource.reviewer)} />
        <Field label="Reviewee" value={fullName(resource.reviewee)} />
        <Field label="Rating" value={resource.rating != null ? `${resource.rating} ★` : '—'} />
        <Field label="Public" value={resource.isPublic ? 'Yes' : 'No'} />
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Comment</dt>
          <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{resource.comment || '—'}</dd>
        </div>
      </div>
    );
  }

  return <p className="text-sm text-gray-500">Unsupported resource type.</p>;
}

function FinancialSection({ financial }) {
  if (!financial) return null;
  const { serviceOrders, escrows, payments, transactions } = financial;
  const empty = !serviceOrders?.length && !escrows?.length && !payments?.length && !transactions?.length;
  if (empty) {
    return (
      <Section icon={BanknotesIcon} title="Financial context">
        <p className="text-sm text-gray-500 dark:text-gray-400">No linked payments, escrows or transactions found for this item.</p>
      </Section>
    );
  }

  const Money = ({ row }) => (
    <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
      {formatCurrency(row.amount, row.currency)}
    </span>
  );

  return (
    <Section icon={BanknotesIcon} title="Financial context" className="space-y-4">
      {serviceOrders?.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Service orders ({serviceOrders.length})</h4>
          <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-dark-700 text-left text-[10px] uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-3 py-2">Order</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {serviceOrders.map((o) => (
                  <tr key={String(o._id)}>
                    <td className="px-3 py-2 font-mono text-gray-500">{o.orderNumber || shortId(o._id)}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{fullName(o.client)}</td>
                    <td className="px-3 py-2"><Money row={o.budget || { amount: o.budget?.amount, currency: o.budget?.currency }} /></td>
                    <td className="px-3 py-2"><Badge status={o.status} /></td>
                    <td className="px-3 py-2 text-gray-500">{fmtRel(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {escrows?.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Escrows ({escrows.length})</h4>
          <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-dark-700 text-left text-[10px] uppercase tracking-wide text-gray-400">
                <tr><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Freelancer</th><th className="px-3 py-2">Created</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {escrows.map((e) => (
                  <tr key={String(e._id)}>
                    <td className="px-3 py-2"><Money row={e} /></td>
                    <td className="px-3 py-2"><Badge status={e.status} /></td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{fullName(e.client)}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{fullName(e.freelancer)}</td>
                    <td className="px-3 py-2 text-gray-500">{fmtRel(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payments?.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Payments ({payments.length})</h4>
          <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-dark-700 text-left text-[10px] uppercase tracking-wide text-gray-400">
                <tr><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Provider</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Reference</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {payments.map((p) => (
                  <tr key={String(p._id)}>
                    <td className="px-3 py-2"><Money row={p} /></td>
                    <td className="px-3 py-2 capitalize text-gray-700 dark:text-gray-300">{p.type?.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.provider}</td>
                    <td className="px-3 py-2"><Badge status={p.status} /></td>
                    <td className="px-3 py-2 font-mono text-gray-500">{p.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {transactions?.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Transactions ({transactions.length})</h4>
          <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-dark-700 text-left text-[10px] uppercase tracking-wide text-gray-400">
                <tr><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Created</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {transactions.map((t) => (
                  <tr key={String(t._id)}>
                    <td className="px-3 py-2"><Money row={t} /></td>
                    <td className="px-3 py-2 capitalize text-gray-700 dark:text-gray-300">{t.type?.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2"><Badge status={t.status} /></td>
                    <td className="px-3 py-2 font-mono text-gray-500">{t.reference}</td>
                    <td className="px-3 py-2 text-gray-500">{fmtRel(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}

function ActivityTimeline({ history }) {
  if (!history?.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No activity recorded yet.</p>;
  }
  const sorted = [...history].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <ol className="space-y-4">
      {sorted.map((h, i) => {
        const detailText = h.details?.note || h.details?.to
          ? `→ ${h.details.to || ''}${h.details.note ? ` · ${h.details.note}` : ''}`
          : '';
        return (
          <li key={i} className="relative pl-5">
            {i < sorted.length - 1 && <span className="absolute left-1.5 top-4 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />}
            <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-primary-500 ring-4 ring-primary-500/20" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {HISTORY_LABELS[h.action] || h.action.replace(/_/g, ' ')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{fullName(h.admin)} · {fmtRel(h.createdAt)}</p>
            {detailText && <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 break-words">{detailText}</p>}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminReports() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [closeModal, setCloseModal] = useState(null); // { mode: 'resolve' | 'dismiss' }
  const [resourceAction, setResourceAction] = useState(null); // { kind, note }
  const [userAction, setUserAction] = useState(null); // { kind, reason }
  const [jobAction, setJobAction] = useState(null);

  const listKey = ['admin', 'reports', { page, status, type, priority, search }];

  const { data: statsData } = useQuery({
    queryKey: ['admin', 'reports', 'stats'],
    queryFn: () => adminService.getReportStats().then((r) => r.data),
  });
  const stats = statsData?.data || statsData;

  const { data: listData, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () =>
      adminService
        .getReports({ page, limit: 15, status: status || undefined, resourceType: type || undefined, priority: priority || undefined, search: search || undefined })
        .then((r) => r.data),
  });
  const reports = listData?.data ?? [];
  const meta = listData?.meta;

  // NOTE: the axios interceptor resolves with the full response, so `r.data` is
  // the standard API envelope { success, statusCode, message, data, meta }. The
  // report document itself lives at `r.data.data` — consuming the envelope
  // directly made every `detail.*` field undefined (Report ID/Resource ID
  // undefined, "Not linked" users, empty investigation/history, and the priority
  // badge/select disagreeing). Unwrap it here, mirroring the list/stats queries.
  const { data: detailEnvelope, isFetching: detailLoading, isError: detailError } = useQuery({
    queryKey: ['admin', 'reports', 'detail', selectedId],
    queryFn: () => adminService.getReportDetail(selectedId).then((r) => r.data),
    enabled: !!selectedId,
  });
  const detail = detailEnvelope?.data ?? null;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
    if (selectedId) qc.invalidateQueries({ queryKey: ['admin', 'reports', 'detail', selectedId] });
  };

  // ── Status / priority changes ───────────────────────────────────────────────
  const { mutate: changeStatus, isPending: statusPending } = useMutation({
    mutationFn: ({ id, data }) => adminService.updateReportStatus(id, data),
    onSuccess: (res) => {
      toast.success(res?.data?.message || 'Report updated');
      invalidateAll();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update report'),
  });

  const handlePriorityChange = (id, value) => {
    if (!id || !value) return;
    changeStatus({ id, data: { status: detail?.status || 'pending', priority: value } });
  };

  const submitClose = (values) => {
    const data = {
      status: closeModal.mode === 'resolve' ? 'resolved' : 'dismissed',
      resolutionReason: values.reason,
      action: values.action,
      notifyReporter: values.notifyReporter !== false,
    };
    changeStatus({ id: selectedId, data });
    setCloseModal(null);
  };

  // ── Internal note ───────────────────────────────────────────────────────────
  const [noteText, setNoteText] = useState('');
  const { mutate: addNote, isPending: notePending } = useMutation({
    mutationFn: (note) => adminService.addReportNote(selectedId, { note }),
    onSuccess: () => { toast.success('Note added'); setNoteText(''); qc.invalidateQueries({ queryKey: ['admin', 'reports', 'detail', selectedId] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add note'),
  });

  // ── Investigation form ──────────────────────────────────────────────────────
  const [investigation, setInvestigation] = useState({ rootCause: '', notes: '', recommendedResolution: '' });
  const syncInvestigation = (d) => {
    if (!d) return;
    setInvestigation({
      rootCause: d.investigation?.rootCause || '',
      notes: d.investigation?.notes || '',
      recommendedResolution: d.investigation?.recommendedResolution || '',
    });
  };

  useEffect(() => {
    syncInvestigation(detail);
  }, [detail]);
  const { mutate: saveInvestigation, isPending: investigationPending } = useMutation({
    mutationFn: () => adminService.updateReportInvestigation(selectedId, investigation),
    onSuccess: () => { toast.success('Investigation saved'); qc.invalidateQueries({ queryKey: ['admin', 'reports', 'detail', selectedId] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save investigation'),
  });

  // ── Resource actions ────────────────────────────────────────────────────────
  const { mutate: runResourceAction, isPending: resourcePending } = useMutation({
    mutationFn: ({ kind, note }) => {
      switch (kind) {
        case 'catalog-dismiss': return adminService.dismissReportedService(selectedId, note);
        case 'catalog-warn': return adminService.warnReportedFreelancer(selectedId, note);
        case 'catalog-remove': return adminService.removeReportedService(selectedId, note);
        case 'catalog-suspend': return adminService.suspendReportedFreelancer(selectedId, note);
        default: throw new Error('Unknown action');
      }
    },
    onSuccess: (res) => { toast.success(res?.data?.message || 'Action applied'); setResourceAction(null); invalidateAll(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Action failed'),
  });

  const { mutate: runUserAction, isPending: userPending } = useMutation({
    mutationFn: ({ userId, kind, reason }) => {
      if (kind === 'ban') return adminService.updateUser(userId, { isBanned: true, banReason: reason });
      if (kind === 'unban') return adminService.updateUser(userId, { isBanned: false });
      if (kind === 'deactivate') return adminService.updateUser(userId, { isActive: false });
      throw new Error('Unknown action');
    },
    onSuccess: () => { toast.success('Account updated'); setUserAction(null); invalidateAll(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Action failed'),
  });

  const { mutate: runJobAction, isPending: jobPending } = useMutation({
    mutationFn: ({ jobId, kind, reason }) => {
      if (kind === 'approve') return adminService.moderateJob(jobId, { isApproved: true });
      if (kind === 'reject') return adminService.moderateJob(jobId, { isApproved: false, rejectionReason: reason });
      throw new Error('Unknown action');
    },
    onSuccess: () => { toast.success('Job updated'); setJobAction(null); invalidateAll(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Action failed'),
  });

  const applyFilters = (e) => {
    e?.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };
  const clearFilters = () => {
    setSearchInput(''); setSearch(''); setStatus(''); setType(''); setPriority(''); setPage(1);
  };
  const hasFilters = Boolean(search || status || type || priority);

  const openDetail = (r) => {
    setSelectedId(r._id);
    setCloseModal(null);
    setResourceAction(null);
    setUserAction(null);
    setJobAction(null);
    setNoteText('');
    setInvestigation({
      rootCause: r.investigation?.rootCause || '',
      notes: r.investigation?.notes || '',
      recommendedResolution: r.investigation?.recommendedResolution || '',
    });
  };

  const statsCards = useMemo(() => [
    { icon: FlagIcon, label: 'Total reports', value: stats?.total ?? stats?.data?.total ?? 0, tone: 'primary' },
    { icon: ClockIcon, label: 'Pending', value: stats?.pending ?? stats?.data?.pending ?? 0, tone: 'warning' },
    { icon: ShieldExclamationIcon, label: 'Under review', value: stats?.under_review ?? stats?.data?.under_review ?? stats?.underReview ?? stats?.data?.underReview ?? 0, tone: 'info' },
    { icon: CheckCircleIcon, label: 'Resolved', value: stats?.resolved ?? stats?.data?.resolved ?? 0, tone: 'success' },
    { icon: XMarkIcon, label: 'Dismissed', value: stats?.dismissed ?? stats?.data?.dismissed ?? 0, tone: 'gray' },
    { icon: ExclamationTriangleIcon, label: 'Urgent', value: stats?.urgent ?? stats?.data?.urgent ?? 0, tone: 'danger' },
  ], [stats]);

  const reportedUserName = detail?.reportedUser ? fullName(detail.reportedUser) : null;

  const resolveDismissOpen = !!closeModal;

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={FlagIcon}
        title="Report Management"
        subtitle="Trust & Safety moderation center — review, investigate and resolve reports"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statsCards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* Filters */}
      <form onSubmit={applyFilters} className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search reporter, reported user, reason…"
              className="input pl-9 w-full"
            />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </Select>
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
          <Select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
            <option value="">All priorities</option>
            {Object.entries(PRIORITY_META).map(([v, m]) => (
              <option key={v} value={v}>{m.label}</option>
            ))}
          </Select>
        </div>
          <div className="flex items-center justify-end mt-3">
            <button type="button" onClick={clearFilters} className="text-xs font-medium text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <FunnelIcon className="w-3.5 h-3.5" /> Clear filters
            </button>
          </div>
      </form>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : reports.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={FlagIcon}
            title={hasFilters ? 'No reports match your filters' : 'No reports yet'}
            description={hasFilters
              ? 'Try adjusting or clearing the filters to see more reports.'
              : 'Reports submitted by users will appear here for review.'}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-3 font-semibold">Report</th>
                  <th className="px-4 py-3 font-semibold">Reporter</th>
                  <th className="px-4 py-3 font-semibold">Reported Item</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {reports.map((r) => (
                  <tr key={String(r._id)} className="hover:bg-gray-50 dark:hover:bg-dark-700/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400" title={String(r._id)}>
                      {r.displayId || shortId(r._id)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar src={r.reporter?.avatar?.url} alt={fullName(r.reporter)} size="xs" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate max-w-[150px]">{fullName(r.reporter)}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[150px]">{r.reporter?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white truncate max-w-[170px]">
                        {r.reportedUser ? fullName(r.reportedUser) : `${typeLabel(r)} ${shortId(r.resourceId)}`}
                      </p>
                      <span className="badge badge-warning mt-0.5">{reasonLabel(r)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${TYPE_BADGES[r.resourceType] || 'badge-gray'}`}>{typeLabel(r)}</span>
                    </td>
                    <td className="px-4 py-3"><PriorityBadge priority={r.priority} /></td>
                    <td className="px-4 py-3"><Badge status={r.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtRel(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(r)}>
                          <EyeIcon className="w-4 h-4 mr-1" /> Review
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination meta={meta} onPageChange={setPage} />

      {/* ── Detail modal ─────────────────────────────────────────────────────── */}
      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} size="3xl"
        title={null} className="!p-0 overflow-hidden">
        {detailLoading && !detail ? (
          <div className="space-y-4 p-6"><SkeletonCard /><SkeletonText lines={6} /></div>
        ) : detailError && !detail ? (
          <div className="p-6">
            <EmptyState
              icon={ExclamationTriangleIcon}
              title="Could not load this report"
              description="The report may have been removed, or the request failed. Close this panel and try again."
            />
          </div>
        ) : detail ? (
          <div className="flex max-h-[84vh] flex-col">
            {/* Header — fixed (non-scrolling) so the key actions stay visible */}
            <div className="shrink-0 border-b border-gray-100 dark:border-gray-700 px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">{detail.displayId}</span>
                  <Badge status={detail.status} />
                  <PriorityBadge priority={detail.priority} />
                  <span className={`badge ${TYPE_BADGES[detail.resourceType] || 'badge-gray'}`}>{typeLabel(detail)}</span>
                  <span className="badge badge-warning">{reasonLabel(detail)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {['pending', 'under_review'].includes(detail.status) ? (
                    <>
                      <Button size="sm" onClick={() => setCloseModal({ mode: 'resolve' })}>
                        <CheckCircleIcon className="w-4 h-4 mr-1" /> Resolve
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setCloseModal({ mode: 'dismiss' })}>
                        <XMarkIcon className="w-4 h-4 mr-1" /> Dismiss
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => changeStatus({ id: detail._id, data: { status: 'under_review' } })} loading={statusPending}>
                      <ArrowPathIcon className="w-4 h-4 mr-1" /> Reopen
                    </Button>
                  )}
                  <Select
                    value={detail.priority}
                    onChange={(e) => handlePriorityChange(detail._id, e.target.value)}
                    className="w-36"
                  >
                    {Object.entries(PRIORITY_META).map(([v, m]) => (
                      <option key={v} value={v}>{m.label} priority</option>
                    ))}
                  </Select>
                  <button onClick={() => setSelectedId(null)} className="btn-icon text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">Reported {fmtDate(detail.createdAt)} ({fmtRel(detail.createdAt)})</p>
            </div>

            {/* Scrollable body — two columns on desktop, one on mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-y-auto px-5 py-4">
              {/* Main column */}
              <div className="lg:col-span-2 space-y-4">
                <Section icon={DocumentTextIcon} title="Report details">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <Field label="Reason" value={reasonLabel(detail)} capitalize />
                    <Field label="Priority" value={PRIORITY_META[detail.priority]?.label || detail.priority} />
                    <Field label="Report ID" value={String(detail._id)} mono />
                    <Field label="Resource ID" value={String(detail.resourceId)} mono />
                    {detail.resolution?.action && <Field label="Resolution action" value={ACTION_LABELS[detail.resolution.action] || detail.resolution.action} />}
                    {detail.resolution?.resolvedAt && <Field label="Resolved at" value={fmtDate(detail.resolution.resolvedAt)} />}
                  </dl>
                  <div className="mt-4">
                    <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Description</h4>
                    <p className="rounded-lg bg-gray-50 dark:bg-dark-700/60 p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{detail.description}</p>
                  </div>
                  {detail.evidence?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Evidence ({detail.evidence.length})</h4>
                      <div className="flex flex-wrap gap-2">
                        {detail.evidence.map((e, i) => (
                          <a key={i} href={e.url} target="_blank" rel="noreferrer"
                            className="chip hover:border-primary-400 hover:text-primary-600">
                            <DocumentTextIcon className="w-3.5 h-3.5" /> {e.originalName || 'Attachment'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {detail.resolution?.note && (
                    <div className="mt-4">
                      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Resolution note</h4>
                      <p className="rounded-lg bg-green-50 dark:bg-green-900/10 p-3 text-sm text-green-800 dark:text-green-200">{detail.resolution.note}</p>
                    </div>
                  )}
                </Section>

                <Section icon={ScaleIcon} title="Reported content">
                  <ResourceView report={detail} onAction={(kind, sub) => {
                    if (kind === 'catalog') setResourceAction({ kind: `catalog-${sub}`, note: '' });
                    if (kind === 'job' && sub === 'approve') setJobAction({ kind: 'approve' });
                    if (kind === 'job' && sub === 'reject') setJobAction({ kind: 'reject' });
                  }} />
                </Section>

                <FinancialSection financial={detail.financial} />

                <Section icon={ShieldExclamationIcon} title="Investigation">
                  <div className="space-y-3">
                    <Textarea label="Root cause" rows={2} value={investigation.rootCause}
                      onChange={(e) => setInvestigation((s) => ({ ...s, rootCause: e.target.value }))}
                      placeholder="What caused this report?" />
                    <Textarea label="Investigation notes" rows={4} value={investigation.notes}
                      onChange={(e) => setInvestigation((s) => ({ ...s, notes: e.target.value }))}
                      placeholder="Findings, communication with parties, timeline…" />
                    <Textarea label="Recommended resolution" rows={2} value={investigation.recommendedResolution}
                      onChange={(e) => setInvestigation((s) => ({ ...s, recommendedResolution: e.target.value }))}
                      placeholder="Suggested outcome for this report" />
                    <div className="flex items-center justify-between">
                      {detail.investigation?.updatedAt && (
                        <p className="text-xs text-gray-400">Last updated {fmtRel(detail.investigation.updatedAt)} by {fullName(detail.investigation?.updatedBy)}</p>
                      )}
                      <Button size="sm" onClick={() => saveInvestigation()} loading={investigationPending}>
                        <PaperAirplaneIcon className="w-4 h-4 mr-1" /> Save investigation
                      </Button>
                    </div>
                  </div>
                </Section>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <Section icon={FlagIcon} title="Reporter">
                  <div className="space-y-3">
                    <UserBadge user={detail.reporter} />
                    <dl className="grid grid-cols-2 gap-3 text-xs">
                      <Field label="Reports sent" value={detail.reporterReportCount ?? 0} />
                      <Field label="Member since" value={fmtDate(detail.reporter?.createdAt)} />
                    </dl>
                  </div>
                </Section>

                <Section icon={UserIcon} title="Reported user"
                  right={detail.reportedUser && (
                    <Link to={`/admin/users/${detail.reportedUser._id}`} className="text-xs font-medium text-primary-600 hover:underline">
                      View profile →
                    </Link>
                  )}>
                  <div className="space-y-3">
                    <UserBadge user={detail.reportedUser} sub={reportedUserName} />
                    {detail.reportedUser ? (
                      <dl className="grid grid-cols-2 gap-3 text-xs">
                        <Field label="Reports against" value={detail.reportedUserReportCount ?? 0} />
                        <Field label="Member since" value={fmtDate(detail.reportedUser.createdAt)} />
                      </dl>
                    ) : null}
                    {detail.reportedUser && detail.reportedUser.role !== 'admin' && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {detail.reportedUser.isBanned ? (
                          <Button variant="outline" size="sm" onClick={() => setUserAction({ kind: 'unban' })}>
                            <CheckCircleIcon className="w-4 h-4 mr-1" /> Unban
                          </Button>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" className="text-red-600" onClick={() => setUserAction({ kind: 'ban' })}>
                              <UserMinusIcon className="w-4 h-4 mr-1" /> Suspend account
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setUserAction({ kind: 'deactivate' })}>
                              Deactivate
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </Section>

                <Section icon={ChatBubbleLeftRightIcon} title="Internal notes">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add a note for the team…"
                        className="input flex-1"
                        onKeyDown={(e) => { if (e.key === 'Enter' && noteText.trim()) addNote(noteText.trim()); }}
                      />
                      <Button size="sm" disabled={!noteText.trim()} loading={notePending}
                        onClick={() => addNote(noteText.trim())}>
                        Add
                      </Button>
                    </div>
                    {detail.adminNotes?.length > 0 ? (
                      <ul className="space-y-3">
                        {[...detail.adminNotes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((n, i) => (
                          <li key={i} className="rounded-lg bg-gray-50 dark:bg-dark-700/60 p-3">
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{n.note}</p>
                            <p className="mt-1 text-xs text-gray-400">{fullName(n.author)} · {fmtRel(n.createdAt)}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No internal notes yet.</p>
                    )}
                  </div>
                </Section>

                <Section icon={ClockIcon} title="Activity history">
                  <ActivityTimeline history={detail.reportHistory} />
                </Section>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Resolve/Dismiss modal */}
      <Modal open={resolveDismissOpen} onClose={() => setCloseModal(null)}
        title={closeModal?.mode === 'resolve' ? 'Resolve report' : 'Dismiss report'} size="sm">
        {closeModal && (
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); submitClose({ reason: fd.get('reason'), action: fd.get('action'), notifyReporter: fd.get('notifyReporter') !== null }); }}
            className="space-y-4">
            <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${closeModal.mode === 'dismiss'
              ? 'border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-dark-700 text-gray-600 dark:text-gray-300'
              : 'border border-green-100 dark:border-green-900/40 bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300'}`}>
              <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
              {closeModal.mode === 'dismiss'
                ? 'The reporter will be notified that the report was reviewed.'
                : 'Choose an action taken (if any) and record why. The reporter will be notified.'}
            </div>
            {closeModal.mode === 'resolve' && (
              <Select label="Action taken" name="action" defaultValue="no_action">
                {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            )}
            <Textarea label="Resolution reason *" name="reason" rows={3} required
              placeholder={closeModal.mode === 'dismiss' ? 'Why was this report dismissed?' : 'Summary of how the report was resolved…'} />
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" name="notifyReporter" defaultChecked className="accent-primary-600" />
              Notify the reporter about this decision
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" size="sm" onClick={() => setCloseModal(null)}>Cancel</Button>
              <Button type="submit" size="sm" loading={statusPending}>
                {closeModal.mode === 'resolve' ? 'Resolve report' : 'Dismiss report'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Catalog resource action modal */}
      <Modal open={!!resourceAction} onClose={() => setResourceAction(null)}
        title={resourceAction?.kind === 'catalog-remove' ? 'Remove service'
          : resourceAction?.kind === 'catalog-suspend' ? 'Suspend freelancer'
          : resourceAction?.kind === 'catalog-warn' ? 'Warn freelancer'
          : 'Dismiss report'} size="sm">
        {resourceAction && (
          <form onSubmit={(e) => { e.preventDefault(); runResourceAction({ kind: resourceAction.kind, note: resourceAction.note }); }}
            className="space-y-4">
            {resourceAction.kind === 'catalog-suspend' && (
              <div className="flex items-start gap-2 rounded-lg border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-3 text-sm text-red-700 dark:text-red-300">
                <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
                This deactivates the freelancer&apos;s account, invalidates their sessions and closes the report.
              </div>
            )}
            {resourceAction.kind === 'catalog-remove' && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
                This archives the service and hides it from the marketplace.
              </div>
            )}
            <Textarea label="Note" rows={3} value={resourceAction.note}
              onChange={(e) => setResourceAction((s) => ({ ...s, note: e.target.value }))}
              placeholder={resourceAction.kind === 'catalog-warn'
                ? 'Message sent to the freelancer…'
                : 'Optional internal note…'} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setResourceAction(null)}>Cancel</Button>
              <Button type="submit" size="sm" loading={resourcePending}
                className={resourceAction.kind === 'catalog-suspend' || resourceAction.kind === 'catalog-remove' ? 'btn-danger' : ''}>
                Confirm
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* User account action modal */}
      <ConfirmModal
        open={!!userAction}
        onClose={() => setUserAction(null)}
        onConfirm={() => userAction && runUserAction({ userId: detail?.reportedUser?._id, kind: userAction.kind, reason: userAction.reason })}
        title={userAction?.kind === 'unban' ? 'Unban account?' : userAction?.kind === 'deactivate' ? 'Deactivate account?' : 'Suspend account?'}
        message={userAction?.kind === 'unban'
          ? 'This restores the user\'s access to the platform.'
          : userAction?.kind === 'deactivate'
            ? 'The user will no longer be able to log in, but their content stays available.'
            : 'The user will be banned, logged out and blocked from the platform until unbanned.'}
        confirmLabel={userAction?.kind === 'unban' ? 'Unban' : userAction?.kind === 'deactivate' ? 'Deactivate' : 'Suspend'}
        danger={userAction?.kind !== 'unban'}
        loading={userPending}
      >
        {userAction?.kind === 'ban' && (
          <Textarea label="Ban reason" rows={2} value={userAction.reason || ''} required
            onChange={(e) => setUserAction((s) => ({ ...s, reason: e.target.value }))}
            placeholder="Reason shown to the user and kept on their account…" />
        )}
      </ConfirmModal>

      {/* Job moderation modal */}
      <ConfirmModal
        open={!!jobAction}
        onClose={() => setJobAction(null)}
        onConfirm={() => jobAction && runJobAction({ jobId: detail?.resource?.data?._id, kind: jobAction.kind, reason: jobAction.reason })}
        title={jobAction?.kind === 'approve' ? 'Approve job?' : 'Reject job?'}
        message={jobAction?.kind === 'approve'
          ? 'The job listing will be approved and remain visible.'
          : 'The job listing will be rejected and hidden. A reason will be attached.'}
        confirmLabel={jobAction?.kind === 'approve' ? 'Approve' : 'Reject'}
        danger={jobAction?.kind === 'reject'}
        loading={jobPending}
      >
        {jobAction?.kind === 'reject' && (
          <Textarea label="Rejection reason *" rows={2} value={jobAction.reason || ''} required
            onChange={(e) => setJobAction((s) => ({ ...s, reason: e.target.value }))}
            placeholder="Why was the job rejected?" />
        )}
      </ConfirmModal>
    </div>
  );
}
