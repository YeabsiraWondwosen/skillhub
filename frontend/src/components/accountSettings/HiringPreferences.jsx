import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { BriefcaseIcon } from '@heroicons/react/24/outline';
import { userService } from '@/services/user.service';
import Button from '@/components/ui/Button';

const TOGGLE_ITEMS = [
  { key: 'allowFreelancerMessages', label: 'Allow freelancers to message me' },
  { key: 'notifyMatchingFreelancers', label: 'Notify me about matching freelancers' },
  { key: 'notifyNewProposals', label: 'Notify me about new proposals' },
  { key: 'notifyServiceUpdates', label: 'Notify me about service updates' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'am', label: 'አማርኛ' },
];

const CURRENCIES = [
  { value: 'ETB', label: 'ETB — Ethiopian Birr' },
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

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500';

export default function HiringPreferences() {
  const qc = useQueryClient();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => userService.getMyProfile().then((r) => r.data),
  });
  const profile = profileData?.data;

  const [prefs, setPrefs] = useState({
    allowFreelancerMessages: true,
    notifyMatchingFreelancers: true,
    notifyNewProposals: true,
    notifyServiceUpdates: true,
    preferredLanguage: 'en',
    preferredPaymentCurrency: 'ETB',
  });

  useEffect(() => {
    if (profile?.hiringPreferences) {
      setPrefs((prev) => ({
        ...prev,
        ...profile.hiringPreferences,
      }));
    }
  }, [profile]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => userService.updateProfile({ hiringPreferences: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      toast.success('Hiring preferences saved!');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save hiring preferences'),
  });

  if (isLoading || !profile) {
    return (
      <div className="card p-6 animate-pulse space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BriefcaseIcon className="w-5 h-5 text-primary-500" /> Hiring Preferences
        </h2>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <BriefcaseIcon className="w-5 h-5 text-primary-500" /> Hiring Preferences
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Control how freelancers and the platform reach you about hiring.
      </p>

      <div className="space-y-3 mb-6">
        {TOGGLE_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">{item.label}</span>
            <Toggle
              checked={!!prefs[item.key]}
              onChange={(v) => setPrefs((prev) => ({ ...prev, [item.key]: v }))}
            />
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Preferred language
          </label>
          <select
            className={inputCls}
            value={prefs.preferredLanguage}
            onChange={(e) => setPrefs((prev) => ({ ...prev, preferredLanguage: e.target.value }))}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Preferred payment currency
          </label>
          <select
            className={inputCls}
            value={prefs.preferredPaymentCurrency}
            onChange={(e) => setPrefs((prev) => ({ ...prev, preferredPaymentCurrency: e.target.value }))}
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button loading={isPending} onClick={() => save(prefs)}>Save Hiring Preferences</Button>
      </div>
    </div>
  );
}
