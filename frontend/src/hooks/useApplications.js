import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { applicationService } from '@/services/application.service';
import { jobService } from '@/services/job.service';

export const appKeys = {
  mine: (params) => ['applications', 'mine', params],
  job: (jobId, params) => ['applications', 'job', jobId, params],
  detail: (id) => ['applications', id],
  received: () => ['applications', 'received', 'client'],
};

export const useMyApplications = (params) =>
  useQuery({ queryKey: appKeys.mine(params), queryFn: () => applicationService.getMyApplications(params).then(r => r.data) });

// ─── Client view: all proposals received across the client's jobs ─────────────
// Reuses the existing per-job proposal API without adding backend endpoints.
export const useClientReceivedProposals = () =>
  useQuery({
    queryKey: appKeys.received(),
    queryFn: async () => {
      const pageSize = 100;
      const maxPages = 5;
      const jobs = [];
      let page = 1;
      let total = null;
      while (page <= maxPages && (total === null || jobs.length < total)) {
        const jobsRes = await jobService.getMyJobs({ page, limit: pageSize });
        const body = jobsRes.data;
        jobs.push(...(body?.data ?? []));
        if (total === null) total = body?.meta?.total ?? jobs.length;
        if ((body?.data ?? []).length < pageSize) break;
        page += 1;
      }
      const settled = await Promise.allSettled(
        jobs.map(j => applicationService.getJobApplications(j._id, { page: 1, limit: 100 }))
      );
      const proposals = [];
      settled.forEach((result) => {
        if (result.status === 'fulfilled') {
          // Each application now carries its own populated `job` from the API —
          // never rely on array position to associate a proposal with a job.
          proposals.push(...(result.value.data?.data ?? []));
        }
      });
      proposals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return proposals;
    },
    staleTime: 1000 * 30,
  });

export const useJobApplications = (jobId, params) =>
  useQuery({ queryKey: appKeys.job(jobId, params), queryFn: () => applicationService.getJobApplications(jobId, params).then(r => r.data), enabled: !!jobId });

export const useApplication = (id) =>
  useQuery({ queryKey: appKeys.detail(id), queryFn: () => applicationService.getApplication(id).then(r => r.data), enabled: !!id });

export const useSubmitApplication = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, formData }) => applicationService.submit(jobId, formData),
    onSuccess: () => { toast.success('Application submitted!'); qc.invalidateQueries({ queryKey: ['applications'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Submission failed'),
  });
};

export const useUpdateApplicationStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => applicationService.updateStatus(id, data),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['applications'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
  });
};

export const useHireFreelancer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: applicationService.hireFreelancer,
    onSuccess: () => { toast.success('Freelancer hired! Project created.'); qc.invalidateQueries({ queryKey: ['applications'] }); qc.invalidateQueries({ queryKey: ['projects'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Hire failed'),
  });
};

export const useWithdrawApplication = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: applicationService.withdraw,
    onSuccess: () => { toast.success('Application withdrawn'); qc.invalidateQueries({ queryKey: ['applications'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
};
