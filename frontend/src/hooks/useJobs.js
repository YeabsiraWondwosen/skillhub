import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { jobService } from '@/services/job.service';
import { getSocket } from '@/services/socket';
import { useAuthStore } from '@/store/authStore';

const REAL_TIME_REFRESH_MS = 4000;

export const jobKeys = {
  all: ['jobs'],
  list: (params) => ['jobs', 'list', params],
  detail: (id) => ['jobs', id],
  myJobs: (params) => ['jobs', 'my', params],
  recommended: () => ['jobs', 'recommended'],
};

const useRealtimeJobSync = () => {
  const qc = useQueryClient();
  const authReady = useAuthStore((s) => s.isInitialized || !!s.accessToken);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['earnings'] });
    };

    socket.on('job:update', invalidate);
    socket.on('project:update', invalidate);
    socket.on('contract:payment-released', invalidate);

    return () => {
      socket.off('job:update', invalidate);
      socket.off('project:update', invalidate);
      socket.off('contract:payment-released', invalidate);
    };
  }, [qc, authReady]);
};

export const useJobs = (params) => {
  useRealtimeJobSync();
  return useQuery({
    queryKey: jobKeys.list(params),
    queryFn: () => jobService.getJobs(params).then(r => r.data),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: REAL_TIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
};

export const useJob = (id) => {
  useRealtimeJobSync();
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: () => jobService.getJob(id).then(r => r.data),
    enabled: !!id,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: REAL_TIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
};

export const useMyJobs = (params) => {
  useRealtimeJobSync();
  return useQuery({
    queryKey: jobKeys.myJobs(params),
    queryFn: () => jobService.getMyJobs(params).then(r => r.data),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: REAL_TIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
};

// AI recommendations are recomputed server-side and each recompute costs an AI
// call (Gemini free tier: ~20/day platform-wide). Polling every 4s exhausted the
// quota in seconds, so this one is not polled — job:update socket events and
// mount-time refetch keep it fresh.
const RECOMMENDATIONS_STALE_MS = 10 * 60 * 1000;

export const useRecommendedJobs = () => {
  useRealtimeJobSync();
  return useQuery({
    queryKey: jobKeys.recommended(),
    queryFn: () => jobService.getRecommendedJobs().then(r => r.data),
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: RECOMMENDATIONS_STALE_MS,
  });
};

export const useCreateJob = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobService.createJob,
    onSuccess: () => { toast.success('Job posted!'); qc.invalidateQueries({ queryKey: jobKeys.all }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to post job'),
  });
};

export const useUpdateJob = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => jobService.updateJob(id, data),
    onSuccess: (_, { id }) => {
      toast.success('Job updated!');
      qc.invalidateQueries({ queryKey: jobKeys.all });
      qc.invalidateQueries({ queryKey: jobKeys.detail(id) });
      qc.invalidateQueries({ queryKey: jobKeys.myJobs });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
  });
};

export const useDeleteJob = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobService.deleteJob,
    onSuccess: () => { toast.success('Job deleted'); qc.invalidateQueries({ queryKey: jobKeys.all }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });
};

export const useUpdateJobStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => jobService.updateJobStatus(id, status),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: jobKeys.all }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
};

export const usePauseJob = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobService.pauseJob,
    onSuccess: () => { toast.success('Job paused'); qc.invalidateQueries({ queryKey: jobKeys.all }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to pause job'),
  });
};

export const useResumeJob = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobService.resumeJob,
    onSuccess: () => { toast.success('Job resumed'); qc.invalidateQueries({ queryKey: jobKeys.all }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to resume job'),
  });
};

export const useCancelJob = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobService.cancelJob,
    onSuccess: () => { toast.success('Job cancelled'); qc.invalidateQueries({ queryKey: jobKeys.all }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to cancel job'),
  });
};

// ── Payment Workflow Hooks ──────────────────────────────────────────────────────
// Any funding / release event changes the same shared domain: the job, the
// project + its milestones (['projects'] matches ['projects', id, 'milestones']),
// the contract, and the money. Invalidating only one screen's keys leaves the
// others showing stale state (e.g. a milestone stuck on "pending" after funding).
const invalidatePaymentRelated = (qc) => {
  qc.invalidateQueries({ queryKey: jobKeys.all });
  qc.invalidateQueries({ queryKey: ['projects'] });
  qc.invalidateQueries({ queryKey: ['contracts'] });
  qc.invalidateQueries({ queryKey: ['wallet'] });
  qc.invalidateQueries({ queryKey: ['transactions'] });
  qc.invalidateQueries({ queryKey: ['earnings'] });
  qc.invalidateQueries({ queryKey: ['earnings-chart'] });
};

export const useFundJobPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId) => jobService.fundJobPayment(jobId),
    onSuccess: (res) => {
      toast.success(res?.data?.message || 'Payment funded! Freelancer can now start work.');
      invalidatePaymentRelated(qc);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Funding failed'),
  });
};

export const useStartJobWork = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId) => jobService.startJobWork(jobId),
    onSuccess: () => { toast.success('Work started!'); invalidatePaymentRelated(qc); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to start work'),
  });
};

export const useSubmitJobDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, formData }) => jobService.submitJobDelivery(jobId, formData),
    onSuccess: () => { toast.success('Delivery submitted!'); invalidatePaymentRelated(qc); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to submit delivery'),
  });
};

export const useApproveJobDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId) => jobService.approveJobDelivery(jobId),
    onSuccess: (res) => {
      toast.success(res?.data?.message || 'Delivery approved! Payment released.');
      invalidatePaymentRelated(qc);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to approve delivery'),
  });
};
