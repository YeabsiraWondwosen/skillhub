import { Router } from 'express';
import * as c from '../controllers/adminService.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';

const router = Router();

// All admin service routes require an authenticated admin.
router.use(protect);
router.use(authorize('admin'));

// ─── Catalog Management ──────────────────────────────────────────────────────
router.get('/services/catalogs', c.getAdminCatalogs);
router.get('/services/catalogs/:catalogId', c.getAdminCatalog);
router.patch('/services/catalogs/:catalogId', c.updateAdminCatalog);
router.patch('/services/catalogs/:catalogId/status', c.updateAdminCatalogStatus);
router.patch('/services/catalogs/:catalogId/feature', c.toggleAdminCatalogFeatured);
router.delete('/services/catalogs/:catalogId', c.deleteAdminCatalog);

// ─── Featured Services ───────────────────────────────────────────────────────
router.get('/services/featured', c.getAdminFeaturedCatalogs);

// ─── Service Orders ──────────────────────────────────────────────────────────
router.get('/services/orders', c.getAdminServiceOrders);
router.get('/services/orders/:orderId', c.getAdminServiceOrder);
router.post('/services/orders/:orderId/cancel', c.adminCancelServiceOrder);
router.post('/services/orders/:orderId/refund', c.adminRefundServiceOrder);
router.post('/services/orders/:orderId/complete', c.adminCompleteServiceOrder);
router.post('/services/orders/:orderId/resolve-dispute', c.adminResolveServiceOrderDispute);

// ─── Reported Services ───────────────────────────────────────────────────────
router.get('/services/reported', c.getAdminReportedServices);
router.post('/services/reported/:reportId/dismiss', c.adminDismissReportedService);
router.post('/services/reported/:reportId/warn', c.adminWarnReportedFreelancer);
router.post('/services/reported/:reportId/remove', c.adminRemoveReportedService);
router.post('/services/reported/:reportId/suspend', c.adminSuspendReportedFreelancer);

// ─── Service Analytics ───────────────────────────────────────────────────────
router.get('/services/analytics', c.getAdminServiceAnalytics);

export default router;
