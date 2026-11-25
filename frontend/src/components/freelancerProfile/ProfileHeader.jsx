import { Link } from 'react-router-dom';
import Avatar from '@/components/ui/Avatar';
import FollowButton from '@/components/profile/FollowButton';
import { useAuthStore } from '@/store/authStore';
import { fullName, displayLocation, formatRateOrUnset, getAvailability, roleLabel, formatDate } from './profileHelpers';
import { CheckBadgeIcon, MapPinIcon, PaperAirplaneIcon, UserPlusIcon, ShareIcon, BoltIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import CategoryIcon from '@/utils/categoryIcons';
import { clsx } from 'clsx';

const AVAILABILITY_TEXT = {
  success: 'text-green-400',
  warning: 'text-amber-400',
  neutral: 'text-gray-400',
};

export default function ProfileHeader({ user, profile, onMessage, onInvite, onShare, showActions = true }) {
  const currentUser = useAuthStore((s) => s.user);
  const isOwnProfile = !!currentUser && currentUser._id === user._id;

  const name = fullName(user) || 'Freelancer';
  const location = displayLocation(profile, user);
  const rate = formatRateOrUnset(profile.hourlyRate, profile.currency);
  const rateIsSet = profile.hourlyRate != null && profile.hourlyRate !== '';
  const availability = getAvailability(user, profile);
  const role = roleLabel(user);
  const memberSince = formatDate(user.createdAt, 'yyyy');

  return (
    <div className="card overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-500" />
      <div className="px-5 pb-5 sm:px-6">
        <div className="flex flex-col gap-4 -mt-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Avatar src={user.avatar?.url} alt={name} size="2xl" online={user.isOnline} className="border-4 border-white rounded-full" />
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
                {role && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                    {role}
                  </span>
                )}
                {user.isVerifiedFreelancer && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-600">
                    <CheckBadgeIcon className="h-4 w-4" />
                    Verified
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
                {location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="h-4 w-4 text-gray-500" />
                    {location}
                  </span>
                )}
                {user.isOnline != null && (
                  <span className="inline-flex items-center gap-1">
                    <span className={clsx('h-2 w-2 rounded-full', user.isOnline ? 'bg-green-500' : 'bg-gray-400')} />
                    <span className="text-xs font-medium text-gray-400">{user.isOnline ? 'Online' : 'Offline'}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 font-semibold text-gray-200">
                  <BoltIcon className={clsx('h-4 w-4', rateIsSet ? 'text-primary-500' : 'text-gray-500')} />
                  <span className={rateIsSet ? undefined : 'text-gray-500'}>{rate}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={clsx('h-2 w-2 rounded-full', availability.dot)} />
                  <span className={clsx('text-xs font-medium', AVAILABILITY_TEXT[availability.tone])}>
                    {availability.label}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {!isOwnProfile && showActions && (
            <div className="flex flex-wrap items-center gap-2">
              <FollowButton userId={user._id} size="md" />
              <button onClick={onShare} className="btn-secondary" aria-label="Share profile">
                <ShareIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
              <button onClick={onMessage} className="btn-secondary">
                <PaperAirplaneIcon className="h-4 w-4" />
                Message
              </button>
              <button onClick={onInvite} className="btn-primary">
                <UserPlusIcon className="h-4 w-4" />
                Invite to Job
              </button>
            </div>
          )}
        </div>

        {profile.categories?.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {profile.categories.slice(0, 5).map((cat) => (
              <Link
                key={cat._id}
                to={`/freelancers?category=${cat._id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-100"
              >
                {cat.icon && <CategoryIcon icon={cat.icon} size={12} className="inline-flex" />}
                {cat.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
