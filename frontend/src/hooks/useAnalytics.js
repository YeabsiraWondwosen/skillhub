import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics.service';

export const useFreelancerAnalytics = () =>
  useQuery({ queryKey: ['analytics', 'freelancer'], queryFn: () => analyticsService.getFreelancer().then(r => r.data) });

export const useClientAnalytics = () =>
  useQuery({ queryKey: ['analytics', 'client'], queryFn: () => analyticsService.getClient().then(r => r.data) });

export const usePlatformAnalytics = () =>
  useQuery({ queryKey: ['analytics', 'platform'], queryFn: () => analyticsService.getPlatform().then(r => r.data) });

export const usePublicStats = () =>
  useQuery({
    queryKey: ['public-stats'],
    queryFn: () => analyticsService.getPublic().then((r) => r.data?.data),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
