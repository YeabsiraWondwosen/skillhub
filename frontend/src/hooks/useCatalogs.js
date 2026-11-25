import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { catalogService } from '@services/catalog.service';
import { userService } from '@services/user.service';

export const useCatalogs = (params) => {
  return useQuery({
    queryKey: ['catalogs', params],
    queryFn: () => catalogService.getCatalogs(params),
    staleTime: 1000 * 60 * 5,
  });
};

export const useCatalog = (slug) => {
  return useQuery({
    queryKey: ['catalog', slug],
    queryFn: () => catalogService.getCatalog(slug),
    enabled: !!slug,
  });
};

export const useMyCatalogs = (params) => {
  return useQuery({
    queryKey: ['my-catalogs', params],
    queryFn: () => catalogService.getMyCatalogs(params),
  });
};

export const useCreateCatalog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: catalogService.createCatalog,
    onSuccess: () => {
      queryClient.invalidateQueries(['my-catalogs']);
      queryClient.invalidateQueries(['catalogs']);
    },
  });
};

export const useUpdateCatalog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ catalogId, data }) => catalogService.updateCatalog(catalogId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-catalogs']);
      queryClient.invalidateQueries(['catalogs']);
    },
  });
};

export const useDeleteCatalog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: catalogService.deleteCatalog,
    onSuccess: () => {
      toast.success('Service deleted');
      queryClient.invalidateQueries(['my-catalogs']);
      queryClient.invalidateQueries(['catalogs']);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to delete service'),
  });
};

export const useToggleCatalogStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: catalogService.toggleStatus,
    onSuccess: () => {
      queryClient.invalidateQueries(['my-catalogs']);
    },
  });
};

export const useFreelancerCatalogs = (userId, params) => {
  return useQuery({
    queryKey: ['freelancer-catalogs', userId, params],
    queryFn: () => catalogService.getFreelancerCatalogs(userId, params),
    enabled: !!userId,
  });
};

export const useSimilarCatalogs = (catalogId, params) => {
  return useQuery({
    queryKey: ['similar-catalogs', catalogId, params],
    queryFn: () => catalogService.getSimilarCatalogs(catalogId, params).then((r) => r.data),
    enabled: !!catalogId,
  });
};

export const useRecommendedFreelancers = (params, options = {}) => {
  return useQuery({
    queryKey: ['recommended-freelancers', params],
    queryFn: () => catalogService.getRecommendedFreelancers(params).then((r) => r.data?.data ?? r.data),
    staleTime: 1000 * 60 * 5,
    ...options,
  });
};

export const useRecentCatalogs = (limit = 5, options = {}) => {
  return useQuery({
    queryKey: ['recent-catalogs', limit],
    queryFn: () => catalogService.getRecentCatalogs({ limit }).then((r) => r.data?.data ?? r.data),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
};

export const useCatalogAnalytics = (catalogId, options = {}) => {
  return useQuery({
    queryKey: ['catalog-analytics', catalogId],
    queryFn: () => catalogService.getCatalogAnalytics(catalogId).then((r) => r.data?.data ?? r.data),
    enabled: !!catalogId && options.enabled !== false,
  });
};

export const useSavedCatalogs = (options = {}) => {
  return useQuery({
    queryKey: ['saved-catalogs'],
    queryFn: () => userService.getSavedCatalogs().then((r) => r.data),
    ...options,
  });
};

export const useToggleSaveCatalog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (catalogId) => userService.toggleSaveCatalog(catalogId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-catalogs'] });
    },
  });
};

export const useDuplicateCatalog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (catalogId) => catalogService.duplicateCatalog(catalogId),
    onSuccess: (res) => {
      toast.success('Service duplicated. Review the copy before publishing.');
      qc.invalidateQueries({ queryKey: ['my-catalogs'] });
      return res;
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Duplicate failed'),
  });
};
