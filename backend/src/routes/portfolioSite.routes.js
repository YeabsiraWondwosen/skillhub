import { Router } from 'express';
import * as portfolioSiteController from '../controllers/portfolioSite.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

// ─── Public routes ───────────────────────────────────────────────────────────
router.get('/templates', portfolioSiteController.getTemplatesList);
router.get('/view/:slug', optionalAuth, portfolioSiteController.viewPublicSite);

// ─── Protected routes ────────────────────────────────────────────────────────
router.use(protect);
router.get('/my', portfolioSiteController.getMySites);
router.get('/stats', portfolioSiteController.getStats);
router.get('/:slug', portfolioSiteController.getSite);
router.get('/:slug/html', portfolioSiteController.getSiteHtml);
router.post('/generate', portfolioSiteController.generatePortfolio);
router.put('/:slug', portfolioSiteController.updateSite);
router.delete('/:slug', portfolioSiteController.deleteSite);
router.patch('/:slug/default', portfolioSiteController.setDefault);

export default router;
