import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { userService } from '@/services/user.service';
import { useAuthStore } from '@/store/authStore';
import Avatar from '@/components/ui/Avatar';

export default function AvatarSection() {
  const { user, updateUser } = useAuthStore();
  const qc = useQueryClient();

  const { mutate: upload, isPending } = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('avatar', file);
      return userService.uploadAvatar(fd);
    },
    onSuccess: (res) => {
      updateUser({ avatar: res.data?.data?.avatar });
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      qc.invalidateQueries({ queryKey: ['freelancer', user?._id] });
      toast.success('Avatar updated!');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to upload avatar'),
  });

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <PhotoIcon className="w-5 h-5 text-primary-500" /> Avatar
      </h2>
      <div className="flex items-center gap-4">
        <Avatar src={user?.avatar?.url} alt="Avatar" size="xl" />
        <div className="space-y-2">
          <label className="cursor-pointer">
            <span className="btn-secondary inline-flex items-center gap-2">
              {isPending ? 'Uploading…' : 'Upload new photo'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
          <p className="text-xs text-gray-400">Square JPG, PNG or GIF. Max 5MB.</p>
        </div>
      </div>
    </div>
  );
}
