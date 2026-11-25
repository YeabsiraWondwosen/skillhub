import { useEffect, useState } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/useNotifications';
import Button from '@/components/ui/Button';

const CHANNELS = [
  { key: 'inApp', label: 'In-app notifications' },
  { key: 'email', label: 'Email notifications' },
  { key: 'push', label: 'Push notifications' },
];

const CATEGORIES = [
  { key: 'proposals', label: 'New Proposals' },
  { key: 'proposalUpdates', label: 'Proposal Updates' },
  { key: 'freelancerMessages', label: 'Freelancer Messages' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'payments', label: 'Payments' },
  { key: 'serviceOrders', label: 'Service Orders' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'systemAlerts', label: 'System Alerts' },
  { key: 'weeklyDigest', label: 'Weekly Summary' },
];

const FREELANCER_CATEGORIES = [
  { key: 'messages', label: 'New Messages' },
  { key: 'jobInvitations', label: 'Job Invitations' },
  { key: 'jobMatches', label: 'New Job Matches' },
  { key: 'proposals', label: 'Proposal Updates (accepted / rejected / shortlisted)' },
  { key: 'contracts', label: 'Contract Updates' },
  { key: 'projects', label: 'Project Updates' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'payments', label: 'Payments & Wallet' },
  { key: 'serviceOrders', label: 'Service Orders' },
  { key: 'catalogPerformance', label: 'Catalog Performance' },
  { key: 'reviews', label: 'Reviews & Ratings' },
  { key: 'verification', label: 'Verification Status' },
  { key: 'systemAlerts', label: 'System Alerts' },
  { key: 'weeklyDigest', label: 'Weekly Summary' },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
        checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

export default function NotificationsSettings({ variant }) {
  const isFreelancer = variant === 'freelancer';
  const categoryOptions = isFreelancer ? FREELANCER_CATEGORIES : CATEGORIES;
  const { data: prefsData, isLoading, isError, error, refetch } = useNotificationPreferences();
  const { mutate: save, isPending } = useUpdateNotificationPreferences();
  const prefs = prefsData?.data;
  const [channels, setChannels] = useState({ inApp: true, email: true, push: true });
  const [categories, setCategories] = useState({});

  useEffect(() => {
    if (prefs) {
      setChannels({
        inApp: prefs.channels?.inApp ?? true,
        email: prefs.channels?.email ?? true,
        push: prefs.channels?.push ?? true,
      });
      const seed = {};
      categoryOptions.forEach((o) => { seed[o.key] = prefs.categories?.[o.key] ?? true; });
      setCategories(seed);
    }
  }, [prefs, categoryOptions]);

  if (isError) {
    return (
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <BellIcon className="w-5 h-5 text-primary-500" /> Notification Preferences
        </h2>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">
          {error?.response?.data?.message || 'Could not load your notification preferences.'}
        </p>
        <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (isLoading || !prefs) {
    return (
      <div className="card p-6 animate-pulse space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BellIcon className="w-5 h-5 text-primary-500" /> Notification Preferences
        </h2>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <BellIcon className="w-5 h-5 text-primary-500" /> Notification Preferences
      </h2>

      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery Channels</h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        In-app notifications are delivered instantly. Email and push delivery are not enabled yet — your
        choices are saved and will apply once those channels are available.
      </p>
      <div className="space-y-3 mb-6">
        {CHANNELS.map(c => (
          <div key={c.key} className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {c.label}
              {c.key !== 'inApp' && (
                <span className="ml-2 text-[11px] font-medium text-gray-400 dark:text-gray-500">Not delivered yet</span>
              )}
            </span>
            <Toggle checked={!!channels[c.key]} onChange={(v) => setChannels(prev => ({ ...prev, [c.key]: v }))} />
          </div>
        ))}
      </div>

      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categories</h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        Choose which in-app notifications you receive. Security and account alerts are always delivered.
      </p>
      <div className="space-y-3 mb-6">
        {categoryOptions.map(c => (
          <div key={c.key} className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">{c.label}</span>
            <Toggle checked={!!categories[c.key]} onChange={(v) => setCategories(prev => ({ ...prev, [c.key]: v }))} />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button loading={isPending} disabled={isPending} onClick={() => save({ channels, categories })}>
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
