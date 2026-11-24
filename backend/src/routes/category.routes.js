import { Router } from 'express';
import * as categoryController from '../controllers/category.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import Joi from 'joi';

const router = Router();

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().max(500).allow('', null),
  icon: Joi.string().max(40).allow('', null),
  color: Joi.string().pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/).allow('', null),
  bannerImage: Joi.string().uri().allow('', null),
  parent: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null, ''),
  featured: Joi.boolean(),
  skills: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)),
  order: Joi.number().integer(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  description: Joi.string().max(500).allow('', null),
  icon: Joi.string().max(40).allow('', null),
  color: Joi.string().pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/).allow('', null),
  bannerImage: Joi.string().uri().allow('', null),
  parent: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null, ''),
  isActive: Joi.boolean(),
  isHidden: Joi.boolean(),
  featured: Joi.boolean(),
  skills: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)),
  order: Joi.number().integer(),
}).min(1);

const reorderSchema = Joi.object({
  orderedIds: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).min(1).required(),
});

const bulkActionSchema = Joi.object({
  ids: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).min(1).required(),
  action: Joi.string()
    .valid('activate', 'deactivate', 'feature', 'unfeature', 'hide', 'show', 'delete')
    .required(),
});

// ─── Admin routes MUST be declared before the generic /:id wildcard ─────────
// If /:id comes first, Express matches "admin" as an id and never reaches
// these routes. Keep ALL /admin/... paths above /:id.
router.get('/admin/stats', protect, authorize('admin'), categoryController.getCategoriesStats);
router.get('/admin/all', protect, authorize('admin'), categoryController.getAllCategoriesAdmin);
router.get('/admin/tree', protect, authorize('admin'), categoryController.getAdminCategoryTree);
router.get('/admin/overview', protect, authorize('admin'), categoryController.getAdminCategoryOverview);
router.get('/admin/:id/overview', protect, authorize('admin'), categoryController.getAdminCategoryDetail);
router.get('/admin/:id/freelancers', protect, authorize('admin'), categoryController.getAdminCategoryFreelancers);
router.get('/admin/:id/jobs', protect, authorize('admin'), categoryController.getAdminCategoryJobs);
router.get('/admin/:id/services', protect, authorize('admin'), categoryController.getAdminCategoryServices);
router.post('/admin/seed', protect, authorize('admin'), categoryController.seedCategories);
router.post('/admin', protect, authorize('admin'), validate(createCategorySchema), categoryController.createCategory);
router.put('/admin/reorder', protect, authorize('admin'), validate(reorderSchema), categoryController.reorderCategories);
router.post('/admin/bulk', protect, authorize('admin'), validate(bulkActionSchema), categoryController.bulkCategoriesAction);
router.put('/admin/skills/:skillId/toggle-active', protect, authorize('admin'), categoryController.toggleSkillActive);
router.put('/admin/skills/:skillId', protect, authorize('admin'), categoryController.updateSkill);
router.delete('/admin/skills/:skillId', protect, authorize('admin'), categoryController.deleteSkill);
router.post('/admin/:id/skills', protect, authorize('admin'), categoryController.createSkill);
router.put('/admin/:id/toggle-featured', protect, authorize('admin'), categoryController.toggleFeatured);
router.put('/admin/:id/toggle-hidden', protect, authorize('admin'), categoryController.toggleHidden);
router.put('/admin/:id', protect, authorize('admin'), validate(updateCategorySchema), categoryController.updateCategory);
router.delete('/admin/:id', protect, authorize('admin'), categoryController.deleteCategory);

// ─── Public routes (generic /:id wildcard MUST come after all /admin/* paths) ─
router.get('/', categoryController.getCategories);
router.get('/tree', categoryController.getCategoryTree);
router.get('/by-slug/:slug', categoryController.getCategoryBySlug);
router.get('/:id/skills', categoryController.getSkillsByCategory);
router.get('/:id/subcategories', categoryController.getSubcategoriesByCategory);
router.get('/:id', categoryController.getCategory);

export default router;
