import SectionCard from '@/components/freelancerProfile/SectionCard';
import { BriefcaseIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function ContractsSection({ stats = {} }) {
  const items = [
    {
      label: 'Active Contracts',
      value: stats.openContracts ?? null,
      icon: <BriefcaseIcon className="h-5 w-5 text-primary-500" />,
    },
    {
      label: 'Completed Contracts',
      value: stats.completedContracts ?? null,
      icon: <CheckCircleIcon className="h-5 w-5 text-green-500" />,
    },
  ];

  return (
    <SectionCard title="Contracts">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
              {item.icon}
            </span>
            <div>
              <p className="text-lg font-bold text-gray-900">{item.value ?? 'No data yet'}</p>
              <p className="text-xs text-gray-500">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Contract summaries are shown only when this profile is public. Individual contract details stay private.
      </p>
    </SectionCard>
  );
}
