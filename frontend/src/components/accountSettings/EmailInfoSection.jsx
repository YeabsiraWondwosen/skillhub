import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';

export default function EmailInfoSection() {
  const { user } = useAuthStore();

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <EnvelopeIcon className="w-5 h-5 text-primary-500" /> Email
      </h2>

      <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
        <p className="text-xs text-gray-400 mb-1">Current email</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.email || '—'}</p>
      </div>
    </div>
  );
}
