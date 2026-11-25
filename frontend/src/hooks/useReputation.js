import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reputationService } from '@services/reputation.service';

export const useMyReputation = () => {
  return useQuery({
    queryKey: ['my-reputation'],
    queryFn: () => reputationService.getMyReputation(),
  });
};

export const useUserReputation = (userId) => {
  return useQuery({
    queryKey: ['user-reputation', userId],
    queryFn: () => reputationService.getUserReputation(userId),
    enabled: !!userId,
  });
};

export const useRecalculateReputation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reputationService.recalculateMyReputation(),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-reputation']);
    },
  });
};

export const useReputationLeaderboard = (params) => {
  return useQuery({
    queryKey: ['reputation-leaderboard', params],
    queryFn: () => reputationService.getLeaderboard(params),
    staleTime: 1000 * 60 * 5,
  });
};

export const useReputationConfig = () => {
  return useQuery({
    queryKey: ['reputation-config'],
    queryFn: () => reputationService.getReputationConfig(),
    staleTime: 1000 * 60 * 60,
  });
};
