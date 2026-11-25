import SectionCard from './SectionCard';
import EmptySection from './EmptySection';
import { SKILL_LEVEL_LABELS } from './profileHelpers';
import { clsx } from 'clsx';

const LEVEL_BAR = {
  beginner: 'w-1/4 bg-green-400',
  intermediate: 'w-2/4 bg-sky-400',
  advanced: 'w-3/4 bg-primary-500',
  expert: 'w-full bg-gradient-to-r from-primary-500 to-secondary-500',
};

export default function SkillsSection({ skills = [] }) {
  if (skills.length === 0) {
    return (
      <SectionCard title="Skills">
        <EmptySection title="No skills listed yet" hint="This freelancer hasn't added any skills yet." />
      </SectionCard>
    );
  }

  return (
    <SectionCard title={`Skills (${skills.length})`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {skills.map((skill) => {
          const level = SKILL_LEVEL_LABELS[skill.level] || skill.level || 'Intermediate';
          return (
            <div
              key={skill._id}
              className="rounded-xl border border-gray-100 bg-white/[0.04] p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-200 capitalize">{skill.name}</p>
                <span className="text-xs font-medium text-gray-500">{level}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className={clsx('h-full rounded-full', LEVEL_BAR[skill.level] || LEVEL_BAR.intermediate)} />
              </div>
              {skill.yearsOfExperience != null && (
                <p className="mt-1.5 text-xs text-gray-500">
                  {skill.yearsOfExperience} {skill.yearsOfExperience === 1 ? 'year' : 'years'} experience
                </p>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
