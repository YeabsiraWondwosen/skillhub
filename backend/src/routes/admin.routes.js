import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { adminOnly } from '../middleware/rbac.middleware.js';
import { uploadBrandingLogo, handleMulterError } from '../middleware/upload.middleware.js';

const router = Router();
router.use(protect, adminOnly);

router.get('/dashboard', adminController.getDashboardStats);
router.get('/users', adminController.getUsers);
router.get('/users/stats', adminController.getUserRegistrationStats);
router.get('/users/:userId', adminController.getUserDetail);
router.patch('/users/:userId', adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);
router.get('/jobs', adminController.getAdminJobs);
router.get('/jobs/:jobId', adminController.getAdminJob);
router.patch('/jobs/:jobId/moderate', adminController.moderateJob);
router.get('/projects', adminController.getAdminProjects);
router.get('/reviews', adminController.getAdminReviews);
router.patch('/reviews/:reviewId/moderate', adminController.moderateReview);
router.get('/reports', adminController.getReports);
router.get('/reports/stats', adminController.getReportStats);
router.get('/reports/:reportId', adminController.getReportDetail);
router.patch('/reports/:reportId/status', adminController.updateReportStatus);
router.patch('/reports/:reportId/notes', adminController.addReportNote);
router.patch('/reports/:reportId/investigation', adminController.updateReportInvestigation);
router.patch('/reports/:reportId/resolve', adminController.resolveReport);
router.get('/payments', adminController.getAdminPayments);
router.get('/settings/platform', adminController.getPlatformSettings);
router.patch('/settings/platform', adminController.updatePlatformSettings);
router.post('/settings/platform/logo', handleMulterError(uploadBrandingLogo), adminController.uploadPlatformSettingsLogo);
router.patch('/settings/commission', adminController.updateCommissionSettings);

export default router;
