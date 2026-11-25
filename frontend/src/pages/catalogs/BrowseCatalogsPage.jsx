import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCatalogs, useRecommendedFreelancers, useRecentCatalogs } from '@/hooks/useCatalogs';
import { useCategoryTree } from '@/hooks/useCategories';
import CategoryFilter from '@/components/categories/CategoryFilter';
import CatalogCard from '@/components/catalogs/CatalogCard';
import { FreelancerLevel } from '@/components/badges/FreelancerBadge';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Avatar from '@/components/ui/Avatar';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import {
  MagnifyingGlassIcon, CommandLineIcon, XMarkIcon, ArrowPathIcon,
  UserGroupIcon, ClockIcon, SparklesIcon, BriefcaseIcon,
  ShieldCheckIcon, BanknotesIcon, CheckBadgeIcon, StarIcon as StarOutline,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Ordered' },
  { value: 'highest-rated', label: 'Top Rated' },
];

const PRICE_OPTIONS = [
  { value: '', label: 'Any price' },
  { value: '0-1000', label: 'Under 1,000 ETB' },
  { value: '1000-5000', label: '1,000 – 5,000 ETB' },
  { value: '5000-20000', label: '5,000 – 20,000 ETB' },
  { value: '20000-', label: 'Over 20,000 ETB' },
];

const RATING_OPTIONS = [
  { value: '', label: 'Any rating' },
  { value: '4.5', label: '4.5 stars and up' },
  { value: '4', label: '4 stars and up' },
  { value: '3', label: '3 stars and up' },
];

// Delivery time options map to the service package `deliveryTime` (normalized
// to days) stored in the database. "Custom" reveals a manual number of days.
const DELIVERY_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1 Day' },
  { value: '3', label: '3 Days' },
  { value: '7', label: '7 Days' },
  { value: '14', label: '14 Days' },
  { value: '30', label: '30 Days' },
  { value: 'custom', label: 'Custom' },
];

const AVAILABILITY_OPTIONS = [
  { value: '', label: 'Any availability' },
  { value: 'available', label: 'Available' },
  { value: 'busy', label: 'Busy' },
  { value: 'vacation', label: 'On vacation' },
  { value: 'offline', label: 'Offline' },
];

const VERIFIED_OPTIONS = [
  { value: '', label: 'Any verification' },
  { value: 'true', label: 'Verified freelancers only' },
];

const SELLER_LEVEL_OPTIONS = [
  { value: '', label: 'Any seller level' },
  { value: 'newcomer', label: 'Newcomer' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'experienced', label: 'Experienced' },
  { value: 'expert', label: 'Expert' },
  { value: 'top_rated_plus', label: 'Top Rated Plus' },
];

const PLATFORM_BENEFITS = [
  { label: 'Secure Escrow', icon: ShieldCheckIcon },
  { label: 'Verified Freelancers', icon: CheckBadgeIcon },
  { label: 'ETB Payments', icon: BanknotesIcon },
  { label: 'Real Reviews', icon: StarOutline },
  { label: 'AI Matching', icon: SparklesIcon },
];

function CatalogGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SidebarListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BrowseCatalogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [subcategory, setSubcategory] = useState(searchParams.get('subcategory') ?? '');
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(searchParams.get('sort') ?? 'newest');
  const [priceRange, setPriceRange] = useState('');
  const [rating, setRating] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [customDelivery, setCustomDelivery] = useState('');
  const [availability, setAvailability] = useState('');
  const [isVerified, setIsVerified] = useState('');
  const [sellerLevel, setSellerLevel] = useState('');
  const firstRender = useRef(true);

  // Reflect active filters in the URL so selections are shareable and persist.
  useEffect(() => {
    const next = new URLSearchParams();
    if (category) next.set('category', category);
    if (subcategory) next.set('subcategory', subcategory);
    if (search) next.set('q', search);
    if (sortBy !== 'newest') next.set('sort', sortBy);
    const current = searchParams.toString();
    if (next.toString() !== current) setSearchParams(next, { replace: true });
  }, [category, subcategory, search, sortBy]);

  // Debounce search so we don't fire a request on every keystroke.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const priceParts = priceRange ? priceRange.split('-') : [];
  const minPrice = priceParts[0] || '';
  const maxPrice = priceParts[1] || '';

  const resolvedDelivery =
    deliveryTime === 'custom' ? customDelivery.trim() : deliveryTime;

  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search,
      category,
      subcategory,
      sortBy,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      rating: rating || undefined,
      maxDeliveryTime: resolvedDelivery || undefined,
      availability: availability || undefined,
      isVerified: isVerified || undefined,
      sellerLevel: sellerLevel || undefined,
    }),
    [page, search, category, subcategory, sortBy, minPrice, maxPrice, rating, resolvedDelivery, availability, isVerified, sellerLevel]
  );

  const { data: catalogsData, isLoading, isError, refetch } = useCatalogs(filters);
  const { data: recData, isLoading: recLoading } = useRecommendedFreelancers({
    category: category || undefined,
    subcategory: subcategory || undefined,
  });
  const { data: recentData, isLoading: recentLoading } = useRecentCatalogs(5);
  const { data: treeData } = useCategoryTree();
  const treeParents = treeData?.data ?? [];

  const payload = catalogsData?.data;
  const catalogs = payload?.data || [];
  const meta = payload?.meta;
  const recommended = recData ?? [];
  const recent = recentData ?? [];

  const categoryName =
    (subcategory
      ? treeParents.find((c) => c.subcategories?.some((s) => s._id === subcategory))?.subcategories?.find((s) => s._id === subcategory)?.name
      : treeParents.find((c) => c._id === category)?.name) || null;

  const hasCategoryFilter = Boolean(category || subcategory);
  const hasActiveFilters = Boolean(search || hasCategoryFilter || deliveryTime || availability || isVerified || sellerLevel);

  const selectCategory = (categoryId, subcategoryId) => {
    setCategory(categoryId);
    setSubcategory(subcategoryId);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setCategory('');
    setSubcategory('');
    setPriceRange('');
    setRating('');
    setDeliveryTime('');
    setCustomDelivery('');
    setAvailability('');
    setIsVerified('');
    setSellerLevel('');
    setPage(1);
  };

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Browse Services</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
          Discover pre-defined service packages from top professionals
        </p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Filters */}
          <div className="card p-4 mb-6 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="input pl-9 pr-9"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              <CategoryFilter
                categoryId={category}
                subcategoryId={subcategory}
                onChange={({ categoryId, subcategoryId }) => selectCategory(categoryId, subcategoryId)}
              />
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                className="input w-auto cursor-pointer"
                aria-label="Sort services"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              <select
                value={priceRange}
                onChange={(e) => { setPriceRange(e.target.value); setPage(1); }}
                className="input w-auto cursor-pointer"
                aria-label="Filter by price"
              >
                {PRICE_OPTIONS.map((o) => (
                  <option key={o.value || 'any-price'} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={rating}
                onChange={(e) => { setRating(e.target.value); setPage(1); }}
                className="input w-auto cursor-pointer"
                aria-label="Filter by rating"
              >
                {RATING_OPTIONS.map((o) => (
                  <option key={o.value || 'any-rating'} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <select
                  value={deliveryTime}
                  onChange={(e) => {
                    setDeliveryTime(e.target.value);
                    if (e.target.value !== 'custom') setCustomDelivery('');
                    setPage(1);
                  }}
                  className="input w-auto cursor-pointer"
                  aria-label="Filter by delivery time"
                >
                  {DELIVERY_OPTIONS.map((o) => (
                    <option key={o.value || 'any-delivery'} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {deliveryTime === 'custom' && (
                  <input
                    type="number"
                    min="1"
                    placeholder="Days"
                    value={customDelivery}
                    onChange={(e) => { setCustomDelivery(e.target.value); setPage(1); }}
                    className="input w-24"
                    aria-label="Custom maximum delivery time in days"
                  />
                )}
              </div>
              <select
                value={availability}
                onChange={(e) => { setAvailability(e.target.value); setPage(1); }}
                className="input w-auto cursor-pointer"
                aria-label="Filter by availability"
              >
                {AVAILABILITY_OPTIONS.map((o) => (
                  <option key={o.value || 'any-availability'} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={isVerified}
                onChange={(e) => { setIsVerified(e.target.value); setPage(1); }}
                className="input w-auto cursor-pointer"
                aria-label="Filter by verified freelancers"
              >
                {VERIFIED_OPTIONS.map((o) => (
                  <option key={o.value || 'any-verification'} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={sellerLevel}
                onChange={(e) => { setSellerLevel(e.target.value); setPage(1); }}
                className="input w-auto cursor-pointer"
                aria-label="Filter by seller level"
              >
                {SELLER_LEVEL_OPTIONS.map((o) => (
                  <option key={o.value || 'any-seller-level'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2">
                {search && (
                  <span className="chip-filter">
                    "{search}" <button type="button" onClick={() => setSearchInput('')} aria-label="Clear search"><XMarkIcon className="w-3.5 h-3.5" /></button>
                  </span>
                )}
                {hasCategoryFilter && (
                  <span className="chip-filter">
                    {categoryName || subcategory || category || 'Category'} <button type="button" onClick={() => selectCategory('', '')} aria-label="Clear category"><XMarkIcon className="w-3.5 h-3.5" /></button>
                  </span>
                )}
                <button type="button" onClick={clearFilters} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                  <XMarkIcon className="w-3.5 h-3.5" /> Clear all
                </button>
              </div>
            )}
          </div>

          {/* Results header */}
          {!isLoading && !isError && meta && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              <span className="font-semibold text-gray-900 dark:text-white">{meta.total}</span>{' '}
              service{meta.total !== 1 ? 's' : ''} found
            </p>
          )}

          {/* Results */}
          {isLoading ? (
            <CatalogGridSkeleton />
          ) : isError ? (
            <div className="card p-10">
              <EmptyState
                icon={ArrowPathIcon}
                title="Unable to load services"
                description="Something went wrong while fetching services. Please try again."
                action={
                  <button type="button" onClick={() => refetch()} className="btn-secondary btn-sm flex items-center gap-1.5">
                    <ArrowPathIcon className="w-4 h-4" /> Try Again
                  </button>
                }
              />
            </div>
          ) : catalogs.length === 0 ? (
            <div className="card p-10">
              {hasActiveFilters ? (
                <EmptyState
                  icon={MagnifyingGlassIcon}
                  title={hasCategoryFilter && !search ? 'No services found in this category' : 'No services found'}
                  description={
                    hasCategoryFilter && !search
                      ? 'There are no published services in this category yet. Try another category or clear the filter.'
                      : 'Try adjusting your search or clearing some filters.'
                  }
                  action={
                    <button type="button" onClick={clearFilters} className="btn-secondary btn-sm">
                      Clear Filters
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon={CommandLineIcon}
                  title="No services available yet"
                  description="Freelancers can publish service packages here once they create and publish their services."
                />
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {catalogs.map((catalog, i) => (
                  <CatalogCard key={catalog._id} catalog={catalog} index={i} />
                ))}
              </div>
              <Pagination meta={meta} onPageChange={setPage} />
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 space-y-4">
          {/* A. Recommended Freelancers */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-4 flex items-center gap-1.5">
              <UserGroupIcon className="w-4 h-4 text-primary-500" /> Recommended Freelancers
            </h3>
            {recLoading ? (
              <SidebarListSkeleton rows={4} />
            ) : recommended.length === 0 ? (
              <p className="text-xs text-gray-400">No freelancer recommendations yet.</p>
            ) : (
              <div className="space-y-3">
                {recommended.map((freelancer) => {
                  const name = [freelancer.firstName, freelancer.lastName].filter(Boolean).join(' ') || 'Freelancer';
                  const hasRating = typeof freelancer.stats?.averageRating === 'number' && freelancer.stats.averageRating > 0;
                  return (
                    <Link
                      key={freelancer._id}
                      to={`/freelancers/${freelancer._id}`}
                      className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-lg p-2 -mx-2 transition-colors"
                    >
                      <Avatar src={freelancer.avatar?.url} alt={name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate flex items-center gap-1">
                          {name}
                          {freelancer.isVerifiedFreelancer && (
                            <CheckBadgeIcon className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          )}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {hasRating ? (
                            <>
                              <StarSolid className="w-3 h-3 text-yellow-400" />
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                {freelancer.stats.averageRating.toFixed(1)}
                              </span>
                              <span className="text-[10px] text-gray-400">({freelancer.stats.totalReviews || 0})</span>
                            </>
                          ) : (
                            <FreelancerLevel level={freelancer.freelancerLevel} size="sm" showProgress={false} />
                          )}
                        </div>
                        {freelancer.skills?.length > 0 && (
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{freelancer.skills.join(', ')}</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* B. Recently Added Services */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-4 flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4 text-primary-500" /> Recently Added Services
            </h3>
            {recentLoading ? (
              <SidebarListSkeleton rows={4} />
            ) : recent.length === 0 ? (
              <p className="text-xs text-gray-400">No recent services.</p>
            ) : (
              <div className="space-y-3">
                {recent.map((item) => (
                  <Link key={item._id} to={`/catalogs/${item.slug}`} className="flex items-center gap-3 group">
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-700 shrink-0 flex items-center justify-center">
                      {item.images?.[0]?.url ? (
                        <img src={item.images[0].url} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <CommandLineIcon className="w-5 h-5 text-primary-300 dark:text-primary-700" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600">
                        {item.title}
                      </p>
                      <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold">
                        {formatCurrency(item.startingPrice, 'ETB')}+
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* C. Why Choose SkillHub */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-4 flex items-center gap-1.5">
              <SparklesIcon className="w-4 h-4 text-primary-500" /> Why Choose SkillHub
            </h3>
            <ul className="space-y-2.5">
              {PLATFORM_BENEFITS.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <li key={benefit.label} className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300">
                    <span className="w-6 h-6 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    {benefit.label}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* D. Need a Custom Project? */}
          <div className="card p-5 bg-gradient-to-br from-primary-500 to-secondary-500 text-white">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              <BriefcaseIcon className="w-4 h-4" /> Need a Custom Project?
            </h3>
            <p className="text-xs text-white/80 mb-4">
              Can't find the right service? Post a job and receive proposals from qualified freelancers.
            </p>
            <Link to="/client/jobs/new" className="btn bg-white text-primary-700 hover:bg-primary-50 w-full text-center text-sm">
              Post a Job
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
