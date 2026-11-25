import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon, ChatBubbleLeftRightIcon, PhoneIcon,
  DocumentTextIcon, ShieldCheckIcon, CurrencyDollarIcon,
  UserGroupIcon, BriefcaseIcon, ChevronDownIcon, ChevronUpIcon,
  ArrowRightIcon, EnvelopeIcon,
} from '@heroicons/react/24/outline';
import PageHero from '@/components/ui/PageHero';
import { ArrowRight } from 'lucide-react';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

const HELP_CATEGORIES = [
  { icon: UserGroupIcon, title: 'Getting Started', desc: 'Create your account, set up your profile, and start using SkillHub.', to: '/faq' },
  { icon: BriefcaseIcon, title: 'Finding Work', desc: 'Learn how to browse jobs, submit proposals, and win projects.', to: '/faq' },
  { icon: CurrencyDollarIcon, title: 'Payments & Billing', desc: 'Understand escrow, withdrawals, fees, and payment methods.', to: '/faq' },
  { icon: ShieldCheckIcon, title: 'Account & Security', desc: 'Manage your account settings, verification, and security.', to: '/faq' },
  { icon: ChatBubbleLeftRightIcon, title: 'Messaging & Communication', desc: 'How to communicate with clients and freelancers.', to: '/faq' },
  { icon: DocumentTextIcon, title: 'Disputes & Resolution', desc: 'What to do when things don\'t go as planned.', to: '/faq' },
];

const CONTACT_OPTIONS = [
  { icon: ChatBubbleLeftRightIcon, title: 'Live Chat', desc: 'Chat with our support team in real-time.', action: 'Start Chat', to: '/support/chat' },
  { icon: EnvelopeIcon, title: 'Email Support', desc: 'Send us a detailed message and we\'ll respond within 24 hours.', action: 'Send Email', href: 'mailto:support@skillhub.et' },
  { icon: PhoneIcon, title: 'Phone Support', desc: 'Call us during business hours (Mon–Fri, 8AM–6PM EAT).', action: 'Call Now', href: 'tel:+251911000000' },
];

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 dark:border-gray-700/50 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
        <span className="font-medium text-gray-900 dark:text-white text-sm">{question}</span>
        {open ? <ChevronUpIcon className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="px-5 pb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{answer}</p>
        </motion.div>
      )}
    </div>
  );
}

const TOP_FAQS = [
  { question: 'How do I create an account?', answer: 'Click "Sign Up" and choose whether you want to work as a freelancer or hire talent. Complete your profile with your skills, experience, and portfolio to get started.' },
  { question: 'How does payment protection work?', answer: 'Clients fund milestones into our secure escrow system before work begins. Funds are only released to freelancers when the client approves the delivered milestone. This protects both parties.' },
  { question: 'What fees does SkillHub charge?', answer: 'SkillHub charges a simple 10% service fee on all transactions. There are no hidden charges. Freelancers receive 90% of the agreed amount.' },
  { question: 'How do I reset my password?', answer: 'Click "Forgot Password" on the login page, enter your email address, and follow the instructions in the reset email we send you.' },
  { question: 'Can I work with freelancers outside Ethiopia?', answer: 'Yes! SkillHub connects talent globally. You can hire freelancers from anywhere and make payments in ETB through our secure payment system.' },
  { question: 'How do I dispute a milestone?', answer: 'If you\'re unsatisfied with delivered work, you can open a dispute from the project workspace. Our support team will review the case and help reach a fair resolution.' },
];

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen premium-dark-page">
      {/* Hero */}
      <PageHero
        eyebrow="Help Center"
        title="How can we help you?"
        description="Find answers, get support, and learn how to make the most of SkillHub."
        centered
      >
        <div className="max-w-lg mx-auto relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Search for help..." className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 dark:bg-dark-800 dark:text-white dark:placeholder:text-gray-500 dark:ring-1 dark:ring-white/10" />
        </div>
      </PageHero>

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {HELP_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <motion.div key={cat.title} variants={fadeUp}>
                <Link to={cat.to} className="block p-5 rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700/50 shadow-card hover:shadow-card-hover hover:border-primary-200 dark:hover:border-primary-800 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-3 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
                    <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-1">{cat.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{cat.desc}</p>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Popular FAQs */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {TOP_FAQS.map((faq) => (
            <FAQItem key={faq.question} {...faq} />
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link to="/faq" className="text-sm font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
            View all FAQs <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Contact Options */}
      <section className="bg-gray-50 dark:bg-dark-800/50 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Still need help?</h2>
            <p className="text-gray-500 dark:text-gray-400">Our support team is ready to assist you.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {CONTACT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const Comp = opt.to ? Link : 'a';
              const props = opt.to ? { to: opt.to } : { href: opt.href };
              return (
                <motion.div key={opt.title} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
                  <Comp {...props} className="block p-6 rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700/50 shadow-card hover:shadow-card-hover transition-all duration-300 text-center group">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
                      <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">{opt.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{opt.desc}</p>
                    <span className="text-sm font-semibold text-primary-600 group-hover:text-primary-700 inline-flex items-center gap-1">{opt.action} <ArrowRight size={14} /></span>
                  </Comp>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
