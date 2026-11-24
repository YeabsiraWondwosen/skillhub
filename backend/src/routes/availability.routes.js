import { Router } from 'express';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as availabilityController from '../controllers/availability.controller.js';
import { availabilityValidation } from '../validations/availability.validation.js';

const router = Router();

// Authenticated (owner) endpoints
router.get('/me', protect, availabilityController.getMyAvailability);
router.patch('/status', protect, validate(availabilityValidation.updateStatus), availabilityController.updateMyStatus);
router.get('/slots', protect, availabilityController.getMySlots);
router.put('/slots', protect, validate(availabilityValidation.saveSlots), availabilityController.saveMySlots);

// Public availability for a freelancer (used by the client booking flow)
router.get(
  '/public/:userId',
  optionalAuth,
  validate(availabilityValidation.userParams, 'params'),
  availabilityController.getPublicAvailability
);
router.get(
  '/public/:userId/slots',
  optionalAuth,
  validate(availabilityValidation.userParams, 'params'),
  validate(availabilityValidation.publicQuery, 'query'),
  availabilityController.getPublicSlots
);

export default router;