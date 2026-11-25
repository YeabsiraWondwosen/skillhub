import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFinanceService } from '@/services/adminFinance.service';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { SkeletonText } from '@/components/ui/Skeleton';
import { CreditCardIcon, CheckCircleIcon, XCircleIcon, CogIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { GatewayIcon } from './components';

const GATEWAY_CONFIGS = [
  { id: 'stripe', name: 'Stripe', description: 'International credit/debit card payments', color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20' },
  { id: 'chapa', name: 'Chapa', description: 'Ethiopian local payment gateway', color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  { id: 'telebirr', name: 'Telebirr', description: 'Ethio Telecom mobile wallet', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  { id: 'cbe_birr', name: 'CBE Birr', description: 'Commercial Bank of Ethiopia mobile banking', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' },
  { id: 'bank_transfer', name: 'Bank Transfer', description: 'Direct bank transfer with manual confirmation', color: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20' },
  { id: 'wallet', name: 'Wallet', description: 'Internal platform wallet transfers', color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20' },
  { id: 'manual', name: 'Manual', description: 'Manual payment processing by admin', color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/20' },
  { id: 'demo', name: 'Demo', description: 'Test payment gateway for development', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' },
];

export default function AdminPaymentGateways() {
  const [editingGateway, setEditingGateway] = useState(null);
  const queryClient = useQueryClient();

  const { data: commissionSettings, isLoading } = useQuery({
    queryKey: ['admin-finance-commission-settings'],
    queryFn: () => adminFinanceService.getCommissionSettings().then(r => r.data),
  });

  const settings = commissionSettings?.data;
  const gatewayFees = settings?.gatewayFees || {};

  const mutation = useMutation({
    mutationFn: (data) => adminFinanceService.updateCommissionSettings(data),
    onSuccess: () => { queryClient.invalidateQueries(['admin-finance-commission-settings']); setEditingGateway(null); },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Gateways</h1></div>
        <div className="card p-6"><SkeletonText lines={6} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Gateways</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure and manage payment gateway integrations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {GATEWAY_CONFIGS.map(gw => {
          const fee = gatewayFees[gw.id];
          const isEditing = editingGateway === gw.id;

          return (
            <div key={gw.id} className={clsx('card p-5 transition-all', isEditing && 'ring-2 ring-primary-500')}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', gw.color)}>
                    <GatewayIcon provider={gw.id} className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{gw.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{gw.description}</p>
                  </div>
                </div>
                <Badge status={fee !== undefined ? 'active' : 'inactive'} />
              </div>

              <div className="mt-4 p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Transaction Fee</span>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input type="number" step="0.1" defaultValue={(fee || 0) * 100}
                        id={`fee-${gw.id}`}
                        className="w-20 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white text-right" />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{fee !== undefined ? `${(fee * 100).toFixed(1)}%` : 'Not configured'}</span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                {isEditing ? (
                  <>
                    <Button variant="ghost" onClick={() => setEditingGateway(null)} className="text-xs">Cancel</Button>
                    <Button onClick={() => {
                      const input = document.getElementById(`fee-${gw.id}`);
                      const newFees = { ...gatewayFees, [gw.id]: parseFloat(input.value) / 100 };
                      mutation.mutate({ gatewayFees: newFees });
                    }} disabled={mutation.isPending} className="text-xs">
                      {mutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <button onClick={() => setEditingGateway(gw.id)}
                    className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors flex items-center gap-1">
                    <CogIcon className="w-3.5 h-3.5" /> Configure
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
