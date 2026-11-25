import Avatar from '@/components/ui/Avatar';
import FollowButton from '@/components/profile/FollowButton';
import { fullName, displayLocation, roleLabel, formatDate } from '@/components/freelancerProfile/profileHelpers';
import { MapPinIcon, PaperAirplaneIcon, BriefcaseIcon, CalendarDaysIcon, ClockIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

export default function ClientProfileHeader({ user, profile, isOwnProfile, onMessage, onViewJobs }) {
  const name = fullName(user) || 'Client';
  const role = roleLabel(user);
  const location = displayLocation(profile, user);
  const memberSince = formatDate(user.createdAt, 'yyyy');
  const lastActive = user.lastSeen ? formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true }) : null;

  return (
    <div className="card overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-500" />
      <div className="px-5 pb-5 sm:px-6">
        <div className="flex flex-col gap-4 -mt-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Avatar
              src={user.avatar?.url}
              alt={name}
              size="2xl"
              online={user.isOnline}
              className="border-4 border-white rounded-full"
            />
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
                {role && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                    {role}
                  </span>
                )}
              </div>
              {profile.tagline && <p className="mt-1 text-sm font-medium text-gray-500">{profile.tagline}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                {memberSince && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDaysIcon className="h-4 w-4 text-gray-500" />
                    Member since {memberSince}
                  </span>
                )}
                {lastActive && (
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="h-4 w-4 text-gray-500" />
                    Active {lastActive}
                  </span>
                )}
                {location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="h-4 w-4 text-gray-500" />
                    {location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {!isOwnProfile && (
            <div className="flex flex-wrap items-center gap-2">
              <FollowButton userId={user._id} size="md" />
              <button onClick={onMessage} className="btn-secondary">
                <PaperAirplaneIcon className="h-4 w-4" />
                Message
              </button>
              <button onClick={onViewJobs} className="btn-primary">
                <BriefcaseIcon className="h-4 w-4" />
                View Open Jobs
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
