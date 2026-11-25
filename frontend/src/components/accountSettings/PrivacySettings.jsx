import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { userService } from '@/services/user.service';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/ui/Button';

const PRIVACY_ITEMS = [
  { key: 'showOnlineStatus', label: 'Show Online Status' },
  { key: 'allowDirectMessages', label: 'Allow Direct Messages' },
  { key: 'showPortfolio', label: 'Display Portfolio Publicly' },
  { key: 'showReviews', label: 'Display Reviews Publicly' },
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

export default function PrivacySettings() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => userService.getMyProfile().then((r) => r.data),
  });
  const profile = profileData?.data;

  const [isPublic, setIsPublic] = useState(true);
  const [privacy, setPrivacy] = useState({
    showOnlineStatus: true,
    allowDirectMessages: true,
    showPortfolio: true,
    showReviews: true,
  });

  useEffect(() => {
    if (profile) {
      setIsPublic(profile.isPublic !== false);
      setPrivacy({
        showOnlineStatus: profile.privacy?.showOnlineStatus !== false,
        allowDirectMessages: profile.privacy?.allowDirectMessages !== false,
        showPortfolio: profile.privacy?.showPortfolio !== false,
        showReviews: profile.privacy?.showReviews !== false,
      });
    }
  }, [profile]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => userService.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      qc.invalidateQueries({ queryKey: ['freelancer', user?._id] });
      toast.success('Privacy settings saved!');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save privacy settings'),
  });

  if (isLoading || !profile) {
    return (
      <div className="card p-6 animate-pulse space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <LockClosedIcon className="w-5 h-5 text-primary-500" /> Privacy
        </h2>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>
    );
  }

  const handleSave = () => save({ isPublic, privacy });

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <LockClosedIcon className="w-5 h-5 text-primary-500" /> Privacy
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Control who can see your profile and how clients can reach you.
      </p>

      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">Public Profile</span>
          <Toggle checked={isPublic} onChange={setIsPublic} />
        </div>
        {PRIVACY_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">{item.label}</span>
            <Toggle
              checked={!!privacy[item.key]}
              onChange={(v) => setPrivacy((prev) => ({ ...prev, [item.key]: v }))}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button loading={isPending} onClick={handleSave}>Save Privacy Settings</Button>
      </div>
    </div>
  );
}
