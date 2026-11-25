import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import EmptySection from './EmptySection';
import { jobService } from '@/services/job.service';
import { formatCurrency, formatRate } from '@/utils/currency';

export default function InviteFreelancerModal({ open, onClose, freelancerId, freelancerName }) {
  const [selectedJobId, setSelectedJobId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-jobs', 'open'],
    queryFn: () => jobService.getMyJobs({ status: 'open', limit: 50 }).then((r) => r.data),
    enabled: open,
  });

  const jobs = data?.data || [];

  const inviteMutation = useMutation({
    mutationFn: (jobId) => jobService.inviteFreelancer(jobId, freelancerId),
    onSuccess: () => {
      toast.success(`Invitation sent to ${freelancerName}`);
      setSelectedJobId('');
      onClose();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to send invitation');
    },
  });

  const handleInvite = () => {
    if (!selectedJobId) {
      toast.error('Select a job to invite to');
      return;
    }
    inviteMutation.mutate(selectedJobId);
  };

  return (
    <Modal open={open} onClose={onClose} title={`Invite ${freelancerName} to a job`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          Choose one of your open jobs. The freelancer will receive an invitation notification.
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptySection
            title="No open jobs"
            hint="Create a job first, then come back to invite freelancers."
          />
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {jobs.map((job) => {
              const selected = selectedJobId === job._id;
              return (
                <label
                  key={job._id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    selected ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="job-select"
                    checked={selected}
                    onChange={() => setSelectedJobId(job._id)}
                    className="mt-1 h-4 w-4 accent-primary-600"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-200">{job.title}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {job.budget?.type === 'fixed'
                        ? `${formatCurrency(job.budget?.maxAmount, job.budget?.currency) ?? 'Budget not specified'} fixed`
                        : job.budget?.minAmount != null && job.budget?.maxAmount != null
                          ? `${formatRate(job.budget?.maxAmount, job.budget?.currency) ?? `${job.budget?.currency || 'ETB'} ${job.budget.maxAmount}/hr`}`
                          : 'Budget not specified'}
                      {job.duration ? ` · ${job.duration.replace(/_/g, ' ')}` : ''}
                      {job.experienceLevel ? ` · ${job.experienceLevel}` : ''}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleInvite}
            disabled={!selectedJobId || inviteMutation.isPending || jobs.length === 0}
            className="btn-primary"
          >
            {inviteMutation.isPending ? 'Sending…' : 'Send invitation'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
