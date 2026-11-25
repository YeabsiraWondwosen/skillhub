import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon, RocketLaunchIcon, UserGroupIcon,
  CheckBadgeIcon, StarIcon, GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { usePublicStats } from '@/hooks/useAnalytics';
import {
  HERO, MISSION, VISION, WHY_CHOOSE, STEPS, TRUST_ITEMS,
  BORDERS, FINAL_CTA, STATS,
} from './data/aboutData';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

const GRID_PATTERN = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
  backgroundSize: '64px 64px',
};

function formatStat(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '—';
  return n.toLocaleString('en-US');
}

/* ─── Section shell ────────────────────────────────────────────────────────── */
function SectionShell({ gradient = 'primary', className = '', children }) {
  return (
    <section className={`relative overflow-hidden ${className}`}>
      <div
        aria-hidden="true"
        className={`absolute inset-0 ${
          gradient === 'primary'
            ? 'bg-gradient-to-br from-primary-950 via-[#14103a] to-secondary-950'
            : 'bg-gradient-to-br from-[#0a0f2c] via-[#0b1136] to-[#1a0b33]'
        }`}
      />
      <div aria-hidden="true" className="absolute -top-32 -left-24 w-[26rem] h-[26rem] rounded-full bg-primary-500/15 blur-3xl pointer-events-none" />
      <div aria-hidden="true" className="absolute -bottom-32 -right-24 w-[26rem] h-[26rem] rounded-full bg-secondary-500/15 blur-3xl pointer-events-none" />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={GRID_PATTERN}
      />
      <div className="relative z-10">{children}</div>
    </section>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────────────── */
function HeroSection() {
  const { data: stats } = usePublicStats();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-950 via-[#14103a] to-secondary-950">
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
        aria-hidden="true"
      />
      <div className="absolute -top-32 -right-24 w-[30rem] h-[30rem] rounded-full bg-primary-500/25 blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute -bottom-40 -left-24 w-[30rem] h-[30rem] rounded-full bg-secondary-500/20 blur-3xl pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 text-xs font-bold uppercase tracking-widest mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
              {HERO.eyebrow}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-black text-white leading-[1.08] tracking-tight mb-6">
              {HERO.headline}
            </h1>
            <p className="text-lg text-white/60 max-w-xl leading-relaxed mb-10">
              {HERO.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to={HERO.primaryCTA.to}
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-bold shadow-xl shadow-primary-900/40 hover:scale-[1.03] hover:shadow-2xl hover:brightness-110 active:scale-[0.98] transition-all duration-300"
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
                {HERO.primaryCTA.label}
              </Link>
              <Link
                to={HERO.secondaryCTA.to}
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/15 text-white font-bold hover:bg-white/10 hover:border-white/25 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300"
              >
                <RocketLaunchIcon className="w-5 h-5" />
                {HERO.secondaryCTA.label}
              </Link>
            </div>

            <div className="mt-8 flex items-center gap-2 text-sm text-white/50">
              <StarIcon className="w-4 h-4 text-yellow-300" />
              Trusted by professionals and businesses worldwide
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
            className="relative"
          >
            <div className="relative rounded-[2rem] overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-primary-900/40 aspect-[4/3]">
              <img
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80&auto=format&fit=crop"
                alt="Professionals collaborating in a modern workspace"
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary-950/60 via-transparent to-transparent" aria-hidden="true" />
            </div>

            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-4 right-4 lg:-right-5 lg:top-8 flex items-center gap-3 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/10 shadow-xl px-4 py-3"
            >
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white shrink-0">
                <UserGroupIcon className="w-4 h-4" />
              </span>
              <div>
                <p className="text-white font-black text-lg leading-none">
                  {stats?.freelancers != null ? formatStat(stats.freelancers) : '—'}
                </p>
                <p className="text-white/55 text-xs mt-1 leading-snug">Freelancers</p>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute bottom-4 left-4 lg:-left-5 lg:bottom-8 flex items-center gap-3 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/10 shadow-xl px-4 py-3"
            >
              <span className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0">
                <CheckBadgeIcon className="w-4 h-4" />
              </span>
              <div>
                <p className="text-white font-black text-base leading-none">Verified</p>
                <p className="text-white/55 text-xs mt-1 leading-snug">Professionals</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ─── Mission ─────────────────────────────────────────────────────────────── */
function MissionSection() {
  return (
    <SectionShell gradient="deep" className="py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-primary-300 mb-4">
              {MISSION.kicker}
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight mb-6">
              {MISSION.title}
            </h2>
            <p className="text-lg text-white/60 leading-relaxed max-w-xl">
              {MISSION.description}
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid sm:grid-cols-2 gap-4"
          >
            {MISSION.points.map(({ icon: Icon, text }, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-5 shadow-lg shadow-black/20 hover:bg-white/[0.1] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-secondary-600 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm text-white/70 leading-relaxed">{text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </SectionShell>
  );
}

/* ─── Vision ──────────────────────────────────────────────────────────────── */
function VisionSection() {
  return (
    <SectionShell gradient="primary" className="py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative rounded-[2rem] overflow-hidden shadow-2xl shadow-primary-900/40 ring-1 ring-white/10 aspect-[4/3]">
              <img
                src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80&auto=format&fit=crop"
                alt="Global digital network spanning the world"
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary-950/50 to-transparent" aria-hidden="true" />
            </div>
            <div className="absolute -bottom-6 right-6 rounded-2xl glass shadow-lg px-4 py-3 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-secondary-600 flex items-center justify-center text-white shrink-0">
                <GlobeAltIcon className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-white leading-none">Global by design</p>
                <p className="text-xs text-white/50 mt-1">Talent connected everywhere</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            className="order-1 lg:order-2"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-primary-300 mb-4">
              {VISION.kicker}
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight mb-6">
              {VISION.title}
            </h2>
            <p className="text-lg text-white/60 leading-relaxed max-w-xl">
              {VISION.description}
            </p>
            <ul className="mt-8 space-y-4">
              {VISION.highlights.map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-center gap-4">
                  <span className="w-10 h-10 rounded-xl bg-white/[0.07] border border-white/10 backdrop-blur-md shadow-lg shadow-black/20 flex items-center justify-center text-primary-300 shrink-0">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-sm font-medium text-white/75">{text}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </SectionShell>
  );
}

/* ─── Why Choose ──────────────────────────────────────────────────────────── */
function WhyChooseSection() {
  return (
    <SectionShell gradient="deep" className="py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-center mb-12 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 text-sm font-semibold mb-5">
            Why SkillHub
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-4">
            Why Choose SkillHub?
          </h2>
          <p className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            Built for professionals and clients who value quality, speed, security, and trust.
          </p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {WHY_CHOOSE.map(({ icon: Icon, title, desc, badge }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              whileHover={{ y: -6 }}
              className="group rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-6 shadow-lg shadow-black/20 hover:bg-white/[0.1] hover:shadow-2xl hover:shadow-primary-900/30 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-600 to-secondary-600 flex items-center justify-center text-white group-hover:brightness-110 group-hover:scale-110 transition-all duration-300">
                  <Icon className="w-5 h-5" />
                </div>
                {badge && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/20">
                    {badge}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionShell>
  );
}

/* ─── How It Works ────────────────────────────────────────────────────────── */
function HowItWorksSection() {
  return (
    <SectionShell gradient="primary" className="py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-center mb-12 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 text-sm font-semibold mb-5">
            How SkillHub Works
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-4">
            From Discovery to Done
          </h2>
          <p className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            A simple, guided workflow that moves your project forward — step by step.
          </p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="relative hidden lg:block"
        >
          <div
            className="absolute top-7 left-10 right-10 h-0.5 bg-gradient-to-r from-primary-400/20 via-primary-400/40 to-primary-400/20"
            aria-hidden="true"
          />
          <div className="relative grid grid-cols-4 gap-6">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <motion.div key={title} variants={fadeUp} className="relative text-center px-4">
                <div className="relative z-10 w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary-600 to-secondary-600 text-white flex items-center justify-center shadow-lg shadow-primary-500/40 ring-4 ring-[#14103a]">
                  <span className="text-sm font-black tracking-wider">0{i + 1}</span>
                </div>
                <div className="mt-6 flex flex-col items-center">
                  <span className="w-11 h-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-primary-300 mb-4">
                    <Icon className="w-5 h-5" />
                  </span>
                  <h3 className="font-black text-white mb-2">{title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed max-w-[220px]">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="relative lg:hidden"
        >
          <div
            className="absolute left-7 top-4 bottom-4 w-0.5 bg-gradient-to-b from-primary-400/30 via-primary-400/40 to-primary-400/30"
            aria-hidden="true"
          />
          <div className="space-y-10">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <motion.div key={title} variants={fadeUp} className="relative flex gap-5">
                <div className="relative z-10 shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600 to-secondary-600 text-white flex items-center justify-center shadow-lg shadow-primary-500/40 ring-4 ring-[#14103a]">
                    <span className="text-sm font-black tracking-wider">0{i + 1}</span>
                  </div>
                </div>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-2 text-primary-300 font-bold mb-1.5">
                    <Icon className="w-4 h-4" />
                    {title}
                  </span>
                  <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </SectionShell>
  );
}

/* ─── Statistics ──────────────────────────────────────────────────────────── */
function StatsSection() {
  const { data: stats } = usePublicStats();

  const values = {
    freelancers: stats?.freelancers,
    clients: stats?.clients,
    projects: stats?.completedProjects,
    successRate: stats?.successRate != null ? `${stats.successRate}%` : '—',
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-950 via-[#14103a] to-secondary-950 py-20 sm:py-24">
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
        aria-hidden="true"
      />
      <div className="absolute -top-32 -left-24 w-[26rem] h-[26rem] rounded-full bg-primary-500/20 blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute -bottom-32 -right-24 w-[26rem] h-[26rem] rounded-full bg-secondary-500/20 blur-3xl pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-center mb-12 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 text-xs font-bold uppercase tracking-widest mb-5">
            Our Impact
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-4">
            Growing With Our Community
          </h2>
          <p className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            Real numbers from the SkillHub community.
          </p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          {STATS.map(({ key, label }) => {
            const value = values[key];
            return (
              <motion.div
                key={key}
                variants={fadeUp}
                className="rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10 p-6 sm:p-8 text-center hover:bg-white/[0.1] transition-colors duration-300"
              >
                <p className="text-3xl sm:text-4xl font-black text-white mb-2">
                  {value === '—' ? '—' : formatStat(value)}
                </p>
                <p className="text-sm text-white/55">{label}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Trust strip ─────────────────────────────────────────────────────────── */
function TrustStrip() {
  return (
    <section className="relative overflow-hidden bg-[#070b20] border-y border-white/5 py-12 sm:py-14">
      <div aria-hidden="true" className="absolute -top-24 left-1/4 w-[24rem] h-[24rem] rounded-full bg-primary-500/10 blur-3xl pointer-events-none" />
      <div aria-hidden="true" className="absolute -bottom-24 right-1/4 w-[24rem] h-[24rem] rounded-full bg-secondary-500/10 blur-3xl pointer-events-none" />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6"
        >
          {TRUST_ITEMS.map(({ icon: Icon, label }) => (
            <motion.div key={label} variants={fadeUp} className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-white/10 border border-white/10 backdrop-blur-md flex items-center justify-center text-primary-300">
                <Icon className="w-5 h-5" />
              </span>
              <span className="text-sm font-semibold text-white/75">{label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Global network visual ───────────────────────────────────────────────── */
function WorldNetwork() {
  const nodes = [
    { x: 14, y: 32, size: 10, delay: 0 },
    { x: 30, y: 18, size: 8, delay: 1 },
    { x: 48, y: 44, size: 12, delay: 2 },
    { x: 64, y: 24, size: 9, delay: 0.5 },
    { x: 80, y: 38, size: 8, delay: 1.5 },
    { x: 38, y: 64, size: 10, delay: 2.5 },
    { x: 58, y: 68, size: 8, delay: 1 },
    { x: 86, y: 60, size: 11, delay: 0.8 },
  ];
  const links = [
    [0, 1], [1, 2], [2, 3], [3, 4], [2, 5],
    [5, 6], [6, 7], [3, 6], [0, 5], [4, 7],
  ];

  return (
    <div className="relative w-full h-full min-h-[300px] rounded-[2rem] bg-white/[0.06] backdrop-blur-xl border border-white/10 shadow-2xl shadow-primary-900/30 overflow-hidden">
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#a5b4fc 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
        aria-hidden="true"
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 rounded-full bg-primary-400/20 blur-2xl pointer-events-none" aria-hidden="true" />

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {links.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="#a5b4fc"
            strokeOpacity="0.35"
            strokeWidth="0.4"
          />
        ))}
      </svg>

      {nodes.map((n, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-primary-400/40 ring-4 ring-primary-400/15"
          style={{ left: `${n.x}%`, top: `${n.y}%`, width: n.size, height: n.size }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: n.delay }}
          aria-hidden="true"
        />
      ))}

      <div className="absolute bottom-4 left-4 rounded-2xl glass px-4 py-2.5 flex items-center gap-2.5">
        <GlobeAltIcon className="w-4 h-4 text-primary-300" />
        <span className="text-xs font-semibold text-white/80">Connecting talent worldwide</span>
      </div>
    </div>
  );
}

/* ─── Global / Community ──────────────────────────────────────────────────── */
function BordersSection() {
  return (
    <SectionShell gradient="deep" className="py-20 sm:py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="order-2 lg:order-1"
          >
            <WorldNetwork />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            className="order-1 lg:order-2"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-primary-300 mb-4">
              A Global Community
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight mb-6">
              {BORDERS.title}
            </h2>
            <p className="text-lg text-white/60 leading-relaxed max-w-xl">
              {BORDERS.description}
            </p>
          </motion.div>
        </div>
      </div>
    </SectionShell>
  );
}

/* ─── Final CTA ───────────────────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#070b20] py-20 sm:py-24">
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#0a0f2c] via-[#0b1136] to-[#1a0b33]" />
      <div aria-hidden="true" className="absolute -top-32 left-1/3 w-[28rem] h-[28rem] rounded-full bg-primary-500/15 blur-3xl pointer-events-none" />
      <div aria-hidden="true" className="absolute -bottom-32 right-1/4 w-[28rem] h-[28rem] rounded-full bg-secondary-500/15 blur-3xl pointer-events-none" />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-primary-950 via-[#14103a] to-secondary-950 shadow-2xl shadow-primary-900/40 ring-1 ring-white/10 px-6 py-16 sm:p-16 lg:p-20 text-center"
        >
          <div className="absolute -top-28 -right-20 w-[26rem] h-[26rem] rounded-full bg-primary-500/25 blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="absolute -bottom-32 -left-20 w-[26rem] h-[26rem] rounded-full bg-secondary-500/20 blur-3xl pointer-events-none" aria-hidden="true" />
          <div
            className="absolute inset-0 opacity-[0.05] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
            }}
            aria-hidden="true"
          />

          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight mb-5">
              {FINAL_CTA.title}
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed mb-10">
              {FINAL_CTA.description}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                to={FINAL_CTA.primaryCTA.to}
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-bold shadow-xl shadow-primary-900/40 hover:scale-[1.03] hover:shadow-2xl hover:brightness-110 active:scale-[0.98] transition-all duration-300"
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
                {FINAL_CTA.primaryCTA.label}
              </Link>
              <Link
                to={FINAL_CTA.secondaryCTA.to}
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/15 text-white font-bold hover:bg-white/10 hover:border-white/25 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300"
              >
                <RocketLaunchIcon className="w-5 h-5" />
                {FINAL_CTA.secondaryCTA.label}
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
              {FINAL_CTA.trust.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <Icon className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-semibold text-white/75">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function AboutPage() {
  return (
    <div className="overflow-hidden bg-[#070b20]">
      <HeroSection />
      <MissionSection />
      <VisionSection />
      <WhyChooseSection />
      <HowItWorksSection />
      <StatsSection />
      <TrustStrip />
      <BordersSection />
      <FinalCTA />
    </div>
  );
}
