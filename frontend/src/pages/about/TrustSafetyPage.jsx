import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ShieldCheckIcon, CheckBadgeIcon, LockClosedIcon,
  ExclamationTriangleIcon, UserGroupIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline';
import PageHero from '@/components/ui/PageHero';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

const PRINCIPLES = [
  { icon: ShieldCheckIcon, title: 'Verified Identity', desc: 'All users undergo identity verification. Freelancers are vetted through identity, GitHub, and portfolio verification before earning verified badges.' },
  { icon: LockClosedIcon, title: 'Secure Payments', desc: 'Every transaction is protected by our escrow system. Funds are held securely and only released when milestones are approved by both parties.' },
  { icon: CheckBadgeIcon, title: 'Quality Assurance', desc: 'Our AI-powered review system monitors work quality, client satisfaction, and delivery timelines to maintain platform standards.' },
  { icon: UserGroupIcon, title: 'Community Standards', desc: 'We enforce strict community guidelines. Harassment, discrimination, fraud, and dishonest behavior result in immediate account action.' },
];

const SAFETY_TIPS = [
  'Never share personal financial information outside the platform.',
  'Always use SkillHub escrow for milestone-based payments.',
  'Communicate through platform messaging for record keeping.',
  'Verify freelancer credentials and reviews before hiring.',
  'Report suspicious behavior immediately to our Trust & Safety team.',
  'Never pay upfront fees outside of the platform\'s escrow system.',
];

export default function TrustSafetyPage() {
  return (
    <div className="min-h-screen premium-dark-page">
      {/* Hero */}
      <PageHero
        backTo="/"
        eyebrow={
          <>
            <ShieldCheckIcon className="w-4 h-4" /> Trust & Safety
          </>
        }
        title="Your safety is our priority"
        description="SkillHub is built on trust. We invest in identity verification, secure payments, and proactive monitoring to keep our community safe."
        centered
      />

      {/* Principles */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRINCIPLES.map((p) => {
            const Icon = p.icon;
            return (
              <motion.div key={p.title} variants={fadeUp} className="p-6 rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700/50 shadow-card">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">{p.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{p.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Safety Tips */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <div className="flex items-center gap-3 mb-6">
            <ExclamationTriangleIcon className="w-6 h-6 text-warning-500" />
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Safety Tips</h2>
          </div>
          <div className="space-y-3">
            {SAFETY_TIPS.map((tip, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-100 dark:border-warning-500/20">
                <CheckBadgeIcon className="w-5 h-5 text-warning-600 dark:text-warning-500 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 dark:text-gray-300">{tip}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Reporting */}
      <section className="bg-gray-50 dark:bg-dark-800/50 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Report a Problem</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-lg mx-auto">
            If you encounter suspicious activity, policy violations, or safety concerns, please report them immediately. Our Trust & Safety team reviews all reports within 24 hours.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/support" className="btn-primary font-bold">
              Report an Issue <ArrowRightIcon className="w-4 h-4 ml-2" />
            </Link>
            <Link to="/contact" className="btn-secondary font-bold">Contact Support</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
