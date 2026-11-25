import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DocumentTextIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useMyApplications, useWithdrawApplication } from '@/hooks/useApplications';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Select from '@/components/ui/Select';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/Modal';
import { formatDistanceToNow } from 'date-fns';
import { formatCurrency } from '@/utils/currency';
import { ArrowRight } from 'lucide-react';

const TABS = ['all', 'pending', 'viewed', 'shortlisted', 'accepted', 'rejected', 'withdrawn'];

const EMPTY_MESSAGES = {
  pending: { title: 'No pending proposals', description: 'Proposals awaiting a client response will appear here.' },
  viewed: { title: 'No viewed proposals', description: 'Proposals a client has opened will appear here.' },
  shortlisted: { title: 'No shortlisted proposals', description: 'Proposals clients shortlisted will appear here.' },
  accepted: { title: 'No accepted proposals', description: 'Accepted proposals will appear here.' },
  rejected: { title: 'No rejected proposals', description: 'Rejected proposals will appear here.' },
  withdrawn: { title: 'No withdrawn proposals', description: 'Proposals you withdraw will appear here.' },
  all: { title: 'No proposals found', description: 'Apply to jobs to see your proposals here.' },
};

export default function FreelancerProposals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') ?? '';
  const [status, setStatus] = useState(() => (TABS.includes(urlStatus) && urlStatus !== 'all' ? urlStatus : ''));
  const [page, setPage] = useState(1);
  const [withdrawId, setWithdrawId] = useState(null);
  const { data, isLoading } = useMyApplications({ status: status || undefined, page, limit: 10 });
  const { mutate: withdraw, isPending: isWithdrawing } = useWithdrawApplication();

  const apps = data?.data ?? [];
  const meta = data?.meta;
  const empty = EMPTY_MESSAGES[status || 'all'] ?? EMPTY_MESSAGES.all;

  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
    setSearchParams(value ? { status: value } : {}, { replace: true });
  };

  return (
    <div className="page-container space-y-6">
      <div>
        <h1 className="section-title">My Proposals</h1>
        <p className="section-sub">Track all your job applications</p>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Select
          aria-label="Filter proposals by status"
          value={status}
          onChange={(e) => changeStatus(e.target.value)}
          className="w-full sm:w-64"
        >
          {TABS.map(t => (
            <option key={t} value={t === 'all' ? '' : t}>{t === 'all' ? 'All' : t}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : apps.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={DocumentTextIcon} title={empty.title}
            description={empty.description}
            action={
              <Link to="/jobs" className="btn-primary btn-sm">
                <SparklesIcon className="w-4 h-4 mr-1 inline" />
                Browse Jobs with AI
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {apps.map((app, i) => (
            <motion.div key={app._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link to={`/jobs/${app.job?._id}`} className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 text-sm">
                      {app.job?.title}
                    </Link>
                    <Badge status={app.status} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>Offer: <span className="font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(app.priceOffer?.amount)}</span></span>
                    <span>·</span>
                    <span>Delivery: {app.deliveryTime?.value} {app.deliveryTime?.unit}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-2">{app.coverLetter}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link to={`/freelancer/proposals/${app._id}`} className="btn-secondary btn-sm">View</Link>
                  {['pending', 'viewed', 'shortlisted'].includes(app.status) && (
                    <button onClick={() => setWithdrawId(app._id)} className="btn-danger btn-sm">Withdraw</button>
                  )}
                </div>
              </div>
              {app.status === 'accepted' && (
                <div className="mt-3 pt-3 border-t border-green-100 dark:border-green-900/20">
                  <Link to="/freelancer/projects" className="text-sm text-green-600 font-medium hover:underline inline-flex items-center gap-1">
                    Accepted! View your project <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <Pagination meta={meta} onPageChange={setPage} />

      <ConfirmModal
        open={!!withdrawId}
        onClose={() => setWithdrawId(null)}
        onConfirm={() => withdraw(withdrawId, { onSuccess: () => setWithdrawId(null) })}
        title="Withdraw Application"
        message="Are you sure you want to withdraw this proposal? This cannot be undone."
        confirmLabel="Withdraw"
        danger
        loading={isWithdrawing}
      />
    </div>
  );
}
