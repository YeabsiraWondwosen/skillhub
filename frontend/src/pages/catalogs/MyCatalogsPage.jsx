import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMyCatalogs, useDeleteCatalog, useToggleCatalogStatus, useDuplicateCatalog } from '@/hooks/useCatalogs';
import { useCategoryTree } from '@/hooks/useCategories';
import { SkeletonStats } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { ConfirmModal } from '@/components/ui/Modal';
import StarRating from '@/components/ui/StarRating';
import { formatCurrency } from '@/utils/currency';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  CommandLineIcon,
  EyeIcon,
  PencilSquareIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  ArrowUpRightIcon,
  ClockIcon,
  Squares2X2Icon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  DocumentDuplicateIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  paused: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  draft: 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-gray-400',
  archived: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'draft', label: 'Draft' },
];

const STATUS_COUNT_LABEL = { active: 'Active', paused: 'Paused', draft: 'Drafts' };

export default function MyCatalogsPage() {
  const { data: catalogsData, isLoading } = useMyCatalogs();
  const { mutate: deleteCatalog, isPending: deleting } = useDeleteCatalog();
  const { mutate: toggleStatus } = useToggleCatalogStatus();
  const { mutate: duplicate } = useDuplicateCatalog();

  const catalogs = catalogsData?.data?.data || [];
  const [tab, setTab] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const { data: treeData } = useCategoryTree();
  const parents = treeData?.data ?? [];
  const selectedMain = parents.find((c) => c._id === categoryFilter) ?? null;
  const subs = selectedMain?.subcategories ?? [];

  const formatDelivery = (catalog) => {
    const tiers = catalog.pricingTiers || [];
    if (!tiers.length) return null;
    const fastest = tiers.reduce((a, b) => (a.deliveryTime <= b.deliveryTime ? a : b));
    const unit = fastest.deliveryUnit === 'weeks' ? 'week' : 'day';
    return `${fastest.deliveryTime} ${unit}${fastest.deliveryTime > 1 ? 's' : ''}`;
  };

  const stats = useMemo(() => {
    return catalogs.reduce(
      (acc, c) => {
        acc.total++;
        acc.views += c.stats?.views || 0;
        acc.orders += c.stats?.orders || 0;
        if (c.status === 'active') acc.active++;
        if (c.status === 'paused') acc.paused++;
        if (c.status === 'draft') acc.draft++;
        return acc;
      },
      { total: 0, views: 0, orders: 0, active: 0, paused: 0, draft: 0 }
    );
  }, [catalogs]);

  const visible = (tab === 'all' ? catalogs : catalogs.filter((c) => c.status === tab)).filter((c) => {
    const matchesCategory = !categoryFilter || (typeof c.category === 'object' && c.category?._id === categoryFilter);
    const matchesSubcategory =
      !subcategoryFilter || (typeof c.subcategory === 'object' && c.subcategory?._id === subcategoryFilter);
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      [c.title, c.shortDescription, c.description, c.skills?.join(' ')]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q));
    return matchesCategory && matchesSubcategory && matchesSearch;
  });

  const hasActiveFilters = Boolean(categoryFilter || subcategoryFilter || search.trim());

  const clearFilters = () => {
    setCategoryFilter('');
    setSubcategoryFilter('');
    setSearch('');
  };

  const statCards = [
    { label: 'Total Services', value: stats.total, icon: FolderOpenIcon, accent: 'from-primary-500 to-secondary-500' },
    { label: 'Active', value: stats.active, icon: PlayIcon, accent: 'from-emerald-500 to-teal-500' },
    { label: 'Paused', value: stats.paused, icon: PauseIcon, accent: 'from-amber-500 to-orange-500' },
    { label: 'Total Views', value: stats.views, icon: EyeIcon, accent: 'from-indigo-500 to-violet-500' },
  ];

  const handleToggle = (catalog) => toggleStatus(catalog._id);
  const handleDuplicate = (catalog) => {
    duplicate(catalog._id, {
      onSuccess: (res) => {
        const copy = res.data?.data;
        if (copy) toast.success(`Copied as "${copy.title}"`);
      },
    });
  };
  const handleShare = async (catalog) => {
    const url = `${window.location.origin}/catalogs/${catalog.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: catalog.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Service link copied to clipboard');
      }
    } catch {
      toast.error('Unable to share or copy the service link');
    }
  };
  const handleDelete = () => {
    if (!toDelete) return;
    if ((toDelete.stats?.orders || 0) > 0) {
      toast.error('This service has orders and cannot be deleted. Pause it instead.');
      setToDelete(null);
      return;
    }
    deleteCatalog(toDelete._id, {
      onSuccess: () => setToDelete(null),
    });
  };

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Services</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your service catalogs — publish, pause and track performance.
          </p>
        </div>
        <Link
          to="/freelancer/catalogs/new"
          className="btn btn-primary inline-flex items-center gap-2 justify-center"
        >
          <PlusIcon className="w-4 h-4" /> Create Service
        </Link>
      </motion.div>

      {/* Stats */}
      {catalogs.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="card p-5 relative overflow-hidden">
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.accent}`} />
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${card.accent} flex items-center justify-center text-white shadow-lg`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{card.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {catalogs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map((t) => {
            const count = t.key === 'all' ? stats.total : stats[t.key] || 0;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={clsx(
                  'px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                  tab === t.key
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                    : 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300'
                )}
              >
                {t.label} <span className={clsx('ml-1 text-xs', tab === t.key ? 'text-white/80' : 'text-gray-400')}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      {catalogs.length > 0 && (
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services..."
                className="input pl-9"
              />
            </div>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setSubcategoryFilter('');
                }}
                className="input pr-9 appearance-none cursor-pointer"
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                {parents.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={subcategoryFilter}
                onChange={(e) => setSubcategoryFilter(e.target.value)}
                className="input pr-9 appearance-none cursor-pointer"
                disabled={!selectedMain}
                aria-label="Filter by subcategory"
              >
                <option value="">All Subcategories</option>
                {subs.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="btn-secondary whitespace-nowrap">
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <SkeletonStats />
      ) : catalogs.length === 0 ? (
        <div className="card p-10">
          <EmptyState
            icon={CommandLineIcon}
            title="No services yet"
            description="Create your first service catalog to start receiving orders from clients."
            action={
              <Link to="/freelancer/catalogs/new" className="btn btn-primary inline-flex items-center gap-2">
                <PlusIcon className="w-4 h-4" /> Create Service
              </Link>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-10">
          <EmptyState
            icon={Squares2X2Icon}
            title={hasActiveFilters ? 'No matching services' : `No ${STATUS_COUNT_LABEL[tab] || 'services'} yet`}
            description={
              hasActiveFilters
                ? 'Nothing matches your current filters. Try adjusting them or searching differently.'
                : 'Nothing matches this filter right now.'
            }
            action={
              hasActiveFilters ? (
                <button type="button" onClick={clearFilters} className="btn-secondary">
                  Clear all filters
                </button>
              ) : (
                <button type="button" onClick={() => setTab('all')} className="btn-secondary">
                  Show all services
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {visible.map((catalog, i) => {
            const startPrice = Math.min(...(catalog.pricingTiers?.map((t) => t.price) || [0]));
            const hasOrders = (catalog.stats?.orders || 0) > 0;
            return (
              <motion.div
                key={catalog._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card overflow-hidden group"
              >
                {/* Cover */}
                <Link to={`/catalogs/${catalog.slug}`} className="block relative h-40 overflow-hidden">
                  {catalog.images?.length > 0 ? (
                    <img
                      src={catalog.images[0].url}
                      alt={catalog.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-500/10 to-secondary-500/10 flex items-center justify-center">
                      <CommandLineIcon className="w-12 h-12 text-primary-300 dark:text-primary-700" />
                    </div>
                  )}
                  <span className={clsx('absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold capitalize shadow-sm', STATUS_STYLES[catalog.status] || STATUS_STYLES.draft)}>
                    {catalog.status}
                  </span>
                  {catalog.isFeatured && (
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-sm">
                      Featured
                    </span>
                  )}
                </Link>

                {/* Body */}
                <div className="p-5">
                  {/* Category breadcrumbs */}
                  <div className="flex items-center gap-1.5 text-xs mb-2 flex-wrap">
                    <span className="font-semibold text-gray-500 dark:text-gray-400">
                      {typeof catalog.category === 'object' ? catalog.category.name : '—'}
                    </span>
                    {catalog.subcategory && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">›</span>
                        <span className="font-medium text-primary-600 dark:text-primary-400">
                          {typeof catalog.subcategory === 'object' ? catalog.subcategory.name : '—'}
                        </span>
                      </>
                    )}
                  </div>

                  <Link to={`/catalogs/${catalog.slug}`} className="block">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {catalog.title}
                    </h3>
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 mb-3">{catalog.shortDescription}</p>

                  {/* Skills */}
                  {catalog.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {catalog.skills.slice(0, 3).map((skill) => (
                        <span key={skill} className="text-[10px] bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                          {skill}
                        </span>
                      ))}
                      {catalog.skills.length > 3 && (
                        <span className="text-[10px] text-gray-400">+{catalog.skills.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Stats + price */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5" />{formatDelivery(catalog) || '—'}</span>
                      <span className="flex items-center gap-1"><EyeIcon className="w-3.5 h-3.5" />{catalog.stats?.orders || 0} orders</span>
                      <StarRating value={catalog.stats?.avgRating || 0} readonly size="xs" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Starting at</p>
                      <p className="text-sm font-bold text-primary-600">{startPrice > 0 ? formatCurrency(startPrice) : '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/60 dark:bg-dark-900/40">
                  <Link to={`/catalogs/${catalog.slug}`} className="btn-secondary btn-sm flex items-center gap-1.5">
                    <ArrowUpRightIcon className="w-3.5 h-3.5" /> View
                  </Link>
                  <Link to={`/freelancer/catalogs/${catalog.slug}/edit`} className="btn-secondary btn-sm flex items-center gap-1.5">
                    <PencilSquareIcon className="w-3.5 h-3.5" /> Edit
                  </Link>
                  <button type="button" onClick={() => handleShare(catalog)} className="btn-icon btn-ghost" aria-label="Share service" title="Share">
                    <ShareIcon className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => handleDuplicate(catalog)} className="btn-icon btn-ghost" aria-label="Duplicate service" title="Duplicate">
                    <DocumentDuplicateIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(catalog)}
                    className={clsx(
                      'btn-sm flex items-center gap-1.5',
                      catalog.status === 'active'
                        ? 'btn-secondary text-amber-600 dark:text-amber-400'
                        : 'btn-secondary text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {catalog.status === 'active' ? <PauseIcon className="w-3.5 h-3.5" /> : <PlayIcon className="w-3.5 h-3.5" />}
                    {catalog.status === 'active' ? 'Pause' : catalog.status === 'paused' ? 'Resume' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(catalog)}
                    disabled={hasOrders}
                    title={hasOrders ? 'Services with orders can’t be deleted — pause it instead' : 'Delete service'}
                    className={clsx(
                      'btn-icon btn-ghost ml-auto',
                      hasOrders ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-red-500'
                    )}
                    aria-label="Delete service"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="Delete service?"
        message={`This will permanently delete "${toDelete?.title}". This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
