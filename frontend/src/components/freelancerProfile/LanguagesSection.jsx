import SectionCard from './SectionCard';
import EmptySection from './EmptySection';
import { listLanguages } from './profileHelpers';
import { LanguageIcon } from '@heroicons/react/24/outline';

export default function LanguagesSection({ profile }) {
  const languages = listLanguages(profile);

  if (languages.length === 0) {
    return (
      <SectionCard title="Languages">
        <EmptySection
          icon={<LanguageIcon className="h-7 w-7 text-gray-500" />}
          title="No languages added yet"
          hint="This freelancer hasn't listed any languages."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Languages">
      <div className="flex flex-wrap gap-2">
        {languages.map((lang) => (
          <span
            key={lang}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-gray-300"
          >
            <LanguageIcon className="h-4 w-4 text-gray-500" />
            {lang}
          </span>
        ))}
      </div>
    </SectionCard>
  );
}
