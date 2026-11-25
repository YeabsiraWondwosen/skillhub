import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { userService } from '@/services/user.service';
import { useAuthStore } from '@/store/authStore';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import { format } from 'date-fns';

export default function ProfileInfoSection() {
  const { user, updateUser } = useAuthStore();
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    values: { firstName: user?.firstName || '', lastName: user?.lastName || '' },
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => userService.updateMe(data),
    onSuccess: (res) => {
      updateUser(res.data?.data);
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      qc.invalidateQueries({ queryKey: ['freelancer', user?._id] });
      toast.success('Profile info updated!');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update profile'),
  });

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—';
  const memberSince = user?.createdAt ? format(new Date(user.createdAt), 'MMMM d, yyyy') : '—';

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <UserCircleIcon className="w-5 h-5 text-primary-500" /> Profile Info
      </h2>

      <div className="flex items-center gap-4 mb-5">
        <Avatar src={user?.avatar?.url} alt={fullName} size="lg" />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white truncate">{fullName}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email || '—'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => save({ firstName: d.firstName.trim(), lastName: d.lastName.trim() }))} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="First Name" error={errors.firstName?.message}
            {...register('firstName', { required: 'First name is required', minLength: { value: 2, message: 'Min 2 characters' } })} />
          <Input label="Last Name" error={errors.lastName?.message}
            {...register('lastName', { required: 'Last name is required', minLength: { value: 2, message: 'Min 2 characters' } })} />
        </div>
        <div className="flex justify-end gap-2 items-center">
          <span className="text-xs text-gray-400 mr-auto">Member since {memberSince}</span>
          <Button type="submit" loading={isPending}>Save Info</Button>
        </div>
      </form>
    </div>
  );
}
