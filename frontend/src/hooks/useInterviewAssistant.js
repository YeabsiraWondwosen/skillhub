import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interviewAssistantService } from '@/services/interviewAssistant.service';
import toast from 'react-hot-toast';

export const iaKeys = {
  all: ['interview-assistant'],
  sessions: (params) => ['interview-assistant', 'sessions', params],
  session: (id) => ['interview-assistant', 'session', id],
  analytics: () => ['interview-assistant', 'analytics'],
};

// ─── AI Generation ───────────────────────────────────────────────────────────
export const useGenerateQuestions = () =>
  useMutation({ mutationFn: interviewAssistantService.generateQuestions });

export const useGenerateChallenge = () =>
  useMutation({ mutationFn: interviewAssistantService.generateCodingChallenge });

export const useEvaluateAnswer = () =>
  useMutation({ mutationFn: interviewAssistantService.evaluateAnswer });

export const useEvaluateCode = () =>
  useMutation({ mutationFn: interviewAssistantService.evaluateCode });

// ─── Sessions ────────────────────────────────────────────────────────────────
export const useInterviewSessions = (params) =>
  useQuery({
    queryKey: iaKeys.sessions(params),
    queryFn: () => interviewAssistantService.getSessions(params).then(r => r.data),
  });

export const useInterviewSession = (id) =>
  useQuery({
    queryKey: iaKeys.session(id),
    queryFn: () => interviewAssistantService.getSession(id).then(r => r.data),
    enabled: !!id,
  });

export const useCreateInterviewSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: interviewAssistantService.createSession,
    onSuccess: () => {
      toast.success('Session created');
      qc.invalidateQueries({ queryKey: iaKeys.all });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
};

export const useUpdateInterviewSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => interviewAssistantService.updateSession(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: iaKeys.all });
    },
  });
};

export const useDeleteInterviewSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: interviewAssistantService.deleteSession,
    onSuccess: () => {
      toast.success('Session deleted');
      qc.invalidateQueries({ queryKey: iaKeys.all });
    },
  });
};

// ─── Question & Challenge Updates ────────────────────────────────────────────
export const useUpdateQuestionAnswer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, questionId, data }) =>
      interviewAssistantService.updateQuestionAnswer(sessionId, questionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: iaKeys.all }),
  });
};

export const useUpdateChallengeSolution = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, challengeId, data }) =>
      interviewAssistantService.updateChallengeSolution(sessionId, challengeId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: iaKeys.all }),
  });
};

// ─── Scorecard & Summary ─────────────────────────────────────────────────────
export const useGenerateScorecard = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: interviewAssistantService.generateScorecard,
    onSuccess: () => {
      toast.success('Scorecard generated');
      qc.invalidateQueries({ queryKey: iaKeys.all });
    },
  });
};

export const useGenerateSummary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: interviewAssistantService.generateSummary,
    onSuccess: () => {
      toast.success('Summary generated');
      qc.invalidateQueries({ queryKey: iaKeys.all });
    },
  });
};

// ─── Analytics ───────────────────────────────────────────────────────────────
export const useInterviewAnalytics = () =>
  useQuery({
    queryKey: iaKeys.analytics(),
    queryFn: () => interviewAssistantService.getAnalytics().then(r => r.data),
  });
