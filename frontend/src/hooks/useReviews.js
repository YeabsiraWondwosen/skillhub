import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { catalogService } from '@/services/catalog.service';
import { reviewService } from '@/services/review.service';

export const serviceReviewsKeys = {
  list: (catalogId, params) => ['service-reviews', catalogId, params],
};

export const useServiceReviews = (catalogId, params) =>
  useQuery({
    queryKey: serviceReviewsKeys.list(catalogId, params),
    queryFn: () => catalogService.getCatalogReviews(catalogId, params).then((r) => r.data),
    enabled: !!catalogId,
  });

const invalidateReviewData = (qc, projectId) => {
  // All review consumers share these query-key prefixes, so a single mutation
  // refreshes the freelancer reviews page, public profiles and the client page.
  qc.invalidateQueries({ queryKey: ['my-reviews'] });
  qc.invalidateQueries({ queryKey: ['reviews'] });
  qc.invalidateQueries({ queryKey: ['service-reviews'] });
  if (projectId) qc.invalidateQueries({ queryKey: ['projects', projectId] });
};

export const useCreateReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }) => reviewService.create(projectId, data),
    onSuccess: (res, { projectId }) => {
      toast.success('Review submitted. Thank you for your feedback!');
      invalidateReviewData(qc, projectId);
      return res;
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Review failed'),
  });
};

export const useUpdateReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, data }) => reviewService.update(reviewId, data),
    onSuccess: () => {
      toast.success('Review updated');
      invalidateReviewData(qc);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update review'),
  });
};

export const useDeleteReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId) => reviewService.remove(reviewId),
    onSuccess: () => {
      toast.success('Review deleted');
      invalidateReviewData(qc);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to delete review'),
  });
};
