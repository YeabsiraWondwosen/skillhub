import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useJob } from '@/hooks/useJobs';
import { useJobApplications, useUpdateApplicationStatus, useHireFreelancer } from '@/hooks/useApplications';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import StarRating from '@/components/ui/StarRating';
import Pagination from '@/components/ui/Pagination';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/Modal';
import { XMarkIcon, BookmarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import EmptyState from '@/components/ui/EmptyState';
import { formatDistanceToNow } from 'date-fns';
import { formatCurrency } from '@/utils/currency';
import { Check, ArrowLeft } from 'lucide-react';

export default function ApplicantsPage() {
  const { jobId } = useParams();
  const [page, setPage] = useState(1);
  const [hireId, setHireId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const { data: jobData } = useJob(jobId);
  const { data, isLoading } = useJobApplications(jobId, { page, limit: 10 });
  const { mutate: updateStatus } = useUpdateApplicationStatus();
  const { mutate: hire, isPending: isHiring } = useHireFreelancer();
  const applications = data?.data ?? [];
  const meta = data?.meta;
  const job = jobData?.data;

  return (
    <div className="page-container space-y-6">
      <div>
        <Link to="/client/jobs" className="text-sm text-gray-400 hover:text-primary-600 inline-flex items-center gap-1"><ArrowLeft size={14} /> My Jobs</Link>
        <h1 className="section-title mt-1">{job?.title ?? 'Job'} — Applicants</h1>
        <p className="section-sub">{meta?.total ?? 0} proposals received</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : applications.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={DocumentTextIcon} title="No applicants yet"
            description="Proposals will appear here once freelancers apply to your job." />
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app, i) => (
            <motion.div key={app._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }} className="card overflow-hidden">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar src={app.freelancer?.avatar?.url}
                    alt={`${app.freelancer?.firstName} ${app.freelancer?.lastName}`}
                    size="lg" online={app.freelancer?.isOnline} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
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
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(app.priceOffer?.amount)}
                      </span>
                      <span>·</span>
                      <span>{app.deliveryTime?.value} {app.deliveryTime?.unit}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {['pending', 'viewed', 'shortlisted'].includes(app.status) && (
                      <>
                        <button onClick={() => setHireId(app._id)} className="btn-primary btn-sm">
                          Hire
                        </button>
                        <button onClick={() => updateStatus({ id: app._id, data: { status: 'shortlisted' } })}
                          className="btn-secondary btn-sm flex items-center gap-1">
                          <BookmarkIcon className="w-3.5 h-3.5" /> Shortlist
                        </button>
                        <button onClick={() => updateStatus({ id: app._id, data: { status: 'rejected' } })}
                          className="btn-ghost btn-sm text-red-500 flex items-center gap-1">
                          <XMarkIcon className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <button onClick={() => setExpanded(expanded === app._id ? null : app._id)}
                  className="mt-3 text-xs text-primary-600 hover:underline">
                  {expanded === app._id ? 'Hide' : 'Read'} cover letter
                </button>
                {expanded === app._id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {app.coverLetter}
                    </p>
                  </motion.div>
                )}
              </div>
              {app.status === 'accepted' && (
                <div className="px-5 py-2.5 bg-green-50 dark:bg-green-900/20 border-t border-green-100 dark:border-green-800/30">
                  <span className="text-sm font-medium text-green-700 dark:text-green-400 inline-flex items-center gap-1.5">
                    <Check size={15} strokeWidth={3} /> Hired — Project created
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
      <Pagination meta={meta} onPageChange={setPage} />
      <ConfirmModal open={!!hireId} onClose={() => setHireId(null)}
        onConfirm={() => hire(hireId, { onSuccess: () => setHireId(null) })}
        title="Hire Freelancer"
        message="This will accept the proposal and create a project workspace automatically."
        confirmLabel="Hire & Create Project" loading={isHiring} />
    </div>
  );
}
