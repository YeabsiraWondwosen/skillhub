import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@store/authStore';

// Layouts
import PublicLayout from '@components/layouts/PublicLayout';
import DashboardLayout from '@components/layouts/DashboardLayout';
import AdminLayout from '@components/layouts/AdminLayout';

// Guards
import ProtectedRoute from '@components/guards/ProtectedRoute';
import RoleRoute from '@components/guards/RoleRoute';

// Auth pages
import LoginPage from '@pages/auth/LoginPage';
import RegisterPage from '@pages/auth/RegisterPage';
import ForgotPasswordPage from '@pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@pages/auth/ResetPasswordPage';
import VerifyEmailPage from '@pages/auth/VerifyEmailPage';
import VerifyEmailChangePage from '@pages/auth/VerifyEmailChangePage';

// Public pages
import LandingPage from '@pages/public/LandingPage';
import BrowseJobsPage from '@pages/public/BrowseJobsPage';
import JobDetailPage from '@pages/public/JobDetailPage';
import FreelancerProfilePage from '@pages/public/FreelancerProfilePage';
import ClientProfilePage from '@pages/public/ClientProfilePage';
import BrowseFreelancersPage from '@pages/public/BrowseFreelancersPage';
import ContactPage from '@pages/public/ContactPage';
import NotificationsPage from '@pages/public/NotificationsPage';
import AboutPage from '@pages/about/AboutPage';
import CategoryPage from '@pages/public/CategoryPage';

// Profile
import FullProfilePage from '@pages/profile/FullProfilePage';

// Freelancer pages
import FreelancerDashboard from '@pages/freelancer/FreelancerDashboard';
import FreelancerProfileEdit from '@pages/freelancer/FreelancerProfileEdit';
import FreelancerProposals from '@pages/freelancer/FreelancerProposals';
import FreelancerProposalDetail from '@pages/freelancer/FreelancerProposalDetail';
import FreelancerProjects from '@pages/freelancer/FreelancerProjects';
import FreelancerEarnings from '@pages/freelancer/FreelancerEarnings';
import FreelancerWallet from '@pages/freelancer/FreelancerWallet';
import FreelancerContracts from '@pages/freelancer/FreelancerContracts';
import ContractDetailPage from '@pages/contracts/ContractDetailPage';
import FreelancerReviews from '@pages/freelancer/FreelancerReviews';
import FreelancerCalendar from '@pages/freelancer/FreelancerCalendar';
import FreelancerSettingsPage from '@pages/freelancer/FreelancerSettingsPage';
import ProposalGenerator from '@pages/freelancer/ProposalGenerator';

// Client pages
import ClientDashboard from '@pages/client/ClientDashboard';
import PostJobPage from '@pages/client/PostJobPage';
import EditJobPage from '@pages/client/EditJobPage';
import ManageJobsPage from '@pages/client/ManageJobsPage';
import ApplicantsPage from '@pages/client/ApplicantsPage';
import ClientContracts from '@pages/client/ClientContracts';
import ClientAnalytics from '@pages/client/ClientAnalytics';
import ClientReviewsPage from '@pages/client/ClientReviewsPage';
import ClientMeetingsPage from '@pages/client/ClientMeetingsPage';

// Project workspace
import ProjectWorkspace from '@pages/project/ProjectWorkspace';
import MilestonesPage from '@pages/project/MilestonesPage';

// Chat
import ChatPage from '@pages/chat/ChatPage';

// Support
import SupportPage from '@pages/support/SupportPage';
import SupportChatPage from '@pages/support/SupportChatPage';
import TicketDetailPage from '@pages/support/TicketDetailPage';

// Developer Verification
import VerificationPage from '@pages/verification/VerificationPage';
import AdminVerifications from '@pages/verification/AdminVerifications';

// Cost Estimator
import CostEstimatorPage from '@pages/costEstimator/CostEstimatorPage';

// Project Planner
import ProjectPlannerPage from '@pages/projectPlanner/ProjectPlannerPage';

// Catalogs
import BrowseCatalogsPage from '@pages/catalogs/BrowseCatalogsPage';
import CatalogDetailPage from '@pages/catalogs/CatalogDetailPage';
import CreateCatalogPage from '@pages/catalogs/CreateCatalogPage';
import EditCatalogPage from '@pages/catalogs/EditCatalogPage';
import MyCatalogsPage from '@pages/catalogs/MyCatalogsPage';

// Service Orders
import OrderDetailPage from '@pages/orders/OrderDetailPage';
import CreateOrderPage from '@pages/orders/CreateOrderPage';
import ClientOrdersPage from '@pages/client/ClientOrdersPage';
import FreelancerServiceOrdersPage from '@pages/freelancer/FreelancerServiceOrdersPage';
import ClientProposalsPage from '@pages/client/ClientProposalsPage';
import SavedServicesPage from '@pages/client/SavedServicesPage';
import ClientPaymentsPage from '@pages/client/ClientPaymentsPage';
import ClientSettingsPage from '@pages/client/ClientSettingsPage';

// Payments
import WalletPage from '@pages/payments/WalletPage';
import DepositPage from '@pages/payments/DepositPage';
import TransactionsPage from '@pages/payments/TransactionsPage';
import InvoicePage from '@pages/payments/InvoicePage';
import EscrowPage from '@pages/payments/EscrowPage';
import WithdrawPage from '@pages/payments/WithdrawPage';

// Admin
import AdminDashboard from '@pages/admin/AdminDashboard';
import AdminUsers from '@pages/admin/AdminUsers';
import AdminUserDetail from '@pages/admin/AdminUserDetail';
import AdminJobs from '@pages/admin/AdminJobs';
import AdminJobDetail from '@pages/admin/AdminJobDetail';
import AdminProjects from '@pages/admin/AdminProjects';
import AdminPayments from '@pages/admin/AdminPayments';
import AdminReviews from '@pages/admin/AdminReviews';
import AdminReports from '@pages/admin/AdminReports';
import AdminSettings from '@pages/admin/AdminSettings';
import AdminSupport from '@pages/admin/AdminSupport';
import ContactMessagesPage from '@pages/admin/ContactMessagesPage';
import AdminCategories from '@pages/admin/AdminCategories';
import AdminFinanceOverview from '@pages/admin/finance/AdminFinanceOverview';
import AdminTransactions from '@pages/admin/finance/AdminTransactions';
import AdminDeposits from '@pages/admin/finance/AdminDeposits';
import AdminWithdrawals from '@pages/admin/finance/AdminWithdrawals';
import AdminEscrowManagement from '@pages/admin/finance/AdminEscrowManagement';
import AdminRevenueCommission from '@pages/admin/finance/AdminRevenueCommission';
import AdminRefundsDisputes from '@pages/admin/finance/AdminRefundsDisputes';
import AdminInvoices from '@pages/admin/finance/AdminInvoices';
import AdminWallets from '@pages/admin/finance/AdminWallets';
import AdminPaymentGateways from '@pages/admin/finance/AdminPaymentGateways';
import AdminFinancialReports from '@pages/admin/finance/AdminFinancialReports';

// Admin Service Management
import AdminServiceCatalogs from '@pages/admin/services/AdminServiceCatalogs';
import AdminServiceOrders from '@pages/admin/services/AdminServiceOrders';
import AdminServiceAnalytics from '@pages/admin/services/AdminServiceAnalytics';

// Legal pages
import TermsPage from '@pages/legal/TermsPage';
import PrivacyPage from '@pages/legal/PrivacyPage';
import CookiePage from '@pages/legal/CookiePage';
import SitemapPage from '@pages/legal/SitemapPage';
import AccessibilityPage from '@pages/legal/AccessibilityPage';
import ComingSoonPage from '@pages/legal/ComingSoonPage';

// Support pages
import HelpCenterPage from '@pages/support/HelpCenterPage';
import FAQPage from '@pages/support/FAQPage';

// About pages
import TrustSafetyPage from '@pages/about/TrustSafetyPage';
import CareersPage from '@pages/about/CareersPage';
import BlogPage from '@pages/about/BlogPage';

// Error pages
import NotFoundPage from '@pages/errors/NotFoundPage';

export default function App() {
  const { initAuth, isDark } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Apply dark mode class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', isDark ? '#070b20' : '#f9fafb');
  }, [isDark]);

  return (
    <Routes>
      {/* ── Public routes ──────────────────────────────── */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/jobs" element={<BrowseJobsPage />} />
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
        <Route path="/freelancers" element={<BrowseFreelancersPage />} />
        <Route path="/categories/:slug" element={<CategoryPage />} />
        <Route path="/freelancers/:userId" element={<FreelancerProfilePage />} />
        <Route path="/client/:userId" element={<ClientProfilePage />} />
        <Route path="/profile/:userId" element={<FullProfilePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/help" element={<HelpCenterPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/trust-safety" element={<TrustSafetyPage />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/cookies" element={<CookiePage />} />
        <Route path="/sitemap" element={<SitemapPage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
        <Route path="/coming-soon" element={<ComingSoonPage />} />
      </Route>

      {/* ── Auth routes ────────────────────────────────── */}
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/verify-email-change" element={<VerifyEmailChangePage />} />

      {/* ── Protected shared routes ─────────────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>

          {/* Redirect /dashboard based on role */}
          <Route path="/dashboard" element={<RoleDashboardRedirect />} />

          {/* Freelancer */}
          <Route element={<RoleRoute role="freelancer" />}>
            <Route path="/freelancer/dashboard" element={<FreelancerDashboard />} />
            <Route path="/freelancer/profile" element={<FreelancerProfileEdit />} />
            <Route path="/freelancer/proposals" element={<FreelancerProposals />} />
            <Route path="/freelancer/proposals/:appId" element={<FreelancerProposalDetail />} />
            <Route path="/freelancer/proposals/generate/:jobId" element={<ProposalGenerator />} />
            <Route path="/freelancer/projects" element={<FreelancerProjects />} />
            <Route path="/freelancer/earnings" element={<FreelancerEarnings />} />
            <Route path="/freelancer/wallet" element={<FreelancerWallet />} />
            <Route path="/freelancer/service-orders" element={<FreelancerServiceOrdersPage />} />
            <Route path="/freelancer/contracts" element={<FreelancerContracts />} />
            <Route path="/freelancer/reviews" element={<FreelancerReviews />} />
            <Route path="/freelancer/calendar" element={<FreelancerCalendar />} />
            <Route path="/freelancer/settings" element={<FreelancerSettingsPage />} />
          </Route>

          {/* Client */}
          <Route element={<RoleRoute role="client" />}>
            <Route path="/client/dashboard" element={<ClientDashboard />} />
            <Route path="/client/jobs/new" element={<PostJobPage />} />
            <Route path="/client/jobs/:jobId/edit" element={<EditJobPage />} />
            <Route path="/client/jobs" element={<ManageJobsPage />} />
            <Route path="/client/jobs/:jobId/applicants" element={<ApplicantsPage />} />
            <Route path="/client/contracts" element={<ClientContracts />} />
  <Route path="/contracts/:contractId" element={<ContractDetailPage />} />
            <Route path="/client/analytics" element={<ClientAnalytics />} />
            <Route path="/client/reviews" element={<ClientReviewsPage />} />
            <Route path="/client/meetings" element={<ClientMeetingsPage />} />
            <Route path="/client/service-orders" element={<ClientOrdersPage />} />
            <Route path="/client/proposals" element={<ClientProposalsPage />} />
            <Route path="/client/saved-services" element={<SavedServicesPage />} />
            <Route path="/client/payments" element={<ClientPaymentsPage />} />
            <Route path="/client/invoices" element={<Navigate to="/payments/transactions?tab=invoices" replace />} />
            <Route path="/client/settings" element={<ClientSettingsPage />} />
          </Route>

          {/* Admin */}
          <Route element={<RoleRoute role="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/users/:userId" element={<AdminUserDetail />} />
              <Route path="/admin/jobs" element={<AdminJobs />} />
              <Route path="/admin/jobs/:jobId" element={<AdminJobDetail />} />
              <Route path="/admin/projects" element={<AdminProjects />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/finance" element={<AdminFinanceOverview />} />
              <Route path="/admin/finance/transactions" element={<AdminTransactions />} />
              <Route path="/admin/finance/deposits" element={<AdminDeposits />} />
              <Route path="/admin/finance/withdrawals" element={<AdminWithdrawals />} />
              <Route path="/admin/finance/escrow" element={<AdminEscrowManagement />} />
              <Route path="/admin/finance/commissions" element={<AdminRevenueCommission />} />
              <Route path="/admin/finance/refunds" element={<AdminRefundsDisputes />} />
              <Route path="/admin/finance/invoices" element={<AdminInvoices />} />
              <Route path="/admin/finance/wallets" element={<AdminWallets />} />
              <Route path="/admin/finance/gateways" element={<AdminPaymentGateways />} />
              <Route path="/admin/finance/reports" element={<AdminFinancialReports />} />
              <Route path="/admin/reviews" element={<AdminReviews />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/services" element={<Navigate to="/admin/services/catalogs" replace />} />
              <Route path="/admin/services/catalogs" element={<AdminServiceCatalogs />} />
              <Route path="/admin/services/orders" element={<AdminServiceOrders />} />
              <Route path="/admin/services/analytics" element={<AdminServiceAnalytics />} />
              <Route path="/admin/analytics" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/support" element={<AdminSupport />} />
              <Route path="/admin/support/:ticketId" element={<AdminSupport />} />
              <Route path="/admin/contact-messages" element={<ContactMessagesPage />} />
              <Route path="/admin/categories" element={<AdminCategories />} />
              <Route path="/admin/verifications" element={<AdminVerifications />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Route>

          {/* Project workspace — both roles */}
          <Route path="/projects/:projectId" element={<ProjectWorkspace />} />
          <Route path="/projects/:projectId/milestones" element={<MilestonesPage />} />

          {/* Chat */}
          <Route path="/messages" element={<ChatPage />} />
          <Route path="/messages/:conversationId" element={<ChatPage />} />

          {/* Payments */}
          <Route path="/payments/wallet" element={<WalletPage />} />
          <Route path="/payments/deposit" element={<DepositPage />} />
          <Route path="/payments/withdraw" element={<WithdrawPage />} />
          <Route path="/payments/transactions" element={<TransactionsPage />} />
          <Route path="/payments/escrow" element={<EscrowPage />} />
          <Route path="/payments/invoices/:paymentId" element={<InvoicePage />} />

          {/* Support */}
          <Route path="/support" element={<RedirectAdminToSupportCenter><SupportPage /></RedirectAdminToSupportCenter>} />
          <Route path="/support/chat" element={<RedirectAdminToSupportCenter><SupportChatPage /></RedirectAdminToSupportCenter>} />
          <Route path="/support/:ticketId" element={<RedirectAdminToSupportCenter><TicketDetailPage /></RedirectAdminToSupportCenter>} />

          {/* Developer Verification */}
          <Route path="/verification" element={<VerificationPage />} />

          {/* Cost Estimator */}
          <Route path="/cost-estimator" element={<CostEstimatorPage />} />

          {/* Project Planner */}
          <Route path="/project-planner" element={<ProjectPlannerPage />} />

          {/* Catalogs */}
          <Route path="/catalogs" element={<BrowseCatalogsPage />} />
          <Route path="/catalogs/:slug" element={<CatalogDetailPage />} />
          <Route path="/catalogs/:slug/order" element={<CreateOrderPage />} />
          <Route path="/freelancer/catalogs" element={<MyCatalogsPage />} />
          <Route path="/freelancer/catalogs/new" element={<CreateCatalogPage />} />
          <Route path="/freelancer/catalogs/:slug/edit" element={<EditCatalogPage />} />

          {/* Service Orders — both roles */}
          <Route path="/services/orders/:orderId" element={<OrderDetailPage />} />

          {/* Notifications */}
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>

      {/* ── 404 ─────────────────────────────────────────── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function RoleDashboardRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/auth/login" replace />;
  if (user.role === 'freelancer') return <Navigate to="/freelancer/dashboard" replace />;
  if (user.role === 'client') return <Navigate to="/client/dashboard" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/" replace />;
}

function RedirectAdminToSupportCenter({ children }) {
  const { user } = useAuthStore();
  if (user?.role === 'admin') return <Navigate to="/admin/support" replace />;
  return children;
}
