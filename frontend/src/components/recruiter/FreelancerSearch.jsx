import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon, FunnelIcon, StarIcon, MapPinIcon, ClockIcon,
  PlusIcon, ArrowTrendingUpIcon, CheckBadgeIcon, UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useFreelancerSearch } from '@/hooks/useRecruiter';
import { clsx } from 'clsx';
import { formatRate } from '@/utils/currency';

const LEVEL_BADGE = {
  newcomer: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  intermediate: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  experienced: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  expert: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  top_rated_plus: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
};

const AVAILABILITY_COLORS = {
  available: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  partially_available: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  not_available: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

const SORT_OPTIONS = [
  { value: 'reputationScore', label: 'Reputation' },
  { value: 'rating', label: 'Rating' },
  { value: 'rate', label: 'Hourly Rate' },
  { value: 'projects', label: 'Projects' },
];

export default function FreelancerSearch({ onAddToPipeline, selectedIds = [], onToggleSelect }) {
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [skillInput, setSkillInput] = useState('');

  const { data, isLoading } = useFreelancerSearch({
    ...filters,
    skills: skillInput || undefined,
    page: filters.page || 1,
    limit: 20,
  });

  const results = data?.data || data?.results || [];
  const meta = data?.meta || {};

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (!value) delete next[key];
      delete next.page;
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by skills (comma-separated)..."
            value={skillInput}
            onChange={e => setSkillInput(e.target.value)}
            className="input-field w-full pl-10"
            onKeyDown={e => { if (e.key === 'Enter') handleFilterChange('skills', skillInput); }}
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary flex items-center gap-2">
          <FunnelIcon className="w-4 h-4" />
          Filters
        </button>
        <select
          value={filters.sortBy || 'reputationScore'}
          onChange={e => handleFilterChange('sortBy', e.target.value)}
          className="input-field w-40"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Min Rate (ETB/hr)</label>
            <input type="number" value={filters.minRate || ''} onChange={e => handleFilterChange('minRate', e.target.value)} className="input-field w-full" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Max Rate (ETB/hr)</label>
            <input type="number" value={filters.maxRate || ''} onChange={e => handleFilterChange('maxRate', e.target.value)} className="input-field w-full" placeholder="200" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Availability</label>
            <select value={filters.availability || ''} onChange={e => handleFilterChange('availability', e.target.value)} className="input-field w-full">
              <option value="">Any</option>
              <option value="available">Available</option>
              <option value="partially_available">Partially</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Location</label>
            <input type="text" value={filters.location || ''} onChange={e => handleFilterChange('location', e.target.value)} className="input-field w-full" placeholder="Country" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Min Rating</label>
            <input type="number" step="0.5" min="0" max="5" value={filters.minRating || ''} onChange={e => handleFilterChange('minRating', e.target.value)} className="input-field w-full" placeholder="4.0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Experience</label>
            <select value={filters.experienceLevel || ''} onChange={e => handleFilterChange('experienceLevel', e.target.value)} className="input-field w-full">
              <option value="">Any</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Language</label>
            <input type="text" value={filters.language || ''} onChange={e => handleFilterChange('language', e.target.value)} className="input-field w-full" placeholder="English" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Min Reputation</label>
            <input type="number" min="0" max="100" value={filters.minReputation || ''} onChange={e => handleFilterChange('minReputation', e.target.value)} className="input-field w-full" placeholder="50" />
          </div>
        </motion.div>
      )}

      {/* Results count */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {meta.total ?? results.length ?? 0} freelancer{meta.total !== 1 ? 's' : ''} found
        {selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
      </p>

      {/* Results grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-40 bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="card p-12 text-center text-gray-500 dark:text-gray-400">
          No freelancers match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {results.map((f, i) => (
            <motion.div
              key={f._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={clsx(
                'card p-4 cursor-pointer transition-all border-2',
                selectedIds.includes(f._id)
                  ? 'border-primary-500 bg-primary-50/30 dark:bg-primary-900/10'
                  : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
              )}
              onClick={() => onToggleSelect?.(f._id)}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0 text-primary-600 font-bold text-sm">
                  {f.firstName?.[0]}{f.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {f.firstName} {f.lastName}
                    </h4>
                    <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-semibold', LEVEL_BADGE[f.freelancerLevel])}>
                      {f.freelancerLevel?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {f.profile?.tagline || f.profile?.skills?.slice(0, 4).map(s => s.name).join(' · ') || 'No skills listed'}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <StarIcon className="w-3 h-3 text-yellow-500" />
                      {f.stats?.averageRating?.toFixed(1) || '—'}
                      <span className="text-gray-400">({f.stats?.totalReviews || 0})</span>
                    </span>
                    <span>{formatRate(f.profile?.hourlyRate)}</span>
                    <span>{f.stats?.completedProjects || 0} projects</span>
                    <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', AVAILABILITY_COLORS[f.profile?.availability])}>
                      {f.profile?.availability?.replace('_', ' ')}
                    </span>
                  </div>
                  {f.profile?.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {f.profile.skills.slice(0, 5).map(s => (
                        <span key={s.name} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-[10px]">
                          {s.name}
                        </span>
                      ))}
                      {f.profile.skills.length > 5 && (
                        <span className="text-[10px] text-gray-400">+{f.profile.skills.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>
                {onAddToPipeline && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddToPipeline(f); }}
                    className="btn-icon btn-ghost text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex-shrink-0"
                    title="Add to pipeline"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
