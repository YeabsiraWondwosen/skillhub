import SectionCard from './SectionCard';
import EmptySection from './EmptySection';
import { formatRange } from './profileHelpers';
import { BriefcaseIcon } from '@heroicons/react/24/outline';

export default function ExperienceSection({ items = [] }) {
  if (items.length === 0) {
    return (
      <SectionCard title="Work experience">
        <EmptySection title="No work experience yet" hint="This freelancer hasn't added any work experience yet." />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Work experience">
      <ol className="relative space-y-6 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-gray-100">
        {items.map((exp) => (
          <li key={exp._id} className="relative pl-6">
            <span className="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary-100 bg-gray-50">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <div className="flex items-center gap-2">
                <BriefcaseIcon className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-200">{exp.title}</h3>
              </div>
              {formatRange(exp.startDate, exp.endDate, exp.isCurrent) && (
                <span className="text-xs font-medium text-gray-500">{formatRange(exp.startDate, exp.endDate, exp.isCurrent)}</span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-gray-500">{exp.company}{exp.location ? ` · ${exp.location}` : ''}</p>
            {exp.description && <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{exp.description}</p>}
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
