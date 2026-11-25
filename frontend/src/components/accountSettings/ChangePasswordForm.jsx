import { useForm } from 'react-hook-form';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { useChangePassword } from '@/hooks/useAuth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

export default function ChangePasswordForm() {
  const { mutate: changePassword, isPending } = useChangePassword();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <LockClosedIcon className="w-5 h-5 text-primary-500" /> Change Password
      </h2>
      <form onSubmit={handleSubmit(d => changePassword({
        currentPassword: d.currentPassword,
        newPassword: d.newPassword,
        confirmPassword: d.confirmPassword,
      }))} className="space-y-4">
        <Input label="Current Password" type="password" placeholder="Enter current password"
          error={errors.currentPassword?.message}
          {...register('currentPassword', { required: 'Current password is required' })} />
        <Input label="New Password" type="password" placeholder="Enter new password"
          hint="At least 8 characters with uppercase, lowercase, number and special character"
          error={errors.newPassword?.message}
          {...register('newPassword', {
            required: 'New password is required',
            minLength: { value: 8, message: 'Password must be at least 8 characters' },
            maxLength: { value: 72, message: 'Password cannot exceed 72 characters' },
            pattern: { value: PASSWORD_PATTERN, message: 'Must include uppercase, lowercase, number and special character' },
          })} />
        <Input label="Confirm New Password" type="password" placeholder="Re-enter new password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword', {
            required: 'Please confirm your new password',
            validate: (v) => v === watch('newPassword') || 'Passwords do not match',
          })} />
        <p className="text-xs text-amber-600 dark:text-amber-400">
          After changing your password you will be signed out and asked to log in again.
        </p>
        <div className="flex justify-end">
          <Button type="submit" loading={isPending}>Update Password</Button>
        </div>
      </form>
    </div>
  );
}
