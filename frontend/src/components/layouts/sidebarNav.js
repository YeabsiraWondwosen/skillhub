import {
  HomeIcon, BriefcaseIcon, DocumentTextIcon, FolderIcon,
  ChatBubbleLeftEllipsisIcon, CurrencyDollarIcon, UserCircleIcon,
  ChartBarIcon, UsersIcon, ShieldCheckIcon, FlagIcon,
  StarIcon, CogIcon, ClipboardDocumentListIcon,
  CommandLineIcon, QuestionMarkCircleIcon,
  MapIcon, CheckBadgeIcon, TagIcon,
  BanknotesIcon, ShoppingBagIcon, BellIcon, CalendarDaysIcon, EyeIcon,
  BookmarkIcon, ArrowUpTrayIcon,
  CreditCardIcon, DocumentChartBarIcon,
} from '@heroicons/react/24/outline';

/**
 * Builds the role-specific sidebar navigation model.
 *
 * This is intentionally a pure factory (no React, no hooks) so the menu
 * structure — items, order, unread-badge flags — can be unit tested without a
 * DOM. `Sidebar.jsx` consumes the result and only handles rendering.
 *
 * @param {object}  options
 * @param {string}  [options.role]   'admin' | 'freelancer' | anything else (client)
 * @param {Function}[options.t]      i18n translate function
 * @param {string}  [options.userId] current user id, used for public-profile links
 * @returns {Array} ordered nav entries; entries either are links or `{ section: [...] }` groups
 */
export function buildSidebarNav({ role, t, userId } = {}) {
  const translate = typeof t === 'function' ? t : (key) => key;

  const FREELANCER_NAV = [
    { label: translate('sidebar.dashboard'), to: '/freelancer/dashboard', icon: HomeIcon },
    {
      label: translate('sidebar.groupWork'),
      section: [
        { label: translate('sidebar.browseJobs'), to: '/jobs', icon: BriefcaseIcon },
        { label: translate('sidebar.myProposals'), to: '/freelancer/proposals', icon: DocumentTextIcon },
        { label: translate('sidebar.myProjects'), to: '/freelancer/projects', icon: FolderIcon },
        { label: translate('sidebar.messages'), to: '/messages', icon: ChatBubbleLeftEllipsisIcon },
      ],
    },
    {
      label: translate('sidebar.groupServices'),
      section: [
        { label: translate('sidebar.myCatalogs'), to: '/freelancer/catalogs', icon: CommandLineIcon },
        { label: translate('sidebar.serviceOrders'), to: '/freelancer/service-orders', icon: ShoppingBagIcon },
      ],
    },
    {
      label: translate('sidebar.groupCareer'),
      section: [
        { label: translate('sidebar.reviews'), to: '/freelancer/reviews', icon: StarIcon },
        { label: translate('sidebar.verification'), to: '/verification', icon: CheckBadgeIcon },
      ],
    },
    {
      label: translate('sidebar.groupPlanning'),
      section: [
        { label: translate('sidebar.projectPlanner'), to: '/project-planner', icon: MapIcon },
        { label: translate('sidebar.calendar'), to: '/freelancer/calendar', icon: CalendarDaysIcon },
      ],
    },
    {
      label: translate('sidebar.finance'),
      section: [
        { label: translate('sidebar.wallet'), to: '/freelancer/wallet', icon: BanknotesIcon },
        { label: translate('sidebar.earnings'), to: '/freelancer/earnings', icon: CurrencyDollarIcon },
        { label: translate('sidebar.transactions'), to: '/payments/transactions', icon: ClipboardDocumentListIcon },
        { label: translate('sidebar.withdrawals'), to: '/payments/withdraw', icon: DocumentTextIcon },
      ],
    },
    {
      label: translate('sidebar.groupProfile'),
      section: [
        { label: translate('sidebar.editProfile'), to: '/freelancer/profile', icon: UserCircleIcon },
        { label: translate('sidebar.publicProfile'), to: `/profile/${userId}`, icon: EyeIcon },
        { label: translate('sidebar.settings'), to: '/freelancer/settings', icon: CogIcon },
      ],
    },
    {
      label: translate('sidebar.groupSystem'),
      section: [
        { label: translate('sidebar.notifications'), to: '/notifications', icon: BellIcon, showUnreadBadge: true },
        { label: translate('sidebar.helpSupport'), to: '/support', icon: QuestionMarkCircleIcon },
      ],
    },
  ];

  const CLIENT_NAV = [
    { label: translate('sidebar.dashboard'), to: '/client/dashboard', icon: HomeIcon },
    {
      label: translate('sidebar.groupHiring'),
      section: [
        { label: translate('sidebar.postAJob'), to: '/client/jobs/new', icon: BriefcaseIcon },
        { label: translate('sidebar.myJobs'), to: '/client/jobs', icon: ClipboardDocumentListIcon },
        { label: translate('sidebar.receivedProposals'), to: '/client/proposals', icon: DocumentTextIcon },
      ],
    },
    {
      label: translate('sidebar.groupServices'),
      section: [
        { label: translate('sidebar.browseServices'), to: '/catalogs', icon: CommandLineIcon },
        { label: translate('sidebar.myServiceOrders'), to: '/client/service-orders', icon: ShoppingBagIcon },
        { label: translate('sidebar.savedServices'), to: '/client/saved-services', icon: BookmarkIcon },
      ],
    },
    {
      label: translate('sidebar.groupProjects'),
      section: [
        { label: translate('sidebar.contracts'), to: '/client/contracts', icon: FolderIcon },
        { label: translate('sidebar.projectPlanner'), to: '/project-planner', icon: MapIcon },
      ],
    },
    {
      label: translate('sidebar.groupCommunication'),
      section: [
        { label: translate('sidebar.messages'), to: '/messages', icon: ChatBubbleLeftEllipsisIcon },
        { label: translate('sidebar.meetings'), to: '/client/meetings', icon: CalendarDaysIcon },
        { label: translate('sidebar.notifications'), to: '/notifications', icon: BellIcon, showUnreadBadge: true },
      ],
    },
    {
      label: translate('sidebar.finance'),
      section: [
        { label: translate('sidebar.wallet'), to: '/payments/wallet', icon: BanknotesIcon },
        { label: translate('sidebar.payments'), to: '/client/payments', icon: CurrencyDollarIcon },
        { label: translate('sidebar.transactions'), to: '/payments/transactions', icon: ClipboardDocumentListIcon },
      ],
    },
    {
      label: translate('sidebar.groupInsights'),
      section: [
        { label: translate('sidebar.analytics'), to: '/client/analytics', icon: ChartBarIcon },
      ],
    },
    {
      label: translate('sidebar.groupAccount'),
      section: [
        { label: translate('sidebar.profile'), to: `/profile/${userId}`, icon: UserCircleIcon },
        { label: translate('sidebar.settings'), to: '/client/settings', icon: CogIcon },
      ],
    },
    {
      label: translate('sidebar.groupSupport'),
      section: [
        { label: translate('sidebar.helpSupport'), to: '/support', icon: QuestionMarkCircleIcon },
      ],
    },
  ];

  const ADMIN_NAV = [
    { label: translate('sidebar.dashboard'), to: '/admin/dashboard', icon: HomeIcon },
    {
      label: translate('sidebar.groupUserManagement'),
      section: [
        { label: translate('sidebar.users'), to: '/admin/users', icon: UsersIcon },
        { label: translate('sidebar.verifications'), to: '/admin/verifications', icon: CheckBadgeIcon },
      ],
    },
    {
      label: translate('sidebar.groupMarketplace'),
      section: [
        { label: translate('sidebar.jobs'), to: '/admin/jobs', icon: BriefcaseIcon },
        { label: translate('sidebar.projectManagement'), to: '/admin/projects', icon: FolderIcon },
        { label: translate('sidebar.categories'), to: '/admin/categories', icon: TagIcon },
        { label: translate('sidebar.serviceCatalog'), to: '/admin/services/catalogs', icon: CommandLineIcon },
        { label: translate('sidebar.serviceOrders'), to: '/admin/services/orders', icon: ShoppingBagIcon },
        { label: translate('sidebar.reviews'), to: '/admin/reviews', icon: StarIcon },
      ],
    },
    {
      label: translate('sidebar.finance'),
      section: [
        { label: translate('sidebar.financialDashboard'), to: '/admin/finance', icon: ChartBarIcon },
        { label: translate('sidebar.transactions'), to: '/admin/finance/transactions', icon: ClipboardDocumentListIcon },
        { label: translate('sidebar.deposits'), to: '/admin/finance/deposits', icon: BanknotesIcon },
        { label: translate('sidebar.escrow'), to: '/admin/finance/escrow', icon: ShieldCheckIcon },
        { label: translate('sidebar.withdrawals'), to: '/admin/finance/withdrawals', icon: ArrowUpTrayIcon },
        { label: translate('sidebar.revenueCommission'), to: '/admin/finance/commissions', icon: CurrencyDollarIcon },
        { label: translate('sidebar.paymentGateways'), to: '/admin/finance/gateways', icon: CreditCardIcon },
        { label: translate('sidebar.financialReports'), to: '/admin/finance/reports', icon: DocumentChartBarIcon },
      ],
    },
    {
      label: translate('sidebar.groupModeration'),
      section: [
        { label: translate('sidebar.reports'), to: '/admin/reports', icon: FlagIcon },
      ],
    },
    {
      label: translate('sidebar.groupInsights'),
      section: [
        { label: translate('sidebar.serviceAnalytics'), to: '/admin/services/analytics', icon: CommandLineIcon },
      ],
    },
    {
      label: translate('sidebar.groupSystem'),
      section: [
        { label: translate('sidebar.settings'), to: '/admin/settings', icon: CogIcon },
        { label: translate('sidebar.notifications'), to: '/notifications', icon: BellIcon, showUnreadBadge: true },
        { label: translate('sidebar.helpSupport'), to: '/admin/support', icon: QuestionMarkCircleIcon },
        { label: 'Contact Messages', to: '/admin/contact-messages', icon: ChatBubbleLeftEllipsisIcon },
      ],
    },
  ];

  if (role === 'admin') return ADMIN_NAV;
  if (role === 'freelancer') return FREELANCER_NAV;
  return CLIENT_NAV;
}
