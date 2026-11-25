import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useForgotPassword } from '@/hooks/useAuth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const { mutate: forgot, isPending, isSuccess } = useForgotPassword();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-primary-50/30 dark:from-dark-900 dark:to-dark-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="card p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
              <EnvelopeIcon className="w-7 h-7 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('auth.forgotTitle')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('auth.forgotDesc')}
            </p>
          </div>

          {isSuccess ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">{t('auth.checkInbox')}</p>
              <p className="text-sm text-gray-500 mt-1">{t('auth.resetSent')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(forgot)} className="space-y-4">
              <Input
                label={t('auth.email')}
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                icon={EnvelopeIcon}
                error={errors.email?.message}
                {...register('email', { required: t('auth.emailRequired') })}
              />
              <Button type="submit" loading={isPending} className="w-full">{t('auth.sendResetLink')}</Button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link to="/auth/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors">
              <ArrowLeftIcon className="w-4 h-4" /> {t('auth.backToLogin')}
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
