import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportService } from '@services/support.service';

export const useSupportTickets = (params) => {
  return useQuery({
    queryKey: ['support-tickets', params],
    queryFn: () => supportService.getMyTickets(params),
    staleTime: 1000 * 60,
  });
};

export const useSupportTicket = (ticketId) => {
  return useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: () => supportService.getTicket(ticketId),
    enabled: !!ticketId,
  });
};

export const useCreateSupportTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supportService.createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries(['support-tickets']);
    },
  });
};

export const useReplyToTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, content }) => supportService.replyToTicket(ticketId, content),
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries(['support-ticket', ticketId]);
      queryClient.invalidateQueries(['support-tickets']);
    },
  });
};

export const useRateTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, rating }) => supportService.rateTicket(ticketId, rating),
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries(['support-ticket', ticketId]);
    },
  });
};

export const useAIChat = () => {
  return useMutation({
    mutationFn: ({ message, conversationHistory }) =>
      supportService.aiChat(message, conversationHistory),
  });
};
