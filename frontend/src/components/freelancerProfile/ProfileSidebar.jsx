import { clsx } from 'clsx';
import { formatDate, listLanguages, displayLocation, computeYearsOfExperience } from './profileHelpers';
import SectionCard from './SectionCard';
import {
  MapPinIcon, LanguageIcon, ClockIcon, CalendarDaysIcon, BriefcaseIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { GithubIcon, LinkedInIcon, GlobeIcon, TwitterIcon } from './SocialIcons';

function FactRow({ icon, label, value }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 text-gray-500">{icon}</span>
      <span>
        <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
        <span className="text-gray-300">{value}</span>
      </span>
    </li>
  );
}

export default function ProfileSidebar({ user, profile, reviewsMeta }) {
  const stats = user.stats || {};
  const location = displayLocation(profile, user);
  const languages = listLanguages(profile);
  const years = computeYearsOfExperience(profile);
  const memberSince = formatDate(user.createdAt, 'yyyy');
  const responseHours = stats.responseTime != null && stats.responseTime > 0
    ? stats.responseTime < 1
      ? '< 1 hr'
      : `~ ${Math.round(stats.responseTime)} hrs`
    : null;

  const social = [
    { href: user.socialLinks?.github, label: 'GitHub', icon: <GithubIcon className="h-4 w-4" /> },
    { href: user.socialLinks?.linkedin, label: 'LinkedIn', icon: <LinkedInIcon className="h-4 w-4" /> },
    { href: user.socialLinks?.twitter, label: 'Twitter', icon: <TwitterIcon className="h-4 w-4" /> },
    { href: user.socialLinks?.website, label: 'Website', icon: <GlobeIcon className="h-4 w-4" /> },
  ].filter((s) => s.href);
  const resumeUrl = profile.resume?.url;

  const reviewTotal = reviewsMeta?.totalReviews;
  const ratingValue =
    reviewTotal > 0
      ? Number(reviewsMeta.averageRating).toFixed(1)
      : stats.averageRating != null && stats.averageRating > 0
        ? stats.averageRating.toFixed(1)
        : null;

  const quickStats = [
    { label: 'Completed', value: stats.completedProjects != null ? stats.completedProjects : null },
    { label: 'Success rate', value: stats.completedProjects > 0 && stats.successRate != null ? `${stats.successRate}%` : null },
    { label: 'Rating', value: ratingValue },
  ].filter((s) => s.value !== null);

  const facts = [
    location && { icon: <MapPinIcon className="h-4 w-4" />, label: 'Location', value: location },
    languages.length > 0 && {
      icon: <LanguageIcon className="h-4 w-4" />,
      label: 'Languages',
      value: (
        <span className="flex flex-wrap gap-1 pt-0.5">
          {languages.map((l) => (
            <span key={l} className="rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-400">
              {l}
            </span>
          ))}
        </span>
      ),
    },
    years && { icon: <BriefcaseIcon className="h-4 w-4" />, label: 'Experience', value: `${years}+ years` },
    responseHours && { icon: <ClockIcon className="h-4 w-4" />, label: 'Avg response', value: responseHours },
    memberSince && { icon: <CalendarDaysIcon className="h-4 w-4" />, label: 'Member since', value: memberSince },
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      {facts.length > 0 && (
        <SectionCard title="Quick facts">
          <ul className="space-y-4">
            {facts.map((f) => (
              <FactRow key={f.label} icon={f.icon} label={f.label} value={f.value} />
            ))}
          </ul>
        </SectionCard>
      )}

      {quickStats.length > 0 && (
        <SectionCard title="Performance">
          <div className="grid grid-cols-3 gap-3">
            {quickStats.map((s) => (
              <div key={s.label} className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
                <p className="mt-0.5 text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {(social.length > 0 || resumeUrl) && (
        <SectionCard title="Links">
          <div className="flex flex-wrap gap-2">
            {social.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-primary-200 hover:text-primary-600"
              >
                {s.icon}
                {s.label}
              </a>
            ))}
            {resumeUrl && (
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-primary-200 hover:text-primary-600"
              >
                <DocumentTextIcon className="h-4 w-4" />
                Resume
              </a>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
