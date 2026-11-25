import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import PageHero from '@/components/ui/PageHero';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const FAQ_SECTIONS = [
  {
    category: 'Getting Started',
    items: [
      { q: 'What is SkillHub?', a: 'SkillHub is a modern freelance marketplace connecting businesses with talented professionals across multiple industries. We offer job matching, secure payments, skill verification, and project management tools.' },
      { q: 'How do I create an account?', a: 'Click "Sign Up" on the homepage, choose your role (freelancer or client), fill in your details, and verify your email. It takes less than 2 minutes.' },
      { q: 'Is SkillHub free to join?', a: 'Yes, creating an account is completely free. Freelancers only pay a 10% service fee on completed projects. Clients pay no additional fees beyond the freelancer\'s rate.' },
      { q: 'Who can use SkillHub?', a: 'SkillHub is open to anyone 18 years or older. We welcome freelancers and clients from Ethiopia and around the world.' },
    ],
  },
  {
    category: 'For Freelancers',
    items: [
      { q: 'How do I find work?', a: 'Browse the "Find Work" page, filter by skills, budget, and category, then submit tailored proposals. Our AI-powered matching also suggests jobs that fit your profile.' },
      { q: 'How do I get paid?', a: 'When a client approves a milestone, funds are released from escrow to your SkillHub wallet. You can withdraw to your local bank account. Payments are in ETB.' },
      { q: 'How do I build my profile?', a: 'Complete your profile with a professional photo, tagline, detailed bio, skills, portfolio items, and certifications. A complete profile ranks higher in search results.' },
      { q: 'Can I set my own rates?', a: 'Yes, freelancers set their own hourly rates or project prices. Our platform provides market insights to help you price competitively.' },
    ],
  },
  {
    category: 'For Clients',
    items: [
      { q: 'How do I post a job?', a: 'Click "Post a Job," describe your project, set a budget, define milestones, and publish. Our AI assistant helps you write clear descriptions that attract the right talent.' },
      { q: 'How does escrow work?', a: 'When you hire a freelancer, you fund milestones into our secure escrow system. Funds are held until you approve the delivered work. This protects both you and the freelancer.' },
      { q: 'How do I choose the right freelancer?', a: 'Review profiles, portfolios, and client reviews. You can also invite freelancers to interview before making a decision.' },
      { q: 'What if I\'m not satisfied with the work?', a: 'You can request revisions through the project workspace. If issues persist, you can open a dispute and our support team will help mediate a resolution.' },
      { q: 'Can I hire freelancers from other countries?', a: 'Yes! SkillHub is a global platform. You can hire talent from anywhere and pay securely in ETB.' },
    ],
  },
  {
    category: 'Payments',
    items: [
      { q: 'What payment methods are supported?', a: 'We support bank transfers and mobile money through our secure payment partner. All transactions are processed in Ethiopian Birr (ETB).' },
      { q: 'What fees does SkillHub charge?', a: 'SkillHub charges a 10% service fee on completed transactions. There are no upfront fees, subscription costs, or hidden charges.' },
      { q: 'How long do withdrawals take?', a: 'Bank transfers typically take 1–3 business days. Mobile money transfers are usually instant or within 24 hours.' },
      { q: 'Is my money safe?', a: 'Yes. Escrow funds are held in secure, segregated accounts. We use bank-level encryption and comply with all financial regulations.' },
    ],
  },
  {
    category: 'Account & Security',
    items: [
      { q: 'How do I reset my password?', a: 'Click "Forgot Password" on the login page, enter your email, and follow the instructions in the reset link we send you.' },
      { q: 'How do I enable two-factor authentication?', a: 'Go to Settings > Security and enable 2FA. You can use an authenticator app or SMS verification for an extra layer of account protection.' },
      { q: 'How do I delete my account?', a: 'Go to Settings > Account and click "Delete Account." This action is irreversible. All your data will be permanently removed within 90 days.' },
      { q: 'How do I report a suspicious user?', a: 'Click the "Report" button on the user\'s profile or message. Our Trust & Safety team reviews all reports within 24 hours.' },
    ],
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 dark:border-gray-700/50 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
        <span className="font-medium text-gray-900 dark:text-white text-sm pr-4">{q}</span>
        {open ? <ChevronUpIcon className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="px-5 pb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{a}</p>
        </motion.div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [search, setSearch] = useState('');
  const filtered = FAQ_SECTIONS.map(s => ({
    ...s,
    items: s.items.filter(i => i.q.toLowerCase().includes(search.toLowerCase()) || i.a.toLowerCase().includes(search.toLowerCase())),
  })).filter(s => s.items.length > 0);

  return (
    <div className="min-h-screen premium-dark-page">
      <PageHero
        eyebrow="FAQ"
        title="Frequently Asked Questions"
        description="Everything you need to know about SkillHub."
        centered
      >
        <div className="max-w-lg mx-auto relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} type="text" placeholder="Search questions..." className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 dark:bg-dark-800 dark:text-white dark:placeholder:text-gray-500 dark:ring-1 dark:ring-white/10" />
        </div>
      </PageHero>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-12">
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-12">No results found for "{search}"</p>
        )}
        {filtered.map(section => (
          <motion.div key={section.category} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">{section.category}</h2>
            <div className="space-y-3">
              {section.items.map(item => <FAQItem key={item.q} {...item} />)}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
