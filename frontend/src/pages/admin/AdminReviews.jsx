import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminService } from '@/services/admin.service';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import StarRating from '@/components/ui/StarRating';
import Pagination from '@/components/ui/Pagination';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EyeSlashIcon, FlagIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight } from 'lucide-react';

export default function AdminReviews() {
  const [page, setPage] = useState(1);
  const [isFlagged, setIsFlagged] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reviews', { page, isFlagged }],
    queryFn: () => adminService.getReviews({ page, limit: 15, isFlagged: isFlagged ? 'true' : undefined }).then(r => r.data),
  });
  const reviews = data?.data ?? [];
  const meta = data?.meta;

  const { mutate: moderate } = useMutation({
    mutationFn: ({ id, data }) => adminService.moderateReview(id, data),
    onSuccess: (res, { data }) => {
      toast.success('Review moderated');
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      if (data.isPublic !== undefined || res?.data?.isPublic !== undefined) {
        qc.invalidateQueries({ queryKey: ['reviews'] });
        qc.invalidateQueries({ queryKey: ['my-reviews'] });
        qc.invalidateQueries({ queryKey: ['service-reviews'] });
      }
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  });

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="section-title">Manage Reviews</h1>
        <button onClick={() => setIsFlagged(f => !f)}
          className={`btn-sm ${isFlagged ? 'btn-danger' : 'btn-secondary'} flex items-center gap-1.5`}>
          <FlagIcon className="w-4 h-4" />
          {isFlagged ? 'Showing Flagged' : 'Show Flagged Only'}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : reviews.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12">No reviews found</p>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r._id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar src={r.reviewer?.avatar?.url} alt={r.reviewer?.firstName} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {r.reviewer?.firstName} {r.reviewer?.lastName}
                        <ArrowRight size={12} className="text-gray-400 mx-1 inline-flex flex-shrink-0" />
                        {r.reviewee?.firstName} {r.reviewee?.lastName}
                      </p>
                      <div className="flex items-center gap-2">
                        <StarRating value={r.rating?.overall} readonly size="sm" />
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{r.comment}</p>
                  {r.isFlagged && r.flagReason && (
                    <p className="text-xs text-red-500 mt-1">Flag: {r.flagReason}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => moderate({ id: r._id, data: { isPublic: !r.isPublic } })}
                    className="btn-icon btn-ghost" title={r.isPublic ? 'Hide' : 'Show'}>
                    <EyeSlashIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => moderate({ id: r._id, data: { isFlagged: !r.isFlagged } })}
                    className={`btn-icon btn-ghost ${r.isFlagged ? 'text-red-500' : 'text-gray-400'}`} title="Flag">
                    <FlagIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge status={r.isPublic ? 'active' : 'cancelled'}>{r.isPublic ? 'Public' : 'Hidden'}</Badge>
                {r.isFlagged && <Badge status="rejected">Flagged</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination meta={meta} onPageChange={setPage} />
    </div>
  );
}
