import { Link } from 'react-router-dom';
import SectionCard from '@/components/freelancerProfile/SectionCard';
import EmptySection from '@/components/freelancerProfile/EmptySection';
import { formatDate } from '@/components/freelancerProfile/profileHelpers';
import { formatCurrency, formatRateRange } from '@/utils/currency';
import { ArrowRightIcon, CurrencyDollarIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

const STATUS_LABELS = {
  open: 'Open',
  proposals_received: 'Proposals Received',
  freelancer_selected: 'Freelancer Selected',
  payment_pending: 'Payment Required',
  funded: 'Funded',
  in_progress: 'In Progress',
  delivery_submitted: 'Delivery Submitted',
  client_review: 'Client Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
  paused: 'Paused',
};

const STATUS_STYLES = {
  open: 'bg-green-100 text-green-700',
  proposals_received: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
  paused: 'bg-amber-100 text-amber-700',
};

function JobBudget({ budget }) {
  if (!budget) return 'Budget not set';
  if (budget.type === 'hourly') {
    return formatRateRange(budget.minAmount, budget.maxAmount, budget.currency) || 'Budget not set';
  }
  return formatCurrency(budget.maxAmount, budget.currency) || 'Budget not set';
}

export default function RecentJobsSection({ jobs = [] }) {
  return (
    <SectionCard title="Recent Jobs">
      {jobs.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {jobs.map((job) => (
            <li key={job._id}>
              <Link
                to={`/jobs/${job._id}`}
                className="group flex flex-col gap-2 rounded-xl px-2 py-3 transition-colors hover:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-200 group-hover:text-primary-600">
                    {job.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    {job.createdAt && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDaysIcon className="h-3.5 w-3.5" />
                        {formatDate(job.createdAt, 'MMM d, yyyy')}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <CurrencyDollarIcon className="h-3.5 w-3.5" />
                      <JobBudget budget={job.budget} />
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {job.status && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[job.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[job.status] || job.status.replace(/_/g, ' ')}
                    </span>
                  )}
                  <ArrowRightIcon className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptySection title="No jobs posted yet" hint="This client hasn't posted any jobs yet." />
      )}
    </SectionCard>
  );
}
