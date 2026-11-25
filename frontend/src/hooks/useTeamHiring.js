import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamHiringService } from '@/services/teamHiring.service';
import toast from 'react-hot-toast';

export const thKeys = {
  all: ['team-hiring'],
  dashboard: () => ['team-hiring', 'dashboard'],
  list: (params) => ['team-hiring', 'list', params],
  detail: (id) => ['team-hiring', 'detail', id],
  messages: (id, params) => ['team-hiring', 'messages', id, params],
  budget: (id) => ['team-hiring', 'budget', id],
  invitations: (id) => ['team-hiring', 'invitations', id],
  analytics: (id) => ['team-hiring', 'analytics', id],
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const useTeamDashboard = () =>
  useQuery({
    queryKey: thKeys.dashboard(),
    queryFn: () => teamHiringService.getDashboardStats().then(r => r.data),
  });

// ─── Teams CRUD ──────────────────────────────────────────────────────────────
export const useTeams = (params) =>
  useQuery({
    queryKey: thKeys.list(params),
    queryFn: () => teamHiringService.getTeams(params).then(r => r.data),
  });

export const useTeam = (id) =>
  useQuery({
    queryKey: thKeys.detail(id),
    queryFn: () => teamHiringService.getTeam(id).then(r => r.data),
    enabled: !!id,
  });

export const useCreateTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teamHiringService.createTeam,
    onSuccess: () => { toast.success('Team created'); qc.invalidateQueries({ queryKey: thKeys.all }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
};

export const useUpdateTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => teamHiringService.updateTeam(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

export const useDeleteTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teamHiringService.deleteTeam,
    onSuccess: () => { toast.success('Team deleted'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

// ─── Members ─────────────────────────────────────────────────────────────────
export const useAddMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, data }) => teamHiringService.addMember(teamId, data),
    onSuccess: () => { toast.success('Member added'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

export const useUpdateMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, memberId, data }) => teamHiringService.updateMember(teamId, memberId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

export const useRemoveMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, memberId, reason }) => teamHiringService.removeMember(teamId, memberId, reason),
    onSuccess: () => { toast.success('Member removed'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

export const useUpdateMemberStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, memberId, status }) => teamHiringService.updateMemberStatus(teamId, memberId, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

// ─── Invitations ─────────────────────────────────────────────────────────────
export const useSendInvitation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, memberId, message }) => teamHiringService.sendInvitation(teamId, memberId, message),
    onSuccess: () => { toast.success('Invitation sent'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

export const useInvitations = (teamId) =>
  useQuery({
    queryKey: thKeys.invitations(teamId),
    queryFn: () => teamHiringService.getInvitations(teamId).then(r => r.data),
    enabled: !!teamId,
  });

export const useCancelInvitation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, memberId }) => teamHiringService.cancelInvitation(teamId, memberId),
    onSuccess: () => { toast.success('Invitation cancelled'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

// ─── Required Roles ──────────────────────────────────────────────────────────
export const useAddRequiredRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, data }) => teamHiringService.addRequiredRole(teamId, data),
    onSuccess: () => { toast.success('Role added'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

export const useUpdateRequiredRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, roleId, data }) => teamHiringService.updateRequiredRole(teamId, roleId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

export const useDeleteRequiredRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, roleId }) => teamHiringService.deleteRequiredRole(teamId, roleId),
    onSuccess: () => { toast.success('Role deleted'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

// ─── Tasks ───────────────────────────────────────────────────────────────────
export const useAddTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, data }) => teamHiringService.addTask(teamId, data),
    onSuccess: () => { toast.success('Task created'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, taskId, data }) => teamHiringService.updateTask(teamId, taskId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, taskId }) => teamHiringService.deleteTask(teamId, taskId),
    onSuccess: () => { toast.success('Task deleted'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

// ─── Messages ────────────────────────────────────────────────────────────────
export const useTeamMessages = (teamId, params) =>
  useQuery({
    queryKey: thKeys.messages(teamId, params),
    queryFn: () => teamHiringService.getMessages(teamId, params).then(r => r.data),
    enabled: !!teamId,
  });

export const useSendMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, data }) => teamHiringService.sendMessage(teamId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

// ─── Budget ──────────────────────────────────────────────────────────────────
export const useInitBudget = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, data }) => teamHiringService.initBudget(teamId, data),
    onSuccess: () => { toast.success('Budget initialized'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

export const useBudgetSummary = (teamId) =>
  useQuery({
    queryKey: thKeys.budget(teamId),
    queryFn: () => teamHiringService.getBudgetSummary(teamId).then(r => r.data),
    enabled: !!teamId,
  });

export const useAddExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, data }) => teamHiringService.addExpense(teamId, data),
    onSuccess: () => { toast.success('Expense added'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

export const useApproveExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, expenseId, approved }) => teamHiringService.approveExpense(teamId, expenseId, approved),
    onSuccess: () => { qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

// ─── Milestones ──────────────────────────────────────────────────────────────
export const useAddMilestone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, data }) => teamHiringService.addMilestone(teamId, data),
    onSuccess: () => { toast.success('Milestone added'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

export const useUpdateMilestone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, milestoneId, data }) => teamHiringService.updateMilestone(teamId, milestoneId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

// ─── AI ──────────────────────────────────────────────────────────────────────
export const useGenerateTeamRecommendation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teamHiringService.generateTeamRecommendation,
    onSuccess: () => { toast.success('AI recommendation generated'); qc.invalidateQueries({ queryKey: thKeys.all }); },
  });
};

// ─── Analytics ───────────────────────────────────────────────────────────────
export const useTeamAnalytics = (teamId) =>
  useQuery({
    queryKey: thKeys.analytics(teamId),
    queryFn: () => teamHiringService.getTeamAnalytics(teamId).then(r => r.data),
    enabled: !!teamId,
  });
