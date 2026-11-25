import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Avatar from '@/components/ui/Avatar';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { UsersIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { ArrowRight } from 'lucide-react';

const ROLES = ['', 'freelancer', 'client', 'admin'];
const PERIODS = [
  { value: '', label: 'All Time' },
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
];

export default function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState(searchParams.get('role') ?? '');
  const [period, setPeriod] = useState(searchParams.get('period') ?? (searchParams.get('newThisMonth') === 'true' ? 'month' : ''));
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    setRole(searchParams.get('role') ?? '');
    setPeriod(searchParams.get('period') ?? (searchParams.get('newThisMonth') === 'true' ? 'month' : ''));
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', { page, role, search, period }],
    queryFn: () => adminService.getUsers({ page, limit: 15, role: role || undefined, search: search || undefined, period: period || undefined }).then(r => r.data),
  });
  const users = data?.data ?? [];
  const meta = data?.meta;

  const { data: statsData } = useQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: () => adminService.getUserStats().then(r => r.data),
  });
  const regStats = statsData?.data;

  const periodCards = [
    { value: 'day', label: 'Today', count: regStats?.today },
    { value: 'week', label: 'Last 7 Days', count: regStats?.week },
    { value: 'month', label: 'This Month', count: regStats?.month },
    { value: 'year', label: 'This Year', count: regStats?.year },
  ];

  const changePeriod = (next) => {
    const params = new URLSearchParams(searchParams);
    params.delete('newThisMonth');
    if (next) params.set('period', next);
    else params.delete('period');
    setSearchParams(params);
    setPage(1);
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader icon={UsersIcon} title="Manage Users" subtitle="View and manage all platform users" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {periodCards.map(card => (
          <button
            key={card.value}
            type="button"
            onClick={() => changePeriod(card.value)}
            className={clsx(
              'stat-card text-left hover:shadow-card-hover transition-all',
              period === card.value && 'ring-2 ring-primary-500'
            )}
          >
            <p className="stat-value">{card.count ?? '–'}</p>
            <p className="stat-label">{card.label}</p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => changePeriod('')}
          className={clsx(
            'stat-card text-left hover:shadow-card-hover transition-all',
            period === '' && 'ring-2 ring-primary-500'
          )}
        >
          <p className="stat-value">{regStats?.total ?? '–'}</p>
          <p className="stat-label">All Users</p>
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
          className="flex gap-2 flex-1 min-w-48">
          <div className="flex-1">
            <Input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Search users…" icon={MagnifyingGlassIcon} />
          </div>
          <button type="submit" className="btn-primary btn-sm">Search</button>
        </form>
        <div className="flex gap-2 flex-wrap">
          {ROLES.map(r => (
            <button key={r || 'all'} onClick={() => { setRole(r); setPage(1); }}
              className={clsx('filter-pill capitalize', role === r && 'filter-pill-active')}>
              {r || 'All'}
            </button>
          ))}
        </div>
        <div className="w-48">
          <Select value={period} onChange={e => changePeriod(e.target.value)} aria-label="Registered period">
            {PERIODS.map(p => (
              <option key={p.value || 'all'} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : users.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No users found"
            description="Users will appear here once they register on the platform." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                {['User', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar src={u.avatar?.url} alt={`${u.firstName} ${u.lastName}`} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td><Badge status={u.role} /></td>
                  <td>
                    {u.isBanned ? <Badge status="rejected">Banned</Badge>
                      : u.isActive ? <Badge status="active">Active</Badge>
                        : <Badge status="cancelled">Inactive</Badge>}
                  </td>
                  <td className="text-gray-400 text-xs">
                    {format(new Date(u.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td>
                    <Link to={`/admin/users/${u._id}`} className="text-primary-600 hover:underline text-xs font-medium inline-flex items-center gap-1">
                      Manage <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
