import api from './api';

export const adminFinanceService = {
  // Overview
  getOverview: (params) => api.get('/admin/finance/overview', { params }),
  getLiveStats: () => api.get('/admin/finance/live-stats'),

  // Analytics
  getRevenue: (params) => api.get('/admin/finance/revenue', { params }),
  getTrends: (params) => api.get('/admin/finance/trends', { params }),
  getCategoryRevenue: (params) => api.get('/admin/finance/category-revenue', { params }),
  getTopCategories: (params) => api.get('/admin/finance/top-categories', { params }),
  getTopEarners: (params) => api.get('/admin/finance/top-earners', { params }),
  getTopFreelancers: (params) => api.get('/admin/finance/top-freelancers', { params }),
  getTopClients: (params) => api.get('/admin/finance/top-clients', { params }),
  getUserGrowth: (params) => api.get('/admin/finance/user-growth', { params }),
  getHeatMap: (params) => api.get('/admin/finance/heat-map', { params }),

  // Escrow
  getEscrows: (params) => api.get('/admin/finance/escrows', { params }),
  getEscrowStats: () => api.get('/admin/finance/escrow-stats'),
  getEscrowTimeline: (escrowId) => api.get(`/admin/finance/escrows/${escrowId}/timeline`),
  releaseEscrow: (escrowId, data) => api.patch(`/admin/finance/escrows/${escrowId}/release`, data),
  holdEscrow: (escrowId, data) => api.patch(`/admin/finance/escrows/${escrowId}/hold`, data),
  refundEscrow: (escrowId, data) => api.patch(`/admin/finance/escrows/${escrowId}/refund`, data),
  resolveDispute: (escrowId, data) => api.patch(`/admin/finance/escrows/${escrowId}/resolve`, data),
  addAdminNote: (escrowId, data) => api.post(`/admin/finance/escrows/${escrowId}/notes`, data),

  // Payments
  getPayments: (params) => api.get('/admin/finance/payments', { params }),
  searchPayments: (params) => api.get('/admin/finance/payments/search', { params }),
  getPaymentStats: (params) => api.get('/admin/finance/payment-stats', { params }),
  getPaymentTransactions: (paymentId) => api.get(`/admin/finance/payments/${paymentId}/transactions`),

  // Wallets
  getWallets: (params) => api.get('/admin/finance/wallets', { params }),

  // Withdrawals
  getWithdrawals: (params) => api.get('/admin/finance/withdrawals', { params }),
  getWithdrawalStats: () => api.get('/admin/finance/withdrawal-stats'),
  processWithdrawal: (withdrawalId, data) => api.patch(`/admin/finance/withdrawals/${withdrawalId}`, data),
  retryWithdrawal: (withdrawalId) => api.patch(`/admin/finance/withdrawals/${withdrawalId}/retry`),

  // Commission
  getCommissionSettings: () => api.get('/admin/finance/commission/settings'),
  updateCommissionSettings: (data) => api.patch('/admin/finance/commission/settings', data),
  getCommissionHistory: (params) => api.get('/admin/finance/commission/history', { params }),

  // Refunds & Disputes
  getRefundDashboard: () => api.get('/admin/finance/refunds'),
  getDisputes: (params) => api.get('/admin/finance/disputes', { params }),

  // Reports
  generateReport: (params) => api.get('/admin/finance/reports', { params, responseType: params.format === 'csv' ? 'blob' : 'json' }),
  getReportSummary: (params) => api.get('/admin/finance/reports/summary', { params }),
  getReportRows: (params) => {
    const isBlob = params.format === 'csv' || params.format === 'pdf';
    return api.get('/admin/finance/reports/rows', { params, responseType: isBlob ? 'blob' : 'json' });
  },

  // Search
  globalSearch: (params) => api.get('/admin/finance/search', { params }),

  // Audit
  getAuditLogs: (params) => api.get('/admin/finance/audit-logs', { params }),
  getAuditSummary: (params) => api.get('/admin/finance/audit-summary', { params }),
  getSuspiciousActivity: () => api.get('/admin/finance/suspicious-activity'),
  getAdminHistory: (params) => api.get('/admin/finance/admin-history', { params }),

  // Invoice
  downloadInvoice: (paymentId) => api.get(`/admin/finance/invoices/${paymentId}/download`, { responseType: 'blob' }),
};
