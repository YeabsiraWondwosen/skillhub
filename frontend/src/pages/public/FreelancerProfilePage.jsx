import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { userService } from '@/services/user.service';
import { reviewService } from '@/services/review.service';
import { messageService } from '@/services/message.service';
import { useFreelancerCatalogs } from '@/hooks/useCatalogs';
import { useAuthStore } from '@/store/authStore';
import ProfileSkeleton from '@/components/freelancerProfile/ProfileSkeleton';
import ProfileHeader from '@/components/freelancerProfile/ProfileHeader';
import ProfileActionCard from '@/components/freelancerProfile/ProfileActionCard';
import ProfileSidebar from '@/components/freelancerProfile/ProfileSidebar';
import AboutSection from '@/components/freelancerProfile/AboutSection';
import SkillsSection from '@/components/freelancerProfile/SkillsSection';
import ExperienceSection from '@/components/freelancerProfile/ExperienceSection';
import EducationSection from '@/components/freelancerProfile/EducationSection';
import CertificationsSection from '@/components/freelancerProfile/CertificationsSection';
import PortfolioSection from '@/components/freelancerProfile/PortfolioSection';
import CatalogsSection from '@/components/freelancerProfile/CatalogsSection';
import ReviewsSection from '@/components/freelancerProfile/ReviewsSection';
import InviteFreelancerModal from '@/components/freelancerProfile/InviteFreelancerModal';
import MeetingBookingModal from '@/components/meetings/MeetingBookingModal';
import { PaperAirplaneIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

export default function FreelancerProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = !!authUser && !!accessToken;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  const { data: profileData, isLoading, isError, refetch } = useQuery({
    queryKey: ['freelancer', userId],
    queryFn: () => userService.getFreelancerProfile(userId).then((r) => r.data),
    enabled: !!userId,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', userId],
    queryFn: () => reviewService.getUserReviews(userId, { page: 1, limit: 6 }).then((r) => r.data),
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

  const { user, profile } = profileData?.data ?? {};
  if (!user || !profile) {
    return (
      <div className="premium-dark-page">
        <div className="page-container">
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium text-gray-400">Freelancer not found or profile is private.</p>
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

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Profile link copied to clipboard');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const handleInvite = () => {
    if (!requireAuth()) return;
    setInviteOpen(true);
  };

  const handleBookMeeting = () => {
    if (!requireAuth()) return;
    if (authUser?.role !== 'client') {
      toast.error('Only client accounts can book meetings');
      return;
    }
    setBookingOpen(true);
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
            onShare={handleShare}
          />

          <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
            <main className="space-y-5 lg:col-span-8">
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
            </main>

            <aside className="space-y-5 lg:col-span-4">
              <div className="hidden lg:block">
                <ProfileActionCard
                  user={user}
                  profile={profile}
                  onMessage={handleMessage}
                  onInvite={handleInvite}
                  onBookMeeting={handleBookMeeting}
                  onViewServices={handleViewServices}
                  hasServices={hasServices}
                />
              </div>
              <ProfileSidebar user={user} profile={profile} reviewsMeta={reviewsMeta} />
            </aside>
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
              <button onClick={handleBookMeeting} className="btn-primary flex-1">
                <CalendarDaysIcon className="h-4 w-4" />
                Book Meeting
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

        <MeetingBookingModal
          open={bookingOpen}
          onClose={() => setBookingOpen(false)}
          freelancer={user}
        />
      </div>
    </div>
  );
}
