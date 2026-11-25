import { useMutation, useQuery } from '@tanstack/react-query';
import { aiService } from '@/services/ai.service';

export const aiKeys = {
  matches: (jobId) => ['ai', 'matches', jobId],
  recommendations: () => ['ai', 'recommendations'],
  proposal: (jobId) => ['ai', 'proposal', jobId],
  fullProposal: (jobId) => ['ai', 'fullProposal', jobId],
  skillGaps: (jobId) => ['ai', 'skillGaps', jobId],
};

export const useFreelancerMatches = (jobId) =>
  useQuery({
    queryKey: aiKeys.matches(jobId),
    queryFn: () => aiService.getFreelancerMatches(jobId).then(r => {
      console.log('[AI] Freelancer matches response:', r.data);
      return r.data?.data;
    }),
    enabled: !!jobId,
  });

export const useJobRecommendations = () =>
  useQuery({
    queryKey: aiKeys.recommendations(),
    queryFn: () => aiService.getJobRecommendations().then(r => {
      console.log('[AI] Job recommendations response:', r.data);
      return r.data?.data;
    }),
  });

export const useAIProposal = (jobId) =>
  useQuery({
    queryKey: aiKeys.proposal(jobId),
    queryFn: () => aiService.generateProposal(jobId).then(r => {
      console.log('[AI] Proposal draft response:', r.data);
      return r.data?.data;
    }),
    enabled: !!jobId,
  });

export const useFullProposal = (jobId) =>
  useQuery({
    queryKey: aiKeys.fullProposal(jobId),
    queryFn: () => aiService.generateFullProposal(jobId).then(r => {
      console.log('[AI] Full proposal response (raw):', r.data);
      console.log('[AI] Full proposal data payload:', r.data?.data);
      console.log('[AI] Proposal object:', r.data?.data?.proposal);
      return r.data?.data;
    }),
    enabled: !!jobId,
    staleTime: 2 * 60 * 1000,
  });

export const useSkillGaps = (jobId) =>
  useQuery({
    queryKey: aiKeys.skillGaps(jobId),
    queryFn: () => aiService.getSkillGaps(jobId).then(r => {
      console.log('[AI] Skill gaps response:', r.data);
      return r.data?.data;
    }),
    enabled: !!jobId,
  });
