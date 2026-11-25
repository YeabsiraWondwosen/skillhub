import FollowButton from '@/components/profile/FollowButton';
import { useAuthStore } from '@/store/authStore';
import { getAvailability, formatRateOrUnset, roleLabel, displayLocation, formatDate } from './profileHelpers';
import { clsx } from 'clsx';
import { BoltIcon, PaperAirplaneIcon, UserPlusIcon, CommandLineIcon, CheckBadgeIcon, MapPinIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

// Sticky "hire" card shown on the right column of the public profile.
// Offers the key conversion actions (invite / message / browse services /
// follow) and only surfaces real public facts about the freelancer.
export default function ProfileActionCard({ user, profile, onMessage, onInvite, onBookMeeting, onViewServices, hasServices }) {
  const currentUser = useAuthStore((s) => s.user);
  const isOwnProfile = !!currentUser && currentUser._id === user._id;

  const rate = formatRateOrUnset(profile.hourlyRate, profile.currency);
  const rateIsSet = profile.hourlyRate != null && profile.hourlyRate !== '';
  const availability = getAvailability(user, profile);
  const location = displayLocation(profile, user);
  const memberSince = formatDate(user.createdAt, 'yyyy');

  return (
    <div className="card sticky top-6 overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className={clsx('text-2xl font-bold', rateIsSet ? 'text-gray-900' : 'text-base font-medium text-gray-500')}>
            {rate}
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
            <span className={clsx('h-2 w-2 rounded-full', availability.dot)} />
            {availability.label}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {user.isVerifiedFreelancer && (
            <span className="inline-flex items-center gap-1 font-semibold text-green-600">
              <CheckBadgeIcon className="h-4 w-4" />
              Verified
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="h-4 w-4" />
              {location}
            </span>
          )}
          {memberSince && (
            <span className="inline-flex items-center gap-1">
              <CalendarDaysIcon className="h-4 w-4" />
              Member since {memberSince}
            </span>
          )}
        </div>
      </div>

      {!isOwnProfile && (
        <div className="space-y-2 px-5 py-4">
          <button onClick={onInvite} className="btn-primary w-full">
            <UserPlusIcon className="h-4 w-4" />
            Invite to Job
          </button>
          <button onClick={onMessage} className="btn-secondary w-full">
            <PaperAirplaneIcon className="h-4 w-4" />
            Message
          </button>
          <button onClick={onBookMeeting} className="btn-primary w-full">
            <CalendarDaysIcon className="h-4 w-4" />
            Book a Meeting
          </button>
          <button
            onClick={onViewServices}
            disabled={!hasServices}
            className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-50"
            title={hasServices ? 'View published services' : 'This freelancer has not published any services yet'}
          >
            <CommandLineIcon className="h-4 w-4" />
            View Services
            {!hasServices && <span className="ml-auto text-xs text-gray-400">0</span>}
          </button>
          <div className="flex justify-center pt-1">
            <FollowButton userId={user._id} size="md" />
          </div>
        </div>
      )}

      {roleLabel(user) && (
        <div className="border-t border-gray-100 px-5 py-3 text-center text-xs font-medium text-gray-500">
          {roleLabel(user)} profile
        </div>
      )}
    </div>
  );
}
