import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DocumentTextIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useClientReceivedProposals } from '@/hooks/useApplications';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import StarRating from '@/components/ui/StarRating';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonCard } from '@/components/ui/Skeleton';
import PageHeader from '@/components/ui/PageHeader';
import { formatDistanceToNow } from 'date-fns';
import { formatCurrency } from '@/utils/currency';

const PENDING = ['pending', 'viewed', 'shortlisted'];

const TABS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Withdrawn', value: 'withdrawn' },
];

const matches = (app, value) => {
  if (!value) return true;
  if (value === 'pending') return PENDING.includes(app.status);
  return app.status === value;
};

const PAGE_SIZE = 8;

export default function ClientProposalsPage() {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useClientReceivedProposals();
  const proposals = data ?? [];

  const filtered = useMemo(() => proposals.filter(a => matches(a, filter)), [proposals, filter]);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = useMemo(() => ({
    pending: proposals.filter(a => PENDING.includes(a.status)).length,
    accepted: proposals.filter(a => a.status === 'accepted').length,
    rejected: proposals.filter(a => a.status === 'rejected').length,
    withdrawn: proposals.filter(a => a.status === 'withdrawn').length,
  }), [proposals]);

  const handleTab = (value) => { setFilter(value); setPage(1); };

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={UserGroupIcon}
        title="Received Proposals"
        subtitle="Proposals received across all your posted jobs"
        actions={<Link to="/client/jobs/new" className="btn-primary">Post a Job</Link>}
      />

      <div className="card p-4 flex items-center gap-2">
        <label htmlFor="proposal-filter" className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Status</label>
        <div className="w-full sm:w-56">
          <select id="proposal-filter" value={filter} onChange={(e) => handleTab(e.target.value)} className="input">
            {TABS.map(t => (
              <option key={t.value || 'all'} value={t.value}>
                {t.label}{t.value !== '' && t.value in counts ? ` (${counts[t.value]})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : proposals.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={DocumentTextIcon} title="No proposals yet"
            description="Proposals from freelancers will appear here once they apply to your jobs."
            action={<Link to="/client/jobs/new" className="btn-primary btn-sm">Post a Job</Link>} />
        </div>
      ) : current.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={DocumentTextIcon} title={`No ${filter || 'matching'} proposals`}
            description="No proposals in this category right now." />
        </div>
      ) : (
        <div className="space-y-4">
          {current.map((app, i) => (
            <motion.div key={app._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="card p-5">
              <div className="flex items-start gap-4">
                <Avatar src={app.freelancer?.avatar?.url}
                  alt={`${app.freelancer?.firstName} ${app.freelancer?.lastName}`}
                  size="lg" online={app.freelancer?.isOnline} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/freelancers/${app.freelancer?._id}`} target="_blank"
                      className="font-semibold text-gray-900 dark:text-white hover:text-primary-600">
                      {app.freelancer?.firstName} {app.freelancer?.lastName}
                    </Link>
                    <Badge status={app.status} />
                    {app.aiMatchScore > 0 && (
                      <span className="text-xs font-semibold text-primary-600 bg-primary-50
                        dark:bg-primary-900/20 px-2 py-0.5 rounded-full">
                        {app.aiMatchScore}% match
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <StarRating value={app.freelancer?.stats?.averageRating ?? 0} readonly size="sm" />
                    <span className="text-xs text-gray-400">({app.freelancer?.stats?.totalReviews ?? 0})</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(app.priceOffer?.amount)}
                    </span>
                    <span>·</span>
                    <span>{app.deliveryTime?.value} {app.deliveryTime?.unit}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-400">For job:</span>
                    <Link to={`/jobs/${app.job?._id}`} className="text-xs font-medium text-primary-600 hover:underline truncate">
                      {app.job?.title ?? '—'}
                    </Link>
                  </div>
                  {app.coverLetter && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-2">{app.coverLetter}</p>
                  )}
                </div>
                <Link to={`/client/jobs/${app.job?._id}/applicants`} className="btn-secondary btn-sm flex-shrink-0">
                  Manage
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <Pagination meta={{ page, totalPages, total, hasPrevPage: page > 1, hasNextPage: page < totalPages }} onPageChange={setPage} />
      )}
    </div>
  );
}
