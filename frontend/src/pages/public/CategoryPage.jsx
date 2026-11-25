import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { categoryService } from '@/services/category.service';
import { userService } from '@/services/user.service';
import { jobService } from '@/services/job.service';
import Avatar from '@/components/ui/Avatar';
import StarRating from '@/components/ui/StarRating';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonStats } from '@/components/ui/Skeleton';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  UsersIcon,
  WrenchIcon,
  ArrowRightIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import CategoryIcon from '@/utils/categoryIcons';
import { formatCurrency, formatRate } from '@/utils/currency';

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="stat-card flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{value.toLocaleString()}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
      </div>
    </div>
  );
}

function SubcategoryCard({ sub, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.35 }}
      className="card card-hover group flex flex-col p-5"
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-100 dark:ring-primary-500/20 flex items-center justify-center flex-shrink-0">
          <CategoryIcon icon={sub.icon} size={22} className="text-primary-600 dark:text-primary-400" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{sub.name}</h3>
          {sub.slug && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub.slug}</p>}
        </div>
      </div>
      {sub.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 flex-1">{sub.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mb-4">
        <span className="inline-flex items-center gap-1">
          <BriefcaseIcon className="w-3.5 h-3.5 text-primary-500" />
          {(sub.activeJobs ?? 0).toLocaleString()} active {sub.activeJobs === 1 ? 'job' : 'jobs'}
        </span>
        {(sub.freelancers ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="w-3.5 h-3.5 text-success-500" />
            {(sub.freelancers ?? 0).toLocaleString()} freelancer{sub.freelancers === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <Link
        to={`/jobs?category=${sub._id}`}
        className="inline-flex items-center justify-between rounded-xl bg-gray-50 dark:bg-dark-700 px-4 py-2.5 text-sm font-semibold text-primary-600 dark:text-primary-400 transition-all group-hover:bg-primary-600 group-hover:text-white"
      >
        View Jobs
        <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}

export default function CategoryPage() {
  const { slug } = useParams();

  const { data: catData, isLoading } = useQuery({
    queryKey: ['category-by-slug', slug],
    queryFn: () => categoryService.getCategoryBySlug(slug).then(r => r.data),
    enabled: !!slug,
  });

  const category = catData?.data;

  const { data: jobsData } = useQuery({
    queryKey: ['category-jobs', category?._id],
    queryFn: () => jobService.getJobs({ category: category._id, limit: 6 }).then(r => r.data),
    enabled: !!category?._id,
  });

  const { data: freelancersData } = useQuery({
    queryKey: ['category-freelancers', category?._id],
    queryFn: () => userService.searchFreelancers({ category: category._id, limit: 6 }).then(r => r.data),
    enabled: !!category?._id,
  });

  if (isLoading) return <div className="premium-dark-page"><div className="page-container"><SkeletonStats /></div></div>;
  if (!category) return <div className="premium-dark-page"><div className="page-container text-center py-20"><h2 className="text-xl font-bold">Category not found</h2><Link to="/" className="text-primary-600 mt-4 inline-block">Go home</Link></div></div>;

  const jobs = jobsData?.data ?? [];
  const freelancers = freelancersData?.data ?? [];
  const subcategories = category.subcategories ?? [];

  const activeJobs = category.activeJobsCount ?? category.activeJobs ?? 0;
  const freelancerCount = category.freelancerCount ?? category.activeFreelancers ?? 0;
  const skillsCount = category.skillsCount ?? category.skillCount ?? 0;
  const accent = category.color || '#6366f1';

  return (
    <div className="premium-dark-page">
      <div className="page-container space-y-10 pb-16">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Home
        </Link>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary-950 via-[#14103a] to-secondary-950 ring-1 ring-white/10">
          <div aria-hidden className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: `${accent}22` }} />
          <div aria-hidden className="absolute -bottom-32 -left-16 w-[24rem] h-[24rem] rounded-full blur-3xl" style={{ backgroundColor: `${accent}18` }} />
          <div className="relative p-6 sm:p-10">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex items-start gap-5 min-w-0">
                <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                  <CategoryIcon icon={category.icon} size={36} className="text-white" />
                </span>
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight">{category.name}</h1>
                  {category.description && (
                    <p className="mt-2 text-sm sm:text-base text-white/70 max-w-2xl">{category.description}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 lg:ml-auto flex-shrink-0">
                <Link
                  to={`/jobs?category=${category._id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-dark-900 shadow-lg transition-all hover:gap-3"
                >
                  Browse Jobs <ArrowRightIcon className="w-4 h-4" />
                </Link>
                <Link
                  to={`/freelancers?category=${category._id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/20 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                >
                  Find Talent <UsersIcon className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={BriefcaseIcon} label="Active Jobs" value={activeJobs} />
          <StatCard icon={UsersIcon} label="Freelancers" value={freelancerCount} />
          <StatCard icon={WrenchIcon} label="Skills" value={skillsCount} />
        </div>

        {/* ── Subcategories ────────────────────────────────────── */}
        {subcategories.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Subcategories</h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">{subcategories.length} specializations</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {subcategories.map((sub, i) => (
                <SubcategoryCard key={sub._id} sub={sub} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Active Jobs & Top Freelancers ────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Jobs</h2>
              <Link to={`/jobs?category=${category._id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 dark:text-primary-400">
                View All <ChevronRightIcon className="w-4 h-4" />
              </Link>
            </div>
            {jobs.length === 0 ? (
              <div className="card p-8">
                <EmptyState icon={BriefcaseIcon} title="No active jobs yet"
                  description="There are no open jobs in this category right now." />
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map(job => (
                  <Link key={job._id} to={`/jobs/${job._id}`} className="card block p-4 hover:shadow-card-hover transition-all">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{job.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{formatCurrency(job.budget?.maxAmount)}</span>
                      {job.client && <span>{job.client.firstName}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Top Freelancers</h2>
              <Link to={`/freelancers?category=${category._id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 dark:text-primary-400">
                View All <ChevronRightIcon className="w-4 h-4" />
              </Link>
            </div>
            {freelancers.length === 0 ? (
              <div className="card p-8">
                <EmptyState icon={UsersIcon} title="No freelancers yet"
                  description="No freelancers have joined this category so far." />
              </div>
            ) : (
              <div className="space-y-3">
                {freelancers.map(item => {
                  const u = item.user || item;
                  const p = item.user ? item : {};
                  return (
                    <Link key={u._id} to={`/freelancers/${u._id}`} className="card block p-4 hover:shadow-card-hover transition-all">
                      <div className="flex items-center gap-3">
                        <Avatar src={u.avatar?.url} alt={`${u.firstName} ${u.lastName}`} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{u.firstName} {u.lastName}</p>
                          {p.tagline && <p className="text-xs text-gray-500 truncate">{p.tagline}</p>}
                          <div className="flex items-center gap-1 mt-0.5">
                            <StarRating value={u.stats?.averageRating ?? 0} readonly size="sm" />
                          </div>
                        </div>
                        {p.hourlyRate > 0 && <span className="text-sm font-bold text-gray-900 dark:text-white">{formatRate(p.hourlyRate)}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
