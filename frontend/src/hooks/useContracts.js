import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { contractService } from '@/services/contract.service';
import { getSocket } from '@/services/socket';
import { useAuthStore } from '@/store/authStore';

const REAL_TIME_REFRESH_MS = 4000;

export const contractKeys = {
  all: ['contracts'],
  list: (params) => ['contracts', 'list', params],
  detail: (id) => ['contracts', id],
};

const invalidateContract = (qc, contractId) => {
  qc.invalidateQueries({ queryKey: contractKeys.all });
  qc.invalidateQueries({ queryKey: ['jobs'] });
  // Milestones + project detail live under ['projects', ...] — funding/release
  // changes milestone status, so these must refresh alongside the contract.
  qc.invalidateQueries({ queryKey: ['projects'] });
  if (contractId) qc.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
  qc.invalidateQueries({ queryKey: ['wallet'] });
  qc.invalidateQueries({ queryKey: ['transactions'] });
  qc.invalidateQueries({ queryKey: ['earnings'] });
};

const useRealtimeContractSync = () => {
  const qc = useQueryClient();
  const authReady = useAuthStore((s) => s.isInitialized || !!s.accessToken);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const invalidate = () => {
      invalidateContract(qc, null);
    };

    socket.on('contract:update', invalidate);
    socket.on('project:update', invalidate);
    socket.on('job:update', invalidate);
    socket.on('contract:payment-released', invalidate);

    return () => {
      socket.off('contract:update', invalidate);
      socket.off('project:update', invalidate);
      socket.off('job:update', invalidate);
      socket.off('contract:payment-released', invalidate);
    };
  }, [qc, authReady]);
};

export const useMyContracts = (params) => {
  useRealtimeContractSync();
  return useQuery({
    queryKey: contractKeys.list(params),
    queryFn: () => contractService.getMyContracts(params).then((r) => r.data),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: REAL_TIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
};

export const useContract = (contractId) => {
  useRealtimeContractSync();
  return useQuery({
    queryKey: contractKeys.detail(contractId),
    queryFn: () => contractService.getContract(contractId).then((r) => r.data?.data ?? r.data),
    enabled: !!contractId,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: REAL_TIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
};

export const useFundContract = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId }) => contractService.fundContract(contractId),
    onSuccess: (_, { contractId }) => {
      toast.success('Contract funded — payment is locked in escrow');
      invalidateContract(qc, contractId);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Funding failed'),
  });
};

export const useSubmitContractDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, formData }) => contractService.submitDelivery(contractId, formData),
    onSuccess: (_, { contractId }) => {
      toast.success('Delivery submitted — awaiting client approval');
      invalidateContract(qc, contractId);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Submission failed'),
  });
};

export const useReviewContractDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, deliveryId, data }) =>
      contractService.reviewDelivery(contractId, deliveryId, data),
    onSuccess: (_, { contractId }) => {
      toast.success('Delivery reviewed');
      invalidateContract(qc, contractId);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Review failed'),
  });
};

export const useRaiseContractDispute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, data }) => contractService.raiseDispute(contractId, data),
    onSuccess: (_, { contractId }) => {
      toast.success('Dispute raised — an admin will review it');
      invalidateContract(qc, contractId);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not raise dispute'),
  });
};
