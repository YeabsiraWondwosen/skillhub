import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { useVerifyEmailChange } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';
import LoadingScreen from '@/components/ui/LoadingScreen';

export default function VerifyEmailChangePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const { data, isLoading, isSuccess, isError, error } = useVerifyEmailChange(token);

  useEffect(() => {
    if (isSuccess && data?.data?.data?.user) {
      updateUser(data.data.data.user);
    }
  }, [isSuccess, data, updateUser]);

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-primary-50/30 dark:from-dark-900 dark:to-dark-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <div className="card p-10 shadow-xl text-center">
          {isSuccess ? (
            <>
              <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Email address updated</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                Your SkillHub email has been changed successfully.
              </p>
              <Link to={user ? '/dashboard' : '/auth/login'} className="btn-primary w-full inline-block text-center">
                {user ? 'Go to dashboard' : 'Go to login'}
              </Link>
            </>
          ) : (
            <>
              <XCircleIcon className="w-16 h-16 text-danger-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Email change failed</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                {error?.response?.data?.message || 'This confirmation link is invalid or has expired.'}
              </p>
              <button onClick={() => navigate(user ? '/dashboard' : '/auth/login')} className="text-primary-600 text-sm hover:underline dark:text-primary-400">
                {user ? 'Back to dashboard' : 'Back to login'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
