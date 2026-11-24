import { Router } from 'express';
import * as teamHiringController from '../controllers/teamHiring.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

// ─── Dashboard ───────────────────────────────────────────────────────────────
router.get('/dashboard', teamHiringController.getDashboardStats);

// ─── Teams CRUD ──────────────────────────────────────────────────────────────
router.get('/', teamHiringController.getTeams);
router.post('/', teamHiringController.createTeam);
router.get('/:teamId', teamHiringController.getTeam);
router.patch('/:teamId', teamHiringController.updateTeam);
router.delete('/:teamId', teamHiringController.deleteTeam);

// ─── Members ─────────────────────────────────────────────────────────────────
router.post('/:teamId/members', teamHiringController.addMember);
router.patch('/:teamId/members/:memberId', teamHiringController.updateMember);
router.delete('/:teamId/members/:memberId', teamHiringController.removeMember);
router.patch('/:teamId/members/:memberId/status', teamHiringController.updateMemberStatus);

// ─── Invitations ─────────────────────────────────────────────────────────────
router.post('/:teamId/members/:memberId/invite', teamHiringController.sendInvitation);
router.get('/:teamId/invitations', teamHiringController.getInvitations);
router.patch('/:teamId/members/:memberId/cancel-invite', teamHiringController.cancelInvitation);

// ─── Required Roles ──────────────────────────────────────────────────────────
router.post('/:teamId/roles', teamHiringController.addRequiredRole);
router.patch('/:teamId/roles/:roleId', teamHiringController.updateRequiredRole);
router.delete('/:teamId/roles/:roleId', teamHiringController.deleteRequiredRole);

// ─── Tasks ───────────────────────────────────────────────────────────────────
router.post('/:teamId/tasks', teamHiringController.addTask);
router.patch('/:teamId/tasks/:taskId', teamHiringController.updateTask);
router.delete('/:teamId/tasks/:taskId', teamHiringController.deleteTask);
router.post('/:teamId/tasks/:taskId/comments', teamHiringController.addTaskComment);

// ─── Messages ────────────────────────────────────────────────────────────────
router.get('/:teamId/messages', teamHiringController.getMessages);
router.post('/:teamId/messages', teamHiringController.sendMessage);

// ─── Budget ──────────────────────────────────────────────────────────────────
router.post('/:teamId/budget', teamHiringController.initBudget);
router.get('/:teamId/budget', teamHiringController.getBudgetSummary);
router.post('/:teamId/budget/expenses', teamHiringController.addExpense);
router.patch('/:teamId/budget/expenses/:expenseId', teamHiringController.approveExpense);

// ─── Milestones ──────────────────────────────────────────────────────────────
router.post('/:teamId/milestones', teamHiringController.addMilestone);
router.patch('/:teamId/milestones/:milestoneId', teamHiringController.updateMilestone);

// ─── AI ──────────────────────────────────────────────────────────────────────
router.post('/:teamId/ai-recommendation', teamHiringController.generateTeamRecommendation);

// ─── Analytics ───────────────────────────────────────────────────────────────
router.get('/:teamId/analytics', teamHiringController.getTeamAnalytics);

export default router;
