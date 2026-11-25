import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { codeReviewService } from '@/services/codeReview.service';

export const useSubmitFileReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) => codeReviewService.submitFileReview(formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-code-reviews'] });
      qc.invalidateQueries({ queryKey: ['my-code-review-stats'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to submit code for review'),
  });
};

export const useSubmitPasteReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => codeReviewService.submitPasteReview(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-code-reviews'] });
      qc.invalidateQueries({ queryKey: ['my-code-review-stats'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to submit code for review'),
  });
};

export const useCodeReview = (reviewId) =>
  useQuery({
    queryKey: ['code-review', reviewId],
    queryFn: () => codeReviewService.getReview(reviewId).then(r => r.data),
    enabled: !!reviewId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'analyzing' || data?.status === 'pending') {
        return 3000;
      }
      return false;
    },
  });

export const useMyCodeReviews = (params) =>
  useQuery({
    queryKey: ['my-code-reviews', params],
    queryFn: () => codeReviewService.getMyReviews(params).then(r => r.data),
  });

export const useMyReviewStats = () =>
  useQuery({
    queryKey: ['my-code-review-stats'],
    queryFn: () => codeReviewService.getMyReviewStats().then(r => r.data),
  });

export const useDeleteCodeReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId) => codeReviewService.deleteReview(reviewId),
    onSuccess: () => {
      toast.success('Review deleted');
      qc.invalidateQueries({ queryKey: ['my-code-reviews'] });
      qc.invalidateQueries({ queryKey: ['my-code-review-stats'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete review'),
  });
};

export const usePublicReview = (reviewId) =>
  useQuery({
    queryKey: ['public-code-review', reviewId],
    queryFn: () => codeReviewService.getPublicReview(reviewId).then(r => r.data),
    enabled: !!reviewId,
  });
