import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectPlannerService } from '@/services/projectPlanner.service';

export const projectPlannerKeys = {
  all: ['projectPlanner'],
  lists: () => [...projectPlannerKeys.all, 'list'],
  list: (params) => [...projectPlannerKeys.lists(), params],
  details: () => [...projectPlannerKeys.all, 'detail'],
  detail: (id) => [...projectPlannerKeys.details(), id],
  projects: () => [...projectPlannerKeys.all, 'projects'],
};

export const useCreatePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => projectPlannerService.createPlan(data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectPlannerKeys.lists() });
    },
  });
};

export const useMyPlans = (params = {}) =>
  useQuery({
    queryKey: projectPlannerKeys.list(params),
    queryFn: () => projectPlannerService.getMyPlans(params).then(r => r.data),
  });

export const usePlanById = (planId) =>
  useQuery({
    queryKey: projectPlannerKeys.detail(planId),
    queryFn: () => projectPlannerService.getPlanById(planId).then(r => r.data),
    enabled: !!planId,
  });

export const useDeletePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId) => projectPlannerService.deletePlan(planId).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectPlannerKeys.lists() });
    },
  });
};

export const useConvertToProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, projectId }) => projectPlannerService.convertToProject(planId, { projectId }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectPlannerKeys.lists() });
    },
  });
};

export const useUserProjects = () =>
  useQuery({
    queryKey: projectPlannerKeys.projects(),
    queryFn: () => projectPlannerService.getUserProjects().then(r => r.data),
  });
