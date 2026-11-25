import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { userService } from '@/services/user.service';
import { reviewService } from '@/services/review.service';
import { messageService } from '@/services/message.service';
import { profileService } from '@/services/profile.service';
import { useFreelancerCatalogs } from '@/hooks/useCatalogs';
import { useAuthStore } from '@/store/authStore';
import ProfileSkeleton from '@/components/freelancerProfile/ProfileSkeleton';
import ProfileHeader from '@/components/freelancerProfile/ProfileHeader';
import ProfileSidebar from '@/components/freelancerProfile/ProfileSidebar';
import ProfileStats from '@/components/freelancerProfile/ProfileStats';
import ProfileActionCard from '@/components/freelancerProfile/ProfileActionCard';
import ClientProfilePage from '@/pages/public/ClientProfilePage';
import AboutSection from '@/components/freelancerProfile/AboutSection';
import SkillsSection from '@/components/freelancerProfile/SkillsSection';
import ExperienceSection from '@/components/freelancerProfile/ExperienceSection';
import EducationSection from '@/components/freelancerProfile/EducationSection';
import CertificationsSection from '@/components/freelancerProfile/CertificationsSection';
import PortfolioSection from '@/components/freelancerProfile/PortfolioSection';
import CatalogsSection from '@/components/freelancerProfile/CatalogsSection';
import ReviewsSection from '@/components/freelancerProfile/ReviewsSection';
import WorkHistorySection from '@/components/freelancerProfile/WorkHistorySection';
import LanguagesSection from '@/components/freelancerProfile/LanguagesSection';
import InviteFreelancerModal from '@/components/freelancerProfile/InviteFreelancerModal';
import { PaperAirplaneIcon, UserPlusIcon } from '@heroicons/react/24/outline';

export default function FullProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = !!authUser && !!accessToken;
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: profileData, isLoading, isError, refetch } = useQuery({
    queryKey: ['full-profile', userId],
    queryFn: () => userService.getFullProfile(userId).then((r) => r.data),
    enabled: !!userId,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', userId],
    queryFn: () => reviewService.getUserReviews(userId, { page: 1, limit: 6 }).then((r) => r.data),
    enabled: !!userId,
  });

  const { data: followerData } = useQuery({
    queryKey: ['followers-count', userId],
    queryFn: () => profileService.getFollowersCount(userId).then((r) => r.data),
    enabled: !!userId,
  });

  const { data: catalogsData, isLoading: isCatalogsLoading } = useFreelancerCatalogs(userId, { page: 1, limit: 6 });
  const catalogs = catalogsData?.data?.data ?? [];
  const hasServices = !isCatalogsLoading && catalogs.length > 0;

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

  const { user, profile, reputation } = profileData?.data ?? {};
  if (!user || !profile) {
    return (
      <div className="premium-dark-page">
        <div className="page-container">
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium text-gray-400">Profile not found or is private.</p>
            <button onClick={() => navigate('/freelancers')} className="btn-secondary">Browse freelancers</button>
          </div>
        </div>
      </div>
    );
  }

  const isOwnProfile = !!authUser && authUser._id === user._id;
  if (user.role === 'client') {
    return <ClientProfilePage userId={userId} />;
  }
  const reviews = reviewsData?.data ?? [];
  const reviewsMeta = reviewsData?.meta?.stats;
  const followers = followerData?.data?.count ?? 0;

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

  const handleInvite = () => {
    if (!requireAuth()) return;
    setInviteOpen(true);
  };

  const handleViewServices = () => {
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="premium-dark-page">
      <div className="page-container pb-24 lg:pb-10">
        <div className="space-y-5">
          <ProfileHeader
            user={user}
            profile={profile}
            onMessage={handleMessage}
            onInvite={handleInvite}
            onShare={() => {}}
            showActions={false}
          />

          <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
            {/* Right: sticky actions (first on mobile) */}
            <aside className="order-1 lg:order-3 lg:col-span-3">
              <ProfileActionCard
                user={user}
                profile={profile}
                onMessage={handleMessage}
                onInvite={handleInvite}
                onViewServices={handleViewServices}
                hasServices={hasServices}
              />
            </aside>

            {/* Left: profile quick facts */}
            <aside className="order-2 space-y-5 lg:order-1 lg:col-span-3">
              <ProfileSidebar user={user} profile={profile} reviewsMeta={reviewsMeta} />
            </aside>

            {/* Center: content sections */}
            <main className="order-3 space-y-5 lg:order-2 lg:col-span-6">
              <ProfileStats
                user={user}
                reputation={reputation}
                reviewsMeta={reviewsMeta}
                catalogsCount={catalogs.length}
                followers={followers}
              />
              <AboutSection profile={profile} />
              <SkillsSection skills={profile.skills} />
              <ExperienceSection items={profile.experience} />
              <EducationSection items={profile.education} />
              <CertificationsSection items={profile.certifications} />
              <PortfolioSection items={profile.portfolio} />
              <div id="services" className="scroll-mt-6">
                <CatalogsSection userId={userId} user={user} />
              </div>
              <ReviewsSection reviews={reviews} meta={reviewsMeta} />
              <WorkHistorySection user={user} reputation={reputation} />
              <LanguagesSection profile={profile} />
            </main>
          </div>
        </div>

        {/* Mobile sticky action bar */}
        {!isOwnProfile && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0f2c]/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-xl gap-3">
              <button onClick={handleMessage} className="btn-secondary flex-1">
                <PaperAirplaneIcon className="h-4 w-4" />
                Message
              </button>
              <button onClick={handleInvite} className="btn-primary flex-1">
                <UserPlusIcon className="h-4 w-4" />
                Invite to Job
              </button>
            </div>
          </div>
        )}

        <InviteFreelancerModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          freelancerId={user._id}
          freelancerName={[user.firstName, user.lastName].filter(Boolean).join(' ') || 'this freelancer'}
        />
      </div>
    </div>
  );
}
