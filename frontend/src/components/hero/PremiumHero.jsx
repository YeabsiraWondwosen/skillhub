import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  Squares2X2Icon,
  AcademicCapIcon,
  ArrowRightIcon,
  BoltIcon,
  CheckIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useCategoryTree } from '@/hooks/useCategories';
import CategoryIcon from '@/utils/categoryIcons';
import { usePublicStats } from '@/hooks/useAnalytics';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

function hexToRgba(hex, alpha) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!match) return `rgba(99, 102, 241, ${alpha})`;
  return `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${alpha})`;
}

function Float({ children, className = '', entranceDelay = 0, floatDelay = 0, duration = 6 }) {
  return (
    <div className={`absolute z-20 ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, delay: entranceDelay, ease: 'easeOut' }}
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay: floatDelay }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}

function CategoryChip({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
        <Icon className="h-4 w-4 text-primary-300" />
      </span>
      <div>
        <p className="text-base font-black leading-none text-white">{value}</p>
        <p className="mt-1 text-[11px] leading-none text-white/55">{label}</p>
      </div>
    </div>
  );
}

function TrustCard({ icon: Icon, gradient, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#131a3d]/80 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg shadow-black/30`}
      >
        <Icon className="h-4 w-4 text-white" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-white">{title}</p>
        <p className="mt-0.5 truncate text-[11px] text-white/60">{subtitle}</p>
      </div>
    </div>
  );
}

function CategoryShowcase({ tree, t }) {
  if (!tree.length) return null;

  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      <div
        aria-hidden="true"
        className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-primary-500/25 via-secondary-500/15 to-transparent blur-2xl"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-6"
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 shadow-lg shadow-primary-500/30">
            <Squares2X2Icon className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="text-sm font-bold text-white">{t('hero.exploreCategoriesTitle')}</p>
            <p className="text-xs text-white/50">{t('hero.exploreCategoriesSub')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {tree.slice(0, 8).map((category) => {
            const subs = category.subcategories ?? [];
            return (
              <Link
                key={category._id || category.slug}
                to={`/categories/${category.slug}`}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.09]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                    style={{ backgroundColor: hexToRgba(category.color, 0.18) }}
                  >
                    {category.icon ? (
                      <CategoryIcon icon={category.icon} size={18} className="text-white/90" />
                    ) : (
                      <CubeIcon className="h-5 w-5 text-white" />
                    )}
                  </span>
                  <p className="min-w-0 truncate text-xs font-bold text-white">{category.name}</p>
                </div>
                {subs.length > 0 && (
                  <p className="mt-2 truncate text-[10px] text-white/50">
                    {subs
                      .slice(0, 3)
                      .map((sub) => sub.name)
                      .join(' · ')}
                  </p>
                )}
              </Link>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-primary-600/20 via-secondary-600/15 to-transparent px-4 py-3">
          <p className="text-xs font-semibold text-white">{t('hero.categoryFooter')}</p>
          <ArrowRightIcon className="h-4 w-4 shrink-0 text-primary-200" />
        </div>
      </motion.div>

      <Float className="-top-4 left-2 sm:left-4" entranceDelay={0.9} floatDelay={0.4} duration={5.5}>
        <TrustCard
          icon={UserPlusIcon}
          gradient="from-primary-500 to-secondary-600"
          title={t('hero.freeToJoin')}
          subtitle={t('hero.freeToJoinSub')}
        />
      </Float>

      <Float className="-top-4 right-2 sm:right-4" entranceDelay={1.05} floatDelay={1.6} duration={6}>
        <TrustCard
          icon={CheckBadgeIcon}
          gradient="from-emerald-500 to-teal-600"
          title={t('hero.verifiedProfessionals')}
          subtitle={t('hero.verifiedProfessionalsSub')}
        />
      </Float>

      <Float className="-bottom-4 left-2 sm:left-4" entranceDelay={1.2} floatDelay={2.8} duration={6.5}>
        <TrustCard
          icon={ShieldCheckIcon}
          gradient="from-sky-500 to-blue-600"
          title={t('hero.securePayments')}
          subtitle={t('hero.securePaymentsSub')}
        />
      </Float>

      <Float className="-bottom-4 right-2 sm:right-4" entranceDelay={1.35} floatDelay={4} duration={7}>
        <TrustCard
          icon={SparklesIcon}
          gradient="from-violet-500 to-fuchsia-600"
          title={t('hero.aiMatching')}
          subtitle={t('hero.aiMatchingSub')}
        />
      </Float>
    </div>
  );
}

export default function PremiumHero() {
  const { t } = useTranslation();

  const { data: statsData, isLoading: statsLoading } = usePublicStats();

  const { data: treeData } = useCategoryTree();
  const tree = treeData?.data ?? [];

  const stats = useMemo(() => {
    const mainCategories = Number(statsData?.categories) || tree.length;
    const skills = Number(statsData?.skills) || 0;
    return { mainCategories, skills };
  }, [statsData, tree]);

  return (
    <section className="relative isolate overflow-hidden bg-[#070b20]">
      <div aria-hidden="true" className="absolute inset-0 -z-20 bg-gradient-to-br from-[#0a0f2c] via-[#0b1136] to-[#1a0b33]" />
      <div aria-hidden="true" className="absolute -top-40 -left-32 -z-10 h-[34rem] w-[34rem] rounded-full bg-primary-600/20 blur-[120px]" />
      <div aria-hidden="true" className="absolute top-1/3 -right-40 -z-10 h-[30rem] w-[30rem] rounded-full bg-secondary-600/20 blur-[120px]" />
      <div aria-hidden="true" className="absolute bottom-0 left-1/3 -z-10 h-[24rem] w-[24rem] rounded-full bg-sky-500/10 blur-[100px]" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-black/20 to-transparent" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:px-8 lg:pb-28 lg:pt-32">
        <div className="grid items-center gap-16 md:grid-cols-[1.05fr_0.95fr] md:gap-12 lg:gap-16 xl:gap-20">
          <motion.div variants={container} initial="hidden" animate="show" className="max-w-xl lg:max-w-none">
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md"
            >
              <SparklesIcon className="h-3.5 w-3.5 text-primary-300" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
                {t('hero.eyebrow')}
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl xl:text-6xl"
            >
              {t('hero.headlineFind')}
              <br />
              <span className="bg-gradient-to-r from-primary-300 via-secondary-300 to-primary-200 bg-clip-text text-transparent">
                {t('hero.headlineBuild')}
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-5 max-w-xl text-base leading-relaxed text-white/55 sm:text-lg">
              {t('hero.description')}
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link
                to="/freelancers"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-secondary-600 px-7 py-4 text-base font-bold text-white shadow-xl shadow-primary-900/40 transition-all duration-300 hover:shadow-2xl hover:shadow-primary-700/40 hover:brightness-110 active:scale-[0.98]"
              >
                {t('hero.findTalent')}
                <ArrowRightIcon className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/auth/register?role=freelancer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-base font-bold text-white backdrop-blur-md transition-all duration-300 hover:border-white/25 hover:bg-white/10 active:scale-[0.98]"
              >
                <BoltIcon className="h-5 w-5 text-yellow-300" />
                {t('hero.startFreelancing')}
              </Link>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/40"
            >
              <span className="inline-flex items-center gap-1.5">
                <CheckIcon className="h-4 w-4 text-emerald-400" />
                {t('hero.freeToJoin')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckIcon className="h-4 w-4 text-emerald-400" />
                {t('hero.verifiedProfessionals')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckIcon className="h-4 w-4 text-emerald-400" />
                {t('hero.securePayments')}
              </span>
            </motion.div>

            {statsLoading ? (
              <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
                <div className="h-[58px] w-44 animate-pulse rounded-2xl bg-white/5" />
                <div className="h-[58px] w-44 animate-pulse rounded-2xl bg-white/5" />
              </motion.div>
            ) : stats.mainCategories > 0 || stats.skills > 0 ? (
              <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
                <CategoryChip
                  icon={Squares2X2Icon}
                  value={`${stats.mainCategories}`}
                  label={t('hero.categoriesLabel')}
                />
                <CategoryChip
                  icon={AcademicCapIcon}
                  value={`${stats.skills}`}
                  label={t('hero.skillsLabel')}
                />
              </motion.div>
            ) : null}
          </motion.div>

          <div className="pt-2 md:pt-0">
            <CategoryShowcase tree={tree} t={t} />
          </div>
        </div>
      </div>
    </section>
  );
}
