import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { developerVerificationService } from '@services/developerVerification.service';

export const useMyVerifications = () => {
  return useQuery({
    queryKey: ['developer-verifications', 'my'],
    queryFn: () => developerVerificationService.getMyVerifications(),
  });
};

export const useMyVerificationScore = () => {
  return useQuery({
    queryKey: ['developer-verifications', 'my-score'],
    queryFn: () => developerVerificationService.getMyScore(),
  });
};

export const useVerificationScore = (userId) => {
  return useQuery({
    queryKey: ['developer-verifications', 'score', userId],
    queryFn: () => developerVerificationService.getScoreByUser(userId),
    enabled: !!userId,
  });
};

export const useVerification = (id) => {
  return useQuery({
    queryKey: ['developer-verification', id],
    queryFn: () => developerVerificationService.getVerification(id),
    enabled: !!id,
  });
};

export const useSubmitIdentity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => developerVerificationService.submitIdentity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer-verifications'] });
    },
  });
};

export const useUploadIdentityDocuments = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ formData, onProgress }) =>
      developerVerificationService.uploadIdentityDocuments(formData, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer-verifications'] });
    },
  });
};

export const useSubmitGithub = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => developerVerificationService.submitGithub(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['developer-verifications', 'my-score'] });
    },
  });
};

export const useSubmitPortfolio = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ formData, onProgress }) =>
      developerVerificationService.submitPortfolio(formData, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer-verifications'] });
    },
  });
};

export const useResubmitVerification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => developerVerificationService.resubmitVerification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer-verifications'] });
    },
  });
};

// Admin hooks
export const useAdminVerifications = (params) => {
  return useQuery({
    queryKey: ['developer-verifications', 'admin', params],
    queryFn: () => developerVerificationService.adminGetAll(params),
  });
};

export const useAdminPendingVerifications = (params) => {
  return useQuery({
    queryKey: ['developer-verifications', 'admin-pending', params],
    queryFn: () => developerVerificationService.adminGetPending(params),
  });
};

export const useAdminVerificationStats = () => {
  return useQuery({
    queryKey: ['developer-verifications', 'admin-stats'],
    queryFn: () => developerVerificationService.adminGetStats(),
  });
};

export const useAdminReviewVerification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => developerVerificationService.adminReview(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer-verifications'] });
    },
  });
};
