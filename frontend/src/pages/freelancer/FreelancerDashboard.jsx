import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Line } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js';
import { useFreelancerAnalytics } from '@/hooks/useAnalytics';
import { useOrderStats } from '@/hooks/useOrders';
import { useAuthStore } from '@/store/authStore';
import { useRecommendedJobs } from '@/hooks/useJobs';
import { userService } from '@/services/user.service';
import { SkeletonStats } from '@/components/ui/Skeleton';
import StarRating from '@/components/ui/StarRating';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import {
  BriefcaseIcon, DocumentTextIcon, CheckCircleIcon,
  CurrencyDollarIcon, StarIcon, ChatBubbleLeftRightIcon, ShoppingBagIcon,
  UserCircleIcon, EyeIcon, CalendarDaysIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatRate } from '@/utils/currency';
import { ArrowRight } from 'lucide-react';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function FreelancerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data, isLoading } = useFreelancerAnalytics();
  const { data: recData } = useRecommendedJobs();
  const { data: orderStatsData } = useOrderStats('freelancer');
  const analytics = data?.data;
  const recommended = recData?.data ?? [];
  const orderStats = orderStatsData?.data || {};

  const { data: profileData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => userService.getMyProfile().then(r => r.data),
  });
  const profile = profileData?.data;
  const completionScore = profile?.completionScore ?? 0;

  const earningsChartData = {
    labels: analytics?.monthlyEarnings?.map(m => MONTH_NAMES[m._id.month - 1]) ?? [],
    datasets: [{
      label: t('dashboard.freelancer.earningsChartLabel'),
      data: analytics?.monthlyEarnings?.map(m => m.earnings) ?? [],
      fill: true,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.08)',
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#6366f1',
    }],
  };

  const stats = [
    { icon: BriefcaseIcon, label: t('dashboard.freelancer.stats.activeProjects'), value: analytics?.activeProjects ?? 0, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', to: '/freelancer/projects?status=active' },
    { icon: DocumentTextIcon, label: t('dashboard.freelancer.stats.pendingProposals'), value: analytics?.pendingApplications ?? 0, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', to: '/freelancer/proposals?status=pending' },
    { icon: CheckCircleIcon, label: t('dashboard.freelancer.stats.completed'), value: analytics?.completedProjects ?? 0, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', to: '/freelancer/projects?status=completed' },
    { icon: ShoppingBagIcon, label: t('dashboard.freelancer.stats.serviceOrders'), value: orderStats.active ?? 0, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20', to: '/freelancer/service-orders' },
    { icon: CurrencyDollarIcon, label: t('dashboard.freelancer.stats.totalEarnings'), value: formatCurrency(analytics?.totalEarnings), color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20', to: '/freelancer/earnings' },
  ];

  return (
    <div className="page-container space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          icon={BriefcaseIcon}
          title={t('dashboard.freelancer.welcomeBack', { name: user?.firstName })}
          subtitle={t('dashboard.freelancer.subtitle')}
        />
      </motion.div>

      {/* Profile strength banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <UserCircleIcon className="w-5 h-5 text-primary-600" /> {t('dashboard.freelancer.profileStrength')}
              </p>
              <span className="text-sm font-bold text-primary-600">{completionScore}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full transition-all duration-700" style={{ width: `${completionScore}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {completionScore >= 100
                ? t('dashboard.freelancer.profileStrengthMessages.complete')
                : completionScore >= 70
                  ? t('dashboard.freelancer.profileStrengthMessages.goodProgress')
                  : t('dashboard.freelancer.profileStrengthMessages.incomplete')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/freelancer/profile" className="btn-primary btn-sm"><UserCircleIcon className="w-4 h-4" /> {t('dashboard.freelancer.actions.editProfile')}</Link>
            <Link to={`/profile/${user?._id}`} className="btn-secondary btn-sm"><EyeIcon className="w-4 h-4" /> {t('dashboard.freelancer.actions.preview')}</Link>
            <Link to="/freelancer/reviews" className="btn-secondary btn-sm"><StarIcon className="w-4 h-4" /> {t('dashboard.freelancer.actions.reviews')}</Link>
            <Link to="/freelancer/calendar" className="btn-secondary btn-sm"><CalendarDaysIcon className="w-4 h-4" /> {t('dashboard.freelancer.actions.availability')}</Link>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      {isLoading ? <SkeletonStats /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Link to={s.to} className="stat-card hover:shadow-card-hover transition-all duration-200 cursor-pointer block">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <p className="stat-value">{s.value}</p>
                <p className="stat-label">{s.label}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Earnings chart */}
        <div className="lg:col-span-2 card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{t('dashboard.freelancer.sections.earningsOverview')}</h2>
          {analytics?.monthlyEarnings?.length > 0 ? (
            <Line data={earningsChartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } }} />
          ) : (
            <EmptyState
              icon={CurrencyDollarIcon}
              title={t('dashboard.freelancer.empty.earnings.title')}
              description={t('dashboard.freelancer.empty.earnings.description')}
              className="py-10"
            />
          )}
        </div>

        {/* Recent reviews */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">{t('dashboard.freelancer.sections.recentReviews')}</h2>
            <span className="flex items-center gap-1 text-sm font-bold text-yellow-500">
              <StarIcon className="w-4 h-4" />{analytics?.averageRating?.toFixed(1) ?? '—'}
            </span>
          </div>
          {analytics?.recentReviews?.length ? (
            <div className="space-y-3">
              {analytics.recentReviews.map(r => (
                <div key={r._id} className="flex gap-2.5">
                  <Avatar src={r.reviewer?.avatar?.url} alt={r.reviewer?.firstName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white">{r.reviewer?.firstName} {r.reviewer?.lastName}</p>
                    <StarRating value={r.rating?.overall} readonly size="sm" />
                    <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{r.comment}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ChatBubbleLeftRightIcon}
              title={t('dashboard.freelancer.reviews.empty.title')}
              description={t('dashboard.freelancer.reviews.empty.description')}
              className="py-8"
            />
          )}
        </div>
      </div>

      {/* Recommended jobs */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('dashboard.freelancer.sections.recommendedJobs')}</h2>
          <Link to="/jobs" className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1">{t('dashboard.freelancer.actions.viewAll')} <ArrowRight size={14} /></Link>
        </div>
        {recommended.length === 0 ? (
          <EmptyState
            icon={BriefcaseIcon}
            title={t('dashboard.freelancer.recommendations.empty.title')}
            description={t('dashboard.freelancer.recommendations.empty.description')}
            action={<Link to="/freelancer/profile" className="btn-primary btn-sm mt-1">{t('dashboard.freelancer.recommendations.actions.completeProfile')}</Link>}
          />
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {recommended.slice(0, 5).map(({ job, score }) => job && (
              <div key={job._id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Link to={`/jobs/${job._id}`} className="text-sm font-semibold text-gray-900 dark:text-white hover:text-primary-600 block truncate">{job.title}</Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{formatCurrency(job.budget?.maxAmount, job.budget?.currency)}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400 capitalize">{job.experienceLevel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-semibold text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded-full">{score}% match</span>
                  <Link to={`/jobs/${job._id}`} className="btn-primary btn-sm">{t('dashboard.freelancer.actions.apply')}</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
