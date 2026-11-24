import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import { downloadInvoicePDF } from '../controllers/adminFinance.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';
import {
  depositSchema, demoDepositSchema, withdrawSchema,
  createEscrowSchema, releaseEscrowSchema, refundEscrowSchema,
  telebirrDepositSchema, cbeBirrDepositSchema,
} from '../validations/payment.validation.js';

const router = Router();

// ─── Webhooks (raw body, no auth) ────────────────────────────────────────────
router.post('/webhook/stripe', paymentController.stripeWebhook);
router.post('/webhook/telebirr', paymentController.telebirrWebhook);
router.post('/webhook/cbe-birr', paymentController.cbeBirrWebhook);

// ─── Payment mode status (public — no auth) ───────────────────────────────────
router.get('/mode', paymentController.getPaymentModeStatus);

router.use(protect);

// ── Wallet ─────────────────────────────────────────────────────────────────────
router.get('/wallet', paymentController.getWallet);
router.get('/wallet/balance', paymentController.getWalletBalance);

// ── Deposits ───────────────────────────────────────────────────────────────────
router.post('/deposit/stripe', paymentLimiter, validate(depositSchema), paymentController.createStripeDeposit);
router.post('/deposit/chapa', paymentLimiter, validate(depositSchema), paymentController.createChapaDeposit);
router.get('/deposit/chapa/verify/:txRef', paymentController.verifyChapaDeposit);
router.post('/deposit/telebirr', paymentLimiter, validate(telebirrDepositSchema), paymentController.createTelebirrDeposit);
router.get('/deposit/telebirr/verify/:txRef', paymentController.verifyTelebirrDeposit);
router.post('/deposit/cbe-birr', paymentLimiter, validate(cbeBirrDepositSchema), paymentController.createCbeBirrDeposit);
router.get('/deposit/cbe-birr/verify/:txRef', paymentController.verifyCbeBirrDeposit);

// ── Demo Deposit (testing — no real money) ─────────────────────────────────────
router.post('/deposit/demo', paymentLimiter, validate(demoDepositSchema), paymentController.createDemoDepositCtrl);

// ── Withdrawals ────────────────────────────────────────────────────────────────
router.post('/withdraw', paymentLimiter, validate(withdrawSchema), paymentController.createWithdrawalCtrl);

// ── Escrow ─────────────────────────────────────────────────────────────────────
router.post('/escrow', paymentLimiter, validate(createEscrowSchema), paymentController.createEscrowCtrl);
router.post('/escrow/:escrowId/fund', paymentLimiter, paymentController.fundEscrowCtrl);
router.post('/escrow/:escrowId/start', paymentController.startEscrowWorkCtrl);
router.post('/escrow/:escrowId/submit', paymentController.submitEscrowWorkCtrl);
router.post('/escrow/:escrowId/release', paymentLimiter, validate(releaseEscrowSchema), paymentController.releaseEscrowCtrl);
router.post('/escrow/:escrowId/refund', paymentLimiter, validate(refundEscrowSchema), paymentController.refundEscrowCtrl);
router.get('/escrow', paymentController.getMyEscrows);
router.get('/escrow/:escrowId', paymentController.getEscrow);

// ── History & Invoices ─────────────────────────────────────────────────────────
router.get('/transactions', paymentController.getTransactions);
router.get('/history', paymentController.getPaymentHistory);
router.get('/invoices/:paymentId', paymentController.getInvoice);
router.get('/invoices/:paymentId/download', downloadInvoicePDF);

// ── Earnings ────────────────────────────────────────────────────────────────────
router.get('/earnings', paymentController.getEarnings);
router.get('/earnings/chart', paymentController.getEarningsChart);

// ── Payment Methods ─────────────────────────────────────────────────────────────
router.get('/payment-methods', paymentController.getPaymentMethods);
router.post('/payment-methods', paymentLimiter, paymentController.createPaymentMethod);
router.put('/payment-methods/:methodId', paymentLimiter, paymentController.updatePaymentMethod);
router.put('/payment-methods/:methodId/default', paymentLimiter, paymentController.setDefaultPaymentMethod);
router.delete('/payment-methods/:methodId', paymentLimiter, paymentController.deletePaymentMethod);

// ── Withdrawal History ─────────────────────────────────────────────────────────
router.get('/withdrawals', paymentController.getWithdrawals);

// ── Receipts ───────────────────────────────────────────────────────────────────
router.get('/receipts/:receiptId', paymentController.getReceipt);
router.get('/receipts/reference/:reference', paymentController.getReceiptByReference);

// ── Admin: Commission & Provider Stats ─────────────────────────────────────────
router.get('/admin/commissions', authorize('admin'), paymentController.getCommissionReport);
router.get('/admin/providers', authorize('admin'), paymentController.getProviderStats);

export default router;
