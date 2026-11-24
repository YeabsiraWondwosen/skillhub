import { Router } from 'express';
import * as recruiterController from '../controllers/recruiter.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

router.get('/freelancers', recruiterController.searchFreelancers);
router.get('/freelancers/:freelancerId', recruiterController.getFreelancer);
router.post('/compare', recruiterController.compareCandidates);
router.get('/analytics', recruiterController.getAnalytics);

router.get('/pipelines', recruiterController.getPipelines);
router.get('/pipelines/:pipelineId', recruiterController.getPipeline);
router.post('/pipelines', recruiterController.createPipeline);
router.patch('/pipelines/:pipelineId', recruiterController.updatePipeline);
router.delete('/pipelines/:pipelineId', recruiterController.deletePipeline);

router.post('/pipelines/:pipelineId/candidates', recruiterController.addCandidate);
router.patch('/pipelines/:pipelineId/candidates/:candidateId/move', recruiterController.moveCandidate);
router.patch('/pipelines/:pipelineId/candidates/:candidateId/rate', recruiterController.rateCandidate);
router.post('/pipelines/:pipelineId/candidates/:candidateId/notes', recruiterController.addCandidateNote);
router.delete('/pipelines/:pipelineId/candidates/:candidateId', recruiterController.removeCandidate);

router.post('/pipelines/:pipelineId/invitations', recruiterController.sendInvitation);
router.get('/pipelines/:pipelineId/invitations', recruiterController.getInvitations);
router.patch('/pipelines/:pipelineId/invitations/:invitationId/cancel', recruiterController.cancelInvitation);

export default router;
