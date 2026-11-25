import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Avatar from '@/components/ui/Avatar';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/currency';
import { format, formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import {
  ShoppingBagIcon, EyeIcon, MagnifyingGlassIcon,
  ScaleIcon, CommandLineIcon, ClockIcon, BriefcaseIcon,
  CheckCircleIcon, ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const ORDER_STATUSES = [
  'all', 'pending_payment', 'funded', 'accepted', 'delivered',
  'revision_requested', 'completed', 'declined', 'cancelled', 'refunded', 'disputed',
];

const ORDER_LABELS = {
  all: 'All',
  active: 'Active Orders',
  pending_payment: 'Pending Payment',
  funded: 'Funded',
  accepted: 'Accepted',
  delivered: 'Delivered',
  revision_requested: 'Revision Requested',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  disputed: 'Disputed',
};

const ORDER_COLORS = {
  pending_payment: 'badge-warning',
  funded: 'badge-info',
  accepted: 'badge-success',
  delivered: 'badge-primary',
  revision_requested: 'badge-danger',
  completed: 'badge-success',
  declined: 'badge-gray',
  cancelled: 'badge-gray',
  refunded: 'badge-primary',
  disputed: 'badge-danger',
};

const ACTIVE_STATUSES = ['funded', 'accepted', 'delivered', 'revision_requested'];
const ACTIVE_FILTER = ACTIVE_STATUSES.join(',');
const STATUS_OPTIONS = ['all', 'active', ...ORDER_STATUSES.filter(s => s !== 'all')];

const StatusBadge = ({ status }) => (
  <span className={clsx('badge capitalize', ORDER_COLORS[status])}>
    {ORDER_LABELS[status] ?? status?.replace(/_/g, ' ')}
  </span>
);

const formatDelivery = (tier) => {
  if (!tier?.deliveryTime) return null;
  const n = Number(tier.deliveryTime);
  const unit = tier.deliveryUnit || 'days';
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
};

const transactionId = (ref) => (ref?._id ?? ref)?.toString();

export default function AdminServiceOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? 'all';
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);

  const setFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    setSearchParams(params);
  };

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setFilter('page', '1'); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'services', 'orders', { page, status, search }],
    queryFn: () => adminService.getServiceOrders({
      page, limit: 15,
      status: status === 'active' ? ACTIVE_FILTER : (status || undefined),
      search: search || undefined,
    }).then(r => r.data),
  });
  const orders = data?.data ?? [];
  const meta = data?.meta;
  const counts = data?.meta?.counts ?? {};

  const { data: detail, isFetching: loadingDetail } = useQuery({
    queryKey: ['admin', 'services', 'orders', 'detail', viewing?._id],
    queryFn: () => adminService.getServiceOrder(viewing._id).then(r => r.data?.data),
    enabled: !!viewing,
  });

  const activeCount = ACTIVE_STATUSES.reduce((sum, k) => sum + (counts[k] || 0), 0);
  const totalCount = ORDER_STATUSES.filter(s => s !== 'all').reduce((sum, k) => sum + (counts[k] || 0), 0);

  const summary = [
    { status: 'all', label: 'Total Orders', value: totalCount, icon: ShoppingBagIcon, color: 'text-primary-600 dark:text-primary-400' },
    { status: 'pending_payment', label: 'Pending Payment', value: counts.pending_payment || 0, icon: ClockIcon, color: 'text-yellow-600 dark:text-yellow-400' },
    { status: 'active', label: 'Active Orders', value: activeCount, icon: BriefcaseIcon, color: 'text-sky-600 dark:text-sky-400' },
    { status: 'completed', label: 'Completed', value: counts.completed || 0, icon: CheckCircleIcon, color: 'text-emerald-600 dark:text-emerald-400' },
    { status: 'disputed', label: 'Disputed', value: counts.disputed || 0, icon: ScaleIcon, color: 'text-red-600 dark:text-red-400' },
  ];

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={ShoppingBagIcon}
        title="Service Orders"
        subtitle="Monitor and manage all service orders on the platform"
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {summary.map(s => (
          <button key={s.label} onClick={() => setFilter('status', s.status === 'all' ? '' : s.status)}
            className={clsx(
              'stat-card text-left cursor-pointer transition-all hover:shadow-card-hover',
              status === s.status && 'ring-2 ring-primary-500/60',
            )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-value">{s.value}</p>
                <p className="stat-label">{s.label}</p>
              </div>
              <s.icon className={clsx('w-6 h-6', s.color)} />
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-full sm:w-64">
          <Select value={status} onChange={e => setFilter('status', e.target.value === 'all' ? '' : e.target.value)} className="capitalize">
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>
                {ORDER_LABELS[s]}
                {s !== 'all' && (s === 'active' ? activeCount : counts[s]) > 0 && ` (${s === 'active' ? activeCount : counts[s]})`}
              </option>
            ))}
          </Select>
        </div>

        <div className="relative w-full sm:w-72">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search order #, client, freelancer or service…"
            className="input pl-9"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : orders.length === 0 ? (
          <EmptyState icon={ShoppingBagIcon} title="No orders found"
            description="No service orders match the current filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Freelancer</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Escrow</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
                {orders.map(o => (
                  <tr key={o._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap">{o.orderNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{o.title}</p>
                      {o.service?.title && o.service.title !== o.title && (
                        <p className="text-xs text-gray-400 max-w-[200px] truncate">{o.service.title}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar src={o.client?.avatar?.url} alt={`${o.client?.firstName} ${o.client?.lastName}`} size="xs" />
                        <span className="text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {o.client?.firstName} {o.client?.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar src={o.freelancer?.avatar?.url} alt={`${o.freelancer?.firstName} ${o.freelancer?.lastName}`} size="xs" />
                        <span className="text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {o.freelancer?.firstName} {o.freelancer?.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="capitalize text-gray-900 dark:text-white">{o.tier?.name || '—'}</p>
                      {formatDelivery(o.tier) && <p className="text-xs text-gray-400">{formatDelivery(o.tier)}</p>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(o.budget?.amount, o.budget?.currency) || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {o.escrow ? <Badge status={o.escrow.status} /> : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {o.createdAt ? format(new Date(o.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button onClick={() => setViewing(o)} className="btn btn-ghost btn-sm whitespace-nowrap" title="View order details">
                          <EyeIcon className="w-4 h-4" /> View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <Pagination meta={meta} onPageChange={p => setFilter('page', p)} />
        </div>
      </div>

      {/* View-only order details */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Order Details" size="lg">
        {loadingDetail && viewing ? (
          <div className="p-4 space-y-3"><SkeletonCard /></div>
        ) : detail ? (
          <div className="space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={detail.status} />
              {detail.escrow && <Badge status={detail.escrow.status}>escrow · {detail.escrow.status.replace(/_/g, ' ')}</Badge>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Order ID</p>
                <p className="font-mono text-xs font-medium text-gray-900 dark:text-white">{detail.orderNumber || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Created</p>
                <p className="text-gray-900 dark:text-white">{detail.createdAt ? format(new Date(detail.createdAt), 'MMM d, yyyy') : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Expected Delivery</p>
                <p className="text-gray-900 dark:text-white">
                  {detail.expectedDelivery ? format(new Date(detail.expectedDelivery), 'MMM d, yyyy') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Client</p>
                <div className="flex items-center gap-2">
                  <Avatar src={detail.client?.avatar?.url} alt={`${detail.client?.firstName} ${detail.client?.lastName}`} size="sm" />
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white truncate">{detail.client?.firstName} {detail.client?.lastName}</p>
                    {detail.client?.email && <p className="text-xs text-gray-400 truncate">{detail.client.email}</p>}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Freelancer</p>
                <div className="flex items-center gap-2">
                  <Avatar src={detail.freelancer?.avatar?.url} alt={`${detail.freelancer?.firstName} ${detail.freelancer?.lastName}`} size="sm" />
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white truncate">{detail.freelancer?.firstName} {detail.freelancer?.lastName}</p>
                    {detail.freelancer?.email && <p className="text-xs text-gray-400 truncate">{detail.freelancer.email}</p>}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Service</p>
                <div className="flex items-center gap-2 min-w-0">
                  {detail.service?.images?.[0]?.url ? (
                    <img src={detail.service.images[0].url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center shrink-0">
                      <CommandLineIcon className="w-4 h-4 text-gray-400" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white truncate">{detail.title || '—'}</p>
                    {detail.service?.title && detail.service.title !== detail.title && (
                      <p className="text-xs text-gray-400 truncate">{detail.service.title}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {detail.budget?.amount != null && (
              <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Package</p>
                  <p className="capitalize font-medium text-gray-900 dark:text-white">{detail.tier?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Amount</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(detail.budget.amount, detail.budget.currency)}</p>
                </div>
                {formatDelivery(detail.tier) && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Delivery</p>
                    <p className="text-gray-900 dark:text-white">{formatDelivery(detail.tier)}</p>
                  </div>
                )}
                {detail.tier?.revisions != null && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Revisions</p>
                    <p className="text-gray-900 dark:text-white">{detail.tier.revisions} included</p>
                  </div>
                )}
              </div>
            )}

            {detail.tier?.title && <p className="text-sm text-gray-600 dark:text-gray-300">{detail.tier.title}</p>}
            {detail.tier?.features?.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-0.5">
                {detail.tier.features.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            )}

            {detail.description && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Details</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">{detail.description}</p>
              </div>
            )}

            {detail.requirements && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Requirements</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">{detail.requirements}</p>
              </div>
            )}

            {detail.additionalNotes && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Additional Notes</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">{detail.additionalNotes}</p>
              </div>
            )}

            {detail.escrow && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Payment & Escrow</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div className="rounded-lg bg-gray-50 dark:bg-dark-700/40 p-3">
                    <p className="text-xs text-gray-400">Escrow Amount</p>
                    <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(detail.escrow.amount, detail.budget?.currency) || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-dark-700/40 p-3">
                    <p className="text-xs text-gray-400">Commission</p>
                    <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(detail.escrow.commissionAmount, detail.budget?.currency) || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-dark-700/40 p-3">
                    <p className="text-xs text-gray-400">Freelancer Receives</p>
                    <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(detail.escrow.freelancerAmount, detail.budget?.currency) || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-dark-700/40 p-3">
                    <p className="text-xs text-gray-400">Funding Transaction</p>
                    <p className="font-mono text-xs text-gray-900 dark:text-white break-all">{transactionId(detail.escrow.fundingTransaction) || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-dark-700/40 p-3">
                    <p className="text-xs text-gray-400">Release Transaction</p>
                    <p className="font-mono text-xs text-gray-900 dark:text-white break-all">{transactionId(detail.escrow.releaseTransaction) || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-dark-700/40 p-3">
                    <p className="text-xs text-gray-400">Refund Transaction</p>
                    <p className="font-mono text-xs text-gray-900 dark:text-white break-all">{transactionId(detail.escrow.refundTransaction) || '—'}</p>
                  </div>
                </div>
              </div>
            )}

            {detail.timeline && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Timeline</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(detail.timeline).filter(([, v]) => v).map(([k, v]) => (
                    <span key={k} className="badge badge-gray">
                      {k.replace(/([A-Z])/g, ' $1')}: {formatDistanceToNow(new Date(v), { addSuffix: true })}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {detail.status === 'disputed' && (
              <div className="rounded-lg border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-3 text-sm text-gray-700 dark:text-gray-300">
                This order is under dispute and is awaiting resolution.
              </div>
            )}

            <div className="flex flex-wrap justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setViewing(null)} className="btn btn-secondary btn-sm">
                <ArrowLeftIcon className="w-4 h-4 mr-1" /> Back to Service Orders
              </button>
            </div>
          </div>
        ) : (
          <EmptyState icon={ShoppingBagIcon} title="Order details unavailable" />
        )}
      </Modal>
    </div>
  );
}
