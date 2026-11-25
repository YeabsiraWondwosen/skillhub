import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recruiterService } from '@/services/recruiter.service';
import toast from 'react-hot-toast';

export const recruiterKeys = {
  all: ['recruiter'],
  freelancers: (params) => ['recruiter', 'freelancers', params],
  freelancer: (id) => ['recruiter', 'freelancer', id],
  pipelines: (params) => ['recruiter', 'pipelines', params],
  pipeline: (id) => ['recruiter', 'pipeline', id],
  analytics: () => ['recruiter', 'analytics'],
  invitations: (pipelineId) => ['recruiter', 'invitations', pipelineId],
};

// ─── Freelancer Search ───────────────────────────────────────────────────────
export const useFreelancerSearch = (params) =>
  useQuery({
    queryKey: recruiterKeys.freelancers(params),
    queryFn: () => recruiterService.searchFreelancers(params).then(r => r.data),
    keepPreviousData: true,
  });

export const useFreelancerDetail = (id) =>
  useQuery({
    queryKey: recruiterKeys.freelancer(id),
    queryFn: () => recruiterService.getFreelancer(id).then(r => r.data),
    enabled: !!id,
  });

export const useCompareCandidates = () =>
  useMutation({
    mutationFn: (ids) => recruiterService.compareCandidates(ids).then(r => r.data),
  });

// ─── Pipelines ───────────────────────────────────────────────────────────────
export const usePipelines = (params) =>
  useQuery({
    queryKey: recruiterKeys.pipelines(params),
    queryFn: () => recruiterService.getPipelines(params).then(r => r.data),
  });

export const usePipeline = (id) =>
  useQuery({
    queryKey: recruiterKeys.pipeline(id),
    queryFn: () => recruiterService.getPipeline(id).then(r => r.data),
    enabled: !!id,
  });

export const useCreatePipeline = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: recruiterService.createPipeline,
    onSuccess: () => {
      toast.success('Pipeline created');
      qc.invalidateQueries({ queryKey: recruiterKeys.all });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create pipeline'),
  });
};

export const useUpdatePipeline = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => recruiterService.updatePipeline(id, data),
    onSuccess: () => {
      toast.success('Pipeline updated');
      qc.invalidateQueries({ queryKey: recruiterKeys.all });
    },
  });
};

export const useDeletePipeline = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: recruiterService.deletePipeline,
    onSuccess: () => {
      toast.success('Pipeline deleted');
      qc.invalidateQueries({ queryKey: recruiterKeys.all });
    },
  });
};

// ─── Candidates ──────────────────────────────────────────────────────────────
export const useAddCandidate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pipelineId, data }) => recruiterService.addCandidate(pipelineId, data),
    onSuccess: () => {
      toast.success('Candidate added');
      qc.invalidateQueries({ queryKey: recruiterKeys.all });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
};

export const useMoveCandidate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pipelineId, candidateId, stage, reason }) =>
      recruiterService.moveCandidate(pipelineId, candidateId, stage, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recruiterKeys.all });
    },
  });
};

export const useRateCandidate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pipelineId, candidateId, rating }) =>
      recruiterService.rateCandidate(pipelineId, candidateId, rating),
    onSuccess: () => qc.invalidateQueries({ queryKey: recruiterKeys.all }),
  });
};

export const useAddCandidateNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pipelineId, candidateId, content }) =>
      recruiterService.addCandidateNote(pipelineId, candidateId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: recruiterKeys.all }),
  });
};

export const useRemoveCandidate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pipelineId, candidateId }) => recruiterService.removeCandidate(pipelineId, candidateId),
    onSuccess: () => {
      toast.success('Candidate removed');
      qc.invalidateQueries({ queryKey: recruiterKeys.all });
    },
  });
};

// ─── Invitations ─────────────────────────────────────────────────────────────
export const useSendInvitation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pipelineId, data }) => recruiterService.sendInvitation(pipelineId, data),
    onSuccess: () => {
      toast.success('Invitation sent');
      qc.invalidateQueries({ queryKey: recruiterKeys.all });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
};

export const useInvitations = (pipelineId) =>
  useQuery({
    queryKey: recruiterKeys.invitations(pipelineId),
    queryFn: () => recruiterService.getInvitations(pipelineId).then(r => r.data),
    enabled: !!pipelineId,
  });

export const useCancelInvitation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pipelineId, invitationId }) => recruiterService.cancelInvitation(pipelineId, invitationId),
    onSuccess: () => {
      toast.success('Invitation cancelled');
      qc.invalidateQueries({ queryKey: recruiterKeys.all });
    },
  });
};

// ─── Analytics ───────────────────────────────────────────────────────────────
export const useRecruiterAnalytics = () =>
  useQuery({
    queryKey: recruiterKeys.analytics(),
    queryFn: () => recruiterService.getAnalytics().then(r => r.data),
  });
