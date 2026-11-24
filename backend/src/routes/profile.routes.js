import { Router } from 'express';
import * as profileController from '../controllers/profile.controller.js';
import * as availabilityController from '../controllers/availability.controller.js';
import * as meetingController from '../controllers/meeting.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { availabilityValidation } from '../validations/availability.validation.js';
import { meetingValidation } from '../validations/meeting.validation.js';

const router = Router();
router.use(protect);

// Legacy endpoints — delegated to the production controllers so the old URL
// surface stays alive and enforces the exact same business rules.
router.patch('/availability', validate(availabilityValidation.updateStatus), availabilityController.updateMyStatus);

router.post('/meetings', validate(meetingValidation.createMeetingLegacy), meetingController.createMeetingLegacy);
router.get('/meetings', validate(meetingValidation.listMeetings, 'query'), meetingController.myMeetings);
router.patch(
  '/meetings/:meetingId',
  validate(meetingValidation.meetingParams, 'params'),
  validate(meetingValidation.updateMeetingStatus),
  meetingController.updateMeetingStatus
);

// My intro video
router.patch('/me/intro-video', profileController.updateIntroVideo);

// Profile analytics, trust score, AI summary, resume
router.get('/:userId/analytics', profileController.getProfileAnalytics);
router.get('/:userId/trust-score', profileController.getAIMTrustScore);
router.get('/:userId/ai-summary', profileController.getAISummary);
router.get('/:userId/resume', profileController.downloadResume);

// Follow system
router.post('/:userId/follow', profileController.followUser);
router.delete('/:userId/follow', profileController.unfollowUser);
router.get('/:userId/is-following', profileController.isFollowing);
router.get('/:userId/followers', profileController.getFollowers);
router.get('/:userId/following', profileController.getFollowing);
router.get('/:userId/followers-count', profileController.getFollowersCount);
router.get('/:userId/following-count', profileController.getFollowingCount);

export default router;
