import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import {
  useAdminVerifications,
  useAdminVerificationStats, useAdminReviewVerification,
} from '@/hooks/useDeveloperVerification';
import { VerificationStatus } from '@/components/verification/VerificationStatus';
import Pagination from '@/components/ui/Pagination';
import Avatar from '@/components/ui/Avatar';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  ShieldCheckIcon, CheckCircleIcon, XCircleIcon,
  ClockIcon, EyeIcon, ArrowPathIcon, XMarkIcon,
  UserIcon, CodeBracketIcon, BriefcaseIcon, SparklesIcon,
  MagnifyingGlassIcon, DocumentTextIcon, ArrowDownTrayIcon,
  QuestionMarkCircleIcon, PaperClipIcon, ChevronUpDownIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { Star } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'identity', label: 'Identity' },
  { value: 'github', label: 'GitHub' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'skill', label: 'Skill' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'info_requested', label: 'Info Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

const TYPE_ICONS = {
  identity: UserIcon,
  github: CodeBracketIcon,
  portfolio: BriefcaseIcon,
  skill: SparklesIcon,
};

const REVIEWABLE = ['submitted', 'under_review'];

const isImageUrl = (url = '') => /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(url);

function downloadDocument(url) {
  if (!url) return;
  const target = /res\.cloudinary\.com/i.test(url)
    ? `${url}${url.includes('?') ? '&' : '?'}fl_attachment`
    : url;
  window.open(target, '_blank', 'noopener,noreferrer');
}

function attemptLabel(method) {
  const map = {
    document_upload: 'Documents uploaded',
    github_api: 'GitHub profile verified',
    portfolio_submission: 'Portfolio submitted',
    resubmission: 'Resubmitted',
  };
  return map[method] || 'Submission update';
}

function buildTimeline(v) {
  const events = [];
  events.push({
    time: v.createdAt,
    icon: PaperClipIcon,
    title: 'Submitted',
    desc: `${v.type} verification ${v.status === 'approved' ? 'auto-approved' : 'submitted for review'}`,
  });

  (v.attempts || []).forEach((a) => {
    events.push({
      time: a.timestamp,
      icon: a.result === 'success' ? CheckCircleIcon : a.result === 'failure' ? XCircleIcon : ClockIcon,
      title: attemptLabel(a.method),
      desc: a.details,
    });
  });

  if (v.review?.requestedMoreInfoAt) {
    events.push({
      time: v.review.requestedMoreInfoAt,
      icon: QuestionMarkCircleIcon,
      title: 'More information requested',
      desc: v.review.notes || 'The reviewer asked for additional details.',
    });
  }

  if (v.review?.reviewedAt) {
    const reviewer = v.review.reviewedBy
      ? `${v.review.reviewedBy.firstName} ${v.review.reviewedBy.lastName}`
      : 'An administrator';
    const approved = v.status === 'approved';
    const rejected = v.status === 'rejected';
    events.push({
      time: v.review.reviewedAt,
      icon: approved ? CheckCircleIcon : rejected ? XCircleIcon : ShieldCheckIcon,
      title: approved ? 'Approved' : rejected ? 'Rejected' : 'Reviewed',
      desc: approved || rejected ? `Reviewed by ${reviewer}` : `Reviewed by ${reviewer}`,
    });
  }

  return events.filter((e) => e.time).sort((a, b) => new Date(b.time) - new Date(a.time));
}

function InfoField({ label, value, isLink = false }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase">{label}</p>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline break-all">
          {value}
        </a>
      ) : (
        <p className="text-sm text-gray-900 dark:text-gray-200">{value}</p>
      )}
    </div>
  );
}

function DocThumb({ url, label, onZoom, height = 'h-32' }) {
  if (!url) return null;
  const isImg = isImageUrl(url);

  return (
    <div className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      {isImg ? (
        <img src={url} alt={label} className={clsx('w-full object-cover', height)} />
      ) : (
        <div className={clsx('w-full bg-gray-50 dark:bg-dark-900 flex flex-col items-center justify-center gap-1.5', height)}>
          <DocumentTextIcon className="w-8 h-8 text-gray-400" />
          <span className="text-[10px] text-gray-400 px-2 text-center truncate max-w-full">{label}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2">
        <button
          onClick={() => onZoom(url, label)}
          title="Preview"
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 p-2 rounded-full hover:scale-110"
        >
          <MagnifyingGlassIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          onClick={() => downloadDocument(url)}
          title="Download"
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 p-2 rounded-full hover:scale-110"
        >
          <ArrowDownTrayIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
        <p className="text-[10px] font-semibold text-white truncate">{label}</p>
      </div>
    </div>
  );
}

function PreviewLightbox({ src, alt, onClose }) {
  const isImg = isImageUrl(src);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white z-10">
        <XMarkIcon className="w-8 h-8" />
      </button>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-w-5xl max-h-[90vh] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {isImg ? (
          <img src={src} alt={alt} className="max-w-full max-h-[85vh] rounded-lg object-contain mx-auto" />
        ) : (
          <iframe src={src} title={alt} className="w-full h-[85vh] rounded-lg bg-white" />
        )}
        <div className="flex items-center justify-center mt-3">
          <button
            onClick={() => downloadDocument(src)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
          >
            <ArrowDownTrayIcon className="w-4 h-4" /> Download
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function VerificationDataSection({ verification, onZoom }) {
  const data = verification.identity || verification.github || verification.portfolio || verification.skill;
  if (!data) return null;

  if (verification.type === 'identity') {
    const docs = [
      { url: data.documentFrontUrl, label: 'Front ID' },
      { url: data.documentBackUrl, label: 'Back ID' },
      { url: data.selfieUrl, label: 'Selfie' },
    ].filter((d) => d.url);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoField label="Full Name" value={data.fullName} />
          <InfoField label="Document Type" value={data.documentType?.replace('_', ' ')} />
          <InfoField label="Country" value={data.country} />
          {data.dateOfBirth && <InfoField label="Date of Birth" value={new Date(data.dateOfBirth).toLocaleDateString()} />}
        </div>
        {docs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Uploaded Documents</p>
            <div className="grid grid-cols-3 gap-3">
              {docs.map((doc) => (
                <DocThumb key={doc.label} url={doc.url} label={doc.label} onZoom={onZoom} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (verification.type === 'github') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoField label="Username" value={`@${data.username}`} />
          <InfoField label="Profile" value={data.profileUrl} isLink />
          <InfoField label="Public Repos" value={data.publicRepos} />
          <InfoField label="Total Stars" value={data.totalStars} />
          <InfoField label="Followers" value={data.followers} />
          <InfoField label="Contribution Score" value={data.contributionScore} />
        </div>
        {data.topLanguages?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Languages</p>
            <div className="flex flex-wrap gap-1">
              {data.topLanguages.map((lang) => (
                <span key={lang} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{lang}</span>
              ))}
            </div>
          </div>
        )}
        {data.pinnedRepos?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Pinned Repositories</p>
            <div className="space-y-1.5">
              {data.pinnedRepos.slice(0, 4).map((repo, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-gray-50 dark:bg-dark-900">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-primary-600 hover:underline truncate"
                  >
                    {repo.name}
                  </a>
                  <span className="text-gray-400 inline-flex items-center gap-1"><Star size={12} className="text-yellow-400" fill="currentColor" />{repo.stars}</span>
                  {repo.language && <span className="text-gray-400">• {repo.language}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (verification.type === 'portfolio') {
    const screenshots = (data.projectScreenshots || []).map((s, i) => ({
      url: s.url,
      label: s.caption || `Screenshot ${i + 1}`,
    }));

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoField label="Website" value={data.websiteUrl} isLink />
          {data.liveProjectUrl && <InfoField label="Live URL" value={data.liveProjectUrl} isLink />}
          {data.sourceCodeUrl && <InfoField label="Source Code" value={data.sourceCodeUrl} isLink />}
        </div>
        <InfoField label="Description" value={data.projectDescription} />
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Technologies</p>
          <div className="flex flex-wrap gap-1">
            {(data.technologiesUsed || []).map((t, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300">{t}</span>
            ))}
          </div>
        </div>
        {screenshots.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Project Screenshots</p>
            <div className="grid grid-cols-3 gap-2">
              {screenshots.map((s, i) => (
                <DocThumb key={i} url={s.url} label={s.label} onZoom={onZoom} height="h-24" />
              ))}
            </div>
          </div>
        )}
        {data.clientTestimonial && (
          <div className="bg-gray-50 dark:bg-dark-900 rounded-xl p-3">
            <p className="text-xs text-gray-500 italic">"{data.clientTestimonial}"</p>
            {data.clientName && <p className="text-xs text-gray-400 mt-1">— {data.clientName}</p>}
          </div>
        )}
      </div>
    );
  }

  if (verification.type === 'skill') {
    return (
      <div className="grid grid-cols-2 gap-3 text-sm">
        <InfoField label="Skill" value={data.skillName} />
        <InfoField label="Score" value={data.score != null ? `${data.score}%` : null} />
      </div>
    );
  }

  return null;
}

function ReviewBanners({ verification }) {
  return (
    <>
      {verification.review?.requestedMoreInfoAt && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
          <QuestionMarkCircleIcon className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">More information requested</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              {verification.review.notes || 'The reviewer asked for additional details.'}
            </p>
            <p className="text-[10px] text-amber-500/80 mt-1">
              {new Date(verification.review.requestedMoreInfoAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {verification.status === 'rejected' && verification.rejectionReason && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <XCircleIcon className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Rejected</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{verification.rejectionReason}</p>
          </div>
        </div>
      )}
    </>
  );
}

function Timeline({ verification }) {
  const events = buildTimeline(verification);
  if (events.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Timeline</p>
      <div className="relative pl-6 space-y-5">
        <div className="absolute left-[10px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />
        {events.map((e, i) => {
          const Icon = e.icon;
          return (
            <div key={i} className="relative">
              <span className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <Icon className="w-3 h-3 text-gray-600 dark:text-gray-300" />
              </span>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">{e.title}</p>
              {e.desc && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{e.desc}</p>}
              <p className="text-[10px] text-gray-400 mt-0.5">{new Date(e.time).toLocaleString()}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailsModal({ verification, onClose, onReview, isPending }) {
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const TypeIcon = TYPE_ICONS[verification.type] || ShieldCheckIcon;
  const user = verification.user;
  const canReview = REVIEWABLE.includes(verification.status);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <TypeIcon className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white capitalize">{verification.type} Verification</h3>
                <p className="text-xs text-gray-400">
                  {user?.firstName} {user?.lastName} • {user?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <VerificationStatus status={verification.status} />
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {user && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-dark-900">
                <Avatar src={user.avatar?.url} alt={user.firstName} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300">
                  {user.role || 'user'}
                </span>
              </div>
            )}

            <ReviewBanners verification={verification} />

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Submission Details</p>
              <VerificationDataSection verification={verification} onZoom={(src, alt) => setLightboxSrc({ src, alt })} />
            </div>

            {verification.review?.reviewedAt && (
              <div className="bg-gray-50 dark:bg-dark-900 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Review Information</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoField
                    label="Reviewed By"
                    value={verification.review.reviewedBy
                      ? `${verification.review.reviewedBy.firstName} ${verification.review.reviewedBy.lastName}`
                      : 'Administrator'}
                  />
                  <InfoField label="Reviewed At" value={new Date(verification.review.reviewedAt).toLocaleString()} />
                </div>
                {verification.review.notes && (
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    <span className="font-semibold">Notes:</span> {verification.review.notes}
                  </p>
                )}
              </div>
            )}

            <Timeline verification={verification} />
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white dark:bg-dark-800 border-t border-gray-100 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              Close
            </button>
            {canReview && (
              <button
                onClick={onReview}
                disabled={isPending}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                <ShieldCheckIcon className="w-4 h-4" /> Review Now
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {lightboxSrc && (
          <PreviewLightbox src={lightboxSrc.src} alt={lightboxSrc.alt} onClose={() => setLightboxSrc(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

function ReviewModal({ verification, onClose, onReview, isPending }) {
  const [action, setAction] = useState('approve');
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const TypeIcon = TYPE_ICONS[verification.type] || ShieldCheckIcon;

  const handleSubmit = () => {
    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    if (action === 'request_more_info' && !notes.trim()) {
      toast.error('A message to the developer is required');
      return;
    }
    onReview({
      id: verification._id,
      data: {
        action,
        notes,
        rejectionReason: action === 'reject' ? rejectionReason : undefined,
      },
    });
  };

  const actionButton = (key, label, Icon, selectedClass) => (
    <button
      onClick={() => setAction(key)}
      className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold border-2 transition-all flex items-center justify-center gap-2 ${
        action === key
          ? selectedClass
          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <Icon className="w-5 h-5" /> {label}
    </button>
  );

  const footerStyle =
    action === 'approve' ? 'bg-green-600 hover:bg-green-700'
    : action === 'reject' ? 'bg-red-600 hover:bg-red-700'
    : 'bg-amber-500 hover:bg-amber-600';

  const footerLabel =
    action === 'approve' ? 'Approve Verification'
    : action === 'reject' ? 'Reject Verification'
    : 'Request More Info';

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <TypeIcon className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Review {verification.type} verification</h3>
                <p className="text-xs text-gray-400">
                  {verification.user?.firstName} {verification.user?.lastName} • {verification.user?.email}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            <VerificationDataSection verification={verification} onZoom={(src, alt) => setLightboxSrc({ src, alt })} />

            <ReviewBanners verification={verification} />

            {/* Review decision */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-5">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Decision</label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {actionButton('approve', 'Approve', CheckCircleIcon, 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 shadow-sm')}
                {actionButton('reject', 'Reject', XCircleIcon, 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 shadow-sm')}
                {actionButton('request_more_info', 'More Info', QuestionMarkCircleIcon, 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 shadow-sm')}
              </div>

              <div className="space-y-3">
                <div>
                  <label className={clsx(
                    'block text-xs font-semibold mb-1',
                    action === 'request_more_info' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'
                  )}>
                    {action === 'request_more_info' ? 'Message to Developer *' : 'Notes (optional)'}
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={clsx('input text-sm w-full', action === 'request_more_info' && 'border-amber-300 dark:border-amber-700')}
                    placeholder={action === 'request_more_info'
                      ? 'Tell the developer exactly what additional information or documents are needed...'
                      : 'Internal review notes...'}
                  />
                </div>

                {action === 'reject' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label className="block text-xs font-semibold text-red-600 mb-1">Rejection Reason *</label>
                    <textarea
                      rows={2}
                      required
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="input text-sm w-full border-red-300 dark:border-red-700"
                      placeholder="Explain why this verification is being rejected..."
                    />
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white dark:bg-dark-800 border-t border-gray-100 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className={`px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors ${footerStyle}`}
            >
              {isPending ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : null}
              {isPending ? 'Processing...' : footerLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {lightboxSrc && (
          <PreviewLightbox src={lightboxSrc.src} alt={lightboxSrc.alt} onClose={() => setLightboxSrc(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

export default function AdminVerifications() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortValue, setSortValue] = useState('latest');
  const [viewingVerification, setViewingVerification] = useState(null);
  const [reviewingVerification, setReviewingVerification] = useState(null);

  const { data: statsData } = useAdminVerificationStats();
  const baseParams = {
    page,
    limit: 10,
    type: typeFilter || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    sort: sortValue || undefined,
  };

  const isInfoRequestedFilter = statusFilter === 'info_requested';
  const isPendingFilter = statusFilter === 'pending';

  const statusParam =
    isInfoRequestedFilter ? undefined
    : isPendingFilter ? 'submitted,under_review'
    : statusFilter || undefined;

  const { data: allData, isLoading: allLoading } = useAdminVerifications({
    ...baseParams,
    status: statusParam,
  });
  const reviewMutation = useAdminReviewVerification();

  const stats = statsData?.data?.data;
  const data = allData?.data;
  const verifications = (data?.data || []).filter((v) =>
    isInfoRequestedFilter ? Boolean(v.review?.requestedMoreInfoAt) : true
  );
  const meta = data?.meta;
  const isLoading = allLoading;

  const handleReview = async ({ id, data: reviewData }) => {
    try {
      await reviewMutation.mutateAsync({ id, data: reviewData });
      const label = reviewData.action === 'approve'
        ? 'approved'
        : reviewData.action === 'reject'
        ? 'rejected'
        : 'more info requested';
      toast.success(`Verification ${label}!`);
      setReviewingVerification(null);
      setViewingVerification(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to review');
    }
  };

  return (
    <div className="page-container space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldCheckIcon className="w-6 h-6 text-primary-500" />
          Verification Management
        </h1>
      </motion.div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => { setStatusFilter('pending'); setPage(1); }}
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-5 text-center cursor-pointer transition hover:shadow-md"
          >
            <p className="text-3xl font-bold text-yellow-600">{stats.totalPending}</p>
            <p className="text-xs text-gray-400 uppercase mt-1">Pending Reviews</p>
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('approved'); setPage(1); }}
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-5 text-center cursor-pointer transition hover:shadow-md"
          >
            <p className="text-3xl font-bold text-green-600">{stats.totalApproved}</p>
            <p className="text-xs text-gray-400 uppercase mt-1">Approved</p>
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('rejected'); setPage(1); }}
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-5 text-center cursor-pointer transition hover:shadow-md"
          >
            <p className="text-3xl font-bold text-red-600">{stats.totalRejected}</p>
            <p className="text-xs text-gray-400 uppercase mt-1">Rejected</p>
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter(''); setPage(1); }}
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-5 text-center cursor-pointer transition hover:shadow-md"
          >
            <p className="text-3xl font-bold text-primary-600">{stats.totalApproved + stats.totalRejected + stats.totalPending}</p>
            <p className="text-xs text-gray-400 uppercase mt-1">Total Submissions</p>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
              Type <ChevronDownIcon className="w-3 h-3 inline" />
            </label>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="input text-xs px-2.5 py-1.5"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="input text-xs px-2.5 py-1.5 w-40"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="input text-xs px-2.5 py-1.5 w-40"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
              <ChevronUpDownIcon className="w-3 h-3 inline mr-1" />Sort
            </label>
            <select
              value={sortValue}
              onChange={(e) => { setSortValue(e.target.value); setPage(1); }}
              className="input text-xs px-2.5 py-1.5"
            >
              <option value="latest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="pending_first">Pending first</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
              Status <ChevronDownIcon className="w-3 h-3 inline" />
            </label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="input text-xs px-2.5 py-1.5"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : verifications.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheckIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No verifications found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-dark-700">
                <tr>
                  {['Developer', 'Type', 'Status', 'Submitted', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
                {verifications.map((v) => {
                  const TypeIcon = TYPE_ICONS[v.type] || ShieldCheckIcon;
                  const canReview = REVIEWABLE.includes(v.status);
                  return (
                    <tr key={v._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={v.user?.avatar?.url} alt={v.user?.firstName} size="sm" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{v.user?.firstName} {v.user?.lastName}</p>
                            <p className="text-xs text-gray-400">{v.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm capitalize">
                          <TypeIcon className="w-4 h-4 text-gray-400" /> {v.type}
                        </span>
                        {v.review?.requestedMoreInfoAt && (
                          <span className="block mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <QuestionMarkCircleIcon className="w-3 h-3" /> Info requested
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><VerificationStatus status={v.status} /></td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(v.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewingVerification(v)}
                            className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <EyeIcon className="w-3.5 h-3.5" /> View
                          </button>
                          {canReview && (
                            <button
                              onClick={() => setReviewingVerification(v)}
                              className="px-3 py-1.5 text-xs font-semibold text-primary-600 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <ShieldCheckIcon className="w-3.5 h-3.5" /> Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      </div>

      {/* Details modal */}
      <AnimatePresence>
        {viewingVerification && (
          <DetailsModal
            verification={viewingVerification}
            onClose={() => setViewingVerification(null)}
            onReview={() => {
              setReviewingVerification(viewingVerification);
              setViewingVerification(null);
            }}
            isPending={reviewMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Review modal */}
      <AnimatePresence>
        {reviewingVerification && (
          <ReviewModal
            verification={reviewingVerification}
            onClose={() => setReviewingVerification(null)}
            onReview={handleReview}
            isPending={reviewMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
