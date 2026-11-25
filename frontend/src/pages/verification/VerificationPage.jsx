import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  useMyVerifications, useSubmitIdentity, useUploadIdentityDocuments,
  useSubmitGithub, useSubmitPortfolio,
  useResubmitVerification,
} from '@/hooks/useDeveloperVerification';
import { VerificationSteps, VerificationStatus, VerificationScoreBar } from '@/components/verification/VerificationStatus';
import { VerificationBadgeGroup, TrustLevelBadge, VerificationShield } from '@/components/verification/VerificationBadge';
import ImageUploadCard from '@/components/verification/ImageUploadCard';
import { SkeletonStats } from '@/components/ui/Skeleton';
import {
  ShieldCheckIcon, UserIcon, CodeBracketIcon, BriefcaseIcon,
  ArrowRightIcon, ArrowLeftIcon, CheckCircleIcon,
  XCircleIcon, DocumentTextIcon, PhotoIcon, LinkIcon,
  GlobeAltIcon, ArrowPathIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { X } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: ShieldCheckIcon },
  { id: 'identity', label: 'Identity', icon: UserIcon },
  { id: 'github', label: 'GitHub', icon: CodeBracketIcon },
  { id: 'portfolio', label: 'Portfolio', icon: BriefcaseIcon },
];

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data;
  const fieldError = Array.isArray(data?.errors) && data.errors[0]?.message;
  return fieldError || data?.message || fallback;
};

function IdentityForm({ onSubmit, isPending }) {
  const [form, setForm] = useState({
    fullName: '', dateOfBirth: '', documentType: 'passport', country: '',
  });
  const [files, setFiles] = useState({ documentFront: null, documentBack: null, selfie: null });
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});

  const handleFileChange = useCallback((field, file) => {
    setFiles((prev) => ({ ...prev, [field]: file }));
    setUploadStatus((prev) => ({ ...prev, [field]: 'selected' }));
  }, []);

  const handleRemove = useCallback((field) => {
    setFiles((prev) => ({ ...prev, [field]: null }));
    setUploadStatus((prev) => ({ ...prev, [field]: null }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    onSubmit({ data: form, files, setProgress: setUploadProgress, setStatus: setUploadStatus });
  };

  const isValid = form.fullName && form.dateOfBirth && form.country && (files.documentFront || files.documentBack || files.selfie);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Personal Info */}
      <div>
        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Personal Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Full Legal Name <span className="text-red-500">*</span></label>
            <input type="text" required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="input text-sm" placeholder="As it appears on your ID" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Date of Birth <span className="text-red-500">*</span></label>
            <input type="date" required value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              className="input text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Document Type <span className="text-red-500">*</span></label>
            <select value={form.documentType} onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))} className="input text-sm">
              <option value="passport">Passport</option>
              <option value="drivers_license">Driver's License</option>
              <option value="national_id">National ID</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Country <span className="text-red-500">*</span></label>
            <input type="text" required value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className="input text-sm" placeholder="e.g. United States" />
          </div>
        </div>
      </div>

      {/* Document Uploads */}
      <div>
        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Upload Documents</h4>
        <p className="text-xs text-gray-400 mb-3">Upload clear photos of your government-issued ID. All images must be legible.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ImageUploadCard
            label="Front of ID"
            sublabel="Upload front side"
            file={files.documentFront}
            onFileSelect={(f) => handleFileChange('documentFront', f)}
            onRemove={() => handleRemove('documentFront')}
            uploading={uploadStatus.documentFront === 'uploading'}
            progress={uploadProgress.documentFront || 0}
            success={uploadStatus.documentFront === 'done'}
            required
          />
          <ImageUploadCard
            label="Back of ID"
            sublabel="Upload back side"
            file={files.documentBack}
            onFileSelect={(f) => handleFileChange('documentBack', f)}
            onRemove={() => handleRemove('documentBack')}
            uploading={uploadStatus.documentBack === 'uploading'}
            progress={uploadProgress.documentBack || 0}
            success={uploadStatus.documentBack === 'done'}
          />
          <ImageUploadCard
            label="Selfie with ID"
            sublabel="Hold ID next to face"
            file={files.selfie}
            onFileSelect={(f) => handleFileChange('selfie', f)}
            onRemove={() => handleRemove('selfie')}
            uploading={uploadStatus.selfie === 'uploading'}
            progress={uploadProgress.selfie || 0}
            success={uploadStatus.selfie === 'done'}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-[11px] text-gray-400">At least one document is required</p>
        <button type="submit" disabled={isPending || !isValid}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2">
          {isPending ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
          {isPending ? 'Uploading & Submitting...' : 'Submit for Review'}
        </button>
      </div>
    </form>
  );
}

function GithubForm({ onSubmit, isPending }) {
  const [username, setUsername] = useState('');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ username }); }} className="space-y-4">
      <div className="bg-gray-50 dark:bg-dark-900 rounded-xl p-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Enter your GitHub username to verify your profile. We analyze your public repos, contributions, and activity.
        </p>
        <div className="flex items-center gap-2 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
          <span className="text-gray-400 text-sm font-mono">github.com/</span>
          <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm font-mono" placeholder="your-username" />
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>What we verify:</strong> Public repositories, total stars earned, follower count, recent contribution activity, top programming languages, and pinned repositories.
        </p>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending || !username.trim()}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2">
          {isPending ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CodeBracketIcon className="w-4 h-4" />}
          {isPending ? 'Verifying...' : 'Verify GitHub Profile'}
        </button>
      </div>
    </form>
  );
}

function PortfolioForm({ onSubmit, isPending }) {
  const [form, setForm] = useState({
    websiteUrl: '', projectDescription: '', technologiesUsed: '',
    liveProjectUrl: '', sourceCodeUrl: '', clientTestimonial: '', clientName: '',
  });
  const [screenshots, setScreenshots] = useState([]);

  const handleScreenshots = useCallback((newFiles) => {
    setScreenshots((prev) => [...prev, ...newFiles].slice(0, 5));
  }, []);

  const removeScreenshot = useCallback((index) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.entries(form).forEach(([key, val]) => {
      if (key === 'technologiesUsed') {
        formData.append('technologiesUsed', JSON.stringify(val.split(',').map((s) => s.trim()).filter(Boolean)));
      } else {
        formData.append(key, val);
      }
    });
    screenshots.forEach((file) => formData.append('images', file));
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Portfolio Website URL <span className="text-red-500">*</span></label>
        <div className="flex items-center gap-2 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
          <GlobeAltIcon className="w-4 h-4 text-gray-400" />
          <input type="url" required value={form.websiteUrl} onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
            className="flex-1 bg-transparent outline-none text-sm" placeholder="https://yourportfolio.com" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Project Description <span className="text-red-500">*</span></label>
        <textarea required rows={4} value={form.projectDescription} onChange={(e) => setForm((f) => ({ ...f, projectDescription: e.target.value }))}
          className="input text-sm" placeholder="Describe your best project, your role, and the technologies you used..." />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Technologies Used (comma-separated) <span className="text-red-500">*</span></label>
        <input type="text" required value={form.technologiesUsed} onChange={(e) => setForm((f) => ({ ...f, technologiesUsed: e.target.value }))}
          className="input text-sm" placeholder="React, Node.js, PostgreSQL, Tailwind CSS" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Live Project URL (optional)</label>
          <input type="url" value={form.liveProjectUrl} onChange={(e) => setForm((f) => ({ ...f, liveProjectUrl: e.target.value }))}
            className="input text-sm" placeholder="https://live-project.com" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Source Code URL (optional)</label>
          <input type="url" value={form.sourceCodeUrl} onChange={(e) => setForm((f) => ({ ...f, sourceCodeUrl: e.target.value }))}
            className="input text-sm" placeholder="https://github.com/you/repo" />
        </div>
      </div>

      {/* Screenshot previews */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Project Screenshots (max 5)</label>
        {screenshots.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {screenshots.map((file, i) => (
              <div key={i} className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <img src={URL.createObjectURL(file)} alt={`Screenshot ${i + 1}`} className="w-full h-20 object-cover" />
                <button
                  type="button"
                  onClick={() => removeScreenshot(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        )}
        {screenshots.length < 5 && (
          <label className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-primary-400 transition-colors">
            <PhotoIcon className="w-8 h-8 text-gray-400" />
            <span className="text-xs text-gray-500">{screenshots.length}/5 screenshots selected</span>
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => handleScreenshots(Array.from(e.target.files))} />
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Client Testimonial (optional)</label>
          <textarea rows={2} value={form.clientTestimonial} onChange={(e) => setForm((f) => ({ ...f, clientTestimonial: e.target.value }))}
            className="input text-sm" placeholder="What did the client say about your work?" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Client Name (optional)</label>
          <input type="text" value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
            className="input text-sm" placeholder="Client Name" />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2">
          {isPending ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <BriefcaseIcon className="w-4 h-4" />}
          {isPending ? 'Submitting...' : 'Submit Portfolio for Review'}
        </button>
      </div>
    </form>
  );
}

function VerificationDetail({ verification, onResubmit, isResubmitPending }) {
  if (!verification) return null;

  const data = verification.identity || verification.github || verification.portfolio || verification.skill;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white capitalize">{verification.type} Verification</h3>
        <VerificationStatus status={verification.status} size="md" />
      </div>

      {verification.status === 'rejected' && verification.rejectionReason && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-1">
            <ExclamationTriangleIcon className="w-4 h-4" /> Rejection Reason
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{verification.rejectionReason}</p>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-dark-900 rounded-xl p-4 space-y-2.5">
        {verification.type === 'identity' && data && (
          <>
            <DetailRow label="Full Name" value={data.fullName} />
            <DetailRow label="Document Type" value={data.documentType?.replace('_', ' ')} />
            <DetailRow label="Country" value={data.country} />
            {data.documentFrontUrl && (
              <div className="pt-2">
                <p className="text-xs text-gray-500 mb-1">Uploaded Documents:</p>
                <div className="flex gap-2">
                  {data.documentFrontUrl && <a href={data.documentFrontUrl} target="_blank" rel="noopener noreferrer"><img src={data.documentFrontUrl} alt="Front" className="w-24 h-16 object-cover rounded-lg border" /></a>}
                  {data.documentBackUrl && <a href={data.documentBackUrl} target="_blank" rel="noopener noreferrer"><img src={data.documentBackUrl} alt="Back" className="w-24 h-16 object-cover rounded-lg border" /></a>}
                  {data.selfieUrl && <a href={data.selfieUrl} target="_blank" rel="noopener noreferrer"><img src={data.selfieUrl} alt="Selfie" className="w-24 h-16 object-cover rounded-lg border" /></a>}
                </div>
              </div>
            )}
          </>
        )}
        {verification.type === 'github' && data && (
          <>
            <DetailRow label="Username" value={`@${data.username}`} />
            <DetailRow label="Public Repos" value={data.publicRepos} />
            <DetailRow label="Total Stars" value={data.totalStars} />
            <DetailRow label="Followers" value={data.followers} />
            <DetailRow label="Contribution Score" value={data.contributionScore} />
            {data.topLanguages?.length > 0 && (
              <div className="flex items-start gap-2 pt-1">
                <span className="text-xs text-gray-500 w-32 shrink-0">Languages</span>
                <div className="flex flex-wrap gap-1">
                  {data.topLanguages.map((lang) => (
                    <span key={lang} className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{lang}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {verification.type === 'portfolio' && data && (
          <>
            <DetailRow label="Website" value={data.websiteUrl} isLink />
            <DetailRow label="Description" value={data.projectDescription} />
            <DetailRow label="Technologies" value={data.technologiesUsed?.join(', ')} />
            {data.liveProjectUrl && <DetailRow label="Live URL" value={data.liveProjectUrl} isLink />}
            {data.sourceCodeUrl && <DetailRow label="Source Code" value={data.sourceCodeUrl} isLink />}
            {data.projectScreenshots?.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-gray-500 mb-1">Screenshots:</p>
                <div className="flex gap-2 flex-wrap">
                  {data.projectScreenshots.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">
                      <img src={s.url} alt={`Screenshot ${i + 1}`} className="w-20 h-14 object-cover rounded-lg border" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {verification.type === 'skill' && data && (
          <>
            <DetailRow label="Skill" value={data.skillName} />
            <DetailRow label="Score" value={`${data.score}%`} />
          </>
        )}
      </div>

      {verification.status === 'rejected' && (
        <div className="flex justify-end">
          <button onClick={() => onResubmit(verification._id)} disabled={isResubmitPending}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 flex items-center gap-2">
            {isResubmitPending ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowPathIcon className="w-4 h-4" />}
            Resubmit
          </button>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, isLink = false }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline truncate">{value}</a>
      ) : (
        <span className="text-xs text-gray-900 dark:text-gray-200">{value}</span>
      )}
    </div>
  );
}

export default function VerificationPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedVerification, setSelectedVerification] = useState(null);

  const { data: verificationsData, isLoading } = useMyVerifications();
  const submitIdentity = useSubmitIdentity();
  const uploadDocs = useUploadIdentityDocuments();
  const submitGithub = useSubmitGithub();
  const submitPortfolio = useSubmitPortfolio();
  const resubmit = useResubmitVerification();

  const verifications = verificationsData?.data?.data?.verifications || [];
  const scores = verificationsData?.data?.data?.scores || {};
  const overallScore = verificationsData?.data?.data?.overallScore || 0;
  const trustLevel = verificationsData?.data?.data?.trustLevel || 'unverified';

  const handleSubmitIdentity = async ({ data, files, setProgress, setStatus }) => {
    try {
      // Step 1: Create identity verification record
      await submitIdentity.mutateAsync(data);

      // Step 2: Upload documents with progress
      const hasFiles = files.documentFront || files.documentBack || files.selfie;
      if (hasFiles) {
        const formData = new FormData();
        if (files.documentFront) formData.append('documentFront', files.documentFront);
        if (files.documentBack) formData.append('documentBack', files.documentBack);
        if (files.selfie) formData.append('selfie', files.selfie);

        // Mark all as uploading
        ['documentFront', 'documentBack', 'selfie'].forEach((key) => {
          if (files[key]) setStatus((s) => ({ ...s, [key]: 'uploading' }));
        });

        await uploadDocs.mutateAsync({
          formData,
          onProgress: (pct) => {
            ['documentFront', 'documentBack', 'selfie'].forEach((key) => {
              if (files[key]) setProgress((s) => ({ ...s, [key]: pct }));
            });
          },
        });

        // Mark all as done
        ['documentFront', 'documentBack', 'selfie'].forEach((key) => {
          if (files[key]) setStatus((s) => ({ ...s, [key]: 'done' }));
        });
      }

      toast.success('Identity verification submitted successfully!');
      setActiveTab('overview');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to submit identity verification'));
      ['documentFront', 'documentBack', 'selfie'].forEach((key) => {
        if (files[key]) setStatus((s) => ({ ...s, [key]: 'error' }));
      });
    }
  };

  const handleSubmitGithub = async (data) => {
    try {
      await submitGithub.mutateAsync(data);
      toast.success('GitHub profile verified successfully!');
      setActiveTab('overview');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to verify GitHub profile'));
    }
  };

  const handleSubmitPortfolio = async (formData) => {
    try {
      await submitPortfolio.mutateAsync({ formData });
      toast.success('Portfolio submitted for review!');
      setActiveTab('overview');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to submit portfolio'));
    }
  };

  const handleResubmit = async (id) => {
    try {
      await resubmit.mutateAsync(id);
      toast.success('Verification resubmitted!');
      setSelectedVerification(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to resubmit'));
    }
  };

  if (isLoading) return <div className="page-container py-8"><SkeletonStats /></div>;

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheckIcon className="w-6 h-6 text-primary-500" />
            Developer Verification
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Verify your identity, GitHub, and portfolio to build trust with clients
          </p>
        </div>
        <TrustLevelBadge trustLevel={trustLevel} size="lg" showProgress score={overallScore} />
      </motion.div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-5 text-center">
            <VerificationShield trustLevel={trustLevel} size={80} />
            <p className="text-sm font-bold text-gray-900 dark:text-white mt-3 capitalize">{trustLevel} Developer</p>
            <p className="text-xs text-gray-400 mt-1">{verifications.filter((v) => v.status === 'approved').length}/3 verified</p>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSelectedVerification(null); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4">
                {selectedVerification ? (
                  <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-6">
                    <VerificationDetail
                      verification={selectedVerification}
                      onResubmit={handleResubmit}
                      isResubmitPending={resubmit.isPending}
                    />
                    <button onClick={() => setSelectedVerification(null)} className="mt-4 text-sm text-primary-600 hover:underline flex items-center gap-1">
                      <ArrowLeftIcon className="w-3 h-3" /> Back to overview
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-6">
                      <VerificationScoreBar scores={scores} overallScore={overallScore} trustLevel={trustLevel} />
                    </div>

                    <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-6">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Verification Steps</h3>
                      <VerificationSteps verifications={verifications} />
                    </div>

                    {verifications.length > 0 && (
                      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-6">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Verification History</h3>
                        <div className="space-y-2">
                          {verifications.map((v) => (
                            <button
                              key={v._id}
                              onClick={() => setSelectedVerification(v)}
                              className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors text-left"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{v.type}</span>
                                <span className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleDateString()}</span>
                              </div>
                              <VerificationStatus status={v.status} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'identity' && (
              <motion.div key="identity" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Identity Verification</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                    Upload your government-issued ID to verify your identity. This helps build trust with clients.
                  </p>
                  <IdentityForm onSubmit={handleSubmitIdentity} isPending={submitIdentity.isPending || uploadDocs.isPending} />
                </div>
              </motion.div>
            )}

            {activeTab === 'github' && (
              <motion.div key="github" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">GitHub Verification</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                    Verify your GitHub profile to showcase your coding activity and contributions.
                  </p>
                  <GithubForm onSubmit={handleSubmitGithub} isPending={submitGithub.isPending} />
                </div>
              </motion.div>
            )}

            {activeTab === 'portfolio' && (
              <motion.div key="portfolio" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Portfolio Verification</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                    Submit a portfolio project for review to demonstrate your real-world skills.
                  </p>
                  <PortfolioForm onSubmit={handleSubmitPortfolio} isPending={submitPortfolio.isPending} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
