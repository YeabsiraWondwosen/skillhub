import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portfolioSiteService } from '@services/portfolioSite.service';

export const usePortfolioTemplates = () => {
  return useQuery({
    queryKey: ['portfolio-templates'],
    queryFn: () => portfolioSiteService.getTemplates(),
    staleTime: 1000 * 60 * 60,
  });
};

export const useMyPortfolioSites = (params) => {
  return useQuery({
    queryKey: ['my-portfolio-sites', params],
    queryFn: () => portfolioSiteService.getMySites(params),
  });
};

export const usePortfolioSite = (slug) => {
  return useQuery({
    queryKey: ['portfolio-site', slug],
    queryFn: () => portfolioSiteService.getSite(slug),
    enabled: !!slug,
  });
};

export const usePortfolioSiteHtml = (slug) => {
  return useQuery({
    queryKey: ['portfolio-site-html', slug],
    queryFn: () => portfolioSiteService.getSiteHtml(slug),
    enabled: !!slug,
  });
};

export const useGeneratePortfolio = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: portfolioSiteService.generatePortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries(['my-portfolio-sites']);
    },
  });
};

export const useUpdatePortfolioSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, data }) => portfolioSiteService.updateSite(slug, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-portfolio-sites']);
    },
  });
};

export const useDeletePortfolioSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: portfolioSiteService.deleteSite,
    onSuccess: () => {
      queryClient.invalidateQueries(['my-portfolio-sites']);
    },
  });
};

export const useSetDefaultPortfolio = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: portfolioSiteService.setDefault,
    onSuccess: () => {
      queryClient.invalidateQueries(['my-portfolio-sites']);
    },
  });
};

export const usePortfolioStats = () => {
  return useQuery({
    queryKey: ['portfolio-stats'],
    queryFn: () => portfolioSiteService.getStats(),
  });
};
