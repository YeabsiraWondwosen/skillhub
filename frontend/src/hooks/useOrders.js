import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { orderService } from '@/services/order.service';

export const orderKeys = {
  all: ['service-orders'],
  list: (params) => ['service-orders', 'list', params],
  detail: (id) => ['service-orders', id],
  stats: (as) => ['service-orders', 'stats', as],
};

export const useOrders = (params) =>
  useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => orderService.getOrders(params).then((r) => r.data),
  });

export const useOrder = (id) =>
  useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => orderService.getOrder(id).then((r) => r.data),
    enabled: !!id,
  });

export const useOrderStats = (as) =>
  useQuery({
    queryKey: orderKeys.stats(as),
    queryFn: () => orderService.getOrderStats({ as }).then((r) => r.data),
    enabled: !!as,
  });

export const useCreateOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) => orderService.createOrder(formData),
    onSuccess: (res) => {
      toast.success('Order placed. Fund the escrow to send it to the freelancer.');
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: ['catalogs'] });
      return res;
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Order placement failed'),
  });
};

export const useFundOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId) => orderService.fundOrder(orderId),
    onSuccess: (res) => {
      toast.success('Order funded. Payment is locked in escrow.');
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      return res;
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Funding failed'),
  });
};

export const useAcceptOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId) => orderService.acceptOrder(orderId),
    onSuccess: (res) => {
      toast.success('Order accepted. Project, conversation and milestone created.');
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
      return res;
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Accept failed'),
  });
};

export const useDeclineOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }) => orderService.declineOrder(orderId, reason),
    onSuccess: () => {
      toast.success('Order declined. The client has been refunded.');
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Decline failed'),
  });
};

export const useCancelOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId) => orderService.cancelOrder(orderId),
    onSuccess: () => {
      toast.success('Order cancelled.');
      qc.invalidateQueries({ queryKey: orderKeys.all });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Cancel failed'),
  });
};

export const useDeliverOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, formData }) => orderService.deliverOrder(orderId, formData),
    onSuccess: () => {
      toast.success('Delivery submitted. Awaiting client review.');
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Delivery failed'),
  });
};

export const useRequestRevision = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }) => orderService.requestRevision(orderId, reason),
    onSuccess: () => {
      toast.success('Revision requested. The freelancer has been notified.');
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Request failed'),
  });
};

export const useCompleteOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId) => orderService.completeOrder(orderId),
    onSuccess: () => {
      toast.success('Order completed. Payment released to the freelancer.');
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Complete failed'),
  });
};

export const useReportOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, data }) => orderService.reportOrder(orderId, data),
    onSuccess: () => {
      toast.success('Problem reported. Funds are locked in escrow and our team will review it.');
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Report failed'),
  });
};
