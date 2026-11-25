import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMyContracts } from '@/hooks/useContracts';
import ContractCard from '@/components/contracts/ContractCard';
import Pagination from '@/components/ui/Pagination';
import Select from '@/components/ui/Select';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { FolderIcon } from '@heroicons/react/24/outline';

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Pending Payment', value: 'pending_payment' },
  { label: 'Completed', value: 'completed' },
  { label: 'Disputed', value: 'disputed' },
];

export default function FreelancerContracts() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyContracts({ status: status || undefined, page, limit: 10, as: 'freelancer' });
  const contracts = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="page-container space-y-6">
      <div>
        <h1 className="section-title">Contracts</h1>
        <p className="section-sub">Manage your ongoing and past client projects</p>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Select
          aria-label="Filter contracts by status"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="w-full sm:w-64"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : contracts.length === 0 ? (
        <EmptyState
          icon={FolderIcon}
          title="No contracts yet"
          description="Once a client hires you, your project contracts will appear here."
          action={<Link to="/jobs" className="btn-primary btn-sm">Browse Jobs</Link>}
        />
      ) : (
        <div className="space-y-4">
          {contracts.map((c, i) => (
            <ContractCard key={c._id} contract={c} role="freelancer" index={i} />
          ))}
        </div>
      )}
      <Pagination meta={meta} onPageChange={setPage} />
    </div>
  );
}
