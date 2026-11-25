import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { StarIcon } from '@heroicons/react/24/outline';
import { useMyProjects } from '@/hooks/useProjects';
import { useCreateReview, useUpdateReview, useDeleteReview } from '@/hooks/useReviews';
import { reviewService } from '@/services/review.service';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import StarRating from '@/components/ui/StarRating';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { clsx } from 'clsx';
import { formatCurrency } from '@/utils/currency';

const RATING_FIELDS = [
  { key: 'communication', label: 'Communication' },
  { key: 'quality', label: 'Quality' },
  { key: 'expertise', label: 'Expertise' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'deadlineAdherence', label: 'Deadline adherence' },
];

export default function ClientReviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading } = useMyProjects({ status: 'completed', page, limit: 10 });
  const { data: myReviewsData } = useQuery({
    queryKey: ['reviews', 'my-written'],
    queryFn: () => reviewService.getMyWritten().then((r) => r.data?.data),
  });
  const { mutate: deleteReview, isPending: isDeleting } = useDeleteReview();

  const [reviewing, setReviewing] = useState(null);

  const projects = data?.data ?? [];
  const meta = data?.meta;
  const reviewedIds = useMemo(
    () => new Set((myReviewsData ?? []).map((r) => String(r.project?._id || r.project)).filter(Boolean)),
    [myReviewsData]
  );

  const pendingOnly = status === 'pending';
  const visible = pendingOnly ? projects.filter((p) => !reviewedIds.has(p._id)) : projects;

  const tabs = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
  ];

  return (
    <div className="page-container space-y-6">
      <div>
        <h1 className="section-title">Reviews</h1>
        <p className="section-sub">Leave feedback for completed projects</p>
      </div>

      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => { setSearchParams(t.value ? { status: t.value } : {}, { replace: true }); setPage(1); }}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              status === t.value ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={StarIcon}
          title={pendingOnly ? 'Nothing left to review' : 'No completed projects yet'}
          description={pendingOnly ? 'You have reviewed every completed project.' : 'Completed projects will appear here for review.'}
          action={<Link to="/client/contracts" className="btn-primary btn-sm">View Contracts</Link>}
        />
      ) : (
        <div className="space-y-4">
          {visible.map((p, i) => {
            const reviewed = reviewedIds.has(p._id);
            return (
              <motion.div key={p._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar src={p.freelancer?.avatar?.url} alt={`${p.freelancer?.firstName} ${p.freelancer?.lastName}`} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/projects/${p._id}`} className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 truncate">{p.title}</Link>
                        <Badge status={p.status} />
                        {reviewed && <Badge status="approved">Reviewed</Badge>}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {p.freelancer?.firstName} {p.freelancer?.lastName}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        <span>{formatCurrency(p.budget?.agreedAmount, p.budget?.currency)}</span>
                        <span>·</span>
                        <span>Completed {p.timeline?.completedAt ? format(new Date(p.timeline.completedAt), 'MMM d, yyyy') : format(new Date(p.updatedAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  {reviewed ? (
                    <Link to={`/projects/${p._id}`} className="btn-secondary btn-sm flex-shrink-0">View Project</Link>
                  ) : (
                    <Button variant="primary" className="btn-sm" onClick={() => setReviewing(p)}>
                      <StarIcon className="w-4 h-4" /> Write Review
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Pagination meta={meta} onPageChange={setPage} />

      {/* My written reviews — edit/delete only the author's own reviews */}
      {!pendingOnly && (myReviewsData ?? []).length > 0 && (
        <section className="space-y-4">
          <h2 className="section-title text-lg">Reviews you&apos;ve written</h2>
          <div className="space-y-4">
            {(myReviewsData ?? []).map((r) => (
              <div key={r._id} className="card p-5">
                <div className="flex items-start gap-4">
                  <Avatar src={r.reviewee?.avatar?.url} alt={`${r.reviewee?.firstName} ${r.reviewee?.lastName}`} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{r.reviewee?.firstName} {r.reviewee?.lastName}</p>
                      {r.project?.title && (
                        <Link to={`/projects/${r.project._id}`} className="text-xs text-primary-600 hover:underline truncate">{r.project.title}</Link>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <StarRating value={r.rating?.overall} readonly size="sm" />
                      <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{r.comment}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                      <span>Communication: {r.rating?.communication ?? '—'}/5</span>
                      <span>Quality: {r.rating?.quality ?? '—'}/5</span>
                      <span>Expertise: {r.rating?.expertise ?? '—'}/5</span>
                      <span>Professionalism: {r.rating?.professionalism ?? '—'}/5</span>
                      <span>Deadline: {r.rating?.deadlineAdherence ?? '—'}/5</span>
                    </div>
                    {r.reply?.content && (
                      <div className="mt-3 rounded-lg border-l-2 border-primary-100 bg-primary-50 dark:bg-primary-900/20 p-3">
                        <p className="text-xs font-semibold text-primary-600">Reply from {r.reviewee?.firstName}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{r.reply.content}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>Edit</Button>
                    <Button size="sm" variant="secondary" className="text-red-600 hover:text-red-700" onClick={() => setDeleting(r)}>Delete</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {reviewing && (
        <ReviewProjectModal mode="create" project={reviewing} onClose={() => setReviewing(null)} />
      )}

      {editing && (
        <ReviewProjectModal
          mode="edit"
          reviewId={editing._id}
          review={editing}
          initialRating={editing.rating}
          initialComment={editing.comment}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { deleteReview(deleting._id, { onSuccess: () => setDeleting(null) }); }}
        title="Delete review"
        message="This will permanently remove your review and update the recipient's average rating. This action cannot be undone."
        confirmLabel="Delete review"
        danger
        loading={isDeleting}
      />
    </div>
  );
}

function ReviewProjectModal({ mode = 'create', reviewId, project, review, initialRating, initialComment, onClose }) {
  const [rating, setRating] = useState({ ...(initialRating || { overall: 0 }) });
  const [comment, setComment] = useState(initialComment || '');
  const { mutate: submitCreate, isPending: isPendingCreate } = useCreateReview();
  const { mutate: submitUpdate, isPending: isPendingUpdate } = useUpdateReview();

  const isEdit = mode === 'edit';
  const mutate = isEdit ? submitUpdate : submitCreate;
  const isPending = isEdit ? isPendingUpdate : isPendingCreate;

  const setField = (key, value) => setRating((r) => ({ ...r, [key]: value }));

  const onSubmit = () => {
    const data = { rating: { ...rating }, comment: comment.trim() };
    const onSuccess = () => {
      setRating({ overall: 0 });
      setComment('');
      onClose();
    };
    if (isEdit) mutate({ reviewId, data }, { onSuccess });
    else mutate({ projectId: project._id, data }, { onSuccess });
  };

  const canSubmit = rating.overall >= 1 && rating.overall <= 5 && comment.trim().length >= 20;
  const freelancer = isEdit ? review?.reviewee : project?.freelancer;

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit your review' : 'Review this project'} size="lg">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        {isEdit
          ? 'Update your feedback. The recipient\'s average rating is recalculated automatically.'
          : `Your feedback helps ${project.freelancer?.firstName || 'the freelancer'} improve and guides other clients.`}
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 card p-4">
          <span className="text-sm font-medium text-gray-900 dark:text-white">Overall rating *</span>
          <StarRating value={rating.overall} onChange={(v) => setField('overall', v)} size="lg" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RATING_FIELDS.map((field) => (
            <div key={field.key} className="card p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{field.label}</p>
              <StarRating value={rating[field.key] || 0} onChange={(v) => setField(field.key, v)} size="sm" />
            </div>
          ))}
        </div>

        <Textarea
          label="Written review *"
          placeholder="Share your experience — what went well, and what could have been better? (at least 20 characters)"
          rows={5}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          hint={`${comment.trim().length}/2000 characters`}
        />
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={onSubmit} disabled={!canSubmit} loading={isPending}>
          {isEdit ? 'Save Changes' : 'Submit Review'}
        </Button>
      </div>
    </Modal>
  );
}