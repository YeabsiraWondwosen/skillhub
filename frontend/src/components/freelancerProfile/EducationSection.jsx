import SectionCard from './SectionCard';
import EmptySection from './EmptySection';
import { formatRange } from './profileHelpers';
import { AcademicCapIcon } from '@heroicons/react/24/outline';

export default function EducationSection({ items = [] }) {
  if (items.length === 0) {
    return (
      <SectionCard title="Education">
        <EmptySection
          icon={<AcademicCapIcon className="h-8 w-8 text-gray-500" />}
          title="No education information has been added yet."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Education">
      <div className="space-y-4">
        {items.map((edu) => (
          <div key={edu._id} className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <AcademicCapIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-200">
                {edu.degree}{edu.fieldOfStudy ? ` · ${edu.fieldOfStudy}` : ''}
              </h3>
              <p className="text-sm text-gray-500">{edu.institution}</p>
              {formatRange(edu.startDate, edu.endDate, edu.isCurrent) && (
                <p className="text-xs text-gray-500">{formatRange(edu.startDate, edu.endDate, edu.isCurrent)}</p>
              )}
              {edu.description && <p className="mt-1 text-sm text-gray-500">{edu.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
