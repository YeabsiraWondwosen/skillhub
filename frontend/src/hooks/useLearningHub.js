import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { learningHubService } from '@/services/learningHub.service';

export const useDashboardStats = () =>
  useQuery({
    queryKey: ['learning-hub', 'dashboard'],
    queryFn: () => learningHubService.getDashboard().then(r => r.data),
  });

export const useSkillGapAnalysis = (params) =>
  useQuery({
    queryKey: ['learning-hub', 'analysis', params],
    queryFn: () => learningHubService.getAnalysis(params).then(r => r.data),
  });

export const useCourseRecommendations = (params) =>
  useQuery({
    queryKey: ['learning-hub', 'courses', params],
    queryFn: () => learningHubService.getCourses(params).then(r => r.data),
  });

export const useCertificationRecommendations = (params) =>
  useQuery({
    queryKey: ['learning-hub', 'certifications', params],
    queryFn: () => learningHubService.getCertifications(params).then(r => r.data),
  });

export const useLearningResources = (params) =>
  useQuery({
    queryKey: ['learning-hub', 'resources', params],
    queryFn: () => learningHubService.getResources(params).then(r => r.data),
  });

export const useLearningPlans = (params) =>
  useQuery({
    queryKey: ['learning-hub', 'plans', params],
    queryFn: () => learningHubService.getPlans(params).then(r => r.data),
  });

export const useLearningPlan = (planId) =>
  useQuery({
    queryKey: ['learning-hub', 'plans', planId],
    queryFn: () => learningHubService.getPlan(planId).then(r => r.data),
    enabled: !!planId,
  });

export const useCreateLearningPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: learningHubService.createPlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning-hub', 'plans'] });
      qc.invalidateQueries({ queryKey: ['learning-hub', 'dashboard'] });
    },
  });
};

export const useUpdatePlanStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, status }) => learningHubService.updatePlanStatus(planId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learning-hub'] }),
  });
};

export const useUpdateCourseProgress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, courseId, data }) => learningHubService.updateCourseProgress(planId, courseId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learning-hub'] }),
  });
};

export const useUpdateCertProgress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, certId, data }) => learningHubService.updateCertProgress(planId, certId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learning-hub'] }),
  });
};

export const useUpdateResourceProgress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, resourceId, data }) => learningHubService.updateResourceProgress(planId, resourceId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learning-hub'] }),
  });
};

export const useToggleBookmark = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, resourceId }) => learningHubService.toggleBookmark(planId, resourceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learning-hub'] }),
  });
};

export const useDeleteLearningPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: learningHubService.deletePlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning-hub', 'plans'] });
      qc.invalidateQueries({ queryKey: ['learning-hub', 'dashboard'] });
    },
  });
};
