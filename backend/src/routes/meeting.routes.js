import { Router } from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as meetingController from '../controllers/meeting.controller.js';
import { meetingValidation } from '../validations/meeting.validation.js';

const router = Router();

router.use(protect);

router.get('/', validate(meetingValidation.listMeetings, 'query'), meetingController.myMeetings);
router.post('/', validate(meetingValidation.createMeeting), meetingController.createMeeting);
router.get(
  '/:meetingId',
  validate(meetingValidation.meetingParams, 'params'),
  meetingController.meetingById
);
router.patch(
  '/:meetingId',
  validate(meetingValidation.meetingParams, 'params'),
  validate(meetingValidation.updateMeetingStatus),
  meetingController.updateMeetingStatus
);

export default router;