import SectionCard from '@/components/freelancerProfile/SectionCard';

const NO_DATA = 'No data yet';

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4 text-center">
      {value != null && value !== '' ? (
        <p className="text-lg font-bold text-gray-900">{value}</p>
      ) : (
        <p className="text-xs font-medium text-gray-500">{NO_DATA}</p>
      )}
      <p className="mt-0.5 text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default function ClientStatsSection({ stats = {}, reviewsReceived }) {
  const tiles = [
    { label: 'Jobs Posted', value: stats.jobsPosted ?? null },
    { label: 'Active Jobs', value: stats.activeJobs ?? null },
    { label: 'Contracts Completed', value: stats.completedContracts ?? null },
    { label: 'Freelancers Hired', value: stats.freelancersHired ?? null },
    { label: 'Open Contracts', value: stats.openContracts ?? null },
    {
      label: 'Avg Rating Given',
      value: stats.averageRatingGiven != null ? stats.averageRatingGiven.toFixed(1) : null,
    },
    { label: 'Reviews Received', value: reviewsReceived ?? null },
  ];

  return (
    <SectionCard title="Hiring Statistics">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatTile key={t.label} label={t.label} value={t.value} />
        ))}
      </div>
    </SectionCard>
  );
}
