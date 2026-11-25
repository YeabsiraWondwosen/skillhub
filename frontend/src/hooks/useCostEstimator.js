import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { costEstimatorService } from '@/services/costEstimator.service';

export const costEstimatorKeys = {
  all: ['costEstimator'],
  lists: () => [...costEstimatorKeys.all, 'list'],
  list: (params) => [...costEstimatorKeys.lists(), params],
  details: () => [...costEstimatorKeys.all, 'detail'],
  detail: (id) => [...costEstimatorKeys.details(), id],
};

export const useCreateEstimate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => costEstimatorService.createEstimate(data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costEstimatorKeys.lists() });
    },
  });
};

export const useMyEstimates = (params = {}) =>
  useQuery({
    queryKey: costEstimatorKeys.list(params),
    queryFn: () => costEstimatorService.getMyEstimates(params).then(r => r.data),
  });

export const useEstimateById = (estimateId) =>
  useQuery({
    queryKey: costEstimatorKeys.detail(estimateId),
    queryFn: () => costEstimatorService.getEstimateById(estimateId).then(r => r.data),
    enabled: !!estimateId,
  });

export const useDeleteEstimate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (estimateId) => costEstimatorService.deleteEstimate(estimateId).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costEstimatorKeys.lists() });
    },
  });
};
