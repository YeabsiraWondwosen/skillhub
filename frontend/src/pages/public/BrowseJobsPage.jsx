import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon, BookmarkIcon, ClockIcon,
  CurrencyDollarIcon, XMarkIcon, AdjustmentsHorizontalIcon,
  ChevronRightIcon, ChevronDownIcon, FolderIcon, BriefcaseIcon,
  ArrowPathIcon, UserCircleIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid, StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { useJobs } from '@/hooks/useJobs';
import { useCategoryTree } from '@/hooks/useCategories';
import { useAuthStore } from '@/store/authStore';
import { userService } from '@/services/user.service';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Skeleton from '@/components/ui/Skeleton';
import { formatCurrency, formatCurrencyRange, formatRate } from '@/utils/currency';
import CategoryIcon from '@/utils/categoryIcons';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const LIMIT = 10;

const SORT_OPTIONS = [
  { value: 'best_match', label: 'Best Match' },
  { value: 'createdAt:desc', label: 'Newest First' },
  { value: 'createdAt:asc', label: 'Oldest First' },
  { value: 'budget.maxAmount:desc', label: 'Budget: High to Low' },
  { value: 'budget.maxAmount:asc', label: 'Budget: Low to High' },
];

const EXPERIENCE_OPTIONS = [
  { value: '', label: 'Any Experience Level' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert', label: 'Expert' },
];

const BUDGET_TYPE_OPTIONS = [
  { value: '', label: 'Any Budget Type' },
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'hourly', label: 'Hourly Rate' },
];

const DURATION_OPTIONS = [
  { value: '', label: 'Any Project Length' },
  { value: 'less_than_1_week', label: 'Less than 1 week' },
  { value: '1_to_4_weeks', label: '1 to 4 weeks' },
  { value: '1_to_3_months', label: '1 to 3 months' },
  { value: '3_to_6_months', label: '3 to 6 months' },
  { value: 'more_than_6_months', label: 'More than 6 months' },
];

const durationLabel = (v) => DURATION_OPTIONS.find(o => o.value === v)?.label ?? '';

function JobCardSkeleton() {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-2/3 rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-4/5 rounded" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <Skeleton className="h-6 w-40 rounded" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Format the budget range from real job data. Returns null when unavailable.
function formatBudget(job) {
  const b = job?.budget;
  if (!b || typeof b.maxAmount !== 'number') return null;
  const currency = b.currency || 'ETB';
  const min = typeof b.minAmount === 'number' && b.minAmount > 0 ? b.minAmount : null;
  const range = min
    ? formatCurrencyRange(min, b.maxAmount, currency)
    : formatCurrency(b.maxAmount, currency);
  return {
    type: b.type,
    amount: b.maxAmount,
    label: `${range}${b.type === 'hourly' ? '/hr' : ''}`,
  };
}

export default function BrowseJobsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: treeResp } = useCategoryTree();
  const parents = treeResp?.data ?? [];

  const [searchParams, setSearchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const urlCategory = searchParams.get('category') ?? '';
  const urlSubcategory = searchParams.get('subcategory') ?? '';

  // A subcategory id may arrive via ?category= (e.g. links from the category
  // page). Resolve it to its parent main category so the sidebar/chips and the
  // `subcategory` filter stay consistent.
  const { category: resolvedCategory, subcategory: resolvedSubcategory } = useMemo(() => {
    if (urlSubcategory) return { category: urlCategory, subcategory: urlSubcategory };
    if (urlCategory && parents.length) {
      const parent = parents.find(c => c.subcategories?.some(s => s._id === urlCategory));
      if (parent) return { category: parent._id, subcategory: urlCategory };
    }
    return { category: urlCategory, subcategory: '' };
  }, [urlCategory, urlSubcategory, parents]);
  const urlSortBy = searchParams.get('sort') ?? 'best_match';
  const urlExperience = searchParams.get('experience') ?? '';
  const urlBudgetType = searchParams.get('budgetType') ?? '';
  const urlMinBudget = searchParams.get('minBudget') ?? '';
  const urlMaxBudget = searchParams.get('maxBudget') ?? '';
  const urlSkills = searchParams.get('skills') ?? '';
  const urlDuration = searchParams.get('duration') ?? '';

  const [filters, setFilters] = useState({
    page: 1, limit: LIMIT,
    search: urlQ,
    category: resolvedCategory,
    subcategory: resolvedSubcategory,
    sortBy: urlSortBy,
    experienceLevel: urlExperience,
    budgetType: urlBudgetType,
    minBudget: urlMinBudget,
    maxBudget: urlMaxBudget,
    skills: urlSkills,
    duration: urlDuration,
  });
  const [searchInput, setSearchInput] = useState(urlQ);
  const [savedJobs, setSavedJobs] = useState(new Set());
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [expandedMains, setExpandedMains] = useState(() => new Set());
  const [budgetDraft, setBudgetDraft] = useState({ min: urlMinBudget, max: urlMaxBudget });
  const [skillsDraft, setSkillsDraft] = useState(urlSkills);
  const resultsRef = useRef(null);

  useEffect(() => {
    setFilters(f => ({
      ...f,
      search: urlQ,
      category: resolvedCategory,
      subcategory: resolvedSubcategory,
      sortBy: urlSortBy,
      experienceLevel: urlExperience,
      budgetType: urlBudgetType,
      minBudget: urlMinBudget,
      maxBudget: urlMaxBudget,
      skills: urlSkills,
      duration: urlDuration,
      page: 1,
    }));
    setSearchInput(urlQ);
  }, [urlQ, resolvedCategory, resolvedSubcategory, urlSortBy, urlExperience, urlBudgetType, urlMinBudget, urlMaxBudget, urlSkills, urlDuration]);

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
    setBudgetDraft({ min: urlMinBudget, max: urlMaxBudget });
    setSkillsDraft(urlSkills);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parents.length, filters.category, filters.subcategory]);

  const { data, isLoading, isError, refetch } = useJobs(filters);
  const jobs = data?.data ?? [];
  const meta = data?.meta;

  const selectedMain = parents.find(c => c._id === filters.category) ?? null;
  const subs = selectedMain?.subcategories ?? [];
  const selectedSub = subs.find(s => s._id === filters.subcategory) ?? null;

  const hasActiveFilters = Boolean(
    filters.search || filters.category || filters.subcategory ||
    filters.experienceLevel || filters.budgetType || filters.minBudget ||
    filters.maxBudget || filters.skills || filters.duration
  );

  const syncUrl = (f) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      const set = (key, val) => (val ? p.set(key, val) : p.delete(key));
      set('q', f.search);
      set('category', f.category);
      set('subcategory', f.subcategory);
      set('sort', f.sortBy && f.sortBy !== 'best_match' ? f.sortBy : '');
      set('experience', f.experienceLevel);
      set('budgetType', f.budgetType);
      set('minBudget', f.minBudget);
      set('maxBudget', f.maxBudget);
      set('skills', f.skills);
      set('duration', f.duration);
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
    patchFilters({ search: searchInput, page: 1 });
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

  const selectMain = (id) => patchFilters({ category: id, subcategory: '' });

  const selectSubcategory = (subId, parentId) => patchFilters({ category: parentId, subcategory: subId });

  const applyBudget = () => patchFilters({ minBudget: budgetDraft.min, maxBudget: budgetDraft.max });

  const applySkills = () => patchFilters({ skills: skillsDraft.trim() });

  const clearAll = () => {
    const reset = {
      search: '', category: '', subcategory: '', sortBy: 'best_match',
      experienceLevel: '', budgetType: '', minBudget: '', maxBudget: '', skills: '', duration: '',
    };
    setSearchInput('');
    setExpandedMains(() => new Set(parents[0] ? [parents[0]._id] : []));
    setBudgetDraft({ min: '', max: '' });
    setSkillsDraft('');
    setFilters(f => ({ ...f, ...reset, page: 1 }));
    syncUrl(reset);
  };

  const browseAll = () => {
    clearAll();
    navigate('/jobs');
  };

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSave = async (jobId) => {
    if (!user) { toast.error('Please login to save jobs'); return; }
    try {
      await userService.toggleSaveJob(jobId);
      setSavedJobs(prev => {
        const n = new Set(prev);
        n.has(jobId) ? n.delete(jobId) : n.add(jobId);
        return n;
      });
    } catch {
      toast.error('Failed to save job');
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
        All Jobs
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
                        {sub.name}
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
          Experience Level
        </p>
        <select
          className="input text-sm w-full"
          value={filters.experienceLevel}
          onChange={e => patchFilters({ experienceLevel: e.target.value })}
          aria-label="Experience level"
        >
          {EXPERIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Budget Type
        </p>
        <select
          className="input text-sm w-full"
          value={filters.budgetType}
          onChange={e => patchFilters({ budgetType: e.target.value })}
          aria-label="Budget type"
        >
          {BUDGET_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Budget Range
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} placeholder="Min"
            className="input text-sm w-full"
            value={budgetDraft.min}
            onChange={e => setBudgetDraft(d => ({ ...d, min: e.target.value }))}
            onBlur={applyBudget}
            onKeyDown={e => { if (e.key === 'Enter') applyBudget(); }}
            aria-label="Minimum budget"
          />
          <span className="text-gray-400 text-xs">–</span>
          <input
            type="number" min={0} placeholder="Max"
            className="input text-sm w-full"
            value={budgetDraft.max}
            onChange={e => setBudgetDraft(d => ({ ...d, max: e.target.value }))}
            onBlur={applyBudget}
            onKeyDown={e => { if (e.key === 'Enter') applyBudget(); }}
            aria-label="Maximum budget"
          />
        </div>
        <button type="button" onClick={applyBudget} className="mt-2 w-full btn-secondary btn-sm">
          Apply Budget
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Project Length
        </p>
        <select
          className="input text-sm w-full"
          value={filters.duration}
          onChange={e => patchFilters({ duration: e.target.value })}
          aria-label="Project length"
        >
          {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Skills
        </p>
        <div className="relative">
          <BriefcaseIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={skillsDraft}
            onChange={e => setSkillsDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applySkills(); }}
            onBlur={applySkills}
            placeholder="e.g. React, Figma"
            className="input pl-9 text-sm"
            aria-label="Required skills"
          />
        </div>
        {filters.skills && (
          <button
            type="button"
            onClick={() => patchFilters({ skills: '' })}
            className="mt-1.5 text-xs text-primary-600 hover:underline flex items-center gap-1"
          >
            <XMarkIcon className="w-3.5 h-3.5" /> Clear skills
          </button>
        )}
      </div>

      {hasActiveFilters && (
        <button type="button" onClick={clearAll} className="w-full btn-secondary text-sm flex items-center justify-center gap-1.5">
          <XMarkIcon className="w-4 h-4" /> Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="browse-jobs-page">
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
          <p className="text-primary-300 text-xs md:text-sm font-semibold tracking-widest uppercase mb-3">SkillHub · Browse Jobs</p>
          <h1 className="text-3xl md:text-5xl font-black text-white leading-tight">
            Find work that matches your skills
          </h1>
          <p className="mt-4 text-white/60 md:text-lg max-w-2xl mx-auto">
            Explore projects from clients looking for talented professionals.
          </p>
          <form onSubmit={handleSearch} className="mt-8 max-w-2xl mx-auto flex rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md shadow-2xl shadow-primary-900/30 overflow-hidden">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search jobs by title, skill, or keyword…"
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
              <span className="hidden sm:inline">Search Jobs</span>
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
                aria-label="Sort jobs"
              >
                {SORT_OPTIONS.map(o => <option key={`${o.value}-${o.label}`} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Results header */}
            <div className="hidden lg:flex items-center flex-wrap gap-3 mb-4">
              <div className="mr-auto">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Browse Jobs</h2>
                {!isLoading && meta && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-white">{meta.total?.toLocaleString()}</span> open job{meta.total !== 1 ? 's' : ''}
                    {selectedMain && (
                      <> in <span className="font-medium text-gray-700 dark:text-gray-200">{selectedMain.name}</span></>
                    )}
                    {selectedSub && (
                      <> · <span className="font-medium text-gray-700 dark:text-gray-200">{selectedSub.name}</span></>
                    )}
                  </p>
                )}
              </div>
              <select
                className="input w-auto text-sm"
                value={filters.sortBy}
                onChange={e => patchFilters({ sortBy: e.target.value })}
                aria-label="Sort jobs"
              >
                {SORT_OPTIONS.map(o => <option key={`${o.value}-${o.label}`} value={o.value}>{o.label}</option>)}
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
                  <span className="chip-filter">{selectedSub.name} <button type="button" onClick={() => patchFilters({ subcategory: '' })}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                )}
                {filters.experienceLevel && (
                  <span className="chip-filter">{EXPERIENCE_OPTIONS.find(o => o.value === filters.experienceLevel)?.label} <button type="button" onClick={() => patchFilters({ experienceLevel: '' })}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                )}
                {filters.budgetType && (
                  <span className="chip-filter">{BUDGET_TYPE_OPTIONS.find(o => o.value === filters.budgetType)?.label} <button type="button" onClick={() => patchFilters({ budgetType: '' })}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                )}
                {filters.duration && (
                  <span className="chip-filter">{durationLabel(filters.duration)} <button type="button" onClick={() => patchFilters({ duration: '' })}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                )}
                {(filters.minBudget || filters.maxBudget) && (
                  <span className="chip-filter">{filters.minBudget || 0} – {filters.maxBudget || '∞'} <button type="button" onClick={() => patchFilters({ minBudget: '', maxBudget: '' })}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
                )}
                {filters.skills && (
                  <span className="chip-filter">Skills: {filters.skills} <button type="button" onClick={() => patchFilters({ skills: '' })}><XMarkIcon className="w-3.5 h-3.5" /></button></span>
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

            {/* Results */}
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => <JobCardSkeleton key={i} />)}
              </div>
            ) : isError ? (
              <div className="card p-10">
                <EmptyState
                  icon={ArrowPathIcon}
                  title="Unable to load jobs"
                  description="Something went wrong while fetching jobs. Please try again."
                  action={
                    <button type="button" onClick={() => refetch()} className="btn-secondary btn-sm flex items-center gap-1.5">
                      <ArrowPathIcon className="w-4 h-4" /> Try Again
                    </button>
                  }
                />
              </div>
            ) : jobs.length === 0 ? (
              <div className="card p-10">
                {hasActiveFilters ? (
                  <EmptyState
                    icon={MagnifyingGlassIcon}
                    title="No jobs found"
                    description="Try adjusting your search or clearing some filters."
                    action={
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button type="button" onClick={clearAll} className="btn-secondary btn-sm">Clear Filters</button>
                        <button type="button" onClick={browseAll} className="btn-primary btn-sm">Browse Categories</button>
                      </div>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={BriefcaseIcon}
                    title="No jobs are available right now."
                    description="New projects from clients appear here as soon as they're posted. Check back soon."
                    action={
                      <button type="button" onClick={scrollToResults} className="btn-secondary btn-sm">Browse Categories</button>
                    }
                  />
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job, i) => {
                  const budget = formatBudget(job);
                  const cat = job.category;
                  const client = job.client;
                  const cStats = client?.stats;
                  const posted = job.createdAt ? formatDistanceToNow(new Date(job.createdAt), { addSuffix: true }) : null;
                  const hasClientRating = typeof cStats?.averageRating === 'number' && cStats.averageRating > 0 && (cStats.totalReviews ?? 0) > 0;
                  return (
                    <motion.div
                      key={job._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      className="card card-hover p-6"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Link
                              to={`/jobs/${job._id}`}
                              className="text-lg font-bold text-gray-900 dark:text-white hover:text-primary-600 transition-colors"
                            >
                              {job.title}
                            </Link>
                            {job.isUrgent && <Badge status="urgent">Urgent</Badge>}
                            {budget?.type && <Badge status={budget.type}>{budget.type === 'fixed' ? 'Fixed' : 'Hourly'}</Badge>}
                            {job.experienceLevel && <Badge status={job.experienceLevel}>{job.experienceLevel}</Badge>}
                          </div>

                          {cat && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1">
                              <CategoryIcon icon={cat.parent?.icon ?? cat.icon ?? '\u{1F4C1}'} size={14} className="mr-1" />
                              {cat.parent && (
                                <>
                                  <span>{cat.parent.name}</span>
                                  <ChevronRightIcon className="w-3 h-3" />
                                </>
                              )}
                              <span className="text-gray-500 dark:text-gray-400">{cat.name}</span>
                            </p>
                          )}

                          {job.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                              {job.description}
                            </p>
                          )}

                          {job.requiredSkills?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-4">
                              {job.requiredSkills.slice(0, 6).map(s => (
                                <span key={s} className="badge badge-gray">{s}</span>
                              ))}
                              {job.requiredSkills.length > 6 && (
                                <span className="badge badge-gray">+{job.requiredSkills.length - 6}</span>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400">
                            {budget && (
                              <span className="flex items-center gap-1 font-medium text-gray-600 dark:text-gray-300">
                                <CurrencyDollarIcon className="w-4 h-4" />
                                {budget.label}
                              </span>
                            )}
                            {posted && (
                              <span className="flex items-center gap-1">
                                <ClockIcon className="w-4 h-4" />
                                {posted}
                              </span>
                            )}
                            {typeof job.applicationsCount === 'number' && (
                              <span className="flex items-center gap-1">
                                <BriefcaseIcon className="w-4 h-4" />
                                {job.applicationsCount} proposal{job.applicationsCount !== 1 ? 's' : ''}
                              </span>
                            )}
                            {job.duration && (
                              <span className="hidden sm:inline">{durationLabel(job.duration)}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleSave(job._id)}
                            className="btn-icon btn-ghost"
                            title="Save job"
                            aria-label="Save job"
                          >
                            {savedJobs.has(job._id)
                              ? <BookmarkSolid className="w-5 h-5 text-primary-600" />
                              : <BookmarkIcon className="w-5 h-5" />}
                          </button>
                          <Link to={`/jobs/${job._id}`} className="btn-primary btn-sm">View Job</Link>
                        </div>
                      </div>

                      {(client || hasClientRating || (cStats?.completedProjects ?? 0) > 0 || (cStats?.successRate ?? 0) > 0) && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {client?.avatar?.url ? (
                              <img src={client.avatar.url} alt={client.firstName || 'Client'} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <UserCircleIcon className="w-7 h-7 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                            )}
                            <span className="text-xs text-gray-600 dark:text-gray-300 font-medium truncate">
                              {client?.firstName || client?.lastName ? `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim() : 'Client'}
                            </span>
                          </div>
                          {typeof cStats?.completedProjects === 'number' && cStats.completedProjects > 0 && (
                            <span className="text-xs text-gray-400">{cStats.completedProjects} jobs completed</span>
                          )}
                          {typeof cStats?.successRate === 'number' && cStats.successRate > 0 && (
                            <span className="text-xs text-gray-400">{cStats.successRate}% job success</span>
                          )}
                          {hasClientRating && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <StarSolid className="w-3.5 h-3.5 text-yellow-400" />
                              <span className="font-medium text-gray-600 dark:text-gray-300">{cStats.averageRating.toFixed(1)}</span>
                              <span>({cStats.totalReviews})</span>
                            </span>
                          )}
                          <div className="flex-1" />
                          <Link to={`/jobs/${job._id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
                            Apply Now
                            <ChevronRightIcon className="w-4 h-4" />
                          </Link>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            <Pagination meta={meta} onPageChange={p => setFilters(f => ({ ...f, page: p }))} />
          </div>
        </div>
      </div>
    </div>
  );
}
