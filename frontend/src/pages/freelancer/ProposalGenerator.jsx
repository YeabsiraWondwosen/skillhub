import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  SparklesIcon, CurrencyDollarIcon, ClockIcon, CheckCircleIcon,
  ExclamationTriangleIcon, ArrowPathIcon, PaperClipIcon,
  BriefcaseIcon, AcademicCapIcon, LinkIcon, PencilSquareIcon,
  StarIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useFullProposal } from '@/hooks/useAI';
import { useSubmitApplication } from '@/hooks/useApplications';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import { SkeletonText, SkeletonCard } from '@/components/ui/Skeleton';
import { formatDistanceToNow, format } from 'date-fns';
import { clsx } from 'clsx';
import { formatCurrency, formatRate } from '@/utils/currency';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProposalGenerator() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isFetching } = useFullProposal(jobId);
  const { mutate: submitApplication, isPending: isSubmitting } = useSubmitApplication();

  const [coverLetter, setCoverLetter] = useState('');
  const [amount, setAmount] = useState('');
  const [offerType, setOfferType] = useState('fixed');
  const [deliveryValue, setDeliveryValue] = useState('');
  const [deliveryUnit, setDeliveryUnit] = useState('days');
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('proposal');

  const proposal = data?.proposal;
  const job = data?.job;
  const profile = data?.profile;
  const skillGaps = data?.skillGaps;

  useEffect(() => {
    if (proposal) {
      setCoverLetter(proposal.coverLetter || '');
      setAmount(proposal.suggestedPrice?.amount?.toString() || '');
      setOfferType(proposal.suggestedPrice?.type || 'fixed');
      setDeliveryValue(proposal.suggestedDelivery?.value?.toString() || '');
      setDeliveryUnit(proposal.suggestedDelivery?.unit || 'days');
    }
  }, [proposal]);

  const handleSubmit = () => {
    if (!coverLetter || coverLetter.length < 100) return;
    if (!amount || Number(amount) < 1) return;
    if (!deliveryValue || Number(deliveryValue) < 1) return;

    const fd = new FormData();
    fd.append('coverLetter', coverLetter);
    fd.append('priceOffer[amount]', amount);
    fd.append('priceOffer[type]', offerType);
    fd.append('priceOffer[currency]', 'ETB');
    fd.append('deliveryTime[value]', deliveryValue);
    fd.append('deliveryTime[unit]', deliveryUnit);

    submitApplication({ jobId, formData: fd }, {
      onSuccess: () => navigate('/freelancer/proposals'),
    });
  };

  const handleRegenerate = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="space-y-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="page-container">
        <div className="card p-12 text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Failed to load proposal data</h2>
          <p className="text-sm text-gray-500 mb-4">We couldn't generate the AI proposal. Please try again.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
            <Link to={`/jobs/${jobId}`} className="btn-secondary">View Job</Link>
          </div>
        </div>
      </div>
    );
  }

  const matchScore = proposal?.matchScore || 0;
  const matchColor = matchScore >= 80 ? 'text-green-600 dark:text-green-400'
    : matchScore >= 50 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link to={`/jobs/${jobId}`} className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1"><ArrowLeft size={14} /> Back to Job</Link>
          </div>
          <h1 className="section-title flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-primary-500" />
            AI Proposal Generator
          </h1>
          <p className="section-sub">Review and customize your AI-generated proposal before submitting</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRegenerate}
            loading={isFetching}
            disabled={isFetching}
          >
            <ArrowPathIcon className={clsx('w-4 h-4 mr-1', isFetching && 'animate-spin')} />
            Regenerate
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || coverLetter.length < 100}
          >
            <CheckCircleIcon className="w-4 h-4 mr-1" />
            Submit Proposal
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Job Info + Profile */}
        <div className="lg:col-span-1 space-y-5">
          {/* Job Summary Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-5"
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <BriefcaseIcon className="w-4 h-4 text-gray-400" />
              Job Details
            </h3>
            <div className="space-y-3">
              <div>
                <Link to={`/jobs/${jobId}`} className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 text-sm">
                  {job.title}
                </Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge status={job.experienceLevel}>{job.experienceLevel}</Badge>
                <Badge status={job.budget?.type}>{job.budget?.type === 'hourly' ? 'Hourly' : 'Fixed'}</Badge>
                {job.isUrgent && <Badge status="danger">Urgent</Badge>}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Budget</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {job.budget?.type === 'hourly'
                      ? formatRate(job.budget?.maxAmount)
                      : formatCurrency(job.budget?.maxAmount)}
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      {job.budget?.type === 'hourly' ? '' : ' fixed'}
                    </span>
                  </span>
                </div>
                {job.deadline && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Deadline</span>
                    <span className="font-medium text-gray-900 dark:text-white text-xs">
                      {format(new Date(job.deadline), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {job.duration && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Duration</span>
                    <span className="font-medium text-gray-900 dark:text-white text-xs capitalize">
                      {job.duration?.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Required Skills</p>
                <div className="flex flex-wrap gap-1">
                  {job.requiredSkills?.map(s => (
                    <span key={s} className="badge badge-primary text-xs">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Match Score Card */}
          {proposal && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card p-5"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4 text-gray-400" />
                Match Analysis
              </h3>
              <div className="text-center mb-4">
                <div className={clsx('text-4xl font-black', matchColor)}>
                  {matchScore}%
                </div>
                <p className="text-xs text-gray-400 mt-1">Match Score</p>
                <div className="w-full bg-gray-100 dark:bg-dark-700 rounded-full h-2 mt-2">
                  <div
                    className={clsx('h-2 rounded-full transition-all duration-500',
                      matchScore >= 80 ? 'bg-green-500' : matchScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    )}
                    style={{ width: `${matchScore}%` }}
                  />
                </div>
              </div>
              {proposal.reasoning?.length > 0 && (
                <div className="space-y-2">
                  {proposal.reasoning.map((reason, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <CheckCircleIcon className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600 dark:text-gray-300">{reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Skill Gaps Card */}
          {skillGaps?.gaps?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card p-5"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />
                Skill Gaps
              </h3>
              <div className="space-y-2">
                {skillGaps.gaps.slice(0, 5).map((gap, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 dark:text-gray-300">{gap.skill || gap}</span>
                    {gap.importance && (
                      <Badge status={gap.importance === 'high' ? 'danger' : gap.importance === 'medium' ? 'warning' : 'open'}>
                        {gap.importance}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Freelancer Profile Card */}
          {profile && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card p-5"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <AcademicCapIcon className="w-4 h-4 text-gray-400" />
                Your Profile
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Hourly Rate</span>
                   <span className="font-semibold text-gray-900 dark:text-white">{formatRate(profile.hourlyRate)}</span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Your Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.skills?.slice(0, 8).map(s => (
                      <span key={s.name} className="badge badge-gray text-xs">{s.name}</span>
                    ))}
                    {profile.skills?.length > 8 && (
                      <span className="badge badge-gray text-xs">+{profile.skills.length - 8} more</span>
                    )}
                  </div>
                </div>
                {profile.portfolio?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">Portfolio ({profile.portfolio.length} projects)</p>
                    <div className="space-y-1.5">
                      {profile.portfolio.slice(0, 3).map((p, i) => (
                        <div key={i} className="text-xs">
                          <span className="text-gray-700 dark:text-gray-300 font-medium">{p.title}</span>
                          {p.projectUrl && (
                            <a href={p.projectUrl} target="_blank" rel="noopener noreferrer"
                              className="ml-1 text-primary-500 hover:underline">
                              <LinkIcon className="w-3 h-3 inline" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {proposal?.relevantPortfolio?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">AI-Selected Relevant Work</p>
                    <div className="space-y-1.5">
                      {proposal.relevantPortfolio.map((p, i) => (
                        <div key={i} className="text-xs bg-primary-50 dark:bg-primary-900/10 rounded-md p-2">
                          <span className="text-primary-700 dark:text-primary-300 font-medium">{p.title}</span>
                          {p.technologies?.length > 0 && (
                            <p className="text-primary-500 dark:text-primary-400 mt-0.5">
                              {p.technologies.join(', ')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column - Proposal Editor */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-dark-700">
            {[
              { id: 'proposal', label: 'Proposal Editor', icon: PencilSquareIcon },
              { id: 'preview', label: 'Preview', icon: StarIcon },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'proposal' ? (
              <motion.div
                key="editor"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                {/* Cover Letter Editor */}
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <PencilSquareIcon className="w-4 h-4 text-gray-400" />
                      Cover Letter
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={clsx('text-xs font-medium',
                        coverLetter.length < 100 ? 'text-red-500' : 'text-green-500'
                      )}>
                        {coverLetter.length}/3000
                      </span>
                    </div>
                  </div>
                  <textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    rows={14}
                    className="input resize-none w-full font-mono text-sm leading-relaxed"
                    placeholder="Write your proposal cover letter here..."
                  />
                  {coverLetter.length < 100 && coverLetter.length > 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Cover letter must be at least 100 characters ({100 - coverLetter.length} more needed)
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRegenerate}
                      loading={isFetching}
                    >
                      <SparklesIcon className="w-4 h-4 mr-1" />
                      Regenerate with AI
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!coverLetter) return;
                        try {
                          await navigator.clipboard.writeText(coverLetter);
                          toast.success('Cover letter copied');
                        } catch (err) {
                          toast.error('Unable to copy cover letter');
                        }
                      }}
                    >
                      Copy to Clipboard
                    </Button>
                  </div>
                </div>

                {/* Pricing & Delivery */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <CurrencyDollarIcon className="w-4 h-4 text-gray-400" />
                    Pricing & Delivery
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Your Price Offer (ETB)</label>
                      <input
                        type="number"
                        min={1}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="input"
                        placeholder="e.g. 500"
                      />
                      {proposal?.suggestedPrice && (
                        <p className="text-xs text-gray-400 mt-1">
                          AI suggested: {proposal.suggestedPrice.type === 'hourly'
                            ? formatRate(proposal.suggestedPrice.amount)
                            : formatCurrency(proposal.suggestedPrice.amount)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="label">Offer Type</label>
                      <select
                        value={offerType}
                        onChange={(e) => setOfferType(e.target.value)}
                        className="input"
                      >
                        <option value="fixed">Fixed Price</option>
                        <option value="hourly">Hourly Rate</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Delivery Time</label>
                      <input
                        type="number"
                        min={1}
                        value={deliveryValue}
                        onChange={(e) => setDeliveryValue(e.target.value)}
                        className="input"
                        placeholder="e.g. 14"
                      />
                      {proposal?.suggestedDelivery && (
                        <p className="text-xs text-gray-400 mt-1">
                          AI suggested: {proposal.suggestedDelivery.value} {proposal.suggestedDelivery.unit}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="label">Unit</label>
                      <select
                        value={deliveryUnit}
                        onChange={(e) => setDeliveryUnit(e.target.value)}
                        className="input"
                      >
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                        <option value="hours">Hours</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Job Description Reference */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <BriefcaseIcon className="w-4 h-4 text-gray-400" />
                    Job Description Reference
                  </h3>
                  <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {job.description}
                  </div>
                </div>

                {/* Submit Bar */}
                <div className="card p-4 flex items-center justify-between sticky bottom-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {coverLetter.length < 100 ? (
                      <span className="text-red-500">
                        Cover letter needs {100 - coverLetter.length} more characters
                      </span>
                    ) : !amount || Number(amount) < 1 ? (
                      <span className="text-yellow-500">Please enter a valid price</span>
                    ) : !deliveryValue || Number(deliveryValue) < 1 ? (
                      <span className="text-yellow-500">Please enter delivery time</span>
                    ) : (
                      <span className="text-green-500 flex items-center gap-1">
                        <CheckCircleIcon className="w-4 h-4" />
                        Ready to submit
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Link to={`/jobs/${jobId}`} className="btn-secondary btn-sm">Cancel</Link>
                    <Button
                      onClick={handleSubmit}
                      loading={isSubmitting}
                      disabled={isSubmitting || coverLetter.length < 100 || !amount || Number(amount) < 1 || !deliveryValue || Number(deliveryValue) < 1}
                    >
                      <CheckCircleIcon className="w-4 h-4 mr-1" />
                      Submit Proposal
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="card p-6"
              >
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Proposal Preview</h3>

                {/* Preview Header */}
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-dark-700">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {profile?.skills?.[0]?.name?.charAt(0) || 'F'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                      Proposal for: {job.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {offerType === 'hourly' ? formatRate(amount) : `${formatCurrency(amount)} fixed`} · {deliveryValue} {deliveryUnit}
                    </p>
                  </div>
                  {matchScore > 0 && (
                    <div className="ml-auto text-right">
                      <div className={clsx('text-lg font-black', matchColor)}>
                        {matchScore}%
                      </div>
                      <p className="text-xs text-gray-400">Match</p>
                    </div>
                  )}
                </div>

                {/* Cover Letter Preview */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {coverLetter || (
                      <span className="text-gray-400 italic">
                        Your cover letter will appear here as you type...
                      </span>
                    )}
                  </div>
                </div>

                {/* Skills Match */}
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-dark-700">
                  <p className="text-xs text-gray-400 mb-2">Skills you're bringing to this project:</p>
                  <div className="flex flex-wrap gap-1">
                    {job.requiredSkills?.map(skill => {
                      const hasSkill = profile?.skills?.some(
                        s => s.name.toLowerCase() === skill.toLowerCase()
                      );
                      return (
                        <span
                          key={skill}
                          className={clsx(
                            'badge text-xs',
                            hasSkill ? 'badge-success' : 'badge-gray'
                          )}
                        >
                          {hasSkill && <CheckCircleIcon className="w-3 h-3 mr-0.5 inline" />}
                          {skill}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
