import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminService } from '@/services/admin.service';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import { SkeletonText } from '@/components/ui/Skeleton';
import PageHeader from '@/components/ui/PageHeader';
import { CheckCircleIcon, XCircleIcon, BriefcaseIcon, PaperClipIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow, format } from 'date-fns';
import { formatCurrency } from '@/utils/currency';

const STATUS_LABELS = {
  open: 'Open',
  proposals_received: 'Proposals Received',
  freelancer_selected: 'Freelancer Selected',
  payment_pending: 'Payment Required',
  funded: 'Funded',
  in_progress: 'In Progress',
  delivery_submitted: 'Delivery Submitted',
  client_review: 'Client Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
  paused: 'Paused',
  draft: 'Draft',
};

function ErrorState({ message }) {
  return (
    <div className="page-container">
      <PageHeader icon={BriefcaseIcon} title="Job Details" subtitle="Review and moderate job listings" />
      <div className="card p-10 text-center">
        <p className="text-gray-500 mb-4">{message}</p>
        <Link to="/admin/jobs" className="btn-secondary">Back to Jobs</Link>
      </div>
    </div>
  );
}

export default function AdminJobDetail() {
  const { jobId } = useParams();
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'job', jobId],
    queryFn: () => adminService.getJob(jobId).then(r => r.data),
    enabled: !!jobId,
  });
  const job = data?.data;

  const { mutate: moderate, isPending } = useMutation({
    mutationFn: ({ id, data }) => adminService.moderateJob(id, data),
    onSuccess: () => { toast.success('Job moderated'); qc.invalidateQueries({ queryKey: ['admin', 'jobs'] }); qc.invalidateQueries({ queryKey: ['admin', 'job', jobId] }); },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) {
    return (
      <div className="page-container">
        <PageHeader icon={BriefcaseIcon} title="Job Details" subtitle="Loading job..." />
        <div className="card p-6 space-y-4"><SkeletonText lines={10} /></div>
      </div>
    );
  }

  if (isError) {
    const status = error?.response?.status;
    let message = 'Unable to load job.';
    if (status === 404) message = 'Job no longer exists.';
    else if (status === 401 || status === 403) message = 'Unauthorized.';
    else if (status >= 500) message = 'Server error.';
    return <ErrorState message={message} />;
  }

  if (!job) return <ErrorState message="Job no longer exists." />;

  const client = job.client;
  const hired = job.hiredFreelancer;
  const createdAt = job.createdAt && !isNaN(new Date(job.createdAt)) ? new Date(job.createdAt) : null;
  const deadline = job.deadline && !isNaN(new Date(job.deadline)) ? new Date(job.deadline) : null;

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader icon={BriefcaseIcon} title="Job Details" subtitle="Review and moderate job listings" />
        <Link to="/admin/jobs" className="btn-secondary btn-sm">
          <ArrowLeftIcon className="w-4 h-4 mr-1" /> Back to Jobs
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Badge status={job.status}>{STATUS_LABELS[job.status] || job.status}</Badge>
          {job.paymentStatus !== 'none' && <Badge status={job.paymentStatus}>{job.paymentStatus}</Badge>}
          {job.isApproved ? <Badge status="approved">Approved</Badge> : <Badge status="pending">Pending Review</Badge>}
          {job.isUrgent && <Badge status="urgent">Urgent</Badge>}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{job.title}</h1>
        <p className="text-sm text-gray-400">
          {createdAt ? `Posted ${formatDistanceToNow(createdAt, { addSuffix: true })}` : 'Posted date unavailable'}
          {job.viewsCount !== undefined && ` · ${job.viewsCount} views`}
          {job.applicationsCount !== undefined && ` · ${job.applicationsCount} proposals`}
        </p>
      </div>

      {!job.isApproved && (
        <div className="card p-6 border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-2">Pending Moderation</h3>
          <p className="text-sm text-amber-600 dark:text-amber-500 mb-4">Approve or reject this job listing.</p>
          <div className="flex gap-3">
            <Button onClick={() => moderate({ id: job._id, data: { isApproved: true } })} loading={isPending}>
              <CheckCircleIcon className="w-4 h-4 mr-1" /> Approve
            </Button>
            <Button variant="danger" onClick={() => moderate({ id: job._id, data: { isApproved: false, rejectionReason: 'Violates guidelines' } })} loading={isPending}>
              <XCircleIcon className="w-4 h-4 mr-1" /> Reject
            </Button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Job Description</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{job.description}</p>
          </div>

          {job.requiredSkills?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Required Skills</h2>
              <div className="flex flex-wrap gap-2">
                {job.requiredSkills.map(s => <span key={s} className="badge badge-primary">{s}</span>)}
              </div>
            </div>
          )}

          {job.attachments?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Attachments</h2>
              <div className="space-y-2">
                {job.attachments.map(a => (
                  <a key={a.publicId} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary-600 hover:underline">
                    <PaperClipIcon className="w-4 h-4" />{a.originalName}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {formatCurrency(job.budget?.maxAmount, job.budget?.currency)}
              </p>
              <p className="text-xs text-gray-400">Budget · {job.budget?.type}</p>
            </div>
            <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              {[
                { label: 'Experience', value: job.experienceLevel },
                { label: 'Duration', value: job.duration?.replace(/_/g, ' ') },
                { label: 'Deadline', value: deadline ? format(deadline, 'MMM d, yyyy') : '—' },
                { label: 'Category', value: job.category?.name || (job.category ? String(job.category).slice(-6) : '—') },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {client && (
            <div className="card p-5">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Client</h3>
              <div className="flex items-center gap-3">
                <Avatar src={client.avatar?.url} alt={`${client.firstName} ${client.lastName}`} size="md" online={client.isOnline} />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{client.firstName} {client.lastName}</p>
                  <p className="text-xs text-gray-400 truncate">{client.email || 'No email'}</p>
                </div>
              </div>
            </div>
          )}

          {hired && (
            <div className="card p-5">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Hired Freelancer</h3>
              <div className="flex items-center gap-3">
                <Avatar src={hired.avatar?.url} alt={`${hired.firstName} ${hired.lastName}`} size="md" />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{hired.firstName} {hired.lastName}</p>
                  <p className="text-xs text-gray-400 truncate">{hired.email || 'No email'}</p>
                </div>
              </div>
            </div>
          )}

          {job.rejectionReason && (
            <div className="card p-5 border-2 border-red-200 dark:border-red-800">
              <h3 className="font-semibold text-sm text-red-600 dark:text-red-400 mb-1">Rejection Reason</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{job.rejectionReason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
