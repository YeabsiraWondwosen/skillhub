import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFinanceService } from '@/services/adminFinance.service';
import { DataTable, DateRangeFilter, SelectFilter, SearchInput, ActionModal } from './components';
import Pagination from '@/components/ui/Pagination';
import { SkeletonText } from '@/components/ui/Skeleton';
import { format } from 'date-fns';
import { EyeIcon } from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';
import { clsx } from 'clsx';
import { formatCurrency } from '@/utils/currency';

const SOURCE_LABELS = {
  milestone: 'Milestone',
  project: 'Project',
  service_order: 'Service Order',
  escrow: 'Escrow',
  job: 'Job',
  other: 'Other',
};

const SOURCE_COLORS = {
  milestone: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
  project: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600',
  service_order: 'bg-green-50 dark:bg-green-900/20 text-green-600',
  escrow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600',
  job: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
  other: 'bg-gray-100 dark:bg-dark-700 text-gray-500',
};

const SOURCE_FILTERS = [
  { value: 'milestone', label: 'Milestone' },
  { value: 'project', label: 'Project' },
  { value: 'service_order', label: 'Service Order' },
  { value: 'other', label: 'Other' },
];

function SourceBadge({ source }) {
  const label = SOURCE_LABELS[source] || 'Other';
  const color = SOURCE_COLORS[source] || SOURCE_COLORS.other;
  return <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize', color)}>{label}</span>;
}

function RelatedCell({ c }) {
  const related = c._related;
  if (related?.name) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{related.name}</p>
        {related.orderNumber && <p className="text-[11px] text-gray-400">Order {related.orderNumber}</p>}
      </div>
    );
  }
  if (c.milestoneId?.title) {
    return <span className="text-xs text-gray-500 truncate max-w-[200px] block">{c.milestoneId.title}</span>;
  }
  if (c.description) {
    return <span className="text-xs text-gray-400 truncate max-w-[200px] block">{c.description}</span>;
  }
  return <span className="text-xs text-gray-300">—</span>;
}

function InfoBlock({ label, children }) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
      <p className="text-[11px] text-gray-400 uppercase font-medium">{label}</p>
      <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">{children || '—'}</div>
    </div>
  );
}

function CommissionDetailModal({ commission, onClose }) {
  const c = commission;
  const source = SOURCE_LABELS[c._source] || 'Other';
  const related = c._related;
  const rate = c._commissionRate;

  return (
    <ActionModal isOpen onClose={onClose} title="Commission Details">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-medium">Commission ID</p>
            <p className="font-mono text-xs text-gray-900 dark:text-white mt-0.5 break-all">{c.reference}</p>
          </div>
          <span className="text-sm font-bold text-green-600">{formatCurrency(c.amount, c.currency)}</span>
        </div>

        <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <p className="text-[11px] text-gray-400 uppercase font-medium mb-3">How this commission was generated</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Source</span>
              <span className="font-medium text-gray-900 dark:text-white">{source}</span>
            </div>
            {related?.name && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 shrink-0">{related.label}</span>
                <span className="font-medium text-gray-900 dark:text-white text-right truncate max-w-[240px]">{related.name}</span>
              </div>
            )}
            {related?.orderNumber && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Order</span>
                <span className="font-mono text-xs text-gray-900 dark:text-white">{related.orderNumber}</span>
              </div>
            )}
            {c.milestoneId?.title && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 shrink-0">Milestone</span>
                <span className="font-medium text-gray-900 dark:text-white text-right truncate max-w-[240px]">{c.milestoneId.title}</span>
              </div>
            )}
            <div className="border-t border-gray-100 dark:border-gray-700 my-2" />
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Original amount</span>
              <span className="font-medium text-gray-900 dark:text-white">{c._originalAmount != null ? formatCurrency(c._originalAmount, c.currency) : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Commission rate</span>
              <span className="font-medium text-gray-900 dark:text-white">{rate != null ? `${rate}%` : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Commission</span>
              <span className="font-semibold text-green-600">{formatCurrency(c.amount, c.currency)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoBlock label="User">
            <p>{c.user?.firstName} {c.user?.lastName}</p>
            <p className="text-[11px] font-normal text-gray-400">{c.user?.email}</p>
          </InfoBlock>
          <InfoBlock label="Payment Date">{format(new Date(c.createdAt), 'MMM d, yyyy HH:mm')}</InfoBlock>
          <InfoBlock label="Transaction ID">
            <p className="font-mono text-xs break-all">{c.reference}</p>
          </InfoBlock>
          {c.paymentId?.reference && (
            <InfoBlock label="Related Payment">
              <p className="font-mono text-xs break-all">{c.paymentId.reference}</p>
              <p className="text-[11px] font-normal text-gray-400 capitalize">{c.paymentId.status}</p>
            </InfoBlock>
          )}
          {c.metadata?.escrowId && (
            <InfoBlock label="Related Escrow">
              <p className="font-mono text-xs">{String(c.metadata.escrowId).slice(-12)}</p>
            </InfoBlock>
          )}
        </div>

        {c.description && (
          <InfoBlock label="Description">
            <p className="font-normal text-gray-600 dark:text-gray-300">{c.description}</p>
          </InfoBlock>
        )}
      </div>
    </ActionModal>
  );
}

function CommissionSettingsForm({ settings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    defaultRate: settings?.defaultRate ? (settings.defaultRate * 100).toFixed(0) : '10',
    clientFee: settings?.clientFee || '0',
    withdrawalFee: settings?.withdrawalFee || '0',
    vat: settings?.vat || '0',
  });

  const mutation = useMutation({
    mutationFn: (data) => adminFinanceService.updateCommissionSettings({
      defaultRate: parseFloat(data.defaultRate) / 100,
      clientFee: parseFloat(data.clientFee),
      withdrawalFee: parseFloat(data.withdrawalFee),
      vat: parseFloat(data.vat),
    }),
    onSuccess: () => queryClient.invalidateQueries(['admin-finance-commission-settings']),
  });

  if (!settings) return <SkeletonText lines={4} />;

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Default Commission Rate (%)</label>
          <input type="number" value={form.defaultRate} onChange={e => setForm(f => ({ ...f, defaultRate: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Client Fee (ETB)</label>
          <input type="number" value={form.clientFee} onChange={e => setForm(f => ({ ...f, clientFee: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Withdrawal Fee (ETB)</label>
          <input type="number" value={form.withdrawalFee} onChange={e => setForm(f => ({ ...f, withdrawalFee: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">VAT / Tax (%)</label>
          <input type="number" value={form.vat} onChange={e => setForm(f => ({ ...f, vat: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white" />
        </div>
      </div>

      {settings.gatewayFees && (
        <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Gateway Fees</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(settings.gatewayFees).map(([g, f]) => (
              <div key={g} className="text-center">
                <p className="text-[11px] text-gray-400 capitalize">{g.replace(/_/g, ' ')}</p>
                <p className="text-xs font-bold text-gray-900 dark:text-white">{(f * 100).toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

export default function AdminRevenueCommission() {
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [sourceFilter, setSourceFilter] = useState(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('history');
  const [detailCommission, setDetailCommission] = useState(null);

  const dateParams = useMemo(() => {
    const p = {};
    if (dateRange.startDate) p.startDate = dateRange.startDate;
    if (dateRange.endDate) p.endDate = dateRange.endDate;
    return p;
  }, [dateRange]);

  const { data: commissionHistory, isLoading: commissionLoading } = useQuery({
    queryKey: ['admin-finance-commission', page, dateParams, sourceFilter, searchQuery],
    queryFn: () => adminFinanceService.getCommissionHistory({
      page, limit: 15, ...dateParams,
      source: sourceFilter,
      q: searchQuery || undefined,
    }).then(r => r.data),
    enabled: activeTab === 'history',
  });

  const { data: commissionSettings } = useQuery({
    queryKey: ['admin-finance-commission-settings'],
    queryFn: () => adminFinanceService.getCommissionSettings().then(r => r.data),
    enabled: activeTab === 'settings',
  });

  const resetFilters = useCallback(() => {
    setSourceFilter(undefined);
    setSearchQuery('');
    setDateRange({ startDate: '', endDate: '' });
    setPage(1);
  }, []);

  const columns = [
    {
      key: 'user', label: 'User',
      render: (r) => (
        <div>
          <p className="text-xs font-medium text-gray-900 dark:text-white">{r.user?.firstName} {r.user?.lastName}</p>
          <p className="text-[11px] text-gray-400">{r.user?.email}</p>
        </div>
      ),
    },
    {
      key: 'source', label: 'Source',
      render: (r) => <SourceBadge source={r._source} />,
    },
    {
      key: 'related', label: 'Related Item',
      render: (r) => <RelatedCell c={r} />,
    },
    {
      key: 'originalAmount', label: 'Original Amount', align: 'right',
      render: (r) => <span className="text-xs text-gray-500 dark:text-gray-400">{r._originalAmount != null ? formatCurrency(r._originalAmount, r.currency) : '—'}</span>,
    },
    {
      key: 'rate', label: 'Rate', align: 'right',
      render: (r) => <span className="text-xs text-gray-500">{r._commissionRate != null ? `${r._commissionRate}%` : '—'}</span>,
    },
    {
      key: 'amount', label: 'Commission', align: 'right',
      render: (r) => <span className="text-xs font-bold text-green-600">{formatCurrency(r.amount, r.currency)}</span>,
    },
    {
      key: 'reference', label: 'Transaction / Reference',
      render: (r) => <span className="text-xs font-mono text-gray-400">{r.reference?.slice(0, 18)}</span>,
    },
    {
      key: 'createdAt', label: 'Date',
      render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy')}</span>,
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => (
        <button onClick={() => setDetailCommission(r)} title="View Details"
          className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
          <EyeIcon className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revenue & Commission</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Commission history and settings</p>
        </div>
        {activeTab === 'history' && <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />}
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'history', label: 'Commission History' },
          { id: 'settings', label: 'Commission Settings' },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setPage(1); }}
            className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'history' && (
        <>
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(1); }} placeholder="Search user or reference..." />
              <SelectFilter label="All Sources" value={sourceFilter} onChange={(v) => { setSourceFilter(v); setPage(1); }} options={SOURCE_FILTERS} />
              {(searchQuery || sourceFilter || dateRange.startDate || dateRange.endDate) && (
                <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-primary-600 transition-colors">
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <DataTable loading={commissionLoading} columns={columns} data={commissionHistory?.data || []} emptyMessage="No commission records" />
            {commissionHistory?.meta && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                <Pagination meta={commissionHistory.meta} onPageChange={setPage} />
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'settings' && (
        <div className="card p-6 max-w-2xl">
          <CommissionSettingsForm settings={commissionSettings?.data} />
        </div>
      )}

      {detailCommission && <CommissionDetailModal commission={detailCommission} onClose={() => setDetailCommission(null)} />}
    </div>
  );
}
