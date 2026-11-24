import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import {
  handleMulterError, uploadAvatar, uploadResume, uploadPortfolioImages,
} from '../middleware/upload.middleware.js';
import {
  updateUserSchema, updateProfileSchema,
  addExperienceSchema, addEducationSchema, addCertificationSchema, addPortfolioSchema,
  idParamSchemas,
} from '../validations/index.js';

const router = Router();

// ── Public search (no :userId param — no conflict) ────────────────
router.get('/freelancers', userController.searchFreelancers);

// ── All /me/* routes — protected, must come BEFORE /:userId ──────
router.use(protect);

router.patch('/me', validate(updateUserSchema), userController.updateMe);
router.post('/me/avatar', uploadLimiter, handleMulterError(uploadAvatar), userController.uploadUserAvatar);

router.get('/me/profile', userController.getMyProfile);
router.patch('/me/profile', validate(updateProfileSchema), userController.updateProfile);
router.post('/me/resume', uploadLimiter, handleMulterError(uploadResume), userController.uploadResume);

router.post('/me/experience', validate(addExperienceSchema), userController.addExperience);
router.put('/me/experience/:expId', validate(idParamSchemas.expId, 'params'), validate(addExperienceSchema), userController.updateExperience);
router.delete('/me/experience/:expId', validate(idParamSchemas.expId, 'params'), userController.deleteExperience);

router.post('/me/education', validate(addEducationSchema), userController.addEducation);
router.put('/me/education/:eduId', validate(idParamSchemas.eduId, 'params'), validate(addEducationSchema), userController.updateEducation);
router.delete('/me/education/:eduId', validate(idParamSchemas.eduId, 'params'), userController.deleteEducation);

router.post('/me/certifications', validate(addCertificationSchema), userController.addCertification);
router.put('/me/certifications/:certId', validate(idParamSchemas.certId, 'params'), validate(addCertificationSchema), userController.updateCertification);
router.delete('/me/certifications/:certId', validate(idParamSchemas.certId, 'params'), userController.deleteCertification);

router.post('/me/portfolio', uploadLimiter, handleMulterError(uploadPortfolioImages), validate(addPortfolioSchema), userController.addPortfolioItem);
router.put('/me/portfolio/:itemId', uploadLimiter, handleMulterError(uploadPortfolioImages), validate(idParamSchemas.itemId, 'params'), validate(addPortfolioSchema), userController.updatePortfolioItem);
router.delete('/me/portfolio/:itemId', validate(idParamSchemas.itemId, 'params'), userController.deletePortfolioItem);

router.get('/me/saved-jobs', userController.getSavedJobs);
router.post('/me/saved-jobs/:jobId', validate(idParamSchemas.jobId, 'params'), userController.toggleSaveJob);
router.delete('/me/saved-jobs/:jobId', validate(idParamSchemas.jobId, 'params'), userController.toggleSaveJob);

router.get('/me/saved-catalogs', userController.getSavedCatalogs);
router.post('/me/saved-catalogs/:catalogId', validate(idParamSchemas.catalogId, 'params'), userController.toggleSaveCatalog);
router.delete('/me/saved-catalogs/:catalogId', validate(idParamSchemas.catalogId, 'params'), userController.toggleSaveCatalog);

router.get('/search', userController.searchUsers);

// ── /:userId routes — AFTER all /me routes to avoid conflict ─────
router.get('/:userId/profile-card', validate(idParamSchemas.userId, 'params'), userController.getProfileCard);
router.get('/:userId/full-profile', validate(idParamSchemas.userId, 'params'), userController.getFullProfile);
router.get('/:userId/client-profile', validate(idParamSchemas.userId, 'params'), userController.getClientProfile);
router.get('/:userId/profile', validate(idParamSchemas.userId, 'params'), userController.getFreelancerProfile);
router.get('/:userId/stats', validate(idParamSchemas.userId, 'params'), userController.getUserStats);

export default router;
