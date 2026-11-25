import SectionCard from '@/components/freelancerProfile/SectionCard';
import EmptySection from '@/components/freelancerProfile/EmptySection';
import { displayLocation } from '@/components/freelancerProfile/profileHelpers';
import { MapPinIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

export default function ClientAboutSection({ user, profile }) {
  const location = displayLocation(profile, user);
  const website = user.socialLinks?.website || profile?.githubData?.profile?.blog || null;

  const facts = [
    location && { icon: <MapPinIcon className="h-4 w-4" />, label: 'Location', value: location },
    website && {
      icon: <GlobeAltIcon className="h-4 w-4" />,
      label: 'Website',
      value: (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-primary-600 hover:underline"
        >
          {website.replace(/^https?:\/\//, '')}
        </a>
      ),
    },
  ].filter(Boolean);

  const hasContent = profile.bio || facts.length > 0;

  return (
    <SectionCard title="About">
      {hasContent ? (
        <div className="space-y-4">
          {profile.bio && <p className="whitespace-pre-line text-sm leading-relaxed text-gray-300">{profile.bio}</p>}
          {facts.length > 0 && (
            <ul className="space-y-3">
              {facts.map((f) => (
                <li key={f.label} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 text-gray-500">{f.icon}</span>
                  <span>
                    <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">{f.label}</span>
                    <span className="text-gray-300">{f.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <EmptySection title="No company information yet" hint="This client hasn't added a description or company details." />
      )}
    </SectionCard>
  );
}
