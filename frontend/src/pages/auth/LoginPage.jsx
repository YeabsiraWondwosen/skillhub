import { Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useLogin } from '@/hooks/useAuth';
import { sanitizeInviteIntent } from '@/utils/authRedirect';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function LoginPage() {
  const { mutate: login, isPending } = useLogin();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { t } = useTranslation();
  const location = useLocation();
  const inviteIntent = sanitizeInviteIntent(location.state?.invite);

  const onSubmit = (data) => login(data);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50/30 to-secondary-50/20 dark:from-dark-900 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center">
            <img src="/images/skillhub-logo-dark.png" alt="SkillHub" className="h-10 w-auto object-contain dark:hidden" />
            <img src="/images/skillhub-logo-light.png" alt="SkillHub" className="h-10 w-auto object-contain hidden dark:block" />
          </Link>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">{t('auth.signInToAccount')}</p>
        </div>

        <div className="card p-8 shadow-xl">
          {inviteIntent && (
            <p className="mb-5 text-sm text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded-xl px-4 py-3">
              Sign in with your client account to finish inviting{' '}
              <span className="font-semibold">{inviteIntent.firstName || 'this freelancer'}</span>.
            </p>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label={t('auth.email')}
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              icon={EnvelopeIcon}
              error={errors.email?.message}
              {...register('email', { required: t('auth.emailRequired') })}
            />
            <div>
              <Input
                label={t('auth.password')}
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                icon={LockClosedIcon}
                error={errors.password?.message}
                {...register('password', { required: t('auth.passwordRequired') })}
              />
              <div className="text-right mt-1.5">
                <Link to="/auth/forgot-password" className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            </div>

            <Button type="submit" loading={isPending} className="w-full btn-lg">
              {t('auth.login')}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {t('auth.noAccount')}{' '}
            <Link to={{ pathname: '/auth/register', search: '' }} state={location.state} className="text-primary-600 font-semibold hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
              {t('auth.createOne')}
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
