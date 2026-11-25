import Avatar from '@/components/ui/Avatar';
import StarRating from '@/components/ui/StarRating';
import SectionCard from './SectionCard';
import EmptySection from './EmptySection';
import { ratingBreakdown } from './profileHelpers';
import { formatDistanceToNow } from 'date-fns';
import { Star } from 'lucide-react';
import { clsx } from 'clsx';

function ReviewSummary({ meta }) {
  const average = meta?.averageRating ?? 0;
  const total = meta?.totalReviews ?? 0;
  if (!total) return null;
  const counts = ratingBreakdown(meta.ratingDistribution);

  return (
    <div className="mb-6 flex flex-col gap-6 rounded-xl border border-gray-100 bg-white/[0.04] p-5 sm:flex-row">
      <div className="text-center sm:min-w-[110px]">
        <p className="text-4xl font-bold text-gray-900">{average > 0 ? average.toFixed(1) : '—'}</p>
        <div className="mt-1 flex justify-center">
          <StarRating value={average} readonly size="sm" />
        </div>
        <p className="mt-1 text-xs text-gray-500">{total} {total === 1 ? 'review' : 'reviews'}</p>
      </div>
      <div className="flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = counts[star];
          const width = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-3 text-right font-medium text-gray-500">{star}</span>
              <Star size={10} className="text-yellow-400 inline-flex" fill="currentColor" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                <div className="h-full rounded-full bg-yellow-400" style={{ width: `${width}%` }} />
              </div>
              <span className="w-6 text-right text-gray-500">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewItem({ review }) {
  const reviewer = review.reviewer || {};
  const name = [reviewer.firstName, reviewer.lastName].filter(Boolean).join(' ') || 'Client';
  const isFreelancerReviewer = reviewer.role === 'freelancer';

  return (
    <li className="border-b border-gray-100 pb-5 last:border-b-0 last:pb-0">
      <div className="flex items-start gap-3">
        <Avatar src={reviewer.avatar?.url} alt={name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-200">{name}</p>
              <span className={clsx(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                isFreelancerReviewer ? 'bg-primary-50 text-primary-600' : 'bg-green-100 text-green-600'
              )}>
                {isFreelancerReviewer ? 'Freelancer' : 'Client'}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {review.createdAt ? formatDistanceToNow(new Date(review.createdAt), { addSuffix: true }) : ''}
            </span>
          </div>
          <div className="mt-1">
            <StarRating value={review.rating?.overall ?? 0} readonly size="sm" />
          </div>
          {review.project?.title && (
            <p className="mt-1 text-xs text-gray-500">on “{review.project.title}”</p>
          )}
          {review.comment && (
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              {typeof review.comment === 'string' ? review.comment : review.comment?.content}
            </p>
          )}
          {review.reply?.content && (
            <div className="mt-3 rounded-xl border-l-2 border-primary-100 bg-primary-50 p-3">
              <p className="text-xs font-semibold text-primary-600">Response</p>
              <p className="mt-0.5 text-sm text-gray-300">{review.reply.content}</p>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default function ReviewsSection({ reviews = [], meta, title, emptyTitle, emptyHint }) {
  const sectionTitle =
    title ??
    (meta?.totalReviews ? `Client reviews (${meta.totalReviews})` : 'Client reviews');
  return (
    <SectionCard title={sectionTitle}>
      <ReviewSummary meta={meta} />
      {reviews.length > 0 ? (
        <ul className="space-y-5">
          {reviews.map((review) => (
            <ReviewItem key={review._id} review={review} />
          ))}
        </ul>
      ) : (
        <EmptySection
          title={emptyTitle ?? 'No client reviews yet'}
          hint={emptyHint ?? "This freelancer hasn't received any reviews yet."}
        />
      )}
    </SectionCard>
  );
}
