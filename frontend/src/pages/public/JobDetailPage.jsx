import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  ClockIcon, CurrencyDollarIcon, CalendarIcon,
  UserIcon, BriefcaseIcon, PaperClipIcon,
  SparklesIcon, CheckCircleIcon, BanknotesIcon,
  PlayIcon, DocumentCheckIcon, ShieldCheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useJob } from '@/hooks/useJobs';
import { useSubmitApplication } from '@/hooks/useApplications';
import { useAuthStore } from '@/store/authStore';
import {
  useFundJobPayment, useStartJobWork,
  useSubmitJobDelivery, useApproveJobDelivery,
} from '@/hooks/useJobs';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Avatar from '@/components/ui/Avatar';
import { SkeletonText } from '@/components/ui/Skeleton';
import { formatCurrency, formatRate } from '@/utils/currency';
import { formatDistanceToNow, format } from 'date-fns';

const categoryLabel = (cat) => {
  if (!cat) return null;
  if (typeof cat === 'object') return cat.name || cat.slug || null;
  if (typeof cat === 'string') return cat.replace(/_/g, ' ');
  return null;
};

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
};

export default function JobDetailPage() {
  const { jobId } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [applyOpen, setApplyOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryFiles, setDeliveryFiles] = useState(null);
  const { data, isLoading } = useJob(jobId);
  const { mutate: submit, isPending } = useSubmitApplication();
  const { mutate: fundJob, isPending: isFunding } = useFundJobPayment();
  const { mutate: startWork, isPending: isStarting } = useStartJobWork();
  const { mutate: submitDelivery, isPending: isSubmitting } = useSubmitJobDelivery();
  const { mutate: approveDelivery, isPending: isApproving } = useApproveJobDelivery();
  const { register, handleSubmit, formState: { errors }, reset } = useForm();
  const job = data?.data;
  const effectiveProjectProgress = (() => {
    const rawProgress = Number(job?.project?.progress ?? 0);
    if (job?.paymentStatus === 'released' || job?.status === 'completed' || job?.project?.status === 'completed') return 100;
    return Number.isFinite(rawProgress) ? rawProgress : 0;
  })();
  const effectiveJobStatus = (() => {
    if (job?.paymentStatus === 'released' || job?.status === 'completed' || job?.project?.status === 'completed' || effectiveProjectProgress >= 100) return 'completed';
    return job?.status || 'open';
  })();

  const handleApply = (values) => {
    if (!user) { navigate('/auth/login'); return; }
    const fd = new FormData();
    fd.append('coverLetter', values.coverLetter);
    fd.append('priceOffer[amount]', values.amount);
    fd.append('priceOffer[type]', values.offerType);
    fd.append('deliveryTime[value]', values.deliveryValue);
    fd.append('deliveryTime[unit]', values.deliveryUnit);
    submit({ jobId, formData: fd }, {
      onSuccess: () => { setApplyOpen(false); reset(); },
    });
  };

  const handleFund = () => fundJob(jobId);
  const handleStartWork = () => startWork(jobId);
  const handleSubmitDelivery = () => {
    const fd = new FormData();
    fd.append('note', deliveryNote);
    if (deliveryFiles) {
      Array.from(deliveryFiles).forEach((f) => fd.append('attachments', f));
    }
    submitDelivery({ jobId, formData: fd }, { onSuccess: () => { setDeliverOpen(false); setDeliveryNote(''); setDeliveryFiles(null); } });
  };
  const handleApproveDelivery = () => approveDelivery(jobId);

  const isClient = user?._id === job?.client?._id;
  const isFreelancerHired = user?._id === job?.hiredFreelancer?._id;

  const getActionCard = () => {
    if (!user) return null;

    // ── CLIENT ACTIONS ──
    if (isClient) {
      switch (effectiveJobStatus) {
        case 'payment_pending':
          return (
            <div className="card p-5 border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
              <h3 className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-2">
                <BanknotesIcon className="w-5 h-5" /> Payment Required
              </h3>
              <p className="text-sm text-amber-600 dark:text-amber-500 mb-4">
                You've hired a freelancer. Fund the milestone payment to start the project.
                <br /><span className="font-medium">Amount: {formatCurrency(job.budget?.maxAmount, job.budget?.currency)}</span>
              </p>
              <Button onClick={handleFund} loading={isFunding} className="w-full">
                <BanknotesIcon className="w-4 h-4 mr-1" /> Pay Now — Fund Milestone
              </Button>
            </div>
          );
        case 'funded':
          return (
            <div className="card p-5 border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-semibold mb-2">
                <ShieldCheckIcon className="w-5 h-5" /> Payment Funded
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-500">Funds are secured in escrow. Awaiting freelancer to start work.</p>
            </div>
          );
        case 'in_progress':
          return (
            <div className="card p-5 border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-semibold mb-2">
                <PlayIcon className="w-5 h-5" /> Work In Progress
              </div>
              <p className="text-sm text-indigo-600 dark:text-indigo-500">The freelancer is working on this job.</p>
            </div>
          );
        case 'delivery_submitted':
          return (
            <div className="card p-5 border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
              <h3 className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2 mb-2">
                <DocumentCheckIcon className="w-5 h-5" /> Delivery Submitted
              </h3>
              <p className="text-sm text-green-600 dark:text-green-500 mb-4">
                The freelancer has submitted their delivery. Review and approve to release payment.
              </p>
              <Button onClick={handleApproveDelivery} loading={isApproving} className="w-full">
                <CheckCircleIcon className="w-4 h-4 mr-1" /> Approve & Release Payment
              </Button>
            </div>
          );
        case 'completed':
          return (
            <div className="card p-5 border-2 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold mb-2">
                <CheckCircleIcon className="w-5 h-5" /> Completed
              </div>
              <p className="text-sm text-green-600 dark:text-green-500">This job has been completed and payment released.</p>
            </div>
          );
        default:
          return null;
      }
    }

    // ── FREELANCER ACTIONS ──
    if (isFreelancerHired) {
      switch (effectiveJobStatus) {
        case 'payment_pending':
          return (
            <div className="card p-5 border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold mb-2">
                <ClockIcon className="w-5 h-5" /> Awaiting Payment
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-500">
                Payment required before starting this project. The client needs to fund the milestone.
              </p>
            </div>
          );
        case 'funded':
          return (
            <div className="card p-5 border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
              <h3 className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-2">
                <ShieldCheckIcon className="w-5 h-5" /> Payment Received — Ready to Start
              </h3>
              <p className="text-sm text-blue-600 dark:text-blue-500 mb-4">
                The client has funded the milestone. You can now start working on this job.
              </p>
              <Button onClick={handleStartWork} loading={isStarting} className="w-full">
                <PlayIcon className="w-4 h-4 mr-1" /> Start Work
              </Button>
            </div>
          );
        case 'in_progress':
          return (
            <div className="card p-5 border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10">
              <h3 className="font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-2 mb-2">
                <PlayIcon className="w-5 h-5" /> Work In Progress
              </h3>
              <p className="text-sm text-indigo-600 dark:text-indigo-500 mb-4">
                Submit your delivery when ready.
              </p>
              <Button onClick={() => setDeliverOpen(true)} className="w-full">
                <DocumentCheckIcon className="w-4 h-4 mr-1" /> Submit Delivery
              </Button>
            </div>
          );
        case 'delivery_submitted':
          return (
            <div className="card p-5 border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold mb-2">
                <CheckCircleIcon className="w-5 h-5" /> Delivery Submitted
              </div>
              <p className="text-sm text-green-600 dark:text-green-500">Awaiting client review and approval.</p>
            </div>
          );
        case 'completed':
          return (
            <div className="card p-5 border-2 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold mb-2">
                <CheckCircleIcon className="w-5 h-5" /> Completed — Payment Released
              </div>
              <p className="text-sm text-green-600 dark:text-green-500">This job is complete. Payment has been released to your wallet.</p>
            </div>
          );
        default:
          return null;
      }
    }

    return null;
  };

  if (isLoading) return <div className="premium-dark-page"><div className="page-container"><SkeletonText lines={8} /></div></div>;
  if (!job) return <div className="premium-dark-page"><div className="page-container"><p className="text-gray-500">Job not found.</p></div></div>;

  return (
    <div className="premium-dark-page">
      <div className="page-container">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {categoryLabel(job.category) && <Badge status={job.category?.parent?.slug || job.category?.slug} className="capitalize">{categoryLabel(job.category)}</Badge>}
              <Badge status={job.experienceLevel}>{job.experienceLevel}</Badge>
              <Badge status={effectiveJobStatus === 'open' ? 'active' : effectiveJobStatus === 'completed' ? 'completed' : effectiveJobStatus === 'cancelled' ? 'cancelled' : 'pending'}>
                {STATUS_LABELS[effectiveJobStatus] || effectiveJobStatus}
              </Badge>
              {job.paymentStatus === 'funded' && <Badge status="success">Payment Funded</Badge>}
              {job.isUrgent && <Badge status="danger">Urgent</Badge>}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{job.title}</h1>
            <p className="text-sm text-gray-400">Posted {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })} · {job.viewsCount} views · {job.applicationsCount} proposals</p>
          </motion.div>

          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Job Description</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{job.description}</p>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.requiredSkills?.map(s => <span key={s} className="badge badge-primary">{s}</span>)}
            </div>
          </div>

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

        {/* Sidebar */}
        <div className="space-y-5">
          {getActionCard()}

          {job.project && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">Project Progress</h3>
                <span className="text-sm font-semibold text-primary-600">{effectiveProjectProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, effectiveProjectProgress)}%` }} />
              </div>
              {job.project.title && (
                <p className="mt-3 text-xs text-gray-400">Project: {job.project.title}</p>
              )}
            </div>
          )}

          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-gray-900 dark:text-white">
                {job.budget?.type === 'hourly'
                  ? formatRate(job.budget?.maxAmount, job.budget?.currency)
                  : formatCurrency(job.budget?.maxAmount, job.budget?.currency)}
                {job.budget?.type !== 'hourly' && <span className="text-sm font-normal text-gray-400 ml-1">fixed</span>}
              </span>
            </div>
            {user?.role === 'freelancer' && !isFreelancerHired && (
              job.hasApplied
                ? <button disabled className="btn-secondary w-full opacity-60">Already Applied</button>
                : <div className="space-y-2">
                    <Link
                      to={`/freelancer/proposals/generate/${job._id}`}
                      className="w-full text-center block btn-primary"
                    >
                      <SparklesIcon className="w-4 h-4 mr-1 inline" />
                      Generate AI Proposal
                    </Link>
                    <button onClick={() => setApplyOpen(true)} className="btn-secondary w-full">
                      Apply Manually
                    </button>
                  </div>
            )}
            {!user && <Link to="/auth/login" className="btn-primary w-full text-center block">Login to Apply</Link>}

            <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              {[
                { icon: CurrencyDollarIcon, label: 'Budget Type', value: job.budget?.type },
                { icon: BriefcaseIcon, label: 'Experience', value: job.experienceLevel },
                { icon: CalendarIcon, label: 'Deadline', value: job.deadline ? format(new Date(job.deadline), 'MMM d, yyyy') : '—' },
                { icon: ClockIcon, label: 'Duration', value: job.duration?.replace(/_/g, ' ') },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-500 dark:text-gray-400">{label}:</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {job.client && (
            <div className="card p-5">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">About the Client</h3>
              <div className="flex items-center gap-3 mb-3">
                <Avatar src={job.client.avatar?.url} alt={`${job.client.firstName || ''} ${job.client.lastName || ''}`.trim() || 'Client'} size="md" online={job.client.isOnline} />
                <div>
                  {(() => {
                    // The client can be a populated user object, a raw id string,
                    // or an embedded legacy profile — only build a /client/:id link
                    // when we actually have a usable id (avoids /client/undefined and
                    // /client/[object Object] links).
                    const rawId = job.client._id ?? job.client.id ?? job.client.clientId ?? null;
                    const clientId = rawId && typeof rawId === 'object' ? String(rawId._id ?? rawId) : String(rawId ?? '');
                    const clientName = `${job.client.firstName || ''} ${job.client.lastName || ''}`.trim() || 'Client';
                    return clientId
                      ? <Link to={`/client/${clientId}`} className="font-medium text-sm text-gray-900 dark:text-white hover:text-primary-600">{clientName}</Link>
                      : <span className="font-medium text-sm text-gray-900 dark:text-white">{clientName}</span>;
                  })()}
                  <p className="text-xs text-gray-400">{job.client.country || 'Unknown location'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-2">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{job.client.stats?.completedProjects ?? 0}</p>
                  <p className="text-xs text-gray-400">Projects</p>
                </div>
                <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-2">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{job.client.stats?.averageRating?.toFixed(1) ?? '—'}</p>
                  <p className="text-xs text-gray-400">Rating</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Apply Modal */}
      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title="Submit Proposal" size="lg">
        <form onSubmit={handleSubmit(handleApply)} className="space-y-4">
          <Textarea label="Cover Letter" rows={6}
            placeholder="Introduce yourself, explain why you're the best fit, and describe your approach…"
            error={errors.coverLetter?.message}
            {...register('coverLetter', { required: 'Cover letter is required', minLength: { value: 100, message: 'At least 100 characters' } })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Your Price Offer (ETB)" type="number" min={1} placeholder="e.g. 500"
              error={errors.amount?.message}
              {...register('amount', { required: 'Required', min: { value: 1, message: 'Min 1 ETB' } })}
            />
            <Select label="Offer Type" {...register('offerType', { required: true })}>
              <option value="fixed">Fixed Price</option>
              <option value="hourly">Hourly Rate</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Delivery Time" type="number" min={1} placeholder="e.g. 7"
              error={errors.deliveryValue?.message}
              {...register('deliveryValue', { required: 'Required', min: { value: 1, message: 'Min 1' } })}
            />
            <Select label="Unit" {...register('deliveryUnit')}>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
              <option value="hours">Hours</option>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending}>Submit Proposal</Button>
          </div>
        </form>
      </Modal>

      {/* Submit Delivery Modal */}
      <Modal open={deliverOpen} onClose={() => setDeliverOpen(false)} title="Submit Delivery" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery Note</label>
            <textarea
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              rows={4}
              className="input"
              placeholder="Describe what you've completed, any instructions or notes for the client..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery Files</label>
            <input
              type="file"
              multiple
              onChange={(e) => setDeliveryFiles(e.target.files)}
              className="input file:bg-primary-50 file:border-0 file:text-primary-600 file:px-3 file:py-1.5 file:rounded-lg file:cursor-pointer"
            />
          </div>
          <p className="text-xs text-gray-400">Upload your completed work files.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeliverOpen(false)}>Cancel</Button>
            <Button loading={isSubmitting} onClick={handleSubmitDelivery}>
              <DocumentCheckIcon className="w-4 h-4 mr-1" /> Submit Delivery
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </div>
  );
}
