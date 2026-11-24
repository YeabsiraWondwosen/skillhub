import { Router } from 'express';
import * as supportController from '../controllers/support.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

// ─── AI Chat (optional auth — personalized for logged-in users) ──────────────
router.post('/chat', optionalAuth, supportController.aiChat);

// ─── Protected routes ─────────────────────────────────────────────────────────
router.use(protect);

// User ticket management
router.post('/tickets', supportController.createSupportTicket);
router.get('/tickets/my', supportController.getMyTickets);
router.get('/tickets/:ticketId', supportController.getTicket);
router.post('/tickets/:ticketId/reply', supportController.replyToTicket);
router.post('/tickets/:ticketId/rate', supportController.rateTicket);

// ─── Admin routes ─────────────────────────────────────────────────────────────
router.get('/admin/tickets', authorize('admin'), supportController.adminGetAllTickets);
router.get('/admin/stats', authorize('admin'), supportController.adminGetTicketStats);
router.post('/admin/tickets/:ticketId/reply', authorize('admin'), supportController.adminReplyToTicket);
router.patch('/admin/tickets/:ticketId/resolve', authorize('admin'), supportController.adminResolveTicket);
router.get('/admin/tickets/:ticketId/context', authorize('admin'), supportController.adminGetTicketContext);
router.get('/admin/tickets/:ticketId', authorize('admin'), supportController.adminGetTicket);
router.patch('/admin/tickets/:ticketId/status', authorize('admin'), supportController.adminUpdateTicketStatus);
router.patch('/admin/tickets/:ticketId/priority', authorize('admin'), supportController.adminUpdateTicketPriority);
router.post('/admin/tickets/:ticketId/notes', authorize('admin'), supportController.adminAddInternalNote);
router.patch('/admin/tickets/:ticketId/investigation', authorize('admin'), supportController.adminSaveInvestigation);

export default router;
