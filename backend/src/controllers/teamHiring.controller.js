import * as teamHiringService from '../services/teamHiring.service.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';

// ─── CRUD ────────────────────────────────────────────────────────────────────
export const createTeam = catchAsync(async (req, res) => {
  const team = await teamHiringService.createTeam(req.user._id, req.body);
  sendResponse(res, 201, 'Team created', team);
});

export const getTeams = catchAsync(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await teamHiringService.getTeams(req.user._id, { ...req.query, page, limit });
  sendResponse(res, 200, 'Teams fetched', result.teams, paginationMeta(result));
});

export const getTeam = catchAsync(async (req, res) => {
  const team = await teamHiringService.getTeam(req.params.teamId, req.user._id);
  if (!team) throw new ApiError(404, 'Team not found');
  sendResponse(res, 200, 'Team fetched', team);
});

export const updateTeam = catchAsync(async (req, res) => {
  const team = await teamHiringService.updateTeam(req.params.teamId, req.user._id, req.body);
  if (!team) throw new ApiError(404, 'Team not found');
  sendResponse(res, 200, 'Team updated', team);
});

export const deleteTeam = catchAsync(async (req, res) => {
  const team = await teamHiringService.deleteTeam(req.params.teamId, req.user._id);
  if (!team) throw new ApiError(404, 'Team not found');
  sendResponse(res, 200, 'Team deleted', null);
});

// ─── Members ─────────────────────────────────────────────────────────────────
export const addMember = catchAsync(async (req, res) => {
  const team = await teamHiringService.addMember(req.params.teamId, req.user._id, req.body);
  sendResponse(res, 200, 'Member added', team);
});

export const updateMember = catchAsync(async (req, res) => {
  const team = await teamHiringService.updateMember(
    req.params.teamId, req.user._id, req.params.memberId, req.body,
  );
  if (!team) throw new ApiError(404, 'Team or member not found');
  sendResponse(res, 200, 'Member updated', team);
});

export const removeMember = catchAsync(async (req, res) => {
  const team = await teamHiringService.removeMember(
    req.params.teamId, req.user._id, req.params.memberId, req.body.reason,
  );
  sendResponse(res, 200, 'Member removed', team);
});

export const updateMemberStatus = catchAsync(async (req, res) => {
  const team = await teamHiringService.updateMemberStatus(
    req.params.teamId, req.params.memberId, req.user._id, req.body.status,
  );
  sendResponse(res, 200, 'Member status updated', team);
});

// ─── Invitations ─────────────────────────────────────────────────────────────
export const sendInvitation = catchAsync(async (req, res) => {
  const result = await teamHiringService.sendInvitation(
    req.params.teamId, req.user._id, req.params.memberId, req.body.message,
  );
  sendResponse(res, 200, 'Invitation sent', result);
});

export const getInvitations = catchAsync(async (req, res) => {
  const invitations = await teamHiringService.getInvitations(req.params.teamId, req.user._id);
  sendResponse(res, 200, 'Invitations fetched', invitations);
});

export const cancelInvitation = catchAsync(async (req, res) => {
  const team = await teamHiringService.cancelInvitation(
    req.params.teamId, req.user._id, req.params.memberId,
  );
  sendResponse(res, 200, 'Invitation cancelled', team);
});

// ─── Tasks ───────────────────────────────────────────────────────────────────
export const addTask = catchAsync(async (req, res) => {
  const task = await teamHiringService.addTask(req.params.teamId, req.user._id, req.body);
  sendResponse(res, 201, 'Task created', task);
});

export const updateTask = catchAsync(async (req, res) => {
  const task = await teamHiringService.updateTask(
    req.params.teamId, req.user._id, req.params.taskId, req.body,
  );
  sendResponse(res, 200, 'Task updated', task);
});

export const deleteTask = catchAsync(async (req, res) => {
  await teamHiringService.deleteTask(req.params.teamId, req.user._id, req.params.taskId);
  sendResponse(res, 200, 'Task deleted', null);
});

export const addTaskComment = catchAsync(async (req, res) => {
  const comment = await teamHiringService.addTaskComment(
    req.params.teamId, req.user._id, req.params.taskId, req.body.content,
  );
  sendResponse(res, 201, 'Comment added', comment);
});

// ─── Messages ────────────────────────────────────────────────────────────────
export const sendMessage = catchAsync(async (req, res) => {
  const msg = await teamHiringService.sendMessage(req.params.teamId, req.user._id, req.body);
  sendResponse(res, 201, 'Message sent', msg);
});

export const getMessages = catchAsync(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await teamHiringService.getMessages(req.params.teamId, req.user._id, { page, limit });
  sendResponse(res, 200, 'Messages fetched', result.messages, paginationMeta(result));
});

// ─── Budget ──────────────────────────────────────────────────────────────────
export const initBudget = catchAsync(async (req, res) => {
  const team = await teamHiringService.initBudget(req.params.teamId, req.user._id, req.body);
  sendResponse(res, 200, 'Budget initialized', team);
});

export const addExpense = catchAsync(async (req, res) => {
  const expense = await teamHiringService.addExpense(req.params.teamId, req.user._id, req.body);
  sendResponse(res, 201, 'Expense added', expense);
});

export const approveExpense = catchAsync(async (req, res) => {
  const expense = await teamHiringService.approveExpense(
    req.params.teamId, req.user._id, req.params.expenseId, req.body.approved,
  );
  sendResponse(res, 200, 'Expense updated', expense);
});

export const getBudgetSummary = catchAsync(async (req, res) => {
  const summary = await teamHiringService.getBudgetSummary(req.params.teamId, req.user._id);
  sendResponse(res, 200, 'Budget summary', summary);
});

// ─── Roles ───────────────────────────────────────────────────────────────────
export const addRequiredRole = catchAsync(async (req, res) => {
  const team = await teamHiringService.addRequiredRole(req.params.teamId, req.user._id, req.body);
  sendResponse(res, 201, 'Role added', team);
});

export const updateRequiredRole = catchAsync(async (req, res) => {
  const role = await teamHiringService.updateRequiredRole(
    req.params.teamId, req.user._id, req.params.roleId, req.body,
  );
  sendResponse(res, 200, 'Role updated', role);
});

export const deleteRequiredRole = catchAsync(async (req, res) => {
  await teamHiringService.deleteRequiredRole(req.params.teamId, req.user._id, req.params.roleId);
  sendResponse(res, 200, 'Role deleted', null);
});

// ─── Milestones ──────────────────────────────────────────────────────────────
export const addMilestone = catchAsync(async (req, res) => {
  const milestone = await teamHiringService.addMilestone(req.params.teamId, req.user._id, req.body);
  sendResponse(res, 201, 'Milestone added', milestone);
});

export const updateMilestone = catchAsync(async (req, res) => {
  const milestone = await teamHiringService.updateMilestone(
    req.params.teamId, req.user._id, req.params.milestoneId, req.body,
  );
  sendResponse(res, 200, 'Milestone updated', milestone);
});

// ─── AI ──────────────────────────────────────────────────────────────────────
export const generateTeamRecommendation = catchAsync(async (req, res) => {
  const rec = await teamHiringService.generateTeamRecommendation(req.params.teamId, req.user._id);
  sendResponse(res, 200, 'Team recommendation generated', rec);
});

// ─── Analytics ───────────────────────────────────────────────────────────────
export const getTeamAnalytics = catchAsync(async (req, res) => {
  const analytics = await teamHiringService.getTeamAnalytics(req.params.teamId, req.user._id);
  sendResponse(res, 200, 'Team analytics', analytics);
});

export const getDashboardStats = catchAsync(async (req, res) => {
  const stats = await teamHiringService.getDashboardStats(req.user._id);
  sendResponse(res, 200, 'Dashboard stats', stats);
});
