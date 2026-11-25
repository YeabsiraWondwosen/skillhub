import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { userService } from '@/services/user.service';
import { profileService } from '@/services/profile.service';
import Avatar from '@/components/ui/Avatar';
import StarRating from '@/components/ui/StarRating';
import { useAuthStore } from '@/store/authStore';
import {
  XMarkIcon, MapPinIcon, CalendarDaysIcon,
  ShieldCheckIcon, ChatBubbleLeftEllipsisIcon, BriefcaseIcon,
  ClockIcon, EyeIcon, FlagIcon,
  CheckCircleIcon, ArrowTopRightOnSquareIcon, HeartIcon,
  CalendarIcon, VideoCameraIcon, DocumentArrowDownIcon,
  UserGroupIcon, TrophyIcon, BoltIcon, FireIcon, RocketLaunchIcon,
  AcademicCapIcon, SparklesIcon, BanknotesIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { formatDistanceToNow, format } from 'date-fns';
import { formatRate } from '@/utils/currency';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const BADGE_CONFIG = {
  top_rated: { label: 'Top Rated', icon: TrophyIcon, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  rising_talent: { label: 'Rising Talent', icon: RocketLaunchIcon, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  expert_vetted: { label: 'Verified', icon: ShieldCheckIcon, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  skill_verified: { label: 'Skill Verified', icon: AcademicCapIcon, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  top_earner: { label: 'Top Earner', icon: BanknotesIcon, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  fast_responder: { label: 'Fast Responder', icon: BoltIcon, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  client_favorite: { label: 'Client Favorite', icon: HeartIcon, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
};

const TRUST_COLORS = { Excellent: 'text-green-600', Good: 'text-blue-600', Average: 'text-yellow-600', 'Needs Improvement': 'text-red-500' };
const AVAILABILITY_COLORS = { available: 'bg-green-500', busy: 'bg-yellow-500', vacation: 'bg-gray-400', offline: 'bg-red-400' };
const AVAILABILITY_LABELS = { available: 'Available Now', busy: 'Busy', vacation: 'On Vacation', offline: 'Offline' };

function TrustScoreRing({ score, level }) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative flex items-center gap-2">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <circle cx="22" cy="22" r="18" fill="none" stroke={score >= 70 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 22 22)" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{score}</span>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase">Trust Score</p>
        <p className={clsx('text-xs font-bold', TRUST_COLORS[level] || 'text-gray-500')}>{level}</p>
      </div>
    </div>
  );
}

function ProfileCardSkeleton() {
  return (
    <div className="animate-pulse p-5 space-y-4">
      <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      <div className="flex items-center gap-3 -mt-10">
        <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 ring-4 ring-white" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-200 dark:bg-gray-700 rounded-lg" />)}
      </div>
      <div className="space-y-2">
        {[1,2,3].map(i => <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />)}
      </div>
    </div>
  );
}

export default function ProfileCard({ userId, open, onClose, onMessage, onBookMeeting }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['profile-card', userId],
    queryFn: () => userService.getProfileCard(userId).then(r => r.data),
    enabled: open && !!userId,
    staleTime: 30000,
  });

  const { data: trustData } = useQuery({
    queryKey: ['trust-score', userId],
    queryFn: () => profileService.getTrustScore(userId).then(r => r.data),
    enabled: open && !!userId,
  });

  const { data: followStatus } = useQuery({
    queryKey: ['is-following', userId],
    queryFn: () => profileService.isFollowing(userId).then(r => r.data),
    enabled: open && !!userId && !!currentUser,
  });

  const { data: followerCount } = useQuery({
    queryKey: ['followers-count', userId],
    queryFn: () => profileService.getFollowersCount(userId).then(r => r.data),
    enabled: open && !!userId,
  });

  const followMutation = useMutation({
    mutationFn: () => followStatus?.data?.isFollowing ? profileService.unfollow(userId) : profileService.follow(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['is-following', userId] });
      qc.invalidateQueries({ queryKey: ['followers-count', userId] });
      toast.success(followStatus?.data?.isFollowing ? 'Unfollowed' : 'Following!');
    },
    onError: () => toast.error('Action failed'),
  });

  if (!open) return null;

  const profile = data?.data;
  const user = profile?.user;
  const prof = profile?.profile;
  const reviews = profile?.reviews;
  const trust = trustData?.data;
  const isFollowing = followStatus?.data?.isFollowing;
  const followers = followerCount?.data?.count || 0;

  const handleViewFullProfile = () => { onClose(); navigate(`/profile/${userId}`); };
  const handleMessage = () => { onClose(); if (onMessage) onMessage(userId); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            {isLoading ? <ProfileCardSkeleton /> : !user ? (
              <div className="p-8 text-center text-sm text-gray-500">User not found</div>
            ) : (
              <>
                {/* Cover + Header */}
                <div className="relative">
                  <div className="h-24 bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-600">
                    {user.introVideo?.url && (
                      <div className="absolute top-2 right-10 bg-black/30 rounded-full p-1">
                        <VideoCameraIcon className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <button onClick={onClose} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                  <div className="px-5 -mt-8 pb-3">
                    <div className="flex items-end gap-3">
                      <Avatar src={user.avatar?.url} alt={`${user.firstName} ${user.lastName}`} size="lg" online={user.isOnline} className="ring-4 ring-white dark:ring-dark-800" />
                      <div className="flex-1 min-w-0 pb-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{user.firstName} {user.lastName}</h3>
                          {user.isVerifiedFreelancer && <ShieldCheckIcon className="w-4 h-4 text-blue-500" />}
                          {user.badges?.slice(0, 2).map((b, i) => {
                            const cfg = BADGE_CONFIG[b.type];
                            if (!cfg) return null;
                            return <span key={i} className={clsx('text-[8px] font-bold px-1.5 py-0.5 rounded-full', cfg.color)}>{cfg.label}</span>;
                          })}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
                      </div>
                    </div>
                    {/* Online / Away / Offline */}
                    <div className="flex items-center gap-2 mt-2 text-[11px]">
                      <span className={clsx('w-2 h-2 rounded-full', AVAILABILITY_COLORS[user.isOnline ? 'available' : 'offline'])} />
                      <span className="text-gray-500">{user.isOnline ? 'Online' : user.lastSeen ? `Last seen ${formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true })}` : 'Offline'}</span>
                    </div>
                  </div>
                </div>

                {/* Scrollable */}
                <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
                  {prof?.tagline && <p className="text-sm text-gray-600 dark:text-gray-300">{prof.tagline}</p>}

                  {/* Trust Score + Stats */}
                  <div className="flex items-center gap-4 bg-gray-50 dark:bg-dark-700/50 rounded-xl p-3">
                    {trust && <TrustScoreRing score={trust.score} level={trust.level} />}
                    <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{reviews?.average?.overall?.toFixed(1) ?? user.stats?.averageRating?.toFixed(1) ?? '—'}</p>
                        <p className="text-[9px] text-gray-400 uppercase">Rating</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{reviews?.total ?? user.stats?.totalReviews ?? 0}</p>
                        <p className="text-[9px] text-gray-400 uppercase">Reviews</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{user.stats?.completedProjects ?? 0}</p>
                        <p className="text-[9px] text-gray-400 uppercase">Jobs</p>
                      </div>
                    </div>
                  </div>

                  {/* Location & Member */}
                  <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                    {(prof?.location?.country || user.country) && (
                      <span className="flex items-center gap-1"><MapPinIcon className="w-3 h-3" />
                        {[prof?.location?.city, prof?.location?.country || user.country].filter(Boolean).join(', ')}
                      </span>
                    )}
                    <span className="flex items-center gap-1"><CalendarDaysIcon className="w-3 h-3" /> Member {format(new Date(user.createdAt), 'MMM yyyy')}</span>
                    {prof?.hourlyRate > 0 && <span className="flex items-center gap-1"><BanknotesIcon className="w-3 h-3" />{formatRate(prof.hourlyRate)}</span>}
                  </div>

                  {/* Followers */}
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <UserGroupIcon className="w-3.5 h-3.5" /> {followers} followers
                  </div>

                  {/* Skills */}
                  {prof?.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {prof.skills.slice(0, 6).map((s, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium">{s.name}</span>
                      ))}
                      {prof.skills.length > 6 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">+{prof.skills.length - 6}</span>}
                    </div>
                  )}

                  {/* Bio */}
                  {prof?.bio && <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">{prof.bio}</p>}

                  {/* AI Summary */}
                  {trust && (
                    <div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/10 dark:to-secondary-900/10 rounded-xl p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <SparklesIcon className="w-3.5 h-3.5 text-primary-500" />
                        <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase">AI Trust Analysis</span>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400">
                        Trust score {trust.score}/100 — {trust.level}. {user.isEmailVerified ? 'Email verified.' : ''} {user.isVerifiedFreelancer ? 'Identity verified.' : ''} {user.stats?.completedProjects > 5 ? `${user.stats.completedProjects} projects completed.` : ''}
                      </p>
                    </div>
                  )}

                  {/* Reviews preview */}
                  {reviews?.recent?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Recent Reviews</h4>
                      {reviews.recent.slice(0, 2).map((r, i) => (
                        <div key={r._id || i} className="py-2 border-b border-gray-50 dark:border-gray-700/30 last:border-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Avatar src={r.reviewer?.avatar?.url} alt={r.reviewer?.firstName} size="xs" />
                            <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{r.reviewer?.firstName} {r.reviewer?.lastName}</span>
                            <StarRating value={r.rating?.overall || 0} readonly size="xs" showValue={false} />
                          </div>
                          <p className="text-[10px] text-gray-500 line-clamp-1">{r.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

                {/* Actions */}
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 space-y-2 bg-gray-50/50 dark:bg-dark-700/30">
                  <div className="flex gap-2">
                    <button onClick={handleViewFullProfile} className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center justify-center gap-1">
                      <EyeIcon className="w-3.5 h-3.5" /> Full Profile
                    </button>
                    <button onClick={handleMessage} className="flex-1 px-3 py-2 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 rounded-lg transition-colors flex items-center justify-center gap-1">
                      <ChatBubbleLeftEllipsisIcon className="w-3.5 h-3.5" /> Message
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {currentUser?._id !== userId && (
                      <button onClick={() => followMutation.mutate()} disabled={followMutation.isPending}
                        className={clsx('flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1',
                          isFollowing ? 'text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20' : 'text-pink-600 bg-pink-50 hover:bg-pink-100 dark:bg-pink-900/20')}>
                        {isFollowing ? <HeartSolidIcon className="w-3.5 h-3.5" /> : <HeartIcon className="w-3.5 h-3.5" />}
                        {isFollowing ? 'Unfollow' : 'Follow'}
                      </button>
                    )}
                    {user.role === 'freelancer' && (
                      <button onClick={() => onBookMeeting?.(user)}
                        className="flex-1 px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 rounded-lg transition-colors flex items-center justify-center gap-1">
                        <CalendarIcon className="w-3.5 h-3.5" /> Meeting
                      </button>
                    )}
                    {prof?.resume?.url && (
                      <a href={prof.resume.url} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 rounded-lg transition-colors flex items-center gap-1">
                        <DocumentArrowDownIcon className="w-3.5 h-3.5" /> CV
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
