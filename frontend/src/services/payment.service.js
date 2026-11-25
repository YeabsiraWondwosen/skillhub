import api from './api';

export const paymentService = {
  // Payment mode
  getPaymentMode: () => api.get('/payments/mode'),

  // Wallet
  getWallet: () => api.get('/payments/wallet'),
  getWalletBalance: () => api.get('/payments/wallet/balance'),

  // Deposits
  depositStripe: (data) => api.post('/payments/deposit/stripe', data),
  depositChapa: (data) => api.post('/payments/deposit/chapa', data),
  verifyChapaDeposit: (txRef) => api.get(`/payments/deposit/chapa/verify/${txRef}`),
  depositTelebirr: (data) => api.post('/payments/deposit/telebirr', data),
  verifyTelebirrDeposit: (txRef) => api.get(`/payments/deposit/telebirr/verify/${txRef}`),
  depositCbeBirr: (data) => api.post('/payments/deposit/cbe-birr', data),
  verifyCbeBirrDeposit: (txRef) => api.get(`/payments/deposit/cbe-birr/verify/${txRef}`),
  depositDemo: (data) => api.post('/payments/deposit/demo', data),

  // Withdrawals
  withdraw: (data) => api.post('/payments/withdraw', data),

  // Escrow
  createEscrow: (data) => api.post('/payments/escrow', data),
  fundEscrow: (escrowId) => api.post(`/payments/escrow/${escrowId}/fund`),
  startEscrowWork: (escrowId) => api.post(`/payments/escrow/${escrowId}/start`),
  submitEscrowWork: (escrowId) => api.post(`/payments/escrow/${escrowId}/submit`),
  releaseEscrow: (escrowId, data) => api.post(`/payments/escrow/${escrowId}/release`, data),
  refundEscrow: (escrowId, data) => api.post(`/payments/escrow/${escrowId}/refund`, data),
  getMyEscrows: (params) => api.get('/payments/escrow', { params }),
  getEscrow: (escrowId) => api.get(`/payments/escrow/${escrowId}`),

  // History & Invoices
  getTransactions: (params) => api.get('/payments/transactions', { params }),
  getPaymentHistory: (params) => api.get('/payments/history', { params }),
  getInvoice: (paymentId) => api.get(`/payments/invoices/${paymentId}`),
  downloadInvoicePdf: (paymentId) => api.get(`/payments/invoices/${paymentId}/download`, { responseType: 'blob' }),

  // Earnings
  getEarnings: () => api.get('/payments/earnings'),
  getEarningsChart: (params) => api.get('/payments/earnings/chart', { params }),

  // Payment Methods
  getPaymentMethods: () => api.get('/payments/payment-methods'),
  createPaymentMethod: (data) => api.post('/payments/payment-methods', data),
  updatePaymentMethod: (methodId, data) => api.put(`/payments/payment-methods/${methodId}`, data),
  setDefaultPaymentMethod: (methodId) => api.put(`/payments/payment-methods/${methodId}/default`),
  deletePaymentMethod: (methodId) => api.delete(`/payments/payment-methods/${methodId}`),

  // Withdrawal history
  getWithdrawals: (params) => api.get('/payments/withdrawals', { params }),

  // Receipts
  getReceipt: (receiptId) => api.get(`/payments/receipts/${receiptId}`),
  getReceiptByReference: (reference) => api.get(`/payments/receipts/reference/${reference}`),

  // Admin
  getCommissionReport: (params) => api.get('/payments/admin/commissions', { params }),
  getProviderStats: () => api.get('/payments/admin/providers'),
};
