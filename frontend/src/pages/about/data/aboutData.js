import {
  SparklesIcon, CheckBadgeIcon, BoltIcon, ShieldCheckIcon,
  CurrencyDollarIcon, UserGroupIcon, MagnifyingGlassIcon,
  CommandLineIcon, StarIcon, GlobeAltIcon,
  ChatBubbleLeftRightIcon, CheckCircleIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline';

export const HERO = {
  eyebrow: 'About SkillHub',
  headline: 'Empowering Talent. Connecting Opportunities.',
  subtitle:
    'SkillHub is an AI-powered freelance marketplace connecting skilled professionals with businesses worldwide — making hiring faster, smarter, and more transparent.',
  primaryCTA: { label: 'Find Talent', to: '/auth/register?role=client' },
  secondaryCTA: { label: 'Start Freelancing', to: '/auth/register?role=freelancer' },
};

export const MISSION = {
  kicker: 'What drives us',
  title: 'Our Mission',
  description:
    'To empower freelancers and businesses through a secure, intelligent, and transparent marketplace where talent meets opportunity.',
  points: [
    { icon: GlobeAltIcon, text: 'Democratize access to global freelance opportunities' },
    { icon: CurrencyDollarIcon, text: 'Promote fair and transparent compensation' },
    { icon: SparklesIcon, text: 'Use AI to connect skills with the right opportunities' },
    { icon: CheckBadgeIcon, text: 'Build a trusted community of verified professionals' },
  ],
};

export const VISION = {
  kicker: "Where we're headed",
  title: 'Our Vision',
  description:
    "To become one of the world's most trusted AI-powered freelance platforms — where every professional, regardless of location, can access meaningful work, and every business can discover the exact talent it needs.",
  highlights: [
    { icon: GlobeAltIcon, text: 'Professionals connected across countries' },
    { icon: CommandLineIcon, text: 'AI-powered collaboration' },
    { icon: UserGroupIcon, text: 'A global digital network of verified talent' },
  ],
};

export const WHY_CHOOSE = [
  {
    icon: CommandLineIcon,
    title: 'AI-Powered Matching',
    desc: 'Intelligent algorithms analyze skills and project requirements to connect clients with highly relevant professionals.',
  },
  {
    icon: CheckBadgeIcon,
    title: 'Verified Professionals',
    desc: 'Verification helps clients work with trusted professionals and gives freelancers a stronger reputation.',
  },
  {
    icon: BoltIcon,
    title: 'Fast Hiring',
    desc: 'Go from project posting to the right professional faster with intelligent matching and streamlined proposals.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Secure Platform',
    desc: 'Secure infrastructure, protected communication, and reliable payment workflows help keep every transaction safe.',
  },
  {
    icon: CurrencyDollarIcon,
    title: 'Escrow Payments',
    desc: 'Client funds can be securely held and released when agreed project milestones or deliverables are approved.',
    badge: 'Coming Soon',
  },
  {
    icon: StarIcon,
    title: 'Transparent Reviews',
    desc: 'Build trust through authentic reviews, ratings, and professional work history.',
  },
];

export const STEPS = [
  { icon: MagnifyingGlassIcon, title: 'Discover', desc: 'Explore professionals and specialized skills that match your needs.' },
  { icon: SparklesIcon, title: 'Match', desc: 'Use AI-powered matching to find relevant talent faster.' },
  { icon: ChatBubbleLeftRightIcon, title: 'Collaborate', desc: 'Communicate, manage milestones, and work together securely.' },
  { icon: CheckCircleIcon, title: 'Complete', desc: 'Approve the work, complete payment, and build lasting professional relationships.' },
];

export const TRUST_ITEMS = [
  { icon: CheckBadgeIcon, label: 'Verified Professionals' },
  { icon: ShieldCheckIcon, label: 'Secure Payments' },
  { icon: SparklesIcon, label: 'AI-Powered Matching' },
  { icon: DocumentTextIcon, label: 'Transparent Workflows' },
  { icon: BoltIcon, label: 'Fast Hiring' },
];

export const BORDERS = {
  title: 'Talent Has No Borders.',
  description:
    'SkillHub helps professionals showcase their expertise and gives businesses access to specialized talent wherever great work can be found.',
};

export const FINAL_CTA = {
  title: "Ready to Build What's Next?",
  description:
    "Whether you're looking for exceptional talent or your next opportunity, SkillHub helps you move from idea to impact.",
  primaryCTA: { label: 'Find Talent', to: '/auth/register?role=client' },
  secondaryCTA: { label: 'Join as a Professional', to: '/auth/register?role=freelancer' },
  trust: [
    { icon: CheckBadgeIcon, label: 'Verified Professionals' },
    { icon: ShieldCheckIcon, label: 'Secure Payments' },
    { icon: SparklesIcon, label: 'AI-Powered Matching' },
  ],
};

export const STATS = [
  { key: 'freelancers', label: 'Freelancers' },
  { key: 'clients', label: 'Clients' },
  { key: 'projects', label: 'Projects Completed' },
  { key: 'successRate', label: 'Success Rate' },
];
