import { Link } from 'react-router-dom';
import SectionCard from './SectionCard';
import EmptySection from './EmptySection';
import { buildCategoryHierarchy } from './profileHelpers';
import CategoryIcon from '@/utils/categoryIcons';
import { Squares2X2Icon } from '@heroicons/react/24/outline';

export default function AboutSection({ profile }) {
  const hierarchy = buildCategoryHierarchy(profile);

  return (
    <SectionCard title="About">
      {profile.bio ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{profile.bio}</p>
      ) : (
        <EmptySection title="No bio provided" />
      )}

      {hierarchy.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Squares2X2Icon className="h-4 w-4 text-gray-500" />
            Areas of expertise
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {hierarchy.map(({ main, subcategories }, i) => (
              <div key={main ? main._id : `orphan-${i}`} className="rounded-xl border border-gray-100 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between gap-2">
                  {main ? (
                    <Link
                      to={`/freelancers?category=${main._id}`}
                      className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-200 hover:text-primary-600"
                    >
                      {main.icon && <CategoryIcon icon={main.icon} size={14} className="inline-flex flex-shrink-0" />}
                      <span className="truncate">{main.name}</span>
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-gray-400">Specialties</span>
                  )}
                  {main && (
                    <Link
                      to={`/jobs?category=${main._id}`}
                      className="shrink-0 text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      Browse jobs
                    </Link>
                  )}
                </div>
                {subcategories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {subcategories.map((sub) => (
                      <Link
                        key={sub._id}
                        to={`/freelancers?category=${sub._id}`}
                        className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-white/10 transition-colors hover:text-primary-600 hover:ring-primary-200"
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
