import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { profileService } from '@/services/profile.service';
import { HeartIcon, BellIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { clsx } from 'clsx';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function FollowButton({ userId, size = 'md', showCount = false, className }) {
  const qc = useQueryClient();
  const [showOptions, setShowOptions] = useState(false);

  const { data: followStatus } = useQuery({
    queryKey: ['is-following', userId],
    queryFn: () => profileService.isFollowing(userId).then(r => r.data),
    enabled: !!userId,
  });

  const { data: countData } = useQuery({
    queryKey: ['followers-count', userId],
    queryFn: () => profileService.getFollowersCount(userId).then(r => r.data),
    enabled: !!userId,
  });

  const followMutation = useMutation({
    mutationFn: () =>
      followStatus?.data?.isFollowing
        ? profileService.unfollow(userId)
        : profileService.follow(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['is-following', userId] });
      qc.invalidateQueries({ queryKey: ['followers-count', userId] });
      toast.success(followStatus?.data?.isFollowing ? 'Unfollowed' : 'Following!');
    },
    onError: () => toast.error('Action failed'),
  });

  const isFollowing = followStatus?.data?.isFollowing;
  const count = countData?.data?.count || 0;

  const sizes = {
    sm: 'px-2.5 py-1 text-xs gap-1',
    md: 'px-4 py-2 text-sm gap-1.5',
    lg: 'px-5 py-2.5 text-sm gap-2',
  };

  return (
    <div className={clsx('relative inline-flex items-center', className)}>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => followMutation.mutate()}
        disabled={followMutation.isPending}
        className={clsx(
          'inline-flex items-center font-semibold rounded-lg transition-all duration-200',
          sizes[size],
          isFollowing
            ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
            : 'bg-pink-50 text-pink-600 hover:bg-pink-100 dark:bg-pink-900/20 dark:text-pink-400 dark:hover:bg-pink-900/30'
        )}
      >
        {isFollowing ? (
          <HeartSolidIcon className="w-4 h-4" />
        ) : (
          <HeartIcon className="w-4 h-4" />
        )}
        {followMutation.isPending ? '...' : isFollowing ? 'Following' : 'Follow'}
      </motion.button>
      {showCount && (
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
          {count} {count === 1 ? 'follower' : 'followers'}
        </span>
      )}
    </div>
  );
}
