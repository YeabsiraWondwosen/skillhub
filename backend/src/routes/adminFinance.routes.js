import { Router } from 'express';
import * as c from '../controllers/adminFinance.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(protect);
router.use(authorize('admin'));

// ─── Financial Overview ────────────────────────────────────────────────────────
router.get('/finance/overview', c.getFinancialOverview);
router.get('/finance/live-stats', c.getLiveStats);

// ─── Analytics ─────────────────────────────────────────────────────────────────
router.get('/finance/revenue', c.getRevenueByPeriod);
router.get('/finance/trends', c.getAnalyticsTrends);
router.get('/finance/category-revenue', c.getCategoryRevenue);
router.get('/finance/top-categories', c.getTopCategories);
router.get('/finance/top-earners', c.getTopEarners);
router.get('/finance/top-freelancers', c.getTopFreelancersByEarnings);
router.get('/finance/top-clients', c.getTopClientsBySpending);
router.get('/finance/user-growth', c.getUserGrowth);
router.get('/finance/heat-map', c.getHeatMapData);

// ─── Escrow Management ─────────────────────────────────────────────────────────
router.get('/finance/escrows', c.getAllEscrows);
router.get('/finance/escrow-stats', c.getEscrowStats);
router.get('/finance/escrows/:escrowId/timeline', c.getEscrowTimeline);
router.patch('/finance/escrows/:escrowId/release', c.adminReleaseEscrow);
router.patch('/finance/escrows/:escrowId/hold', c.adminHoldEscrow);
router.patch('/finance/escrows/:escrowId/refund', c.adminRefundEscrow);
router.patch('/finance/escrows/:escrowId/resolve', c.adminResolveDispute);
router.post('/finance/escrows/:escrowId/notes', c.addAdminNote);

// ─── Payment Management ────────────────────────────────────────────────────────
router.get('/finance/payments', c.getAllPayments);
router.get('/finance/payments/search', c.searchPayments);
router.get('/finance/payments/:paymentId/transactions', c.getPaymentTransactions);
router.get('/finance/payment-stats', c.getPaymentStats);
router.get('/finance/wallets', c.getAllWallets);

// ─── Withdrawal Management ─────────────────────────────────────────────────────
router.get('/finance/withdrawals', c.getAllWithdrawals);
router.get('/finance/withdrawal-stats', c.getWithdrawalStats);
router.patch('/finance/withdrawals/:withdrawalId', c.processWithdrawal);
router.patch('/finance/withdrawals/:withdrawalId/retry', c.retryFailedWithdrawal);

// ─── Commission Management ─────────────────────────────────────────────────────
router.get('/finance/commission/settings', c.getCommissionSettings);
router.patch('/finance/commission/settings', c.updateCommissionSettings);
router.get('/finance/commission/history', c.getCommissionHistory);

// ─── Refund & Dispute ──────────────────────────────────────────────────────────
router.get('/finance/refunds', c.getRefundDashboard);
router.get('/finance/disputes', c.getDisputeCenter);

// ─── Reports ───────────────────────────────────────────────────────────────────
router.get('/finance/reports', c.generateReport);
router.get('/finance/reports/summary', c.getFinancialReportsSummary);
router.get('/finance/reports/rows', c.getFinancialReportRows);

// ─── Search ────────────────────────────────────────────────────────────────────
router.get('/finance/search', c.globalSearch);

// ─── Audit & Security ──────────────────────────────────────────────────────────
router.get('/finance/audit-logs', c.getAuditLogsCtrl);
router.get('/finance/audit-summary', c.getAuditLogsSummary);
router.get('/finance/suspicious-activity', c.getSuspiciousActivity);
router.get('/finance/admin-history', c.getAdminActionHistory);

// ─── Invoice ───────────────────────────────────────────────────────────────────
router.get('/finance/invoices/:paymentId/download', c.downloadInvoicePDF);

export default router;
