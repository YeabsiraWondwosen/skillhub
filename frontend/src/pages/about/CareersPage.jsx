import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BriefcaseIcon, HeartIcon, RocketLaunchIcon, CodeBracketIcon,
  PaintBrushIcon, MegaphoneIcon, ArrowRightIcon, CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import PageHero from '@/components/ui/PageHero';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

const OPEN_ROLES = [
  { icon: CodeBracketIcon, title: 'Full-Stack Developer', team: 'Engineering', location: 'Addis Ababa / Remote', type: 'Full-time' },
  { icon: PaintBrushIcon, title: 'UI/UX Designer', team: 'Design', location: 'Addis Ababa / Remote', type: 'Full-time' },
  { icon: MegaphoneIcon, title: 'Growth Marketing Manager', team: 'Marketing', location: 'Addis Ababa', type: 'Full-time' },
  { icon: BriefcaseIcon, title: 'Customer Success Lead', team: 'Operations', location: 'Addis Ababa', type: 'Full-time' },
];

const PERKS = [
  'Competitive salary and equity options',
  'Flexible remote work policy',
  'Health insurance coverage',
  'Professional development budget',
  'Annual team retreats',
  'Latest equipment and tools',
  'Paid time off and sick leave',
  'Career growth opportunities',
];

export default function CareersPage() {
  return (
    <div className="min-h-screen premium-dark-page">
      {/* Hero with premium navy background */}
      <PageHero
        centered
        eyebrow={<><HeartIcon className="w-4 h-4" /> Careers</>}
        title="Build the Future of Work"
        description="Join our team and help shape the platform that connects talented professionals with businesses across Ethiopia and beyond."
      >
        {/* CTA Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mb-10">
          <Link to="/contact" className="btn-primary btn-lg font-bold">
            View Open Positions
            <ArrowRightIcon className="w-5 h-5 ml-2" />
          </Link>
          <Link to="/contact" className="btn border-2 border-white/20 text-white hover:bg-white/10 btn-lg font-bold backdrop-blur-md">
            Join Our Team
          </Link>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-3">
          {['Flexible Remote Work', 'Professional Growth', 'Collaborative Team', 'Innovative Projects'].map((item) => (
            <span key={item} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 backdrop-blur-md">
              <CheckBadgeIcon className="w-4 h-4 text-primary-400 shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </PageHero>

      {/* Why Work Here */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-12">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">Why Work at SkillHub?</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            We&apos;re a fast-growing startup on a mission to revolutionize how talent and opportunity connect. Here, you&apos;ll do meaningful work with a passionate team.
          </p>
        </motion.div>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid md:grid-cols-2 gap-6">
          <motion.div variants={fadeUp} className="p-6 rounded-2xl bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800/30">
            <RocketLaunchIcon className="w-8 h-8 text-primary-600 dark:text-primary-400 mb-3" />
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Impact at Scale</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your work directly impacts thousands of freelancers and businesses building their careers and companies on SkillHub.</p>
          </motion.div>
          <motion.div variants={fadeUp} className="p-6 rounded-2xl bg-secondary-50 dark:bg-secondary-900/10 border border-secondary-100 dark:border-secondary-800/30">
            <CodeBracketIcon className="w-8 h-8 text-secondary-600 dark:text-secondary-400 mb-3" />
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Modern Tech Stack</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Work with React, Node.js, AI/ML, and cutting-edge tools. We invest in developer experience and best practices.</p>
          </motion.div>
        </motion.div>
      </section>

      {/* Perks */}
      <section className="bg-gray-50 dark:bg-dark-800/50 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-8 text-center">Perks & Benefits</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PERKS.map((perk) => (
              <div key={perk} className="flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700/50">
                <CheckBadgeIcon className="w-4 h-4 text-primary-500 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{perk}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Roles */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-8 text-center">Open Positions</h2>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="space-y-3">
          {OPEN_ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <motion.div key={role.title} variants={fadeUp} className="flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700/50 shadow-card hover:shadow-card-hover transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{role.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{role.team} · {role.location} · {role.type}</p>
                  </div>
                </div>
                <Link to="/contact" className="text-sm font-semibold text-primary-600 hover:text-primary-700 hidden sm:flex items-center gap-1">
                  Apply <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Don&apos;t see a role that fits?</p>
        <Link to="/contact" className="btn-primary font-bold">
          Send us your resume <ArrowRightIcon className="w-4 h-4 ml-2" />
        </Link>
      </section>
    </div>
  );
}
