import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { githubService } from '@/services/github.service';
import { useAuthStore } from '@/store/authStore';

export const useMyGitHubData = () =>
  useQuery({
    queryKey: ['github-me'],
    queryFn: () => githubService.getMyData().then(r => r.data),
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

export const useGitHubData = (userId) =>
  useQuery({
    queryKey: ['github', userId],
    queryFn: () => githubService.getUserData(userId).then(r => r.data),
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

export const useGitHubRepos = (userId, params) =>
  useQuery({
    queryKey: ['github-repos', userId, params],
    queryFn: () => githubService.getUserRepos(userId, params).then(r => r.data),
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
  });

export const useGitHubLanguages = (userId) =>
  useQuery({
    queryKey: ['github-languages', userId],
    queryFn: () => githubService.getUserLanguages(userId).then(r => r.data),
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
  });

export const useGitHubContributions = (userId) =>
  useQuery({
    queryKey: ['github-contributions', userId],
    queryFn: () => githubService.getUserContributions(userId).then(r => r.data),
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
  });

export const useGitHubCommitActivity = (userId) =>
  useQuery({
    queryKey: ['github-commits', userId],
    queryFn: () => githubService.getUserCommitActivity(userId).then(r => r.data),
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
  });

export const useLinkGitHub = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: githubService.link,
    onSuccess: (res) => {
      const socialLinks = res?.data?.data?.socialLinks;
      if (socialLinks) useAuthStore.getState().updateUser({ socialLinks });
      toast.success('GitHub account linked!');
      qc.invalidateQueries({ queryKey: ['github-me'] });
      qc.invalidateQueries({ queryKey: ['my-profile'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to link GitHub'),
  });
};

export const useUnlinkGitHub = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: githubService.unlink,
    onSuccess: () => {
      const current = useAuthStore.getState().user?.socialLinks || {};
      useAuthStore.getState().updateUser({ socialLinks: { ...current, github: '' } });
      toast.success('GitHub account unlinked');
      qc.invalidateQueries({ queryKey: ['github-me'] });
      qc.invalidateQueries({ queryKey: ['my-profile'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to unlink GitHub'),
  });
};

export const useRefreshGitHub = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: githubService.refresh,
    onSuccess: () => {
      toast.success('GitHub data refreshed');
      qc.invalidateQueries({ queryKey: ['github-me'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to refresh'),
  });
};
