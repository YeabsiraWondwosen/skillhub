import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { advancedAnalyticsService } from '@/services/advancedAnalytics.service';
import toast from 'react-hot-toast';

export const aaKeys = {
  all: ['analytics'],
  dashboard: () => ['analytics', 'dashboard'],
  revenue: (params) => ['analytics', 'revenue', params],
  platformStats: () => ['analytics', 'platform'],
  fraud: (params) => ['analytics', 'fraud', params],
  spam: (params) => ['analytics', 'spam', params],
  growth: (params) => ['analytics', 'growth', params],
  insights: (params) => ['analytics', 'insights', params],
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const useAnalyticsDashboard = () =>
  useQuery({
    queryKey: aaKeys.dashboard(),
    queryFn: () => advancedAnalyticsService.getDashboard().then(r => r.data),
  });

// ─── Revenue ─────────────────────────────────────────────────────────────────
export const useRevenueReport = (params) =>
  useQuery({
    queryKey: aaKeys.revenue(params),
    queryFn: () => advancedAnalyticsService.getRevenueReport(params).then(r => r.data),
  });

// ─── Platform Stats ──────────────────────────────────────────────────────────
export const usePlatformStats = () =>
  useQuery({
    queryKey: aaKeys.platformStats(),
    queryFn: () => advancedAnalyticsService.getPlatformStats().then(r => r.data),
  });

// ─── Fraud Detection ─────────────────────────────────────────────────────────
export const useFraudAlerts = (params) =>
  useQuery({
    queryKey: aaKeys.fraud(params),
    queryFn: () => advancedAnalyticsService.getFraudAlerts(params).then(r => r.data),
  });

export const useRunFraudDetection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: advancedAnalyticsService.runFraudDetection,
    onSuccess: (res) => {
      toast.success(`Fraud scan complete: ${res.data?.newAlerts || 0} new alerts`);
      qc.invalidateQueries({ queryKey: aaKeys.all });
    },
  });
};

export const useResolveFraudAlert = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, data }) => advancedAnalyticsService.resolveFraudAlert(alertId, data),
    onSuccess: () => { toast.success('Alert resolved'); qc.invalidateQueries({ queryKey: aaKeys.all }); },
  });
};

// ─── Spam Detection ──────────────────────────────────────────────────────────
export const useSpamFlags = (params) =>
  useQuery({
    queryKey: aaKeys.spam(params),
    queryFn: () => advancedAnalyticsService.getSpamFlags(params).then(r => r.data),
  });

export const useAnalyzeContent = () =>
  useMutation({ mutationFn: advancedAnalyticsService.analyzeContent });

export const useResolveSpamFlag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ flagId, data }) => advancedAnalyticsService.resolveSpamFlag(flagId, data),
    onSuccess: () => { toast.success('Spam flag resolved'); qc.invalidateQueries({ queryKey: aaKeys.all }); },
  });
};

// ─── User Growth ─────────────────────────────────────────────────────────────
export const useUserGrowth = (params) =>
  useQuery({
    queryKey: aaKeys.growth(params),
    queryFn: () => advancedAnalyticsService.getUserGrowth(params).then(r => r.data),
  });

// ─── Business Insights ───────────────────────────────────────────────────────
export const useInsights = (params) =>
  useQuery({
    queryKey: aaKeys.insights(params),
    queryFn: () => advancedAnalyticsService.getInsights(params).then(r => r.data),
  });

export const useGenerateInsights = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: advancedAnalyticsService.generateInsights,
    onSuccess: () => { toast.success('Insights generated'); qc.invalidateQueries({ queryKey: aaKeys.all }); },
  });
};

export const useMarkInsightViewed = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: advancedAnalyticsService.markInsightViewed,
    onSuccess: () => { qc.invalidateQueries({ queryKey: aaKeys.all }); },
  });
};
