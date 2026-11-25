import SectionCard from './SectionCard';
import EmptySection from './EmptySection';
import { BriefcaseIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

// Work history is derived from real completed-project data only. No fabricated
// entries are ever shown.
export default function WorkHistorySection({ user, reputation }) {
  const completed = reputation?.completedProjects ?? user?.stats?.completedProjects ?? 0;
  const successRate = user?.stats?.successRate != null && user.stats.successRate > 0
    ? user.stats.successRate
    : null;
  const onTime = reputation?.completionRate != null && reputation.completionRate > 0
    ? reputation.completionRate
    : null;

  if (completed <= 0 && !successRate && !onTime) {
    return (
      <SectionCard title="Work History">
        <EmptySection
          icon={<BriefcaseIcon className="h-7 w-7 text-gray-500" />}
          title="No work history yet"
          hint="This freelancer hasn't completed any projects yet."
        />
      </SectionCard>
    );
  }

  const facts = [
    completed > 0 && { label: 'Completed projects', value: completed, icon: BriefcaseIcon },
    successRate != null && { label: 'Success rate', value: `${successRate}%`, icon: CheckCircleIcon },
    onTime != null && { label: 'On-time completion', value: `${onTime}%`, icon: ClockIcon },
  ].filter(Boolean);

  return (
    <SectionCard title="Work History">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="rounded-xl border border-gray-100 bg-white/[0.04] p-3.5">
            <f.icon className="h-5 w-5 text-primary-400" />
            <p className="mt-2 text-xl font-bold text-gray-900">{f.value}</p>
            <p className="mt-0.5 text-xs text-gray-500">{f.label}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
