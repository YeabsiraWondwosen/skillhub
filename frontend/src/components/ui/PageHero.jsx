import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

export default function PageHero({
  backTo,
  backLabel = 'Back to Home',
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  description,
  centered = false,
  children,
  className = '',
}) {
  return (
    <div className={`relative isolate overflow-hidden bg-[#070b20] ${className}`}>
      <div aria-hidden="true" className="absolute inset-0 -z-20 bg-gradient-to-br from-[#0a0f2c] via-[#0b1136] to-[#1a0b33]" />
      <div aria-hidden="true" className="absolute -top-40 -left-32 -z-10 h-[30rem] w-[30rem] rounded-full bg-primary-600/20 blur-[120px]" />
      <div aria-hidden="true" className="absolute top-1/3 -right-40 -z-10 h-[26rem] w-[26rem] rounded-full bg-secondary-600/20 blur-[120px]" />
      <div aria-hidden="true" className="absolute bottom-0 left-1/3 -z-10 h-[22rem] w-[22rem] rounded-full bg-sky-500/10 blur-[100px]" />
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

      <div className={`relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 ${centered ? 'text-center' : ''}`}>
        <motion.div initial="hidden" animate="show" variants={stagger}>
          {backTo && (
            <motion.div variants={fadeUp} className={centered ? 'flex justify-center' : ''}>
              <Link
                to={backTo}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-semibold text-white/70 backdrop-blur-md transition-all duration-300 hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeftIcon className="w-4 h-4" /> {backLabel}
              </Link>
            </motion.div>
          )}

          {eyebrow && (
            <motion.div variants={fadeUp} className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 backdrop-blur-md ${centered ? '' : 'mt-6'}`}>
              {eyebrow}
            </motion.div>
          )}

          <motion.div
            variants={fadeUp}
            className={`flex items-center gap-3 ${centered ? 'justify-center mt-6' : 'mt-6'}`}
          >
            {Icon && (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-600 shadow-lg shadow-primary-500/30">
                <Icon className="h-6 w-6 text-white" />
              </span>
            )}
            <h1 className="text-3xl lg:text-5xl font-black text-white tracking-tight">{title}</h1>
          </motion.div>

          {subtitle && (
            <motion.p variants={fadeUp} className="mt-4 text-lg text-white/60">
              {subtitle}
            </motion.p>
          )}

          {description && (
            <motion.p variants={fadeUp} className={`mt-4 text-lg text-white/60 leading-relaxed ${centered ? 'max-w-2xl mx-auto' : 'max-w-2xl'}`}>
              {description}
            </motion.p>
          )}

          {children && <motion.div variants={fadeUp} className="mt-8">{children}</motion.div>}
        </motion.div>
      </div>
    </div>
  );
}
