import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import { supportService } from '@services/support.service';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import {
  LifebuoyIcon,
  TicketIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  UserCircleIcon,
  ClockIcon,
  PencilSquareIcon,
  XCircleIcon,
  EllipsisVerticalIcon,
  ArrowRightIcon,
  WrenchScrewdriverIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { Star } from 'lucide-react';

const STATUSES = ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const CATEGORIES = [
  'general_inquiry', 'account_issue', 'payment_problem', 'project_dispute',
  'technical_issue', 'billing', 'feature_request', 'bug_report', 'other',
];
const ROLES = ['client', 'freelancer', 'admin'];

const STATUS_TRANSITIONS = {
  open: ['in_progress', 'closed'],
  in_progress: ['waiting_for_user', 'resolved', 'closed'],
  waiting_for_user: ['in_progress', 'resolved', 'closed'],
  resolved: ['open', 'closed'],
  closed: ['open'],
};

const STATUS_STYLES = {
  open: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  in_progress: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  waiting_for_user: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  resolved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  closed: 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400',
};

const PRIORITY_STYLES = {
  low: 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400',
  medium: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  high: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  urgent: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

const ROLE_STYLES = {
  client: 'badge-success',
  freelancer: 'badge-primary',
  admin: 'badge-danger',
};

const INVESTIGATION_CHECKLISTS = {
  account_issue: [
    'Check account status',
    'Check email verification',
    'Check login / authentication',
    'Check password / reset status',
    'Check profile / settings',
    'Check relevant errors',
  ],
  payment_problem: [
    'Check payment',
    'Check transaction',
    'Check wallet',
    'Check escrow',
    'Check gateway response',
    'Check refund status',
  ],
  project_dispute: [
    'Check project',
    'Check client / freelancer',
    'Check milestones',
    'Check messages / evidence',
    'Check payment / escrow',
  ],
  technical_issue: [
    'Reproduce the issue',
    'Check affected page',
    'Check API response',
    'Check server / client errors',
  ],
  bug_report: [
    'Reproduce the reported bug.',
    'Identify the affected page / feature.',
    'Check API response and server error logs.',
    'Check browser / client console errors.',
    'Identify the root cause and fix scope.',
  ],
  billing: [
    'Check the invoice and its line items.',
    'Verify the billing details on file.',
    'Review the payment record and transaction history.',
    'Confirm currency, fees, and commission applied.',
    'Cross-check with the wallet / escrow ledger.',
  ],
  general_inquiry: [],
  feature_request: [],
  other: [],
};

const FEATURE_REQUEST_STEPS = [
  'Review the request',
  'Add Admin decision',
  'Add internal notes',
];

const ACTIVITY_LABELS = {
  created: 'Ticket created',
  assigned: 'Ticket assigned',
  status_changed: 'Status changed',
  priority_changed: 'Priority changed',
  reply_sent: 'Reply sent',
  note_added: 'Admin note added',
  investigation_started: 'Investigation Started',
  investigation_updated: 'Investigation Updated',
  resolution_added: 'Resolution Added',
  resolved: 'Ticket Resolved',
  closed: 'Ticket closed',
  reopened: 'Ticket reopened',
};

const ACTIVITY_ICONS = {
  created: TicketIcon,
  assigned: UserCircleIcon,
  status_changed: ArrowPathIcon,
  priority_changed: ExclamationTriangleIcon,
  reply_sent: ChatBubbleLeftRightIcon,
  note_added: PencilSquareIcon,
  investigation_started: WrenchScrewdriverIcon,
  investigation_updated: WrenchScrewdriverIcon,
  resolution_added: CheckCircleIcon,
  resolved: CheckCircleIcon,
  closed: XCircleIcon,
  reopened: ArrowPathIcon,
};

function StatusBadge({ status }) {
  return (
    <span className={clsx('badge', STATUS_STYLES[status] || 'badge-gray')}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return (
    <span className={clsx('badge', PRIORITY_STYLES[priority] || 'badge-gray')}>
      {priority}
    </span>
  );
}

function Avatar({ user, className = 'w-8 h-8' }) {
  if (user?.avatar) {
    return <img src={user.avatar} alt="" className={clsx(className, 'rounded-full object-cover')} />;
  }
  const initial = (user?.firstName?.[0] || user?.email?.[0] || '?').toUpperCase();
  return (
    <span className={clsx(className, 'rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-semibold')}>
      {initial}
    </span>
  );
}

const fmt = (date) => (date ? new Date(date).toLocaleString() : '—');
const ago = (date) => (date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : '—');

export default function AdminSupportPage() {
  const qc = useQueryClient();
  const { ticketId: urlTicketId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [role, setRole] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [resolveTicket, setResolveTicket] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);
  const portalRef = useRef(null);

  const debouncedSearch = useDebouncedValue(search, 350);

  const filters = useMemo(() => ({
    status: status || undefined,
    priority: priority || undefined,
    category: category || undefined,
    role: role || undefined,
    from: from || undefined,
    to: to || undefined,
    q: debouncedSearch || undefined,
    page,
    limit: 20,
  }), [status, priority, category, role, from, to, debouncedSearch, page]);

  const { data: ticketsData, isLoading, isFetching } = useQuery({
    queryKey: ['admin-support-tickets', filters],
    queryFn: () => supportService.adminGetAllTickets(filters),
  });

  const { data: statsData } = useQuery({
    queryKey: ['admin-support-stats'],
    queryFn: () => supportService.adminGetStats(),
  });

  const { data: urlTicketData, isFetching: urlTicketLoading } = useQuery({
    queryKey: ['admin-support-ticket', urlTicketId],
    queryFn: () => supportService.adminGetTicket(urlTicketId),
    enabled: !!urlTicketId,
  });

  const urlHandled = useRef(false);
  useEffect(() => {
    if (urlTicketId && urlTicketData?.data?.data && !urlHandled.current) {
      urlHandled.current = true;
      setSelectedTicket(urlTicketData.data.data);
    }
  }, [urlTicketId, urlTicketData]);

  useEffect(() => {
    if (!menuFor) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuFor(null); };
    const onScroll = () => setMenuFor(null);
    const onResize = () => setMenuFor(null);
    const onOutside = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setMenuFor(null);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('mousedown', onOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [menuFor]);

  useLayoutEffect(() => {
    if (!menuFor || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = menuPos.top;
    let right = menuPos.right;
    if (top + rect.height > vh - 8) top = Math.max(8, vh - rect.height - 8);
    if (right + rect.width > vw - 8) right = Math.max(8, vw - rect.width - 8);
    if (top !== menuPos.top || right !== menuPos.right) setMenuPos({ top, right });
  }, [menuFor, menuPos.top, menuPos.right]);

  const tickets = ticketsData?.data?.data || [];
  const meta = ticketsData?.data?.meta;
  const stats = statsData?.data?.data || {};
  const statusStats = stats?.statusStats || [];
  const priorityStats = stats?.priorityStats || [];

  const countOf = (key) => statusStats.find((s) => s._id === key)?.count || 0;
  const totalTickets = statusStats.reduce((sum, s) => sum + s.count, 0);
  const highPriority = priorityStats
    .filter((p) => p._id === 'high' || p._id === 'urgent')
    .reduce((sum, s) => sum + s.count, 0);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-support-tickets'] });
    qc.invalidateQueries({ queryKey: ['admin-support-stats'] });
    if (urlTicketId) qc.invalidateQueries({ queryKey: ['admin-support-ticket', urlTicketId] });
  };

  const applyTicketUpdate = (updated) => {
    if (updated) setSelectedTicket(updated);
    invalidateAll();
  };

  const replyMutation = useMutation({
    mutationFn: ({ ticketId, content }) => supportService.adminReplyToTicket(ticketId, content),
    onSuccess: (res) => { toast.success('Reply sent'); applyTicketUpdate(res?.data?.data); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to send reply'),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ ticketId, investigationNotes, rootCause, resolution }) =>
      supportService.adminResolveTicket(ticketId, { investigationNotes, rootCause, resolution }),
    onSuccess: (res) => {
      toast.success('Ticket resolved');
      setResolveTicket(null);
      applyTicketUpdate(res?.data?.data);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to resolve ticket'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ ticketId, status }) => supportService.adminUpdateTicketStatus(ticketId, status),
    onSuccess: (res) => { toast.success('Status updated'); applyTicketUpdate(res?.data?.data); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update status'),
  });

  const priorityMutation = useMutation({
    mutationFn: ({ ticketId, priority }) => supportService.adminUpdateTicketPriority(ticketId, priority),
    onSuccess: (res) => { toast.success('Priority updated'); applyTicketUpdate(res?.data?.data); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update priority'),
  });

  const noteMutation = useMutation({
    mutationFn: ({ ticketId, content }) => supportService.adminAddInternalNote(ticketId, content),
    onSuccess: (res) => { toast.success('Internal note added'); applyTicketUpdate(res?.data?.data); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add note'),
  });

  const investigationMutation = useMutation({
    mutationFn: ({ ticketId, investigationNotes, rootCause }) =>
      supportService.adminSaveInvestigation(ticketId, { investigationNotes, rootCause }),
    onSuccess: (res) => { toast.success('Investigation saved'); applyTicketUpdate(res?.data?.data); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save investigation'),
  });

  const clearFilters = () => {
    setStatus(''); setPriority(''); setCategory(''); setRole(''); setFrom(''); setTo(''); setSearch(''); setPage(1);
  };

  const hasFilters = !!(status || priority || category || role || from || to || debouncedSearch);
  const hasActiveFilter = !!(status || priority || category || role || from || to);

  const openTicket = (ticket) => { setMenuFor(null); setSelectedTicket(ticket); };
  const toggleMenu = (e, ticket) => {
    e.stopPropagation();
    if (menuFor === ticket._id) { setMenuFor(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuFor(ticket._id);
  };

  const getMenuPortal = () => {
    if (!portalRef.current && typeof document !== 'undefined' && document.body) {
      portalRef.current = document.createElement('div');
      portalRef.current.dataset.adminMenuPortal = '';
      document.body.appendChild(portalRef.current);
    }
    return portalRef.current;
  };
  const closeTicket = () => {
    setSelectedTicket(null);
    if (urlTicketId) navigate('/admin/support', { replace: true });
  };

  const statsCards = [
    { label: 'Total Tickets', value: totalTickets, onClick: () => setStatus(''), icon: TicketIcon },
    { label: 'Open', value: countOf('open'), onClick: () => setStatus(status === 'open' ? '' : 'open'), icon: ExclamationTriangleIcon },
    { label: 'In Progress', value: countOf('in_progress'), onClick: () => setStatus(status === 'in_progress' ? '' : 'in_progress'), icon: ClockIcon },
    { label: 'Waiting on User', value: countOf('waiting_for_user'), onClick: () => setStatus(status === 'waiting_for_user' ? '' : 'waiting_for_user'), icon: ChatBubbleLeftRightIcon },
    { label: 'Resolved', value: countOf('resolved'), onClick: () => setStatus(status === 'resolved' ? '' : 'resolved'), icon: CheckCircleIcon },
    { label: 'High / Urgent', value: highPriority, onClick: () => setPriority(priority === 'high' ? '' : 'high'), icon: ExclamationTriangleIcon },
  ];

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={LifebuoyIcon}
        title="Support Management Center"
        subtitle="Investigate and resolve customer support tickets"
        actions={
          <Button variant="outline" size="sm" onClick={() => { invalidateAll(); toast.success('Refreshed'); }}>
            <ArrowPathIcon className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsCards.map((card) => (
          <button
            key={card.label}
            onClick={card.onClick}
            className={clsx(
              'stat-card text-left transition-colors',
              (card.label === 'High / Urgent' && priority === 'high')
                ? 'ring-2 ring-primary-500'
                : (card.label !== 'Total Tickets' && status === card.label.toLowerCase().replace(/\s+/g, '_'))
                  ? 'ring-2 ring-primary-500'
                  : 'hover:border-primary-300 dark:hover:border-primary-600'
            )}
          >
            <card.icon className="w-5 h-5 text-gray-400" />
            <p className="stat-value">{card.value}</p>
            <p className="stat-label">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 min-w-[220px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by ticket ID, subject, or user…"
              className="input pl-9"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="capitalize">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </Select>
            <Select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="capitalize">
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="capitalize">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </Select>
            <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="capitalize">
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <FunnelIcon className="w-4 h-4" /> Date range
          </div>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              className="input flex-1"
              title="Created from"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              className="input flex-1"
              title="Created to"
            />
          </div>
        </div>
      </div>

      {/* Tickets table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Tickets {isFetching && <span className="ml-2 inline-block w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin align-middle" />}
          </h2>
          <span className="text-xs text-gray-400">{hasActiveFilter ? `${tickets.length} shown` : `${totalTickets} total`}</span>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-dark-700/60 animate-pulse" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={TicketIcon}
              title={hasActiveFilter ? 'No matching tickets' : 'No support tickets yet'}
              description={hasActiveFilter
                ? 'Try adjusting your search or filters.'
                : 'When users create support tickets they will appear here.'}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700/60">
                  <th className="px-5 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {tickets.map((ticket) => (
                  <tr
                    key={ticket._id}
                    onClick={() => openTicket(ticket)}
                    className="hover:bg-gray-50 dark:hover:bg-dark-700/40 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <p className="text-xs font-mono text-gray-400">{ticket.ticketId}</p>
                      <p className="font-medium text-gray-900 dark:text-white truncate max-w-[240px]">{ticket.subject}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar user={ticket.user} />
                        <div>
                          <p className="text-gray-900 dark:text-white font-medium text-xs">
                            {ticket.user?.firstName} {ticket.user?.lastName}
                          </p>
                          <Badge status={ticket.user?.role} className="mt-0.5">
                            {ticket.user?.role}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {ticket.category?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400" title={fmt(ticket.createdAt)}>
                      {ago(ticket.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openTicket(ticket); }}
                          className="btn-primary btn-sm"
                        >
                          View
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => toggleMenu(e, ticket)}
                            className="btn-icon text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            title="More actions"
                            aria-haspopup="menu"
                            aria-expanded={menuFor === ticket._id}
                          >
                            <EllipsisVerticalIcon className="w-5 h-5" />
                          </button>
                          {menuFor === ticket._id && (() => {
                            const target = getMenuPortal();
                            if (!target) return null;
                            return createPortal(
                              <>
                                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }} />
                                <div
                                  ref={menuRef}
                                  role="menu"
                                  className="fixed z-50 w-48 rounded-xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700 shadow-lg py-1.5 text-left"
                                  style={{ top: menuPos.top, right: menuPos.right }}
                                >
                                  <MenuAction label="View" onClick={() => openTicket(ticket)} />
                                  <MenuAction label="Reply" onClick={() => openTicket(ticket)} />
                                  <MenuAction label="Add Note" onClick={() => openTicket(ticket)} />
                                  <div className="px-3 py-1.5">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Change status</p>
                                    <div className="flex flex-wrap gap-1">
                                      {(STATUS_TRANSITIONS[ticket.status] || []).map((s) => (
                                        <button
                                          key={s}
                                          type="button"
                                          onClick={() => {
                                            setMenuFor(null);
                                            statusMutation.mutate({ ticketId: ticket.ticketId, status: s });
                                          }}
                                          className="px-2 py-0.5 text-xs rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 capitalize"
                                        >
                                          {s.replace(/_/g, ' ')}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                                    <MenuAction
                                      label="Resolve"
                                      onClick={() => { setMenuFor(null); setResolveTicket(ticket); }}
                                    />
                                  )}
                                </div>
                              </>,
                              target
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination meta={meta} onPageChange={setPage} />

      {/* Ticket detail modal */}
      <Modal open={!!selectedTicket} onClose={closeTicket} size="xl" className="p-0">
        {selectedTicket ? (
          <TicketDetail
            key={selectedTicket._id || selectedTicket.ticketId}
            ticket={selectedTicket}
            mutations={{
              reply: replyMutation,
              resolve: resolveMutation,
              status: statusMutation,
              priority: priorityMutation,
              note: noteMutation,
              investigation: investigationMutation,
            }}
          />
        ) : (
          urlTicketLoading && (
            <div className="p-10 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
            </div>
          )
        )}
      </Modal>

      {/* Standalone resolve modal */}
      <ResolveModal
        open={!!resolveTicket}
        onClose={() => setResolveTicket(null)}
        ticket={resolveTicket}
        loading={resolveMutation.isPending}
        onResolve={(investigationNotes, rootCause, resolution) =>
          resolveTicket && resolveMutation.mutate({
            ticketId: resolveTicket.ticketId,
            investigationNotes,
            rootCause,
            resolution,
          })
        }
      />
    </div>
  );
}

function MenuAction({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700/60"
    >
      {label}
    </button>
  );
}

function ResolveModal({ open, onClose, ticket, loading, onResolve }) {
  const [investigationNotes, setInvestigationNotes] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [resolution, setResolution] = useState('');
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setInvestigationNotes('');
      setRootCause('');
      setResolution('');
      setErrors({});
      setConfirmOpen(false);
    }
  }, [open, ticket?._id]);

  const isFeatureRequest = ticket?.category === 'feature_request';
  const rootCauseLabel = isFeatureRequest ? 'Admin decision' : 'Root cause';

  const submit = () => {
    const nextErrors = {};
    if (!rootCause.trim()) nextErrors.rootCause = `${rootCauseLabel} is required`;
    if (!resolution.trim()) nextErrors.resolution = 'Resolution is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setConfirmOpen(true);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Resolve this support ticket?" size="md">
        {ticket ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span className="text-xs font-mono text-gray-400">{ticket.ticketId}</span>
              <span className="truncate font-medium">{ticket.subject}</span>
            </div>
            <Textarea
              label="Investigation notes (optional)"
              rows={2}
              value={investigationNotes}
              onChange={(e) => setInvestigationNotes(e.target.value)}
              placeholder="Notes from your investigation…"
            />
            <Textarea
              label={rootCauseLabel}
              rows={2}
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder={isFeatureRequest ? 'Record your decision…' : 'Enter the confirmed root cause after investigation…'}
              error={errors.rootCause}
            />
            <Textarea
              label="Resolution"
              rows={4}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Explain the resolution to the user…"
              error={errors.resolution}
            />
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={submit} disabled={loading}>
                {loading ? 'Resolving…' : 'Resolve'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => onResolve(investigationNotes.trim(), rootCause.trim(), resolution.trim())}
        title="Resolve this support ticket?"
        message={`Are you sure you want to resolve ${ticket?.ticketId || 'this ticket'}? The resolution will be sent to the user.`}
        confirmLabel="Yes, resolve ticket"
        loading={loading}
      />
    </>
  );
}

function TicketDetail({ ticket, mutations }) {
  const [replyContent, setReplyContent] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [investigationNotes, setInvestigationNotes] = useState('');
  const [investigationRootCause, setInvestigationRootCause] = useState('');
  const [resolutionContent, setResolutionContent] = useState('');
  const [resolveErrors, setResolveErrors] = useState({});
  const [nextStatus, setNextStatus] = useState(ticket.status);
  const [nextPriority, setNextPriority] = useState(ticket.priority);
  const [confirmAction, setConfirmAction] = useState(null);

  const { data: contextData, isFetching: contextLoading } = useQuery({
    queryKey: ['admin-support-ticket-context', ticket.ticketId],
    queryFn: () => supportService.adminGetTicketContext(ticket.ticketId),
    enabled: !!ticket?.ticketId,
    staleTime: 60_000,
  });
  const context = contextData?.data?.data || {};

  useEffect(() => {
    setNextStatus(ticket.status);
    setNextPriority(ticket.priority);
    setInvestigationNotes(ticket.investigationNotes || '');
    setInvestigationRootCause(ticket.rootCause || '');
    setResolutionContent('');
    setResolveErrors({});
  }, [ticket._id, ticket.status, ticket.priority, ticket.rootCause, ticket.investigationNotes]);

  const isClosed = ticket.status === 'closed';
  const isResolved = ticket.status === 'resolved';
  const isFeatureRequest = ticket.category === 'feature_request';
  const validNextStatuses = STATUS_TRANSITIONS[ticket.status] || [];
  const checklist = isFeatureRequest ? FEATURE_REQUEST_STEPS : (INVESTIGATION_CHECKLISTS[ticket.category] || []);
  const rootCauseLabel = isFeatureRequest ? 'Admin decision' : 'Root cause';

  const sendReply = () => {
    if (!replyContent.trim()) return;
    mutations.reply.mutate({ ticketId: ticket.ticketId, content: replyContent.trim() });
    setReplyContent('');
  };

  const saveInvestigation = () => {
    if (!investigationNotes.trim() && !investigationRootCause.trim()) {
      toast.error('Enter investigation notes or a root cause to save');
      return;
    }
    mutations.investigation.mutate({
      ticketId: ticket.ticketId,
      investigationNotes: investigationNotes.trim(),
      rootCause: investigationRootCause.trim(),
    });
  };

  const requestResolve = () => {
    const nextErrors = {};
    if (!investigationRootCause.trim()) nextErrors.rootCause = `${rootCauseLabel} is required`;
    if (!resolutionContent.trim()) nextErrors.resolution = 'Resolution is required';
    setResolveErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setConfirmAction('resolve');
  };

  const confirmResolve = () => {
    mutations.resolve.mutate({
      ticketId: ticket.ticketId,
      investigationNotes: investigationNotes.trim(),
      rootCause: investigationRootCause.trim(),
      resolution: resolutionContent.trim(),
    });
    setConfirmAction(null);
  };

  const confirmClose = () => {
    mutations.status.mutate({ ticketId: ticket.ticketId, status: 'closed' });
    setConfirmAction(null);
  };

  const confirmReopen = () => {
    mutations.status.mutate({ ticketId: ticket.ticketId, status: 'open' });
    setConfirmAction(null);
  };

  const timeline = ticket.activities?.length
    ? ticket.activities
    : [{ action: 'created', createdAt: ticket.createdAt, actor: ticket.user }];

  return (
    <div className="max-h-[85vh] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-dark-900/95 backdrop-blur border-b border-gray-100 dark:border-gray-700/60 px-6 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono text-gray-400">{ticket.ticketId}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="badge badge-gray capitalize">{ticket.category?.replace(/_/g, ' ')}</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white break-words">{ticket.subject}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {ticket.status !== 'closed' && (
            <button
              type="button"
              onClick={() => setConfirmAction('close')}
              disabled={mutations.status.isPending}
              className="btn-secondary btn-sm"
              title="Close ticket"
            >
              Close
            </button>
          )}
          {(isResolved || isClosed) && (
            <button
              type="button"
              onClick={() => setConfirmAction('reopen')}
              disabled={mutations.status.isPending}
              className="btn-primary btn-sm"
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* User + meta */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <Avatar user={ticket.user} className="w-10 h-10" />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                {ticket.user?.firstName} {ticket.user?.lastName}
              </p>
              <p className="text-xs text-gray-400 truncate">{ticket.user?.email}</p>
              <Badge status={ticket.user?.role} className="mt-1">{ticket.user?.role}</Badge>
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Created</p>
            <p className="text-sm text-gray-900 dark:text-white">{fmt(ticket.createdAt)}</p>
            <p className="text-xs text-gray-400 mt-1">{ago(ticket.createdAt)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Last Updated</p>
            <p className="text-sm text-gray-900 dark:text-white">{fmt(ticket.updatedAt)}</p>
            <p className="text-xs text-gray-400 mt-1">{ago(ticket.updatedAt)}</p>
          </div>
        </div>

        {/* Status / priority controls */}
        <div className="card p-4 flex flex-col lg:flex-row gap-3 items-start lg:items-end flex-wrap">
          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <label className="label">Status</label>
            <div className="flex gap-2">
              <Select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="flex-1 capitalize">
                <option value={ticket.status} disabled>{ticket.status.replace(/_/g, ' ')} (current)</option>
                {validNextStatuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </Select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={nextStatus === ticket.status || mutations.status.isPending}
                onClick={() => mutations.status.mutate({ ticketId: ticket.ticketId, status: nextStatus })}
              >
                Apply
              </Button>
            </div>
            <p className="text-[11px] text-gray-400">Only valid workflow transitions are allowed.</p>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <label className="label">Priority</label>
            <div className="flex gap-2">
              <Select value={nextPriority} onChange={(e) => setNextPriority(e.target.value)} className="flex-1 capitalize">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={nextPriority === ticket.priority || mutations.priority.isPending}
                onClick={() => mutations.priority.mutate({ ticketId: ticket.ticketId, priority: nextPriority })}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>

        {/* User Problem */}
        <div className="card p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-4 h-4 text-gray-400" />
            User Problem
          </h4>
          {ticket.messages?.length ? (
            <div className="space-y-3">
              {/* Exact description submitted by the user (verbatim, never summarized) */}
              <div className="bg-primary-50 dark:bg-primary-900/15 border-l-4 border-primary-400 rounded-r-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                  Original description · submitted by user
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">
                  {ticket.messages[0].content}
                </p>
              </div>

              {/* Full conversation (excluding the original description) */}
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {ticket.messages.slice(1).map((msg, i) => {
                  const isAdmin = msg.senderType === 'admin';
                  return (
                    <div key={i} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                        isAdmin
                          ? 'bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-white'
                          : 'bg-primary-50 dark:bg-primary-900/20 text-gray-900 dark:text-white'
                      }`}>
                        <p className="text-[10px] text-gray-400 mb-1">
                          {isAdmin
                            ? `Support · ${msg.sender?.firstName || 'Admin'}`
                            : `User · ${msg.sender?.firstName || ticket.user?.firstName || ''}`}
                          {' '}· {ago(msg.createdAt)}
                        </p>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No messages yet</p>
          )}

          {!isClosed && !isResolved && (
            <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={3}
                placeholder="Reply to the user…"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={!replyContent.trim() || mutations.reply.isPending}
                  loading={mutations.reply.isPending}
                  onClick={sendReply}
                >
                  Send Reply
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* User / Account Context (read-only, only real data is shown) */}
        <TicketContextSection context={context} loading={contextLoading} />

        {/* Investigation */}
        <div className="card p-4 border-l-4 border-primary-400">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <WrenchScrewdriverIcon className="w-4 h-4 text-primary-500" />
            Investigation
          </h4>

          {checklist.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                {isFeatureRequest ? 'Review checklist' : 'Investigation checklist (helpers only)'}
              </p>
              <ul className="space-y-1.5">
                {checklist.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <CheckCircleIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <Textarea
              label="Investigation notes"
              rows={3}
              value={investigationNotes}
              onChange={(e) => setInvestigationNotes(e.target.value)}
              placeholder="What did you check and find during your investigation?"
            />
            <Textarea
              label={rootCauseLabel}
              rows={2}
              value={investigationRootCause}
              onChange={(e) => setInvestigationRootCause(e.target.value)}
              placeholder={isFeatureRequest
                ? 'Record the Admin decision after reviewing the request…'
                : 'Enter the confirmed root cause after investigation…'}
              error={resolveErrors.rootCause}
            />
            {!investigationRootCause.trim() && (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                {isFeatureRequest
                  ? 'Admin decision not determined yet.'
                  : 'Root cause not determined yet.'}
              </p>
            )}
            {!isResolved && !isClosed && (
              <Textarea
                label="Resolution"
                rows={3}
                value={resolutionContent}
                onChange={(e) => setResolutionContent(e.target.value)}
                placeholder="Explain the resolution to the user…"
                error={resolveErrors.resolution}
              />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={mutations.investigation.isPending || (!investigationNotes.trim() && !investigationRootCause.trim())}
                loading={mutations.investigation.isPending}
                onClick={saveInvestigation}
              >
                Save investigation
              </Button>
              {!isResolved && !isClosed && (
                <Button
                  type="button"
                  size="sm"
                  disabled={mutations.resolve.isPending}
                  loading={mutations.resolve.isPending}
                  onClick={requestResolve}
                >
                  <CheckCircleIcon className="w-4 h-4" /> Resolve
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Resolution */}
        {isResolved && ticket.resolution && (
          <div className="card p-4 border-emerald-200 dark:border-emerald-800/60">
            <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4" /> Resolution
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{ticket.resolution.content}</p>
            {ticket.rootCause ? (
              <p className="text-xs text-gray-400 mt-2">
                <span className="font-medium">Root cause:</span> {ticket.rootCause}
              </p>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                Root cause not determined yet.
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Resolved {ago(ticket.resolution.resolvedAt)} by {ticket.resolution.resolvedBy?.firstName || 'Admin'}
              {ticket.satisfactionRating ? <span className="inline-flex items-center gap-1">· Rated {ticket.satisfactionRating} <Star size={12} className="text-yellow-400" fill="currentColor" /></span> : ''}
            </p>
          </div>
        )}

        {/* Internal notes */}
        <div className="card p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <PencilSquareIcon className="w-4 h-4 text-gray-400" />
            Internal notes (visible to Admin only)
          </h4>
          {ticket.internalNotes?.length ? (
            <ul className="space-y-3 mb-4">
              {ticket.internalNotes.map((note, i) => (
                <li key={i} className="flex gap-3 bg-gray-50 dark:bg-dark-700/50 rounded-lg p-3">
                  <UserCircleIcon className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">
                      {note.author?.firstName || 'Admin'} {note.author?.lastName || ''} · {ago(note.createdAt)}
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{note.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 mb-4">No internal notes yet.</p>
          )}
          <div className="flex gap-2">
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={2}
              placeholder="Add a private note (e.g. Checked the user's account. The account was locked after multiple failed login attempts.)…"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              disabled={!noteContent.trim() || mutations.note.isPending}
              onClick={() => {
                mutations.note.mutate({ ticketId: ticket.ticketId, content: noteContent.trim() });
                setNoteContent('');
              }}
            >
              Add note
            </Button>
          </div>
        </div>

        {/* Timeline */}
        <div className="card p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-gray-400" />
            Timeline
          </h4>
          <ol className="space-y-4">
            {timeline.map((activity, i) => {
              const Icon = ACTIVITY_ICONS[activity.action] || TicketIcon;
              const actorName = activity.actor
                ? `${activity.actor.firstName || ''} ${activity.actor.lastName || ''}`.trim()
                : 'Admin';
              return (
                <li key={i} className="relative flex gap-3 pl-1">
                  <div className="flex flex-col items-center">
                    <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                    </span>
                    {i < timeline.length - 1 && <span className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      <span className="font-medium">{ACTIVITY_LABELS[activity.action] || activity.action.replace(/_/g, ' ')}</span>
                      {activity.action !== 'created' && <span className="text-gray-400"> by {actorName}</span>}
                    </p>
                    {(activity.from || activity.to) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        {activity.from && <span className="capitalize">{activity.from.replace(/_/g, ' ')}</span>}
                        {activity.from && activity.to && <ArrowRightIcon className="w-3 h-3" />}
                        {activity.to && <span className="capitalize">{activity.to.replace(/_/g, ' ')}</span>}
                      </p>
                    )}
                    {activity.note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">{activity.note}</p>}
                    <p className="text-[11px] text-gray-400 mt-0.5">{fmt(activity.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Confirmations */}
      <ConfirmModal
        open={confirmAction === 'close'}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmClose}
        title="Close ticket?"
        message={`Are you sure you want to close ${ticket.ticketId}? The user will no longer be able to reply to this ticket.`}
        confirmLabel="Close ticket"
        danger
        loading={mutations.status.isPending}
      />
      <ConfirmModal
        open={confirmAction === 'reopen'}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmReopen}
        title="Reopen ticket?"
        message={`Are you sure you want to reopen ${ticket.ticketId}? The user will be able to reply again.`}
        confirmLabel="Reopen ticket"
        loading={mutations.status.isPending}
      />
      <ConfirmModal
        open={confirmAction === 'resolve'}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmResolve}
        title="Resolve this support ticket?"
        message={`Are you sure you want to resolve ${ticket.ticketId}? The resolution message will be sent to the user.`}
        confirmLabel="Yes, resolve ticket"
        loading={mutations.resolve.isPending}
      />
    </div>
  );
}

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const fmtMoney = (n, currency = 'ETB') =>
  n == null ? '—' : `${Number(n).toLocaleString()} ${currency}`;

function CtxRow({ label, value, danger }) {
  if (value === null || value === undefined || value === '' || value === false) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-[11px] uppercase tracking-wider text-gray-400 shrink-0">{label}</span>
      <span className={clsx('text-sm text-right break-words', danger ? 'text-red-500 font-medium' : 'text-gray-800 dark:text-gray-200')}>
        {value === true ? 'Yes' : value}
      </span>
    </div>
  );
}

function CtxBlock({ title, children }) {
  return (
    <div className="bg-gray-50 dark:bg-dark-700/40 rounded-lg p-3">
      <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">{title}</p>
      <div className="divide-y divide-gray-100 dark:divide-gray-700/50">{children}</div>
    </div>
  );
}

function StatusPill({ value }) {
  if (!value) return null;
  const ok = ['active', 'completed', 'resolved', 'available', 'released'].includes(value);
  const danger = ['failed', 'cancelled', 'refunded', 'disputed', 'banned', 'inactive'].includes(value);
  return (
    <span className={clsx('badge', ok ? 'badge-success' : danger ? 'badge-danger' : 'badge-warning')}>
      {String(value).replace(/_/g, ' ')}
    </span>
  );
}

function TicketContextSection({ context, loading }) {
  const hasAccount = !!context.account && (!!context.account.role || context.account.isActive === false || context.account.isEmailVerified === false);
  const hasAny =
    hasAccount ||
    !!context.profile ||
    !!context.wallet ||
    context.payments?.length > 0 ||
    context.transactions?.length > 0 ||
    context.escrows?.length > 0 ||
    context.projects?.length > 0 ||
    !!context.relatedProject;

  return (
    <div className="card p-4">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <UserCircleIcon className="w-4 h-4 text-gray-400" />
        User / Account Context
        {loading && <span className="ml-1 inline-block w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />}
      </h4>

      {loading ? (
        <div className="p-6 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : !hasAny ? (
        <p className="text-sm text-gray-400">No additional context available for this ticket.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hasAccount && context.account && (
            <CtxBlock title="Account">
              <CtxRow label="Role" value={context.account.role && String(context.account.role).replace(/_/g, ' ')} />
              <CtxRow label="Account status" value={context.account.isActive ? 'Active' : 'Inactive'} danger={context.account.isActive === false} />
              {context.account.isBanned && (
                <CtxRow label="Ban reason" value={context.account.banReason || 'Banned'} danger />
              )}
              <CtxRow label="Email verified" value={context.account.isEmailVerified === false ? 'No' : null} danger={context.account.isEmailVerified === false} />
              <CtxRow label="Freelancer verified" value={context.account.isVerifiedFreelancer} />
              <CtxRow label="Pending email" value={context.account.pendingEmail} />
              <CtxRow label="Availability" value={context.account.availabilityStatus && String(context.account.availabilityStatus).replace(/_/g, ' ')} />
              <CtxRow label="Country" value={context.account.country} />
              <CtxRow label="Joined" value={fmt(context.account.createdAt)} />
              <CtxRow label="Last seen" value={context.account.lastSeen ? ago(context.account.lastSeen) : null} />
            </CtxBlock>
          )}

          {context.profile && (
            <CtxBlock title="Profile">
              <CtxRow label="Tagline" value={context.profile.tagline} />
              <CtxRow label="Hourly rate" value={context.profile.hourlyRate != null ? `${fmtMoney(context.profile.hourlyRate)}/hr` : null} />
              <CtxRow label="Experience" value={context.profile.yearsOfExperience != null ? `${context.profile.yearsOfExperience} yrs` : null} />
              <CtxRow label="Availability" value={context.profile.availability && String(context.profile.availability).replace(/_/g, ' ')} />
              <CtxRow label="Skills" value={context.profile.skillsCount ? `${context.profile.skillsCount} listed` : null} />
              <CtxRow label="Completion" value={context.profile.completionScore != null ? `${context.profile.completionScore}%` : null} />
              <CtxRow label="Bio" value={context.profile.bio && context.profile.bio.length > 90 ? `${context.profile.bio.slice(0, 90)}…` : context.profile.bio} />
            </CtxBlock>
          )}

          {context.wallet && (
            <CtxBlock title="Wallet">
              <CtxRow label="Balance" value={fmtMoney(context.wallet.balance, context.wallet.currency)} />
              <CtxRow label="Escrow balance" value={fmtMoney(context.wallet.escrowBalance, context.wallet.currency)} />
              <CtxRow label="Pending balance" value={fmtMoney(context.wallet.pendingBalance, context.wallet.currency)} />
              <CtxRow label="Total earned" value={fmtMoney(context.wallet.totalEarned, context.wallet.currency)} />
              <CtxRow label="Total spent" value={fmtMoney(context.wallet.totalSpent, context.wallet.currency)} />
              <CtxRow label="Total withdrawn" value={fmtMoney(context.wallet.totalWithdrawn, context.wallet.currency)} />
              <CtxRow label="Wallet active" value={context.wallet.isActive} danger={context.wallet.isActive === false} />
            </CtxBlock>
          )}

          {context.payments?.length > 0 && (
            <CtxBlock title={`Recent payments (${context.payments.length})`}>
              {context.payments.map((p, i) => (
                <div key={i} className="py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-gray-500 truncate">{p.reference}</span>
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{fmtMoney(p.amount, p.currency)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <StatusPill value={p.status} />
                    <span className="text-[11px] text-gray-400 capitalize">{String(p.type || '').replace(/_/g, ' ')}</span>
                    {p.provider && <span className="text-[11px] text-gray-400 capitalize">{p.provider}</span>}
                  </div>
                  {p.failureReason && <p className="text-[11px] text-red-500 mt-0.5 break-words">{p.failureReason}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">{ago(p.createdAt)}</p>
                </div>
              ))}
            </CtxBlock>
          )}

          {context.transactions?.length > 0 && (
            <CtxBlock title={`Recent transactions (${context.transactions.length})`}>
              {context.transactions.map((t, i) => (
                <div key={i} className="py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs capitalize text-gray-600 dark:text-gray-300">{String(t.type || '').replace(/_/g, ' ')}</span>
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{fmtMoney(t.amount, t.currency)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <StatusPill value={t.status} />
                    <span className="text-[11px] text-gray-400">{ago(t.createdAt)}</span>
                  </div>
                  {t.failureReason && <p className="text-[11px] text-red-500 mt-0.5 break-words">{t.failureReason}</p>}
                </div>
              ))}
            </CtxBlock>
          )}

          {context.escrows?.length > 0 && (
            <CtxBlock title={`Escrows (${context.escrows.length})`}>
              {context.escrows.map((e, i) => (
                <div key={i} className="py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <StatusPill value={e.status} />
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{fmtMoney(e.amount)}</span>
                  </div>
                  {e.disputeReason && <p className="text-[11px] text-red-500 mt-0.5 break-words">Dispute: {e.disputeReason}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">{ago(e.createdAt)}</p>
                </div>
              ))}
            </CtxBlock>
          )}

          {context.projects?.length > 0 && (
            <CtxBlock title={`Projects (${context.projects.length})`}>
              {context.projects.map((pr, i) => (
                <div key={i} className="py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{pr.title}</span>
                    <StatusPill value={pr.status} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[11px] text-gray-400">{fmtMoney(pr.agreedAmount, pr.currency)} agreed</span>
                    {pr.isDisputed && <span className="text-[11px] text-red-500 font-medium">Disputed</span>}
                  </div>
                  {pr.disputeReason && <p className="text-[11px] text-red-500 mt-0.5 break-words">{pr.disputeReason}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">{ago(pr.createdAt)}</p>
                </div>
              ))}
            </CtxBlock>
          )}

          {context.relatedProject && (
            <CtxBlock title="Related project">
              <CtxRow label="Title" value={context.relatedProject.title} />
              <CtxRow label="Status" value={context.relatedProject.status && String(context.relatedProject.status).replace(/_/g, ' ')} />
              <CtxRow label="Agreed amount" value={fmtMoney(context.relatedProject.agreedAmount, context.relatedProject.currency)} />
              <CtxRow label="Paid amount" value={fmtMoney(context.relatedProject.paidAmount, context.relatedProject.currency)} />
              <CtxRow label="Disputed" value={context.relatedProject.isDisputed} danger={context.relatedProject.isDisputed} />
              {context.relatedProject.disputeReason && (
                <CtxRow label="Dispute reason" value={context.relatedProject.disputeReason} danger />
              )}
              <CtxRow label="Created" value={fmt(context.relatedProject.createdAt)} />
              {context.relatedProject.milestones?.length > 0 && (
                <div className="py-1.5">
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Milestones</p>
                  {context.relatedProject.milestones.map((m, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{m.title}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">
                        {fmtMoney(m.amount)} · <StatusPill value={m.status} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {context.relatedProject.escrows?.length > 0 && (
                <div className="py-1.5">
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Escrows</p>
                  {context.relatedProject.escrows.map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="text-xs text-gray-600 dark:text-gray-300">{fmtMoney(e.amount)}</span>
                      <span className="flex items-center gap-1.5">
                        <StatusPill value={e.status} />
                        <span className="text-[11px] text-gray-400">{ago(e.createdAt)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CtxBlock>
          )}
        </div>
      )}
    </div>
  );
}
