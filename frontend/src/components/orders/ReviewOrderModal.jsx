import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import StarRating from '@/components/ui/StarRating';
import { useCreateReview } from '@/hooks/useReviews';
import { useQueryClient } from '@tanstack/react-query';

const RATING_FIELDS = [
  { key: 'communication', label: 'Communication' },
  { key: 'quality', label: 'Quality' },
  { key: 'expertise', label: 'Expertise' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'deadlineAdherence', label: 'Deadline adherence' },
];

export default function ReviewOrderModal({ open, onClose, order }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState({ overall: 0 });
  const [comment, setComment] = useState('');
  const { mutate: submit, isPending } = useCreateReview();

  const projectId = order?.project?._id;

  const setField = (key, value) => setRating(r => ({ ...r, [key]: value }));

  const onSubmit = () => {
    if (!projectId) return;
    submit({
      projectId,
      data: { rating: { ...rating }, comment: comment.trim() },
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['service-orders', order._id] });
        setRating({ overall: 0 });
        setComment('');
        onClose();
      },
    });
  };

  const canSubmit = rating.overall >= 1 && rating.overall <= 5 && comment.trim().length >= 20;

  return (
    <Modal open={open} onClose={onClose} title="Review this order" size="lg">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Your feedback helps other clients choose the right freelancer and helps {order?.freelancer?.firstName || 'the freelancer'} improve.
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 card p-4">
          <span className="text-sm font-medium text-gray-900 dark:text-white">Overall rating *</span>
          <StarRating value={rating.overall} onChange={(v) => setField('overall', v)} size="lg" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RATING_FIELDS.map(field => (
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
          onChange={e => setComment(e.target.value)}
          hint={`${comment.trim().length}/2000 characters`}
        />
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={onSubmit} disabled={!canSubmit} loading={isPending}>
          Submit Review
        </Button>
      </div>
    </Modal>
  );
}
