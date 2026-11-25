import { Link, useLocation } from 'react-router-dom';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';

const SEGMENT_DESTINATIONS = {
  freelancer: '/freelancer/dashboard',
  client: '/client/dashboard',
  admin: '/admin/dashboard',
  payments: '/payments/wallet',
};

const LINKABLE_PATHS = new Set([
  '/',
  '/jobs', '/freelancers', '/about', '/contact', '/help', '/faq',
  '/trust-safety', '/careers', '/blog', '/terms', '/privacy', '/cookies',
  '/sitemap', '/accessibility', '/coming-soon',
  '/dashboard',
  '/freelancer/dashboard', '/freelancer/profile', '/freelancer/proposals',
  '/freelancer/projects', '/freelancer/earnings', '/freelancer/wallet', '/freelancer/catalogs',
  '/client/dashboard', '/client/jobs', '/client/jobs/new', '/client/contracts', '/client/analytics',
  '/projects/:projectId',
  '/messages', '/payments/wallet', '/payments/deposit', '/payments/withdraw',
  '/payments/transactions', '/payments/escrow',
  '/support', '/support/chat',
  '/verification', '/cost-estimator', '/project-planner',
  '/catalogs', '/notifications',
  '/admin', '/admin/dashboard', '/admin/users', '/admin/jobs', '/admin/payments',
  '/admin/finance', '/admin/finance/transactions', '/admin/finance/deposits',
  '/admin/finance/withdrawals', '/admin/finance/escrow', '/admin/finance/commissions',
  '/admin/finance/refunds', '/admin/finance/invoices', '/admin/finance/gateways',
  '/admin/finance/reports', '/admin/reviews', '/admin/reports', '/admin/analytics',
  '/admin/support', '/admin/categories', '/admin/verifications',
  '/admin/settings',
]);

const SEGMENT_LABELS = {
  freelancer: 'Freelancer',
  client: 'Client',
  admin: 'Admin',
  dashboard: 'Dashboard',
  proposals: null,
  projects: 'My Projects',
  earnings: 'Earnings',
  profile: 'Profile',
  jobs: 'Browse Jobs',
  new: 'New Job',
  edit: 'Edit',
  applicants: 'Applicants',
  contracts: 'Contracts',
  analytics: 'Analytics',
  wallet: 'Wallet',
  deposit: 'Deposit',
  transactions: 'Transactions',
  invoices: 'Invoices',
  messages: 'Messages',
  payments: 'Finance',
  support: 'Support',
  verification: 'Verification',
  'cost-estimator': 'Cost Estimator',
  'project-planner': 'Project Planner',
  catalogs: 'Catalogs',
  notifications: 'Notifications',
  reviews: 'Reviews',
  settings: 'Settings',
  results: 'Results',
  generate: 'Generate Proposal',
};

export default function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = [{ label: <HomeIcon className="w-3.5 h-3.5" />, to: '/' }];

  let path = '';
  segments.forEach((seg, i) => {
    path += `/${seg}`;
    const label = SEGMENT_LABELS[seg] === null
      ? (path.startsWith('/client') ? 'Received Proposals' : 'My Proposals')
      : (SEGMENT_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '));
    const to = SEGMENT_DESTINATIONS[seg] ? SEGMENT_DESTINATIONS[seg] : path;
    const isLink = !(i === segments.length - 1) && LINKABLE_PATHS.has(to);
    crumbs.push({ label, to, isLink, isLast: i === segments.length - 1 });
  });

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-400 dark:text-gray-500 mb-4" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={crumb.to + i} className="flex items-center gap-1">
          {i > 0 && <ChevronRightIcon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />}
          {crumb.isLast ? (
            <span className="font-medium text-gray-700 dark:text-gray-200">{crumb.label}</span>
          ) : crumb.isLink ? (
            <Link
              to={crumb.to}
              className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center"
            >
              {crumb.label}
            </Link>
          ) : (
            <span>{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
