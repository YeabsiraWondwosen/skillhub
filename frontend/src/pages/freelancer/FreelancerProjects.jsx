import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FolderIcon } from '@heroicons/react/24/outline';
import { useMyProjects } from '@/hooks/useProjects';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Select from '@/components/ui/Select';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/currency';
import { format } from 'date-fns';

const TABS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'On Hold', value: 'on_hold' },
];

const EMPTY_MESSAGES = {
  active: { title: 'No active projects', description: 'Accepted proposals will appear here as active projects.' },
  completed: { title: 'No completed projects', description: 'Projects you finish will appear here.' },
  on_hold: { title: 'No projects on hold', description: 'Paused projects will appear here.' },
  '': { title: 'No projects yet', description: 'Accepted proposals will appear here as projects.' },
};

export default function FreelancerProjects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') ?? '';
  const [status, setStatus] = useState(() => (TABS.some(t => t.value === urlStatus) ? urlStatus : ''));
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyProjects({ status: status || undefined, page, limit: 10 });
  const projects = data?.data ?? [];
  const meta = data?.meta;
  const empty = EMPTY_MESSAGES[status] ?? EMPTY_MESSAGES[''];

  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
    setSearchParams(value ? { status: value } : {}, { replace: true });
  };

  return (
    <div className="page-container space-y-6">
      <div><h1 className="section-title">My Projects</h1><p className="section-sub">Manage your active and past projects</p></div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Select
          aria-label="Filter projects by status"
          value={status}
          onChange={(e) => changeStatus(e.target.value)}
          className="w-full sm:w-64"
        >
          {TABS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderIcon} title={empty.title} description={empty.description} action={<Link to="/jobs" className="btn-primary btn-sm">Find Jobs</Link>} />
      ) : (
        <div className="space-y-4">
          {projects.map((p, i) => (
            <motion.div key={p._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="card p-5 hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link to={`/projects/${p._id}`} className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 truncate">{p.title}</Link>
                    <Badge status={p.status} />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar src={p.client?.avatar?.url} alt={`${p.client?.firstName}`} size="xs" />
                    <span className="text-xs text-gray-400">{p.client?.firstName} {p.client?.lastName}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mb-2">
                    <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${p.progress ?? 0}%` }} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>Budget: <span className="font-semibold text-gray-600 dark:text-gray-300">{formatCurrency(p.budget?.agreedAmount)}</span></span>
                    <span>·</span>
                    <span>Deadline: {p.timeline?.deadline ? format(new Date(p.timeline.deadline), 'MMM d, yyyy') : '—'}</span>
                    <span>·</span>
                    <span>{p.progress ?? 0}% complete</span>
                  </div>
                </div>
                <Link to={`/projects/${p._id}`} className="btn-primary btn-sm flex-shrink-0">Open</Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <Pagination meta={meta} onPageChange={setPage} />
    </div>
  );
}
