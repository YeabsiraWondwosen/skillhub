import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { badgeService } from '@services/badge.service';

export const useBadgeTypes = () => {
  return useQuery({
    queryKey: ['badge-types'],
    queryFn: () => badgeService.getBadgeTypes(),
    staleTime: 1000 * 60 * 60,
  });
};

export const useMyBadges = () => {
  return useQuery({
    queryKey: ['my-badges'],
    queryFn: () => badgeService.getMyBadges(),
  });
};

export const useUserBadges = (userId) => {
  return useQuery({
    queryKey: ['user-badges', userId],
    queryFn: () => badgeService.getUserBadges(userId),
    enabled: !!userId,
  });
};

export const useRefreshBadges = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => badgeService.refreshMyBadges(),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-badges']);
    },
  });
};

export const useLeaderboard = (params) => {
  return useQuery({
    queryKey: ['leaderboard', params],
    queryFn: () => badgeService.getLeaderboard(params),
    staleTime: 1000 * 60 * 5,
  });
};
