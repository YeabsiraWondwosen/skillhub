import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCategoryTree } from '@/hooks/useCategories';
import { usePublicStats } from '@/hooks/useAnalytics';
import PremiumHero from '@/components/hero/PremiumHero';
import ImageGallery from '@/components/hero/ImageGallery';
import BrowseCategories from '@/components/home/BrowseCategories';
import {
  BriefcaseIcon, ShieldCheckIcon, CurrencyDollarIcon,
  StarIcon, BoltIcon, ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon, UserGroupIcon, DocumentTextIcon,
  WalletIcon, CheckBadgeIcon, RocketLaunchIcon,
  AcademicCapIcon, CommandLineIcon, ShieldCheckIcon as ShieldIcon,
  HandRaisedIcon, ArrowTrendingUpIcon, GiftIcon,
} from '@heroicons/react/24/outline';

const FEATURES_KEYS = ['multiCategory', 'escrow', 'fees', 'verified', 'aiMatch', 'workspace'];
const FEATURES_ICONS = [BriefcaseIcon, ShieldCheckIcon, CurrencyDollarIcon, StarIcon, BoltIcon, ChatBubbleLeftRightIcon];
const FEATURES_IMAGES = [
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&h=400&fit=crop',
];

const CLIENT_STEP_KEYS = ['step1','step2','step3','step4','step5','step6','step7'];
const CLIENT_STEP_ICONS = [DocumentTextIcon, CommandLineIcon, UserGroupIcon, WalletIcon, ChatBubbleLeftRightIcon, CheckBadgeIcon, ArrowTrendingUpIcon];
const CLIENT_STEP_COLORS = ['from-blue-500 to-indigo-600','from-violet-500 to-purple-600','from-emerald-500 to-teal-600','from-amber-500 to-orange-600','from-cyan-500 to-blue-600','from-green-500 to-emerald-600','from-rose-500 to-pink-600'];

const FREELANCER_STEP_ICONS = [AcademicCapIcon, MagnifyingGlassIcon, RocketLaunchIcon, HandRaisedIcon, ShieldIcon, CurrencyDollarIcon, GiftIcon];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stepVariants = {
  hidden: (isLeft) => ({ opacity: 0, x: isLeft ? -24 : 24, y: 12 }),
  show: (isLeft) => ({ opacity: 1, x: 0, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }),
};

function formatStat(value, suffix = '+') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M${suffix}`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k${suffix}`;
  return `${n}${suffix}`;
}

function HowItWorks() {
  const [activeTab, setActiveTab] = useState('client');
  const { t } = useTranslation();
  const isClient = activeTab === 'client';

  const steps = CLIENT_STEP_KEYS.map((key, i) => ({
    step: `0${i + 1}`,
    icon: isClient ? CLIENT_STEP_ICONS[i] : FREELANCER_STEP_ICONS[i],
    title: t(`howItWorks.${activeTab}s.${key}.title`),
    desc: t(`howItWorks.${activeTab}s.${key}.desc`),
    color: CLIENT_STEP_COLORS[i],
  }));

  return (
    <section className="relative overflow-hidden bg-gray-50 dark:bg-dark-900/50">
      <div className="absolute -top-32 right-[-12%] w-[520px] h-[520px] rounded-full bg-primary-200/40 dark:bg-primary-500/10 blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-[-12%] left-[-12%] w-[460px] h-[460px] rounded-full bg-secondary-200/40 dark:bg-secondary-500/10 blur-3xl pointer-events-none" aria-hidden="true" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="text-center mb-12 sm:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 text-sm font-semibold mb-5"
          >
            <BoltIcon className="w-4 h-4" />
            {t('howItWorks.badge')}
          </motion.div>
          <motion.h2
            id="how-it-works-title"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4 tracking-tight"
          >
            {t('howItWorks.title')}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed"
          >
            {t('howItWorks.subtitle')}
          </motion.p>
        </div>

        <div className="flex justify-center mb-12 sm:mb-16">
          <div className="inline-flex bg-white dark:bg-dark-800 rounded-2xl p-1.5 border border-gray-200 dark:border-white/10 shadow-sm">
            <button
              onClick={() => setActiveTab('client')}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                isClient
                  ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-500/25'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {t('howItWorks.forClients')}
            </button>
            <button
              onClick={() => setActiveTab('freelancer')}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                !isClient
                  ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-500/25'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {t('howItWorks.forFreelancers')}
            </button>
          </div>
        </div>

        <div key={activeTab} className="relative">
          <div className="absolute left-[28px] top-0 bottom-0 w-px bg-gradient-to-b from-primary-200 via-primary-400/50 to-primary-200 dark:from-primary-500/15 dark:via-primary-500/35 dark:to-primary-500/15 md:left-1/2" aria-hidden="true" />

          <div className="space-y-8 md:space-y-10">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isLeft = i % 2 === 0;
              return (
                <motion.div
                  key={s.step}
                  custom={isLeft}
                  variants={stepVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.3 }}
                  className="relative pl-[80px] md:pl-0"
                >
                  <div className="absolute left-0 top-3 z-10 md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
                    <motion.div
                      whileHover={{ scale: 1.12 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                      className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-primary-500/25 ring-4 ring-gray-50 dark:ring-dark-900"
                    >
                      <span className="text-sm font-black tracking-wider">{s.step}</span>
                    </motion.div>
                  </div>

                  <div className={`md:w-[calc(50%-56px)] ${isLeft ? 'md:mr-auto' : 'md:ml-auto'}`}>
                    <motion.div
                      whileHover={{ y: -4 }}
                      className="bg-white dark:bg-dark-800 rounded-2xl shadow-card hover:shadow-card-hover ring-1 ring-gray-100 dark:ring-white/10 p-6 transition-all duration-300"
                    >
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ${s.color} text-white shadow-sm mb-3`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1.5 leading-snug">{s.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.desc}</p>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { t } = useTranslation();

  const { data: treeData } = useCategoryTree();
  const tree = treeData?.data ?? [];
  const categoryCount = tree.length;
  const subcategoryCount = tree.reduce((n, c) => n + (c.subcategories?.length ?? 0), 0);

  const { data: statsData } = usePublicStats();

  const trustItems = [
    { key: 'cta.trustVerified', icon: CheckBadgeIcon },
    { key: 'cta.trustPayments', icon: ShieldCheckIcon },
    { key: 'cta.trustAI', icon: RocketLaunchIcon },
    { key: 'cta.trustHiring', icon: BoltIcon },
  ];

  const statChips = [
    { key: 'categories', label: t('cta.statCategories'), value: categoryCount || subcategoryCount, icon: BriefcaseIcon, position: 'top-2 right-0', floatDelay: 0 },
    { key: 'skills', label: t('cta.statSkills'), value: statsData?.skills, icon: AcademicCapIcon, position: 'bottom-8 -left-1', floatDelay: 1.1 },
    { key: 'freelancers', label: t('cta.statFreelancers'), value: statsData?.freelancers, icon: UserGroupIcon, position: 'top-16 -left-2', floatDelay: 2.2 },
  ];

  return (
    <div className="overflow-hidden">
      <PremiumHero />

      <section className="py-24 bg-white dark:bg-dark-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
              {t('features.title')}
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              {t('features.subtitle')}
            </p>
          </div>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {FEATURES_KEYS.map((key, idx) => {
              const Icon = FEATURES_ICONS[idx];
              return (
                <motion.div key={key} variants={item} className="relative rounded-2xl overflow-hidden group">
                  <img src={FEATURES_IMAGES[idx]} alt={t(`features.${key}.title`)} className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
                  <div className="absolute inset-0 p-6 flex flex-col justify-end">
                    <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{t(`features.${key}.title`)}</h3>
                    <p className="text-sm text-white/70 leading-relaxed">{t(`features.${key}.desc`)}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <ImageGallery />

      <BrowseCategories />

      <HowItWorks />

      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-primary-950 via-[#14103a] to-secondary-950 shadow-2xl shadow-primary-900/30 ring-1 ring-white/10"
          >
            {/* Animated gradient glow orbs */}
            <div className="absolute -top-28 -right-20 w-[26rem] h-[26rem] rounded-full bg-primary-500/25 blur-3xl pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-32 -left-20 w-[26rem] h-[26rem] rounded-full bg-secondary-500/20 blur-3xl pointer-events-none" aria-hidden="true" />
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[42rem] h-[42rem] rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            />

            {/* Subtle background pattern */}
            <div
              className="absolute inset-0 opacity-[0.05] pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
                backgroundSize: '56px 56px',
              }}
              aria-hidden="true"
            />
            <div className="absolute top-[40%] left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" aria-hidden="true" />

            <div className="relative z-10 p-8 sm:p-12 lg:p-16">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Left: copy */}
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
                >
                  <h2 className="text-4xl sm:text-5xl font-black text-white leading-[1.08] tracking-tight mb-6">
                    {t('cta.headline')}
                  </h2>

                  <p className="text-lg text-white/60 max-w-xl leading-relaxed mb-10">
                    {t('cta.subtitle')}
                  </p>

                  {/* CTA buttons */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                      to="/auth/register?role=client"
                      className="group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white text-primary-950 font-bold text-lg shadow-xl shadow-primary-900/20 hover:scale-[1.03] hover:shadow-2xl active:scale-[0.98] transition-all duration-300"
                    >
                      <MagnifyingGlassIcon className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                      {t('cta.findTalent')}
                    </Link>
                    <Link
                      to="/auth/register?role=freelancer"
                      className="group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/15 text-white font-bold text-lg hover:bg-white/10 hover:border-white/25 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300"
                    >
                      <RocketLaunchIcon className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform duration-300" />
                      {t('cta.startFreelancing')}
                    </Link>
                  </div>

                  {/* Mobile stats strip */}
                  <div className="mt-10 grid grid-cols-3 gap-3 lg:hidden">
                    {statChips.map((chip) => {
                      const Icon = chip.icon;
                      return (
                        <div key={chip.key} className="rounded-2xl bg-white/[0.06] border border-white/10 p-3.5 text-center">
                          <Icon className="w-5 h-5 text-primary-300 mx-auto mb-2" />
                          <p className="text-white font-black text-xl leading-none">{formatStat(chip.value, '')}</p>
                          <p className="text-white/55 text-[11px] mt-1.5 leading-snug">{chip.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Right: visual composition */}
                <div className="hidden lg:flex relative h-[400px] items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
                    className="absolute inset-x-8 top-1/2 -translate-y-1/2 rounded-3xl bg-white/[0.07] backdrop-blur-xl border border-white/10 shadow-2xl p-6 sm:p-7"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 via-secondary-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
                          <UserGroupIcon className="w-8 h-8" />
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 ring-4 ring-[#171a3f] flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-bold text-lg leading-tight">{t('cta.mockTitle')}</p>
                        <p className="text-sm text-white/60 mt-0.5">{t('cta.mockSubtitle')}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-4">
                        <CheckBadgeIcon className="w-6 h-6 text-emerald-400 mb-2" />
                        <p className="text-white font-bold text-sm leading-tight">{t('cta.trustVerified')}</p>
                        <p className="text-white/50 text-xs mt-1">{t('cta.verifiedSub')}</p>
                      </div>
                      <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-4">
                        <RocketLaunchIcon className="w-6 h-6 text-primary-400 mb-2" />
                        <p className="text-white font-bold text-sm leading-tight">{t('cta.trustAI')}</p>
                        <p className="text-white/50 text-xs mt-1">{t('cta.aiSub')}</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Floating stat chips */}
                  {statChips.map((chip) => {
                    const Icon = chip.icon;
                    return (
                      <motion.div
                        key={chip.key}
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: chip.floatDelay }}
                        className={`absolute ${chip.position} z-20 flex items-center gap-3 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/10 shadow-xl px-4 py-3`}
                      >
                        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white shrink-0">
                          <Icon className="w-5 h-5" />
                        </span>
                        <div>
                          <p className="text-white font-black text-lg leading-none">{formatStat(chip.value, '')}</p>
                          <p className="text-white/55 text-xs mt-1 leading-snug">{chip.label}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom: trust indicators */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mt-14 pt-8 border-t border-white/10 flex flex-wrap items-center justify-center lg:justify-between gap-x-10 gap-y-5"
              >
                {trustItems.map(({ key, icon: Icon }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-white/[0.07] border border-white/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-green-400" />
                    </span>
                    <span className="text-sm font-semibold text-white/80">{t(key)}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
