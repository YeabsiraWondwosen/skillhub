import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { reviewService } from '@/services/review.service';
import Avatar from '@/components/ui/Avatar';
import StarRating from '@/components/ui/StarRating';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Star } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { ChatBubbleLeftRightIcon, StarIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const REVIEW_ROLES = { client: 'Client', freelancer: 'Freelancer' };
const FILTER_LABELS = { client: 'Clients', freelancer: 'Freelancers' };

const CATEGORY_LABELS = [
  { key: 'communication', label: 'Communication' },
  { key: 'quality', label: 'Quality' },
  { key: 'expertise', label: 'Expertise' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'deadlineAdherence', label: 'Deadline' },
];

const DEFAULT_STATS = { averageRating: 0, totalReviews: 0, ratingDistribution: {}, categoryAverages: {} };

export default function FreelancerReviews() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const userId = user?._id;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-reviews', page, filter],
    queryFn: () => reviewService.getUserReviews(userId, { page, limit: 10, reviewerRole: filter || undefined }).then(r => r.data),
    enabled: !!userId,
  });

  const reviews = data?.data ?? [];
  const meta = data?.meta;
  const stats = data?.meta?.stats || DEFAULT_STATS;
  const dist = stats.ratingDistribution || {};
  const distTotal = [5, 4, 3, 2, 1].reduce((acc, k) => acc + (dist[k] || 0), 0);
  const categoryAverages = stats.categoryAverages || {};
  const distPct = (k) => (distTotal > 0 ? Math.round(((dist[k] || 0) / distTotal) * 100) : 0);

  const { mutate: submitReply, isPending: isReplying } = useMutation({
    mutationFn: ({ reviewId, content }) => reviewService.reply(reviewId, content),
    onSuccess: () => {
      toast.success('Reply submitted');
      setReplyTo(null);
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['my-reviews'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to submit reply'),
  });

  const filters = [{ label: 'All', value: '' }, { label: 'From Clients', value: 'client' }, { label: 'From Freelancers', value: 'freelancer' }];

  const renderEmptyState = () => {
    if (stats.totalReviews > 0 && filter) {
      return (
        <EmptyState
          icon={ChatBubbleLeftRightIcon}
          title={`No reviews from ${FILTER_LABELS[filter]}`}
          description={`No reviews match this filter yet. Showing ${stats.totalReviews} total review${stats.totalReviews === 1 ? '' : 's'}.`}
        />
      );
    }
    return (
      <EmptyState icon={ChatBubbleLeftRightIcon} title="No reviews yet"
        description="Reviews from clients who completed projects with you will appear here." />
    );
  };

  return (
    <div className="page-container space-y-6">
      <div><h1 className="section-title flex items-center gap-2"><StarIcon className="w-7 h-7 text-yellow-500" />Reviews & Ratings</h1></div>

      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-yellow-50 dark:bg-yellow-900/20 flex items-baseline justify-center gap-0.5">
            <span className="text-3xl font-bold text-yellow-500">{stats.averageRating ? stats.averageRating.toFixed(1) : '—'}</span>
            {stats.averageRating > 0 && <span className="text-xs font-medium text-gray-400">/5</span>}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Average Rating</p>
            <StarRating value={stats.averageRating} readonly size="sm" showValue={false} />
            <p className="text-xs text-gray-400 mt-1">
              {stats.totalReviews === 0
                ? 'No reviews yet'
                : `${stats.totalReviews} review${stats.totalReviews !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="card p-5 md:col-span-2 space-y-1.5">
          {stats.totalReviews === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No ratings to display yet.</p>
          ) : ([5, 4, 3, 2, 1].map(r => (
            <div key={r} className="flex items-center gap-3 text-xs">
              <span className="w-8 text-gray-500 inline-flex items-center gap-0.5">{r}<Star size={10} className="text-yellow-400" fill="currentColor" /></span>
              <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${distPct(r)}%` }} title={`${distPct(r)}%`} />
              </div>
              <span className="w-6 text-gray-400">{dist[r] || 0}</span>
            </div>
          )))}
        </div>
      </div>

      {/* Category averages — computed from real review data */}
      {stats.totalReviews > 0 && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Category ratings</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {CATEGORY_LABELS.map(({ key, label }) => {
              const value = categoryAverages[key];
              return (
                <div key={key} className="rounded-xl bg-gray-50 dark:bg-dark-700/50 px-4 py-3">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {value != null ? `${value.toFixed(1)}/5` : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1">
        {filters.map(f => (
          <button key={f.value} onClick={() => { setFilter(f.value); setPage(1); }}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === f.value ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700')}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : isError ? (
        <EmptyState icon={ChatBubbleLeftRightIcon} title="Could not load reviews"
          description="Something went wrong while fetching your reviews. Please try again." />
      ) : reviews.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-4">
          {reviews.map((r, i) => (
            <motion.div key={r._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-5">
              <div className="flex items-start gap-3">
                <Avatar src={r.reviewer?.avatar?.url} alt={r.reviewer?.firstName} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-white">{r.reviewer?.firstName} {r.reviewer?.lastName}</p>
                    <span className="badge badge-secondary text-[10px]">{REVIEW_ROLES[r.reviewerRole]}</span>
                    {r.project?.title && (
                      <Link to={`/projects/${r.project._id}`} className="text-xs text-primary-600 hover:underline truncate">{r.project.title}</Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRating value={r.rating?.overall} readonly size="sm" />
                    <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy')}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{r.comment}</p>

                  {(() => {
                    const cats = CATEGORY_LABELS.filter(({ key }) => r.rating?.[key] != null);
                    if (cats.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {cats.map(({ key, label }) => (
                          <span key={key} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 dark:bg-dark-700/50 px-2.5 py-1 text-xs text-gray-500 dark:text-gray-300">
                            <span className="text-gray-400">{label}</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-200">{r.rating[key]}/5</span>
                            <span className="text-yellow-400">★</span>
                          </span>
                        ))}
                      </div>
                    );
                  })()}

                  {r.reply?.content ? (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-dark-700/50 rounded-lg">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Your reply</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{r.reply.content}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{format(new Date(r.reply.repliedAt), 'MMM d, yyyy')}</p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      {replyTo === r._id ? (
                        <div className="space-y-2">
                          <Textarea rows={3} placeholder="Write a professional reply…" value={replyText} onChange={e => setReplyText(e.target.value)} />
                          <div className="flex gap-2">
                            <Button size="sm" loading={isReplying}
                              onClick={() => replyText.trim() && submitReply({ reviewId: r._id, content: replyText.trim() })}>
                              Submit Reply
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => { setReplyTo(null); setReplyText(''); }}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setReplyTo(r._id)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Reply to review</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <Pagination meta={meta} onPageChange={setPage} />
    </div>
  );
}