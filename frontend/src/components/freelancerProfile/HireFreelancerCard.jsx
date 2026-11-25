import { getAvailability, formatRateOrUnset } from './profileHelpers';
import { clsx } from 'clsx';
import { BoltIcon } from '@heroicons/react/24/outline';

export default function HireFreelancerCard({ user, profile, onMessage, onInvite }) {
  const rate = formatRateOrUnset(profile.hourlyRate, profile.currency);
  const rateIsSet = profile.hourlyRate != null && profile.hourlyRate !== '';
  const availability = getAvailability(user, profile);
  const types = profile.preferredProjectTypes?.length
    ? profile.preferredProjectTypes.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' · ')
    : null;

  return (
    <div className="card overflow-hidden">
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
        {types && <p className="mt-1 text-xs text-gray-500">Prefers {types} contracts</p>}
      </div>
      <div className="space-y-2 px-5 py-4">
        <button onClick={onMessage} className="btn-primary w-full">
          <BoltIcon className="h-4 w-4" />
          Message
        </button>
        <button onClick={onInvite} className="btn-secondary w-full">
          Invite to Job
        </button>
      </div>
    </div>
  );
}
