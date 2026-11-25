import { useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useResetPassword } from '@/hooks/useAuth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { mutate: reset, isPending } = useResetPassword();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const { t } = useTranslation();

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card p-8 text-center max-w-sm">
        <p className="text-danger-500 font-semibold mb-2">{t('auth.invalidReset')}</p>
        <Link to="/auth/forgot-password" className="text-primary-600 text-sm hover:underline dark:text-primary-400">{t('auth.requestNew')}</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-primary-50/30 dark:from-dark-900 dark:to-dark-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="card p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
              <LockClosedIcon className="w-7 h-7 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('auth.resetTitle')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('auth.resetDesc')}</p>
          </div>

          <form onSubmit={handleSubmit((d) => reset({ token, password: d.password, confirmPassword: d.confirmPassword }))} className="space-y-4">
            <Input
              label={t('auth.newPassword')}
              type="password"
              placeholder={t('auth.newPasswordPlaceholder')}
              icon={LockClosedIcon}
              error={errors.password?.message}
              {...register('password', {
                required: t('auth.required'),
                minLength: { value: 8, message: t('auth.min8Chars') },
                pattern: { value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/, message: t('auth.passwordPattern') },
              })}
            />
            <Input
              label={t('auth.confirmNewPassword')}
              type="password"
              placeholder={t('auth.confirmPlaceholder')}
              icon={LockClosedIcon}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword', {
                required: t('auth.required'),
                validate: (v) => v === watch('password') || t('auth.passwordsNoMatch'),
              })}
            />
            <Button type="submit" loading={isPending} className="w-full">{t('auth.resetPassword')}</Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
