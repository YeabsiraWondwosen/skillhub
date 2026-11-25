import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { paymentService } from '@/services/payment.service';

export const useWallet = () =>
  useQuery({ queryKey: ['wallet'], queryFn: () => paymentService.getWallet().then(r => r.data) });

export const useWalletBalance = () =>
  useQuery({ queryKey: ['wallet-balance'], queryFn: () => paymentService.getWalletBalance().then(r => r.data) });

export const useTransactions = (params) =>
  useQuery({ queryKey: ['transactions', params], queryFn: () => paymentService.getTransactions(params).then(r => r.data) });

export const usePaymentHistory = (params) =>
  useQuery({ queryKey: ['payments', params], queryFn: () => paymentService.getPaymentHistory(params).then(r => r.data) });

export const useDepositStripe = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentService.depositStripe,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet'] }),
    onError: (e) => toast.error(e.response?.data?.message || 'Deposit failed'),
  });
};

export const useDepositChapa = () =>
  useMutation({
    mutationFn: paymentService.depositChapa,
    onError: (e) => toast.error(e.response?.data?.message || 'Deposit failed'),
  });

export const useDepositTelebirr = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentService.depositTelebirr,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet'] }),
    onError: (e) => toast.error(e.response?.data?.message || 'Telebirr deposit failed'),
  });
};

export const useDepositCbeBirr = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentService.depositCbeBirr,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet'] }),
    onError: (e) => toast.error(e.response?.data?.message || 'CBE Birr deposit failed'),
  });
};

export const useWithdraw = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentService.withdraw,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Withdrawal failed'),
  });
};

// ─── Escrow Hooks ────────────────────────────────────────────────────────────
export const useMyEscrows = (params) =>
  useQuery({ queryKey: ['escrows', params], queryFn: () => paymentService.getMyEscrows(params).then(r => r.data) });

export const useEscrow = (escrowId) =>
  useQuery({ queryKey: ['escrow', escrowId], queryFn: () => paymentService.getEscrow(escrowId).then(r => r.data), enabled: !!escrowId });

export const useCreateEscrow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentService.createEscrow,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escrows'] }),
    onError: (e) => toast.error(e.response?.data?.message || 'Escrow creation failed'),
  });
};

export const useFundEscrow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentService.fundEscrow,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['escrows'] }); qc.invalidateQueries({ queryKey: ['wallet'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Escrow funding failed'),
  });
};

export const useReleaseEscrow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ escrowId, data }) => paymentService.releaseEscrow(escrowId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['escrows'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['earnings'] });
      qc.invalidateQueries({ queryKey: ['earnings-chart'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Escrow release failed'),
  });
};

export const useRefundEscrow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ escrowId, data }) => paymentService.refundEscrow(escrowId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['escrows'] }); qc.invalidateQueries({ queryKey: ['wallet'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Escrow refund failed'),
  });
};

// ─── Earnings Hooks ──────────────────────────────────────────────────────────
export const useEarnings = () =>
  useQuery({ queryKey: ['earnings'], queryFn: () => paymentService.getEarnings().then(r => r.data) });

export const useEarningsChart = (params) =>
  useQuery({ queryKey: ['earnings-chart', params], queryFn: () => paymentService.getEarningsChart(params).then(r => r.data) });

// ─── Payment Methods Hooks ──────────────────────────────────────────────────
export const usePaymentMethods = () =>
  useQuery({ queryKey: ['payment-methods'], queryFn: () => paymentService.getPaymentMethods().then(r => r.data) });

export const useCreatePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentService.createPaymentMethod,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); toast.success('Payment method added'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add payment method'),
  });
};

export const useUpdatePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ methodId, data }) => paymentService.updatePaymentMethod(methodId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); toast.success('Payment method updated'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update payment method'),
  });
};

export const useSetDefaultPaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentService.setDefaultPaymentMethod,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); toast.success('Default method updated'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to set default'),
  });
};

export const useDeletePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentService.deletePaymentMethod,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); toast.success('Payment method removed'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to remove payment method'),
  });
};

// ─── Withdrawal History Hook ────────────────────────────────────────────────
export const useWithdrawals = (params) =>
  useQuery({ queryKey: ['withdrawals', params], queryFn: () => paymentService.getWithdrawals(params).then(r => r.data) });

// ─── Receipt Hook ───────────────────────────────────────────────────────────
export const useReceipt = (receiptId) =>
  useQuery({ queryKey: ['receipt', receiptId], queryFn: () => paymentService.getReceipt(receiptId).then(r => r.data), enabled: !!receiptId });

// ─── Admin Hooks ─────────────────────────────────────────────────────────────
export const useCommissionReport = (params) =>
  useQuery({ queryKey: ['commission-report', params], queryFn: () => paymentService.getCommissionReport(params).then(r => r.data) });

export const useProviderStats = () =>
  useQuery({ queryKey: ['provider-stats'], queryFn: () => paymentService.getProviderStats().then(r => r.data) });
