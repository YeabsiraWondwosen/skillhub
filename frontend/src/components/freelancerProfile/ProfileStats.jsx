import SectionCard from './SectionCard';
import { formatDate } from './profileHelpers';
import {
  BriefcaseIcon, CommandLineIcon, StarIcon, UserGroupIcon,
  ClockIcon, CheckCircleIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline';

const formatResponseTime = (hours) => {
  if (hours == null || hours <= 0) return null;
  return hours < 1 ? '< 1 hr' : `~ ${Math.round(hours)} hrs`;
};

// Overview statistics built ONLY from real database values. Metrics that
// cannot be calculated (e.g. total earnings, response rate without message
// data) are never rendered — no "—" placeholders.
export default function ProfileStats({ user, reputation, reviewsMeta, catalogsCount, followers }) {
  const stats = user?.stats || {};
  const reviewTotal = reviewsMeta?.totalReviews;
  const rating = reviewTotal > 0 && Number(reviewsMeta.averageRating) > 0
    ? Number(reviewsMeta.averageRating).toFixed(1)
    : null;
  const completionRate = reputation?.completionRate > 0 && (reputation?.completedProjects ?? 0) >= 3
    ? `${reputation.completionRate}%`
    : null;

  const items = [
    { label: 'Rating', value: rating, icon: StarIcon },
    { label: 'Completed Jobs', value: stats.completedProjects > 0 ? stats.completedProjects : null, icon: BriefcaseIcon },
    { label: 'Services', value: catalogsCount > 0 ? catalogsCount : null, icon: CommandLineIcon },
    { label: 'Reviews', value: reviewTotal > 0 ? reviewTotal : null, icon: CheckCircleIcon },
    { label: 'Followers', value: followers > 0 ? followers : null, icon: UserGroupIcon },
    { label: 'Avg Response', value: formatResponseTime(stats.responseTime), icon: ClockIcon },
    { label: 'Completion Rate', value: completionRate, icon: CheckCircleIcon },
    { label: 'Member Since', value: formatDate(user?.createdAt, 'MMM yyyy'), icon: CalendarDaysIcon },
  ].filter((s) => s.value != null);

  if (items.length === 0) return null;

  return (
    <SectionCard title="Overview">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-100 bg-white/[0.04] p-3.5">
            <s.icon className="h-5 w-5 text-primary-400" />
            <p className="mt-2 text-xl font-bold text-gray-900">{s.value}</p>
            <p className="mt-0.5 text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
