import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { userService } from '@/services/user.service';
import { reviewService } from '@/services/review.service';
import { messageService } from '@/services/message.service';
import { useAuthStore } from '@/store/authStore';
import ProfileSkeleton from '@/components/freelancerProfile/ProfileSkeleton';
import ReviewsSection from '@/components/freelancerProfile/ReviewsSection';
import ClientProfileHeader from '@/components/clientProfile/ClientProfileHeader';
import ClientAboutSection from '@/components/clientProfile/ClientAboutSection';
import ClientStatsSection from '@/components/clientProfile/ClientStatsSection';
import RecentJobsSection from '@/components/clientProfile/RecentJobsSection';
import ContractsSection from '@/components/clientProfile/ContractsSection';
import FollowButton from '@/components/profile/FollowButton';
import { PaperAirplaneIcon, BriefcaseIcon } from '@heroicons/react/24/outline';

export default function ClientProfilePage({ userId: userIdProp }) {
  const { userId: userIdParam } = useParams();
  const userId = userIdProp || userIdParam;
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = !!authUser && !!accessToken;

  const { data: profileData, isLoading, isError, refetch } = useQuery({
    queryKey: ['client-profile', userId],
    queryFn: () => userService.getClientProfile(userId).then((r) => r.data),
    enabled: !!userId,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', userId],
    queryFn: () => reviewService.getUserReviews(userId, { page: 1, limit: 6 }).then((r) => r.data),
    enabled: !!userId,
  });

  if (isLoading) return <div className="premium-dark-page"><ProfileSkeleton /></div>;

  if (isError) {
    return (
      <div className="premium-dark-page">
        <div className="page-container">
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium text-gray-400">Something went wrong while loading this profile.</p>
            <button onClick={() => refetch()} className="btn-primary">Try again</button>
          </div>
        </div>
      </div>
    );
  }

  const { user, profile, clientStats = {}, recentJobs = [] } = profileData?.data ?? {};
  if (!user || !profile) {
    return (
      <div className="premium-dark-page">
        <div className="page-container">
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium text-gray-400">Client not found or profile is private.</p>
            <button onClick={() => navigate('/freelancers')} className="btn-secondary">Browse freelancers</button>
          </div>
        </div>
      </div>
    );
  }

  const isOwnProfile = !!authUser && authUser._id === user._id;
  const reviews = reviewsData?.data ?? [];
  const reviewsMeta = reviewsData?.meta?.stats;

  const requireAuth = () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to continue');
      navigate('/auth/login');
      return false;
    }
    return true;
  };

  const handleMessage = async () => {
    if (!requireAuth()) return;
    try {
      const res = await messageService.startConversation(user._id);
      const conv = res.data?.data || res.data;
      navigate(`/messages/${conv._id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to start conversation');
    }
  };

  const handleViewJobs = () => {
    document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="premium-dark-page">
      <div className="page-container pb-24 lg:pb-10">
        <div className="space-y-5">
          <ClientProfileHeader
            user={user}
            profile={profile}
            isOwnProfile={isOwnProfile}
            onMessage={handleMessage}
            onViewJobs={handleViewJobs}
          />

          <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
            {/* Left: about / company information */}
            <aside className="order-1 space-y-5 lg:order-1 lg:col-span-4">
              <ClientAboutSection user={user} profile={profile} />
            </aside>

            {/* Main: hiring activity */}
            <main className="order-2 space-y-5 lg:order-2 lg:col-span-8">
              <ClientStatsSection stats={clientStats} reviewsReceived={reviewsMeta?.totalReviews ?? null} />
              <div id="jobs" className="scroll-mt-6">
                <RecentJobsSection jobs={recentJobs} />
              </div>
              <ContractsSection stats={clientStats} />
              <ReviewsSection
                reviews={reviews}
                meta={reviewsMeta}
                title={reviewsMeta?.totalReviews ? `Reviews received (${reviewsMeta.totalReviews})` : 'Reviews received'}
                emptyTitle="No reviews yet"
                emptyHint="This client hasn't received any reviews yet."
              />
            </main>
          </div>
        </div>

        {/* Mobile sticky action bar */}
        {!isOwnProfile && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0f2c]/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-xl items-center gap-3">
              <button onClick={handleMessage} className="btn-secondary flex-1">
                <PaperAirplaneIcon className="h-4 w-4" />
                Message
              </button>
              <button onClick={handleViewJobs} className="btn-primary flex-1">
                <BriefcaseIcon className="h-4 w-4" />
                Open Jobs
              </button>
              <FollowButton userId={user._id} size="md" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
