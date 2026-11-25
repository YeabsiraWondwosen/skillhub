import { useNavigate, useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCatalog,
  useSimilarCatalogs,
  useToggleSaveCatalog,
  useSavedCatalogs,
  useCatalogAnalytics,
  useDeleteCatalog,
  useToggleCatalogStatus,
  useDuplicateCatalog,
} from '@/hooks/useCatalogs';
import { useServiceReviews } from '@/hooks/useReviews';
import { FreelancerLevel, BadgeShowcase } from '@/components/badges/FreelancerBadge';
import Avatar from '@/components/ui/Avatar';
import StarRating from '@/components/ui/StarRating';
import Button from '@/components/ui/Button';
import { SkeletonStats } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { ConfirmModal } from '@/components/ui/Modal';
import ReportModal from '@/components/chat/ReportModal';
import { messageService } from '@/services/message.service';
import { useAuthStore } from '@/store/authStore';
import CategoryIcon from '@/utils/categoryIcons';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon, ClockIcon, CheckIcon, PaperAirplaneIcon, CheckBadgeIcon,
  BookmarkIcon, ShareIcon, FlagIcon, StarIcon as StarSolid,
  ShoppingBagIcon, ChevronRightIcon, PencilSquareIcon, PauseIcon, PlayIcon,
  TrashIcon, DocumentDuplicateIcon, EyeIcon, ChartBarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidFilled } from '@heroicons/react/24/solid';
import { formatCurrency } from '@/utils/currency';
import { format } from 'date-fns';
import { clsx } from 'clsx';

export default function CatalogDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();
  const isAuthenticated = !!user && !!accessToken;
  const { data: catalogData, isLoading } = useCatalog(slug);
  const catalog = catalogData?.data?.data;

  const catalogId = catalog?._id;
  const isOwner = !!user && !!catalog?.freelancer?._id && catalog.freelancer._id === user._id;

  const { data: similarData } = useSimilarCatalogs(catalogId, { limit: 3 });
  const similar = similarData?.data ?? [];
  const { data: savedData } = useSavedCatalogs({ enabled: isAuthenticated && !isOwner });
  const savedIds = new Set((savedData?.data ?? []).map(c => c._id));
  const isSaved = catalogId ? savedIds.has(catalogId) : false;
  const { mutate: toggleSave } = useToggleSaveCatalog();

  const { data: analytics, isLoading: analyticsLoading } = useCatalogAnalytics(catalogId, { enabled: isOwner });

  const { data: reviewsData } = useServiceReviews(catalogId, { page: 1, limit: 5 });
  const reviews = reviewsData?.data ?? [];
  const reviewStats = reviewsData?.meta?.stats || { averageRating: 0, totalReviews: 0, distribution: {} };

  const { mutate: deleteCatalog, isPending: deleting } = useDeleteCatalog();
  const { mutate: toggleStatus, isPending: togglingStatus } = useToggleCatalogStatus();
  const { mutate: duplicate } = useDuplicateCatalog();

  const [reportOpen, setReportOpen] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <div className="page-container"><SkeletonStats /></div>;
  if (!catalog) return <div className="page-container text-center py-20"><h2>Catalog not found</h2></div>;

  const freelancer = catalog.freelancer || {};
  const freelancerName = [freelancer.firstName, freelancer.lastName].filter(Boolean).join(' ') || 'Freelancer';
  const category = typeof catalog.category === 'object' && catalog.category ? catalog.category : null;
  const subcategory = typeof catalog.subcategory === 'object' && catalog.subcategory ? catalog.subcategory : null;
  const fStats = freelancer.stats || {};
  const hasFreelancerRating = typeof fStats.averageRating === 'number' && fStats.averageRating > 0;

  const requireAuth = () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to continue');
      navigate('/auth/login');
      return false;
    }
    return true;
  };

  const handleOrder = (tierName) => {
    if (!requireAuth()) return;
    if (isOwner) {
      toast.error('You cannot order your own service');
      return;
    }
    navigate(`/catalogs/${catalog.slug || slug}/order?tier=${tierName}`);
  };

  const handleMessage = async () => {
    if (!requireAuth()) return;
    if (isOwner) {
      toast.error('You cannot message yourself');
      return;
    }
    if (!freelancer?._id) {
      toast.error('Freelancer information is unavailable');
      return;
    }
    try {
      const res = await messageService.startConversation(freelancer._id);
      const conv = res.data?.data || res.data;
      navigate(`/messages/${conv._id}`);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
        'You can only message users you have an active relationship with (accepted proposal, contract, or existing conversation).'
      );
    }
  };

  const handleSave = () => {
    if (!requireAuth()) return;
    if (isOwner) return;
    toggleSave(catalogId);
  };

  const handleShare = async () => {
    const url = window.location.href;
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

  const handleToggleStatus = () => {
    toggleStatus(catalogId, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['catalog', slug] });
      },
    });
  };

  const handleDuplicate = () => {
    duplicate(catalogId, {
      onSuccess: (res) => {
        const copy = res.data?.data;
        if (copy) toast.success(`Copied as "${copy.title}"`);
      },
    });
  };

  const handlePreview = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = () => {
    deleteCatalog(catalogId, {
      onSuccess: () => {
        setDeleteOpen(false);
        toast.success('Service deleted');
        navigate('/freelancer/catalogs');
      },
      onError: (e) => {
        setDeleteOpen(false);
        toast.error(e?.response?.data?.message || 'Unable to delete service');
      },
    });
  };

  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  return (
    <div className="page-container max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <Link to="/catalogs" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Services
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Images */}
          {catalog.images?.length > 0 && (
            <div className="card overflow-hidden">
              <img src={catalog.images[0].url} alt={catalog.title} className="w-full h-64 object-cover" />
            </div>
          )}

          {/* Title & Description */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {category && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: `${category.color || '#3b82f6'}1a`,
                    color: category.color || '#3b82f6',
                  }}
                >
                  {category.icon && <CategoryIcon icon={category.icon} size={14} className="inline-flex" />}
                  {category.name || category.slug || 'Unknown'}
                </span>
              )}
              {subcategory && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300">
                  {subcategory.name || subcategory.slug}
                </span>
              )}
              {catalog.skills?.map((skill) => (
                <span key={skill} className="text-xs bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                  {skill}
                </span>
              ))}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{catalog.title}</h1>
            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {catalog.description}
            </div>
          </div>

          {/* Pricing Tiers */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Pricing Packages</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {catalog.pricingTiers?.map((tier) => (
                <div key={tier._id} className={`rounded-xl border-2 p-5 flex flex-col ${tier.name === 'standard' ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                  {tier.name === 'standard' && (
                    <span className="text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full font-medium self-start">Most Popular</span>
                  )}
                  <h3 className="font-bold text-gray-900 dark:text-white mt-2">{tier.title}</h3>
                  <p className="text-2xl font-black text-primary-600 my-2">{formatCurrency(tier.price, tier.currency || 'ETB')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{tier.description}</p>
                  <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300 flex-1">
                    <div className="flex items-center gap-2">
                      <ClockIcon className="w-3.5 h-3.5" />
                      <span>{tier.deliveryTime} {tier.deliveryUnit}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      <span>{tier.revisions} revision{tier.revisions !== 1 ? 's' : ''}</span>
                    </div>
                    {tier.features?.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckIcon className="w-3.5 h-3.5 text-green-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  {isOwner ? (
                    <div className="mt-4 text-center text-xs font-medium text-gray-400 dark:text-gray-500 rounded-lg bg-gray-50 dark:bg-dark-800 py-2.5">
                      This is your service — you can't order it
                    </div>
                  ) : (
                    <Button
                      className="w-full mt-4 text-sm"
                      variant={tier.name === 'standard' ? 'primary' : 'outline'}
                      onClick={() => handleOrder(tier.name)}
                    >
                      <ShoppingBagIcon className="w-4 h-4" /> Continue — {formatCurrency(tier.price, tier.currency || 'ETB')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">Service Reviews</h2>
              <span className="flex items-center gap-1.5 text-sm">
                <StarSolidFilled className="w-4 h-4 text-yellow-400" />
                <span className="font-bold text-gray-900 dark:text-white">{reviewStats.averageRating?.toFixed(1) || '—'}</span>
                <span className="text-xs text-gray-400">({reviewStats.totalReviews || 0})</span>
              </span>
            </div>

            {reviews.length === 0 ? (
              <EmptyState
                icon={StarSolid}
                title="No reviews yet"
                description="Reviews from completed orders will appear here."
                className="py-8"
              />
            ) : (
              <div className="space-y-4">
                {visibleReviews.map(review => (
                  <div key={review._id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar src={review.reviewer?.avatar?.url} alt={review.reviewer?.firstName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {[review.reviewer?.firstName, review.reviewer?.lastName].filter(Boolean).join(' ')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {review.createdAt ? format(new Date(review.createdAt), 'MMM d, yyyy') : ''}
                        </p>
                      </div>
                      <StarRating value={review.rating?.overall || 0} readonly size="sm" />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{review.comment}</p>
                  </div>
                ))}
                {reviews.length > 3 && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAllReviews(v => !v)} className="w-full text-center">
                    {showAllReviews ? 'Show less' : `Show all ${reviews.length} reviews`}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Freelancer / Owner Card */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <Avatar src={freelancer.avatar?.url} alt={freelancerName} size="lg" />
              <div className="min-w-0">
                <Link to={`/freelancers/${freelancer._id}`} className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 flex items-center gap-1">
                  {freelancerName}
                  {freelancer.isVerifiedFreelancer && (
                    <CheckBadgeIcon className="w-4 h-4 text-green-500" />
                  )}
                </Link>
                {freelancer.freelancerLevel && (
                  <FreelancerLevel level={freelancer.freelancerLevel} size="sm" showProgress={false} />
                )}
              </div>
            </div>

            {hasFreelancerRating && (
              <div className="flex items-center gap-2 mb-4 text-sm">
                <StarSolid className="w-4 h-4 text-yellow-400" />
                <span className="font-bold text-gray-900 dark:text-white">{fStats.averageRating.toFixed(1)}</span>
                <span className="text-xs text-gray-400">({fStats.totalReviews || 0} reviews)</span>
              </div>
            )}

            {freelancer.badges?.length > 0 && (
              <div className="mb-4">
                <BadgeShowcase badges={freelancer.badges} size="sm" />
              </div>
            )}

            {isOwner ? (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to={`/freelancer/catalogs/${catalog.slug}/edit`}
                  className="col-span-2 btn-secondary btn-sm inline-flex items-center justify-center gap-1.5"
                >
                  <PencilSquareIcon className="w-3.5 h-3.5" /> Edit Service
                </Link>
                <Button
                  className="w-full text-sm"
                  variant="outline"
                  onClick={handleToggleStatus}
                  loading={togglingStatus}
                >
                  {catalog.status === 'active' ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                  {catalog.status === 'active' ? 'Pause' : catalog.status === 'paused' ? 'Resume' : 'Publish'}
                </Button>
                <Button className="w-full text-sm" variant="outline" onClick={handlePreview}>
                  <EyeIcon className="w-4 h-4" /> Preview
                </Button>
                <Button className="w-full text-sm" variant="outline" onClick={handleDuplicate}>
                  <DocumentDuplicateIcon className="w-4 h-4" /> Duplicate
                </Button>
                <Button className="w-full text-sm" variant="outline" onClick={handleShare}>
                  <ShareIcon className="w-4 h-4" /> Share
                </Button>
                <Button className="w-full text-sm" variant="outline" onClick={() => setDeleteOpen(true)}>
                  <TrashIcon className="w-4 h-4 text-red-500" /> Delete
                </Button>
                <Link
                  to="/freelancer/earnings"
                  className="col-span-2 btn btn-primary btn-sm inline-flex items-center justify-center gap-1.5"
                >
                  <ChartBarIcon className="w-4 h-4" /> View Analytics
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="w-full text-sm" variant="secondary" onClick={handleMessage}>
                    <PaperAirplaneIcon className="w-4 h-4" /> Message Freelancer
                  </Button>
                  <Button className={clsx('w-full text-sm', isSaved && 'text-primary-600 border-primary-200 dark:border-primary-700')} variant="outline" onClick={handleSave}>
                    <BookmarkIcon className={clsx('w-4 h-4', isSaved && 'fill-current')} /> {isSaved ? 'Saved' : 'Save Service'}
                  </Button>
                  <Button className="w-full text-sm" variant="outline" onClick={handleShare}>
                    <ShareIcon className="w-4 h-4" /> Share
                  </Button>
                  <Button className="w-full text-sm" variant="outline" onClick={() => requireAuth() && setReportOpen(true)}>
                    <FlagIcon className="w-4 h-4" /> Report
                  </Button>
                </div>
                <Link
                  to={`/freelancers/${freelancer._id}`}
                  className="mt-2 w-full btn-secondary btn-sm inline-flex items-center justify-center gap-1.5"
                >
                  <CheckBadgeIcon className="w-3.5 h-3.5" /> View Freelancer Profile
                </Link>
              </>
            )}
          </div>

          {/* Stats / Analytics */}
          {isOwner ? (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Service Analytics</h3>
                <Link to="/freelancer/earnings" className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-0.5">
                  Earnings <ChevronRightIcon className="w-3 h-3" />
                </Link>
              </div>
              {analyticsLoading ? (
                <SkeletonStats />
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Views</span>
                    <span className="font-medium text-gray-900 dark:text-white">{analytics?.views ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Orders</span>
                    <span className="font-medium text-gray-900 dark:text-white">{analytics?.orders ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Favorites</span>
                    <span className="font-medium text-gray-900 dark:text-white">{analytics?.favorites ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Revenue</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(analytics?.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Conversion Rate</span>
                    <span className="font-medium text-gray-900 dark:text-white">{analytics?.conversionRate ?? 0}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Rating</span>
                    <span className="flex items-center gap-1.5">
                      <StarSolid className="w-4 h-4 text-yellow-400" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {analytics?.rating ? analytics.rating.toFixed(1) : '—'}
                      </span>
                      <span className="text-xs text-gray-400">({analytics?.totalReviews ?? 0})</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Service Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total orders</span>
                  <span className="font-medium text-gray-900 dark:text-white">{catalog.stats?.orders || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Views</span>
                  <span className="font-medium text-gray-900 dark:text-white">{catalog.stats?.views || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400">Rating</span>
                  <StarRating value={catalog.stats?.avgRating || 0} readonly size="sm" />
                </div>
              </div>
            </div>
          )}

          {/* Similar services */}
          {similar.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Similar Services</h3>
                <Link to="/catalogs" className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-0.5">
                  Browse all <ChevronRightIcon className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-3">
                {similar.map(sim => (
                  <Link key={sim._id} to={`/catalogs/${sim.slug}`} className="flex items-center gap-3 group">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-700 shrink-0">
                      {sim.images?.[0]?.url ? (
                        <img src={sim.images[0].url} alt={sim.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary-300">
                          <ShoppingBagIcon className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600">{sim.title}</p>
                      <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold">
                        {formatCurrency(sim.startingPrice, 'ETB')}+
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {catalog.tags?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {catalog.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        resourceType="catalog"
        resourceId={catalogId}
        resourceLabel={catalog.title}
      />

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete service?"
        message={`This will permanently delete "${catalog.title}". This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
