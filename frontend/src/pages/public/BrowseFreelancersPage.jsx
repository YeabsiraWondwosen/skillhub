import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon, XMarkIcon, AdjustmentsHorizontalIcon,
  ShieldCheckIcon, MapPinIcon, BriefcaseIcon,
  PaperAirplaneIcon, ArrowPathIcon, ChevronDownIcon, FolderIcon, UserCircleIcon,
} from '@heroicons/react/24/outline';
import { userService } from '@/services/user.service';
import { jobService } from '@/services/job.service';
import CategoryIcon from '@/utils/categoryIcons';
import { useCategoryTree, useSkillsByCategory } from '@/hooks/useCategories';
import { useAuthStore } from '@/store/authStore';
import { subcategoryToProfession } from '@/utils/professions';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import StarRating from '@/components/ui/StarRating';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';
import { clsx } from 'clsx';
import { formatCurrency, formatRate } from '@/utils/currency';
import {
  buildAuthEntryLocation,
  clearInviteIntent,
  inviteIntentFromCard,
  readInviteIntent,
  sanitizeInviteIntent,
  stashInviteIntent,
} from '@/utils/authRedirect';

const LIMIT = 12;

const AVAILABILITY = [
  { value: '', label: 'Any Availability' },
  { value: 'available', label: 'Available Now' },
  { value: 'partially_available', label: 'Partially Available' },
];

const RATING_OPTIONS = [
  { value: '', label: 'Any Rating' },
  { value: '4', label: '4+ Stars' },
  { value: '4.5', label: '4.5+ Stars' },
];

const SORT_OPTIONS = [
  { value: '', label: 'Recommended' },
  { value: 'stats.averageRating:desc', label: 'Top Rated' },
  { value: 'stats.completedProjects:desc', label: 'Most Jobs' },
  { value: 'hourlyRate:asc', label: 'Lowest Rate' },
  { value: 'hourlyRate:desc', label: 'Highest Rate' },
  { value: 'most_relevant', label: 'Most Relevant' },
];

const availabilityLabel = (v) => AVAILABILITY.find(a => a.value === v)?.label ?? '';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const FreelancerCardSkeleton = () => (
  <div className="card p-5 space-y-4">
    <div className="flex items-start gap-3">
      <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <Skeleton className="h-3 w-1/3 rounded" />
      </div>
      <Skeleton className="h-9 w-16 rounded-lg flex-shrink-0" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-5/6 rounded" />
    </div>
    <div className="flex gap-2">
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-6 w-14 rounded-full" />
    </div>
    <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
      <Skeleton className="h-5 w-24 rounded" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  </div>
);

// ─── Invite to Job modal ──────────────────────────────────────────────────────

function InviteModal({ open, onClose, freelancer, jobs, jobsLoading, selectedJobId, onSelectJob, submitting, sent, onConfirm }) {
  const name = freelancer ? `${freelancer.firstName} ${freelancer.lastName}` : '';

  return (
    <Modal open={open} onClose={onClose} title="Invite to Job" size="md">
      {freelancer && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-gray-50 dark:bg-dark-700/60">
          <Avatar src={freelancer.avatar?.url} alt={name} size="md" />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{freelancer.profile?.tagline || 'Freelancer'}</p>
          </div>
        </div>
      )}

      {sent ? (
        <div className="text-center py-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-success-50 flex items-center justify-center mb-3">
            <ShieldCheckIcon className="w-6 h-6 text-success-500" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-white">Invitation sent!</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">They will be notified and can respond to your job.</p>
          <button onClick={onClose} className="btn-primary btn-sm mt-5">Done</button>
        </div>
      ) : jobsLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            You don't have any open jobs to invite this freelancer to yet.
          </p>
          <Link to="/client/jobs/new" onClick={onClose} className="btn-primary btn-sm">Post a Job</Link>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Choose an open job</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {jobs.map(job => {
              const active = selectedJobId === job._id;
              return (
                <button
                  key={job._id}
                  type="button"
                  onClick={() => onSelectJob(job._id)}
                  className={clsx(
                    'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors',
                    active
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                  )}
                >
                  <span className={clsx('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0', active ? 'border-primary-600' : 'border-gray-300 dark:border-gray-500')}>
                    {active && <span className="w-2 h-2 rounded-full bg-primary-600" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-sm text-gray-900 dark:text-white truncate">{job.title}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                      {job.budget?.type === 'hourly' ? 'Hourly' : 'Fixed'} · {job.budget?.type === 'hourly'
                        ? formatRate(job.budget?.maxAmount, job.budget?.currency) ?? (job.budget?.maxAmount ? `${job.budget.maxAmount} ${job.budget?.currency || 'ETB'}/hr` : '—')
                        : formatCurrency(job.budget?.maxAmount, job.budget?.currency) ?? (job.budget?.maxAmount ? `${job.budget.maxAmount} ${job.budget?.currency || 'ETB'}` : '—')} · Posted {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={onConfirm} disabled={!selectedJobId || submitting} className="btn-primary">
              {submitting ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BrowseFreelancersPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const location = useLocation();
  const { pathname, search } = location;

  const { data: treeResp } = useCategoryTree();
  const parents = treeResp?.data ?? [];

  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategory = searchParams.get('category') ?? '';
  const urlSubcategory = searchParams.get('subcategory') ?? '';
  const urlSkillsString = searchParams.get('skills') ?? '';
  const urlSearch = searchParams.get('q') ?? '';
  const urlAvailability = searchParams.get('availability') ?? '';
  const urlMinRating = searchParams.get('minRating') ?? '';
  const urlMinRate = searchParams.get('minRate') ?? '';
  const urlMaxRate = searchParams.get('maxRate') ?? '';
  const urlVerified = searchParams.get('verified') ?? '';
  const urlSortBy = searchParams.get('sort') ?? '';

  const [filters, setFilters] = useState({
    search: urlSearch,
    skills: urlSkillsString.split(',').filter(Boolean),
    category: urlCategory,
    subcategory: urlSubcategory,
    availability: urlAvailability,
    minRating: urlMinRating,
    minRate: urlMinRate,
    maxRate: urlMaxRate,
    isVerified: urlVerified,
    sortBy: urlSortBy,
    page: 1,
    limit: LIMIT,
  });
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [expandedMains, setExpandedMains] = useState(() => new Set());
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [rateDraft, setRateDraft] = useState({ min: urlMinRate, max: urlMaxRate });
  const [inviteTarget, setInviteTarget] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const resultsRef = useRef(null);
  const inviteResumeRef = useRef(false);

  useEffect(() => {
    setFilters(f => ({
      ...f,
      search: urlSearch,
      category: urlCategory,
      subcategory: urlSubcategory,
      skills: urlSkillsString.split(',').filter(Boolean),
      availability: urlAvailability,
      minRating: urlMinRating,
      minRate: urlMinRate,
      maxRate: urlMaxRate,
      isVerified: urlVerified,
      sortBy: urlSortBy,
      page: 1,
    }));
    setSearchInput(urlSearch);
    setRateDraft({ min: urlMinRate, max: urlMaxRate });
  }, [urlSearch, urlCategory, urlSubcategory, urlSkillsString, urlAvailability, urlMinRating, urlMinRate, urlMaxRate, urlVerified, urlSortBy]);

  useEffect(() => {
    if (!parents.length) return;
    setExpandedMains(() => {
      const n = new Set();
      if (filters.category) n.add(filters.category);
      if (filters.subcategory) {
        const parent = parents.find(c => c.subcategories?.some(s => s._id === filters.subcategory));
        if (parent) n.add(parent._id);
      }
      if (!n.size) n.add(parents[0]?._id);
      return n;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parents.length]);

  const selectedMain = parents.find(c => c._id === filters.category) ?? null;
  const subs = selectedMain?.subcategories ?? [];
  const selectedSub = subs.find(s => s._id === filters.subcategory) ?? null;

  const { data: skillsResp, isLoading: skillsLoading } = useSkillsByCategory(filters.subcategory);
  const skillOptions = skillsResp?.data ?? [];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['freelancers-public', { ...filters }],
    queryFn: () =>
      userService.searchFreelancers({
        search: filters.search || undefined,
        skills: filters.skills.length ? filters.skills.join(',') : undefined,
        category: filters.category || undefined,
        subcategory: filters.subcategory || undefined,
        availability: filters.availability || undefined,
        minRating: filters.minRating || undefined,
        minRate: filters.minRate || undefined,
        maxRate: filters.maxRate || undefined,
        isVerified: filters.isVerified || undefined,
        sortBy: filters.sortBy || undefined,
        page: filters.page,
        limit: LIMIT,
      }).then(r => r.data),
  });

  const freelancers = data?.data ?? [];
  const meta = data?.meta;

  // Open jobs for the invite flow (only fetched while the modal is open)
  const { data: jobsResp, isLoading: jobsLoading } = useQuery({
    queryKey: ['my-open-jobs', user?._id],
    queryFn: () => jobService.getMyJobs({ status: 'open', limit: 50 }).then(r => r.data),
    enabled: !!inviteTarget && !!user,
  });
  const openJobs = jobsResp?.data ?? [];

  const hasActiveFilters = Object.entries(filters).some(([k, v]) =>
    k !== 'sortBy' && k !== 'page' && k !== 'limit' && (Array.isArray(v) ? v.length > 0 : v !== '')
  );

  const syncUrl = (f) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      const set = (key, val) => (val ? p.set(key, val) : p.delete(key));
      set('q', f.search);
      set('category', f.category);
      set('subcategory', f.subcategory);
      set('skills', f.skills?.length ? f.skills.join(',') : '');
      set('availability', f.availability);
      set('minRating', f.minRating);
      set('minRate', f.minRate);
      set('maxRate', f.maxRate);
      set('verified', f.isVerified);
      set('sort', f.sortBy);
      return p;
    }, { replace: true });
  };

  const patchFilters = (next, sync = true) => {
    setFilters(f => {
      const merged = { ...f, page: 1, ...next };
      if (sync) syncUrl(merged);
      return merged;
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    patchFilters({ search: searchInput });
  };

  const clearSearch = () => {
    setSearchInput('');
    patchFilters({ search: '' });
  };

  const toggleMain = (id) => {
    setExpandedMains(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectMain = (id) => patchFilters({ category: id, subcategory: '', skills: [] });

  const selectSubcategory = (subId, parentId) => patchFilters({ category: parentId, subcategory: subId, skills: [] });

  const toggleSkill = (name) => {
    const next = filters.skills.includes(name)
      ? filters.skills.filter(s => s !== name)
      : [...filters.skills, name];
    patchFilters({ skills: next });
  };

  const applyRate = () => patchFilters({ minRate: rateDraft.min, maxRate: rateDraft.max });

  const clearAll = () => {
    const reset = {
      search: '', skills: [], category: '', subcategory: '',
      availability: '', minRating: '', minRate: '', maxRate: '',
      isVerified: '', sortBy: '',
    };
    setSearchInput('');
    setExpandedMains(() => new Set(parents[0] ? [parents[0]._id] : []));
    setRateDraft({ min: '', max: '' });
    setFilters(f => ({ ...f, ...reset, page: 1 }));
    syncUrl(reset);
  };

  const browseAll = () => {
    clearAll();
    navigate('/freelancers');
  };

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Invite handlers ────────────────────────────────────────────────────────
  const openInvite = (freelancerUser, profile) => {
    const intent = inviteIntentFromCard(freelancerUser, profile, `${pathname}${search}`);

    if (!user) {
      stashInviteIntent(intent);
      const entry = buildAuthEntryLocation({ invite: intent });
      navigate(entry.to, { state: entry.state, replace: entry.replace });
      return;
    }

    if (user.role !== 'client') {
      toast.error('Only client accounts can invite freelancers to a job.');
      return;
    }

    setInviteTarget({ ...freelancerUser, profile });
    setSelectedJobId(null);
    setInviteSent(false);
  };

  const closeInvite = () => {
    clearInviteIntent();
    setInviteTarget(null);
    setInviting(false);
  };

  // Resume an invitation the visitor started before authenticating.
  useEffect(() => {
    if (inviteResumeRef.current || !user || user.role !== 'client') return;

    const intent = sanitizeInviteIntent(location.state?.invite) || readInviteIntent();
    if (!intent) return;

    inviteResumeRef.current = true;
    clearInviteIntent();
    setInviteTarget({
      _id: intent.freelancerId,
      firstName: intent.firstName,
      lastName: intent.lastName,
      avatar: intent.avatarUrl ? { url: intent.avatarUrl } : undefined,
      profile: { tagline: intent.tagline },
    });
    setSelectedJobId(null);
    setInviteSent(false);
  }, [user, location.state]);

  const submitInvite = async () => {
    if (!selectedJobId || !inviteTarget) return;
    setInviting(true);
    try {
      await jobService.inviteFreelancer(selectedJobId, inviteTarget._id);
      setInviteSent(true);
      toast.success(`Invitation sent to ${inviteTarget.firstName}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  // ── Category sidebar (desktop + mobile drawer) ────────────────────────────
  const CategorySidebar = () => (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => selectMain('')}
        className={clsx(
          'w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2',
          !filters.category && !filters.subcategory
            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'
        )}
      >
        <FolderIcon className="w-5 h-5 text-primary-500 flex-shrink-0" />
        All Talent
      </button>

      {parents.map(cat => {
        const isExpanded = expandedMains.has(cat._id);
        const activeMain = filters.category === cat._id;
        const activeSubHere = filters.subcategory && cat.subcategories?.some(s => s._id === filters.subcategory);
        return (
          <div key={cat._id}>
            <button
              type="button"
              onClick={() => toggleMain(cat._id)}
              aria-expanded={isExpanded}
              className={clsx(
                'w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-between gap-2 group',
                activeMain || activeSubHere
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'
              )}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <CategoryIcon icon={cat.icon} size={16} className="w-6 text-center flex-shrink-0" />
                <span className="truncate">{cat.name}</span>
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                {cat.subcategories?.length > 0 && (
                  <span className="text-[10px] text-gray-400">{cat.subcategories.length}</span>
                )}
                <ChevronDownIcon className={clsx(
                  'w-3.5 h-3.5 transition-transform text-gray-300 dark:text-gray-600',
                  isExpanded && 'rotate-180'
                )} />
              </span>
            </button>

            {cat.subcategories?.length > 0 && (
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden pl-4 pr-1 pb-1 space-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => selectMain(cat._id)}
                      className={clsx(
                        'block w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        activeMain
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-700 dark:hover:text-gray-200'
                      )}
                    >
                      All {cat.name}
                    </button>
                    {cat.subcategories.map(sub => (
                      <button
                        key={sub._id}
                        type="button"
                        onClick={() => selectSubcategory(sub._id, cat._id)}
                        className={clsx(
                          'block w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors',
                          filters.subcategory === sub._id && filters.category === cat._id
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700'
                        )}
                      >
                        {subcategoryToProfession(sub.name)}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        );
      })}
    </div>
  );

  const FilterPanel = () => (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Availability
        </p>
        <select
          className="input text-sm w-full"
          value={filters.availability}
          onChange={e => patchFilters({ availability: e.target.value })}
          aria-label="Availability"
        >
          {AVAILABILITY.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Minimum Rating
        </p>
        <select
          className="input text-sm w-full"
          value={filters.minRating}
          onChange={e => patchFilters({ minRating: e.target.value })}
          aria-label="Minimum rating"
        >
          {RATING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Hourly Rate (ETB)
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} placeholder="Min"
            className="input text-sm w-full"
            value={rateDraft.min}
            onChange={e => setRateDraft(d => ({ ...d, min: e.target.value }))}
            onBlur={applyRate}
            onKeyDown={e => { if (e.key === 'Enter') applyRate(); }}
            aria-label="Minimum hourly rate"
          />
          <span className="text-gray-400 text-xs">–</span>
          <input
            type="number" min={0} placeholder="Max"
            className="input text-sm w-full"
            value={rateDraft.max}
            onChange={e => setRateDraft(d => ({ ...d, max: e.target.value }))}
            onBlur={applyRate}
            onKeyDown={e => { if (e.key === 'Enter') applyRate(); }}
            aria-label="Maximum hourly rate"
          />
        </div>
        <button type="button" onClick={applyRate} className="mt-2 w-full btn-secondary btn-sm">Apply Rate</button>
      </div>

      {selectedSub && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
            Skills · {subcategoryToProfession(selectedSub.name)}
          </p>
          {skillsLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
            </div>
          ) : skillOptions.length === 0 ? (
            <p className="text-sm text-gray-400">No skills listed for this specialty yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {skillOptions.map(skill => (
                <button
                  key={skill._id}
                  type="button"
                  onClick={() => toggleSkill(skill.name)}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    filters.skills.includes(skill.name)
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white dark:bg-dark-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-300'
                  )}
                >
                  {skill.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-300 select-none">
        <input
          type="checkbox"
          checked={filters.isVerified === 'true'}
          onChange={e => patchFilters({ isVerified: e.target.checked ? 'true' : '' })}
          className="w-4 h-4 rounded text-primary-600"
        />
        Verified only
      </label>

      {hasActiveFilters && (
        <button type="button" onClick={clearAll} className="w-full btn-secondary text-sm flex items-center justify-center gap-1.5">
          <XMarkIcon className="w-4 h-4" /> Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="browse-freelancers-page">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-950 via-[#14103a] to-secondary-950">
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
          aria-hidden="true"
        />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-[28rem] h-[28rem] bg-secondary-500/20 rounded-full blur-3xl" />
        <div className="relative page-container py-14 md:py-20 text-center">
          <p className="text-primary-300 text-xs md:text-sm font-semibold tracking-widest uppercase mb-3">SkillHub · Find Talent</p>
          <h1 className="text-3xl md:text-5xl font-black text-white leading-tight">
            Hire top freelance professionals
          </h1>
          <p className="mt-4 text-white/60 md:text-lg max-w-2xl mx-auto">
            Search Ethiopia's best freelancers across technology, design, marketing, writing, video and more.
          </p>
          <form onSubmit={handleSearch} className="mt-8 max-w-2xl mx-auto flex rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md shadow-2xl shadow-primary-900/30 overflow-hidden">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search talent by name, skill, or title…"
                className="w-full h-14 pl-12 pr-10 text-white placeholder-white/40 focus:outline-none bg-transparent"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50"
                  aria-label="Clear search"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-6 md:px-8 h-14 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-bold hover:brightness-110 transition-all flex items-center gap-2"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Search Talent</span>
            </button>
          </form>
        </div>
      </section>

      <div className="page-container py-8">
        <div className="flex gap-6">
          {/* ── LEFT: Categories + filters (desktop) ─────────── */}
          <aside className="hidden lg:block w-60 xl:w-64 flex-shrink-0">
            <div className="sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto space-y-4 pr-0.5">
              <div className="card p-3">
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Browse by Category
                </p>
                <CategorySidebar />
              </div>
              <div className="card p-4">
                <p className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Refine Results
                </p>
                <FilterPanel />
              </div>
            </div>
          </aside>

          {/* ── RIGHT: Results ───────────────────────────────── */}
          <div className="flex-1 min-w-0" ref={resultsRef}>
            {/* Mobile: filter button + sort */}
            <div className="lg:hidden flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(v => !v)}
                className="btn-secondary btn-sm flex items-center gap-1.5"
              >
                <AdjustmentsHorizontalIcon className="w-4 h-4" />
                Filters
              </button>
              <select
                className="input flex-1 text-sm"
                value={filters.sortBy}
                onChange={e => patchFilters({ sortBy: e.target.value })}
                aria-label="Sort freelancers"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Results header */}
            <div className="hidden lg:flex items-center flex-wrap gap-3 mb-4">
              <div className="mr-auto">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Find Talent</h2>
                {!isLoading && meta && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-white">{meta.total?.toLocaleString()}</span> freelancer{meta.total !== 1 ? 's' : ''} available
                    {selectedMain && (
                      <> in <span className="font-medium text-gray-700 dark:text-gray-200">{selectedMain.name}</span></>
                    )}
                    {selectedSub && (
                      <> · <span className="font-medium text-gray-700 dark:text-gray-200">{subcategoryToProfession(selectedSub.name)}</span></>
                    )}
                  </p>
                )}
              </div>
              <select
                className="input w-auto text-sm"
                value={filters.sortBy}
                onChange={e => patchFilters({ sortBy: e.target.value })}
                aria-label="Sort freelancers"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {filters.search && (
                  <span className="chip-filter">"{filters.search}" <button type="button" onClick={clearSearch}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                )}
                {selectedMain && (
                  <span className="chip-filter inline-flex items-center gap-1"><CategoryIcon icon={selectedMain.icon} size={14} /> {selectedMain.name} <button type="button" onClick={() => selectMain('')}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                )}
                {selectedSub && (
                  <span className="chip-filter">{subcategoryToProfession(selectedSub.name)} <button type="button" onClick={() => patchFilters({ subcategory: '' })}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                )}
                {filters.skills.map(skill => (
                  <span key={skill} className="chip-filter">{skill} <button type="button" onClick={() => toggleSkill(skill)}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                ))}
                {filters.availability && (
                  <span className="chip-filter">{availabilityLabel(filters.availability)} <button type="button" onClick={() => patchFilters({ availability: '' })}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                )}
                {filters.minRating && (
                  <span className="chip-filter">{filters.minRating}+ Stars <button type="button" onClick={() => patchFilters({ minRating: '' })}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                )}
                {(filters.minRate || filters.maxRate) && (
                  <span className="chip-filter">{filters.minRate || 0} – {filters.maxRate || '∞'} ETB/hr <button type="button" onClick={() => patchFilters({ minRate: '', maxRate: '' })}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                )}
                {filters.isVerified === 'true' && (
                  <span className="chip-filter">Verified <button type="button" onClick={() => patchFilters({ isVerified: '' })}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                )}
                <button type="button" onClick={clearAll} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                  <XMarkIcon className="w-3.5 h-3.5" /> Clear all
                </button>
              </div>
            )}

            {/* Mobile: filter drawer */}
            <AnimatePresence>
              {mobileFiltersOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="lg:hidden overflow-hidden mb-4"
                >
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="font-semibold text-gray-900 dark:text-white">Filters</p>
                      <button type="button" onClick={() => setMobileFiltersOpen(false)} className="btn-icon text-gray-400" aria-label="Close filters">
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Browse by Category</p>
                    <CategorySidebar />
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
                      <FilterPanel />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Grid / states */}
            {isLoading ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => <FreelancerCardSkeleton key={i} />)}
              </div>
            ) : isError ? (
              <div className="card p-10">
                <EmptyState
                  icon={ArrowPathIcon}
                  title="Unable to load talent"
                  description="Something went wrong while fetching freelancers. Please try again."
                  action={
                    <button type="button" onClick={() => refetch()} className="btn-secondary btn-sm flex items-center gap-1.5">
                      <ArrowPathIcon className="w-4 h-4" /> Try Again
                    </button>
                  }
                />
              </div>
            ) : freelancers.length === 0 ? (
              <div className="card p-10">
                {hasActiveFilters ? (
                  <EmptyState
                    icon={MagnifyingGlassIcon}
                    title="No freelancers found"
                    description="Try adjusting your search or clearing some filters."
                    action={
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button type="button" onClick={clearAll} className="btn-secondary btn-sm">Clear Filters</button>
                        <button type="button" onClick={browseAll} className="btn-primary btn-sm">Browse All Talent</button>
                      </div>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={UserCircleIcon}
                    title="No freelancers are available right now."
                    description="New specialists appear here as soon as they complete their profiles. Check back soon."
                    action={
                      <button type="button" onClick={scrollToResults} className="btn-secondary btn-sm">Browse Categories</button>
                    }
                  />
                )}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {freelancers.map((item, i) => {
                  // Items returned by /users/freelancers ARE Profile docs
                  // (populated with `user`, `categories`, `subcategories`).
                  const profile = item;
                  const u = item.user;
                  if (!u) return null;
                  const name = `${u.firstName} ${u.lastName}`.trim();
                  return (
                    <motion.div
                      key={u._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="h-full"
                    >
                      <div className="card card-hover h-full flex flex-col p-5">
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-4">
                          <Avatar src={u.avatar?.url} alt={name} size="lg" online={u.isOnline} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Link to={`/freelancers/${u._id}`} className="font-bold text-gray-900 dark:text-white truncate hover:text-primary-600">
                                {name || 'Freelancer'}
                              </Link>
                              {u.isVerifiedFreelancer && (
                                <ShieldCheckIcon className="w-4 h-4 text-blue-500 flex-shrink-0" title="Verified freelancer" />
                              )}
                            </div>
                            {profile.tagline && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{profile.tagline}</p>
                            )}
                            <p className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-1">
                              <MapPinIcon className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">
                                {profile.location?.city || profile.location?.country
                                  ? [profile.location.city, profile.location.country].filter(Boolean).join(', ')
                                  : 'Location not specified'}
                              </span>
                            </p>
                          </div>
                          {typeof profile.hourlyRate === 'number' && profile.hourlyRate > 0 && (
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-gray-900 dark:text-white text-sm">{formatRate(profile.hourlyRate)}</p>
                            </div>
                          )}
                        </div>

                        {/* Rating + stats */}
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-4 gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {(u.stats?.totalReviews ?? 0) > 0 ? (
                              <>
                                <StarRating value={u.stats?.averageRating ?? 0} readonly size="sm" />
                                <span className="font-medium text-gray-500 dark:text-gray-300">{(u.stats?.averageRating ?? 0).toFixed(1)}</span>
                                <span>({u.stats?.totalReviews ?? 0})</span>
                              </>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">No reviews yet</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="flex items-center gap-1">
                              <BriefcaseIcon className="w-3.5 h-3.5" /> {u.stats?.completedProjects ?? 0} jobs completed
                            </span>
                          </div>
                        </div>

                        {/* Skills */}
                        {profile.skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {profile.skills.slice(0, 3).map(s => (
                              <span key={s._id} className="badge badge-gray text-[11px]">{s.name}</span>
                            ))}
                            {profile.skills.length > 3 && (
                              <span className="badge badge-primary text-[11px]">+{profile.skills.length - 3}</span>
                            )}
                          </div>
                        )}

                        {/* Footer actions */}
                        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                          <Badge status={profile.availability ?? 'available'}>
                            {profile.availability === 'available' ? 'Available' :
                             profile.availability === 'partially_available' ? 'Partial' : 'Not Available'}
                          </Badge>
                          <div className="flex gap-2 flex-shrink-0">
                            <Link to={`/freelancers/${u._id}`} className="btn-secondary btn-sm">View Profile</Link>
                            <button type="button" onClick={() => openInvite(u, profile)} className="btn-primary btn-sm flex items-center gap-1.5">
                              <PaperAirplaneIcon className="w-3.5 h-3.5" />
                              Invite to Job
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            <Pagination meta={meta} onPageChange={p => patchFilters({ page: p }, false)} />
          </div>
        </div>
      </div>

      {/* ── Invite to Job modal ───────────────────────────────── */}
      <InviteModal
        open={!!inviteTarget}
        onClose={closeInvite}
        freelancer={inviteTarget}
        jobs={openJobs}
        jobsLoading={jobsLoading}
        selectedJobId={selectedJobId}
        onSelectJob={setSelectedJobId}
        submitting={inviting}
        sent={inviteSent}
        onConfirm={submitInvite}
      />
    </div>
  );
}
