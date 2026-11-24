import { logger } from '../utils/logger.js';
import { TeamHiring, User, Profile, Job, Application, ReputationScore, Project } from '../models/index.js';
import crypto from 'crypto';
import { chatJSON, isAIAvailable } from './aiClient.js';
import { isDateOnlyInPast } from '../utils/dateValidation.js';
import { ApiError } from '../utils/apiResponse.js';

const AI_AVAILABLE = isAIAvailable();

const safeAI = async (fn, fallback) => {
  if (!AI_AVAILABLE) return fallback;
  try { return await fn(); } catch (err) {
    logger.error(`TeamHiring AI error: ${err.message}`);
    return fallback;
  }
};

// ─── CRUD ────────────────────────────────────────────────────────────────────
const TEAM_DATE_FIELDS = ['startDate', 'endDate', 'deadline'];

const rejectPastDates = (data, fields) => {
  for (const field of fields) {
    const val = data[field];
    if (!val) continue;
    const result = isDateOnlyInPast(val);
    if (!result.valid) {
      throw new ApiError(400, `${field}: ${result.message}`);
    }
  }
};

export const createTeam = async (clientId, data) => {
  rejectPastDates(data, TEAM_DATE_FIELDS);
  return TeamHiring.create({ ...data, client: clientId, status: 'planning' });
};

export const getTeams = async (clientId, filters = {}) => {
  const { status, page = 1, limit = 20 } = filters;
  const q = { client: clientId };
  if (status) q.status = status;
  const total = await TeamHiring.countDocuments(q);
  const teams = await TeamHiring.find(q)
    .populate('project', 'title')
    .populate('members.freelancer', 'name email avatar')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(Number(limit));
  return { teams, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
};

export const getTeam = async (teamId, clientId) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId })
    .populate('project', 'title description')
    .populate('members.freelancer', 'name email avatar role')
    .populate('tasks.assignedTo', 'name avatar')
    .populate('tasks.comments.author', 'name avatar')
    .populate('messages.sender', 'name avatar')
    .populate('budget.allocations.member', 'name avatar')
    .populate('budget.expenses.paidTo', 'name')
    .populate('budget.expenses.approvedBy', 'name');
  return team;
};

export const updateTeam = async (teamId, clientId, data) => {
  rejectPastDates(data, TEAM_DATE_FIELDS);
  return TeamHiring.findOneAndUpdate(
    { _id: teamId, client: clientId },
    { $set: data },
    { new: true, runValidators: true },
  );
};

export const deleteTeam = async (teamId, clientId) => {
  return TeamHiring.findOneAndDelete({ _id: teamId, client: clientId });
};

// ─── Members ─────────────────────────────────────────────────────────────────
export const addMember = async (teamId, clientId, data) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');

  const exists = team.members.some(m => m.freelancer.toString() === data.freelancer);
  if (exists) throw new Error('Freelancer already in team');

  team.members.push({ ...data, status: data.inviteDirectly ? 'invited' : 'pending', addedBy: clientId });
  await team.save();
  return team;
};

export const updateMember = async (teamId, clientId, memberId, data) => {
  return TeamHiring.findOneAndUpdate(
    { _id: teamId, client: clientId, 'members._id': memberId },
    { $set: { [`members.$.${Object.keys(data)[0]}`]: Object.values(data)[0] } },
    { new: true, runValidators: true },
  );
};

export const removeMember = async (teamId, clientId, memberId, reason) => {
  return TeamHiring.findOneAndUpdate(
    { _id: teamId, client: clientId, 'members._id': memberId },
    {
      $set: {
        'members.$.status': 'removed',
        'members.$.removedAt': new Date(),
        'members.$.removedReason': reason || 'Removed by client',
      },
    },
    { new: true },
  );
};

export const updateMemberStatus = async (teamId, memberId, userId, status) => {
  const team = await TeamHiring.findOne({ _id: teamId, 'members._id': memberId });
  if (!team) throw new Error('Team not found');

  const member = team.members.id(memberId);
  if (!member) throw new Error('Member not found');
  if (member.freelancer.toString() !== userId) throw new Error('Unauthorized');

  member.status = status;
  if (status === 'accepted') member.joinedAt = new Date();
  await team.save();
  return team;
};

// ─── Invitations ─────────────────────────────────────────────────────────────
export const sendInvitation = async (teamId, clientId, memberId, message) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');

  const member = team.members.id(memberId);
  if (!member) throw new Error('Member not found');

  const token = crypto.randomBytes(32).toString('hex');
  member.status = 'invited';
  member.invitation = {
    message: message || '',
    invitedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    token,
  };
  await team.save();
  return { token, expiresAt: member.invitation.expiresAt };
};

export const getInvitations = async (teamId, clientId) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId })
    .populate('members.freelancer', 'name email avatar');
  if (!team) throw new Error('Team not found');
  return team.members.filter(m => m.status === 'invited' || m.status === 'pending');
};

export const cancelInvitation = async (teamId, clientId, memberId) => {
  return TeamHiring.findOneAndUpdate(
    { _id: teamId, client: clientId, 'members._id': memberId },
    { $set: { 'members.$.status': 'pending', 'members.$.invitation': null } },
    { new: true },
  );
};

// ─── Tasks ───────────────────────────────────────────────────────────────────
export const addTask = async (teamId, clientId, data) => {
  rejectPastDates(data, ['dueDate']);
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');
  team.tasks.push(data);
  await team.save();
  return team.tasks[team.tasks.length - 1];
};

export const updateTask = async (teamId, clientId, taskId, data) => {
  rejectPastDates(data, ['dueDate']);
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');
  const task = team.tasks.id(taskId);
  if (!task) throw new Error('Task not found');
  Object.assign(task, data);
  if (data.status === 'done') {
    task.completedAt = new Date();
    task.completedBy = clientId;
  }
  await team.save();
  return task;
};

export const deleteTask = async (teamId, clientId, taskId) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');
  team.tasks.pull(taskId);
  await team.save();
  return team;
};

export const addTaskComment = async (teamId, clientId, taskId, content) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');
  const task = team.tasks.id(taskId);
  if (!task) throw new Error('Task not found');
  task.comments.push({ author: clientId, content });
  await team.save();
  return task.comments[task.comments.length - 1];
};

// ─── Messages ────────────────────────────────────────────────────────────────
export const sendMessage = async (teamId, userId, data) => {
  const team = await TeamHiring.findById(teamId);
  if (!team) throw new Error('Team not found');
  const isMember = team.client.toString() === userId || team.members.some(m => m.freelancer.toString() === userId && m.status === 'active');
  if (!isMember) throw new Error('Not a team member');
  team.messages.push({ sender: userId, ...data });
  await team.save();
  return team.messages[team.messages.length - 1];
};

export const getMessages = async (teamId, userId, { page = 1, limit = 50 } = {}) => {
  const team = await TeamHiring.findById(teamId).populate('messages.sender', 'name avatar');
  if (!team) throw new Error('Team not found');
  const msgs = team.messages.slice().reverse();
  const total = msgs.length;
  const paginated = msgs.slice((page - 1) * limit, page * limit);
  return { messages: paginated.reverse(), total, page: Number(page), limit: Number(limit) };
};

// ─── Budget ──────────────────────────────────────────────────────────────────
export const initBudget = async (teamId, clientId, data) => {
  return TeamHiring.findOneAndUpdate(
    { _id: teamId, client: clientId },
    { $set: { budget: data } },
    { new: true, runValidators: true },
  );
};

export const addExpense = async (teamId, clientId, data) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');
  if (!team.budget) throw new Error('Budget not initialized');
  team.budget.expenses.push({ ...data, status: 'pending' });
  team.budget.spentBudget += data.amount;
  await team.save();
  return team.budget.expenses[team.budget.expenses.length - 1];
};

export const approveExpense = async (teamId, clientId, expenseId, approved) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');
  const expense = team.budget.expenses.id(expenseId);
  if (!expense) throw new Error('Expense not found');
  expense.status = approved ? 'approved' : 'rejected';
  expense.approvedBy = clientId;
  expense.approvedAt = new Date();
  if (!approved) team.budget.spentBudget -= expense.amount;
  await team.save();
  return expense;
};

export const getBudgetSummary = async (teamId, clientId) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId }).lean();
  if (!team || !team.budget) return null;
  const b = team.budget;
  const approvedExpenses = b.expenses.filter(e => e.status === 'approved');
  const pendingExpenses = b.expenses.filter(e => e.status === 'pending');
  return {
    ...b,
    approvedTotal: approvedExpenses.reduce((s, e) => s + e.amount, 0),
    pendingTotal: pendingExpenses.reduce((s, e) => s + e.amount, 0),
    remaining: b.totalBudget - b.spentBudget,
    utilizationPct: b.totalBudget > 0 ? ((b.spentBudget / b.totalBudget) * 100).toFixed(1) : 0,
  };
};

// ─── Roles ───────────────────────────────────────────────────────────────────
export const addRequiredRole = async (teamId, clientId, data) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');
  team.requiredRoles.push(data);
  await team.save();
  return team.requiredRoles[team.requiredRoles.length - 1];
};

export const updateRequiredRole = async (teamId, clientId, roleId, data) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');
  const role = team.requiredRoles.id(roleId);
  if (!role) throw new Error('Role not found');
  Object.assign(role, data);
  await team.save();
  return role;
};

export const deleteRequiredRole = async (teamId, clientId, roleId) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');
  team.requiredRoles.pull(roleId);
  await team.save();
  return team;
};

// ─── Milestones ──────────────────────────────────────────────────────────────
export const addMilestone = async (teamId, clientId, data) => {
  rejectPastDates(data, ['dueDate']);
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');
  team.milestones.push(data);
  await team.save();
  return team.milestones[team.milestones.length - 1];
};

export const updateMilestone = async (teamId, clientId, milestoneId, data) => {
  rejectPastDates(data, ['dueDate']);
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId });
  if (!team) throw new Error('Team not found');
  const ms = team.milestones.id(milestoneId);
  if (!ms) throw new Error('Milestone not found');
  Object.assign(ms, data);
  if (data.status === 'completed') ms.completedAt = new Date();
  await team.save();
  return ms;
};

// ─── AI Team Recommendation ─────────────────────────────────────────────────
export const generateTeamRecommendation = async (teamId, clientId) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId })
    .populate('project', 'title description')
    .lean();
  if (!team) throw new Error('Team not found');

  return safeAI(async () => {
    const prompt = `You are an expert tech team builder. Analyze this project and recommend optimal team composition.

Project: ${team.project?.title || team.title}
Description: ${team.description || 'No description'}
Required Roles: ${JSON.stringify(team.requiredRoles)}
Current Members: ${team.members?.length || 0}
Budget: ${team.budget?.totalBudget || 'Not set'}

Provide:
1. Suggested roles with skills and estimated hourly rates
2. Risk factors for this team composition
3. Estimated timeline
4. Team composition score (1-100)

Return JSON: { suggestedRoles: [{ title, skills, reason, estimatedRate }], riskFactors: [string], estimatedTimeline: string, teamCompositionScore: number }`;

    const parsed = await chatJSON(
      'You are an expert tech team builder. Return only valid JSON.',
      prompt,
      0.7,
      2000
    );

    await TeamHiring.findByIdAndUpdate(teamId, {
      $set: {
        aiRecommendations: {
          generatedAt: new Date(),
          ...parsed,
        },
      },
    });

    return parsed;
  }, {
    suggestedRoles: team.requiredRoles?.map(r => ({
      title: r.title,
      skills: r.skills || [],
      reason: 'Based on role requirements',
      estimatedRate: r.maxRate || 50,
    })) || [],
    riskFactors: ['AI recommendations unavailable'],
    estimatedTimeline: 'Unable to estimate',
    teamCompositionScore: 50,
  });
};

// ─── Team Analytics ──────────────────────────────────────────────────────────
export const getTeamAnalytics = async (teamId, clientId) => {
  const team = await TeamHiring.findOne({ _id: teamId, client: clientId }).lean();
  if (!team) throw new Error('Team not found');

  const membersByStatus = {};
  team.members.forEach(m => {
    membersByStatus[m.status] = (membersByStatus[m.status] || 0) + 1;
  });

  const tasksByStatus = {};
  team.tasks.forEach(t => {
    tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
  });

  const tasksByAssignee = {};
  team.tasks.forEach(t => {
    const key = t.assignedTo?.toString() || 'unassigned';
    tasksByAssignee[key] = (tasksByAssignee[key] || 0) + 1;
  });

  const overdueTasks = team.tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length;
  const completedTasks = team.tasks.filter(t => t.status === 'done').length;
  const totalTasks = team.tasks.length;

  return {
    totalMembers: team.members.length,
    activeMembers: membersByStatus.active || 0,
    membersByStatus,
    totalTasks,
    completedTasks,
    overdueTasks,
    tasksByStatus,
    tasksByAssignee,
    completionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0,
    budget: team.budget ? {
      total: team.budget.totalBudget,
      spent: team.budget.spentBudget,
      remaining: team.budget.totalBudget - team.budget.spentBudget,
      utilization: team.budget.totalBudget > 0
        ? ((team.budget.spentBudget / team.budget.totalBudget) * 100).toFixed(1) : 0,
    } : null,
    teamStatus: team.status,
    daysActive: team.startDate
      ? Math.floor((new Date() - new Date(team.startDate)) / (1000 * 60 * 60 * 24)) : 0,
  };
};

// ─── Dashboard Stats ─────────────────────────────────────────────────────────
export const getDashboardStats = async (clientId) => {
  const teams = await TeamHiring.find({ client: clientId }).lean();

  const totalTeams = teams.length;
  const activeTeams = teams.filter(t => t.status === 'active').length;
  const totalMembers = teams.reduce((s, t) => s + t.members.length, 0);
  const activeMembers = teams.reduce((s, t) =>
    s + t.members.filter(m => m.status === 'active').length, 0);
  const totalTasks = teams.reduce((s, t) => s + t.tasks.length, 0);
  const completedTasks = teams.reduce((s, t) =>
    s + t.tasks.filter(tk => tk.status === 'done').length, 0);

  const teamsByStatus = {};
  teams.forEach(t => {
    teamsByStatus[t.status] = (teamsByStatus[t.status] || 0) + 1;
  });

  return {
    totalTeams,
    activeTeams,
    totalMembers,
    activeMembers,
    totalTasks,
    completedTasks,
    taskCompletionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0,
    teamsByStatus,
  };
};
