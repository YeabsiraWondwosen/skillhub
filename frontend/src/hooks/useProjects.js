import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { projectService } from '@/services/project.service';
import { milestoneService } from '@/services/milestone.service';

export const projectKeys = {
  all: ['projects'],
  list: (params) => ['projects', 'list', params],
  detail: (id) => ['projects', id],
  milestones: (id) => ['projects', id, 'milestones'],
  deliveries: (id) => ['projects', id, 'deliveries'],
  delivery: (id, deliveryId) => ['projects', id, 'deliveries', deliveryId],
};

export const useMyProjects = (params) =>
  useQuery({ queryKey: projectKeys.list(params), queryFn: () => projectService.getMyProjects(params).then(r => r.data) });

export const useProject = (id) =>
  useQuery({ queryKey: projectKeys.detail(id), queryFn: () => projectService.getProject(id).then(r => r.data), enabled: !!id });

export const useProjectMilestones = (projectId) =>
  useQuery({ queryKey: projectKeys.milestones(projectId), queryFn: () => milestoneService.getProjectMilestones(projectId).then(r => r.data), enabled: !!projectId });

export const useProjectDeliveries = (projectId) =>
  useQuery({ queryKey: projectKeys.deliveries(projectId), queryFn: () => projectService.getProjectDeliveries(projectId).then(r => r.data), enabled: !!projectId });

export const useAddTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }) => projectService.addTask(projectId, data),
    onSuccess: (_, { projectId }) => { toast.success('Task added'); qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, taskId, data }) => projectService.updateTask(projectId, taskId, data),
    onSuccess: (_, { projectId }) => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, taskId }) => projectService.deleteTask(projectId, taskId),
    onSuccess: (_, { projectId }) => { toast.success('Task deleted'); qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
};

export const useSubmitDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, formData }) => projectService.submitDelivery(projectId, formData),
    onSuccess: (_, { projectId }) => {
      toast.success('Delivery submitted!');
      qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      qc.invalidateQueries({ queryKey: projectKeys.deliveries(projectId) });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Submission failed'),
  });
};

export const useUpdateDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, deliveryId, formData }) => projectService.updateDelivery(projectId, deliveryId, formData),
    onSuccess: (_, { projectId }) => {
      toast.success('Delivery updated and resubmitted for review');
      qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      qc.invalidateQueries({ queryKey: projectKeys.deliveries(projectId) });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
  });
};

export const useReviewDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, deliveryId, data }) => projectService.reviewDelivery(projectId, deliveryId, data),
    onSuccess: (_, { projectId }) => {
      toast.success('Delivery reviewed');
      qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      qc.invalidateQueries({ queryKey: projectKeys.deliveries(projectId) });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
};

export const useCreateMilestone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }) => milestoneService.create(projectId, data),
    onSuccess: (_, { projectId }) => { toast.success('Milestone created'); qc.invalidateQueries({ queryKey: projectKeys.milestones(projectId) }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
};

export const useFundMilestone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: milestoneService.fund,
    onSuccess: () => {
      toast.success('Milestone funded!');
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Funding failed'),
  });
};

export const useApproveMilestone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: milestoneService.approve,
    onSuccess: () => {
      toast.success('Milestone approved & payment released!');
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['earnings'] });
      qc.invalidateQueries({ queryKey: ['earnings-chart'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Approval failed'),
  });
};
