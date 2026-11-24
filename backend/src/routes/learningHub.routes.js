import { Router } from 'express';
import * as lhController from '../controllers/learningHub.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

router.get('/dashboard', lhController.getDashboardStats);
router.get('/analysis', lhController.getSkillGapAnalysis);
router.get('/courses', lhController.getCourses);
router.get('/certifications', lhController.getCertifications);
router.get('/resources', lhController.getResources);
router.get('/plans', lhController.getPlans);
router.get('/plans/:planId', lhController.getPlan);

router.post('/plans', lhController.createPlan);
router.patch('/plans/:planId/status', lhController.updatePlanStatus);
router.patch('/plans/:planId/courses/:courseId', lhController.updateCourseProgress);
router.patch('/plans/:planId/certifications/:certId', lhController.updateCertProgress);
router.patch('/plans/:planId/resources/:resourceId', lhController.updateResourceProgress);
router.patch('/plans/:planId/resources/:resourceId/bookmark', lhController.toggleBookmark);
router.delete('/plans/:planId', lhController.deletePlan);

export default router;
