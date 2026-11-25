import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminFinanceService } from '@/services/adminFinance.service';
import { DataTable, KPICard, SearchInput, SelectFilter, FilterPills } from './components';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { WalletIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';

const SORT_OPTIONS = [
  { label: 'All Wallets', value: '' },
  { label: 'Highest Balance', value: 'balance' },
  { label: 'Most In Escrow', value: 'escrow' },
  { label: 'Most Earned', value: 'earned' },
  { label: 'Most Withdrawn', value: 'withdrawn' },
  { label: 'Recently Created', value: 'recent' },
];

export default function AdminWallets() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState('');
  const [statusFilter, setStatusFilter] = useState();

  const params = useMemo(() => {
    const p = { page, limit: 15 };
    if (searchQuery) p.search = searchQuery;
    if (sort) p.sort = sort;
    if (statusFilter === 'active') p.isActive = 'true';
    return p;
  }, [page, searchQuery, sort, statusFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-finance-wallets', page, searchQuery, sort, statusFilter],
    queryFn: () => adminFinanceService.getWallets(params).then(r => r.data),
  });

  const wallets = data?.data?.wallets ?? [];
  const stats = data?.data?.stats;
  const meta = data?.meta;

  const columns = [
    {
      key: 'user', label: 'User',
      render: (r) => {
        const u = r.user;
        const name = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u?.email || '—' : '—';
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600 shrink-0">
              {name[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white">{name}</p>
              <p className="text-[11px] text-gray-400">{u?.email || '—'}</p>
            </div>
          </div>
        );
      },
    },
    { key: 'role', label: 'Role', render: (r) => r.user?.role ? <Badge status={r.user.role} /> : <span className="text-xs text-gray-400">—</span> },
    {
      key: 'balance', label: 'Balance', align: 'right',
      render: (r) => (
        <div className="text-right">
          <p className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(r.balance, r.currency)}</p>
          <p className="text-[11px] text-green-600">{formatCurrency(r.availableBalance, r.currency)} available</p>
        </div>
      ),
    },
    { key: 'escrowBalance', label: 'Escrow', align: 'right', render: (r) => <span className="text-xs font-semibold text-yellow-600">{formatCurrency(r.escrowBalance, r.currency)}</span> },
    { key: 'pendingBalance', label: 'Pending', align: 'right', render: (r) => <span className="text-xs text-gray-600 dark:text-gray-400">{formatCurrency(r.pendingBalance, r.currency)}</span> },
    { key: 'totalEarned', label: 'Total Earned', align: 'right', render: (r) => <span className="text-xs font-semibold text-green-600">{formatCurrency(r.totalEarned, r.currency)}</span> },
    { key: 'totalWithdrawn', label: 'Total Withdrawn', align: 'right', render: (r) => <span className="text-xs text-orange-600">{formatCurrency(r.totalWithdrawn, r.currency)}</span> },
    {
      key: 'isActive', label: 'Status',
      render: (r) => <Badge status={r.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'createdAt', label: 'Created', align: 'right',
      render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy')}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Platform-wide wallet balances and user funds</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard label="Total Balance" value={formatCurrency(stats.totalBalance)} icon={WalletIcon} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-900/20" onClick={() => { setSort('balance'); setPage(1); }} />
          <KPICard label="In Escrow" value={formatCurrency(stats.totalEscrow)} icon={WalletIcon} color="text-yellow-600" bg="bg-yellow-50 dark:bg-yellow-900/20" onClick={() => { setSort('escrow'); setPage(1); }} />
          <KPICard label="Total Earned" value={formatCurrency(stats.totalEarned)} icon={WalletIcon} color="text-green-600" bg="bg-green-50 dark:bg-green-900/20" onClick={() => { setSort('earned'); setPage(1); }} />
          <KPICard label="Total Withdrawn" value={formatCurrency(stats.totalWithdrawn)} icon={WalletIcon} color="text-orange-600" bg="bg-orange-50 dark:bg-orange-900/20" onClick={() => { setSort('withdrawn'); setPage(1); }} />
          <KPICard label="Active Wallets" value={stats.activeWallets ?? stats.walletCount ?? 0} icon={WalletIcon} color="text-purple-600" bg="bg-purple-50 dark:bg-purple-900/20" sub={`${stats.walletCount || 0} total`} onClick={() => { setStatusFilter(statusFilter === 'active' ? undefined : 'active'); setPage(1); }} />
        </div>
      )}

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(1); }} placeholder="Search by name or email..." />
          <SelectFilter label="All Wallets" value={sort} onChange={(v) => { setSort(v); setPage(1); }} options={SORT_OPTIONS.filter(o => o.value)} />
        </div>
        <div className="flex items-center gap-2">
          <FilterPills options={['', 'active']} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} />
          {(statusFilter || sort) && (
            <button onClick={() => { setStatusFilter(undefined); setSort(''); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WalletIcon className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Wallets</h3>
          </div>
          <span className={clsx('text-xs', meta?.total ? 'text-gray-400' : 'text-gray-400')}>{meta?.total ?? 0} records</span>
        </div>
        <DataTable loading={isLoading} columns={columns} data={wallets} emptyMessage="No wallets found" />
        {meta && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
