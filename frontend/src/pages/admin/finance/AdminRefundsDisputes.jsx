import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFinanceService } from '@/services/adminFinance.service';
import { DataTable, KPICard, ActionModal } from './components';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { ArrowUturnLeftIcon, ClockIcon, ExclamationTriangleIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';

function EscrowActionButton({ escrow, action, label, icon: Icon, color }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => adminFinanceService.resolveDispute(escrow._id, { resolution: action, releaseTo: 'client', adminNotes: notes }),
    onSuccess: () => { queryClient.invalidateQueries(['admin-finance-disputes']); setOpen(false); setNotes(''); },
  });

  return (
    <>
      <button onClick={() => setOpen(true)} className={clsx('p-1.5 rounded-md transition-colors', color)} title={label}>
        <Icon className="w-3.5 h-3.5" />
      </button>
      <ActionModal isOpen={open} onClose={() => setOpen(false)} title="Resolve Dispute">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Escrow: {formatCurrency(escrow.amount, escrow.currency)}</p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Resolution notes"
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white resize-none" rows={3} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Processing...' : 'Confirm Resolution'}
            </Button>
          </div>
        </div>
      </ActionModal>
    </>
  );
}

export default function AdminRefundsDisputes() {
  const [page, setPage] = useState(1);

  const { data: refundData } = useQuery({
    queryKey: ['admin-finance-refunds'],
    queryFn: () => adminFinanceService.getRefundDashboard().then(r => r.data),
  });

  const { data: disputesData } = useQuery({
    queryKey: ['admin-finance-disputes', page],
    queryFn: () => adminFinanceService.getDisputes({ page, limit: 15 }).then(r => r.data),
  });

  const disputeColumns = [
    {
      key: 'client', label: 'Client',
      render: (r) => <span className="text-xs">{r.client?.firstName} {r.client?.lastName}</span>,
    },
    {
      key: 'freelancer', label: 'Freelancer',
      render: (r) => <span className="text-xs">{r.freelancer?.firstName} {r.freelancer?.lastName}</span>,
    },
    {
      key: 'project', label: 'Project',
      render: (r) => <span className="text-xs text-gray-500">{r.project?.title || '—'}</span>,
    },
    {
      key: 'amount', label: 'Amount', align: 'right',
      render: (r) => <span className="font-bold text-xs text-red-600">{formatCurrency(r.amount, r.currency)}</span>,
    },
    {
      key: 'disputeReason', label: 'Reason',
      render: (r) => <span className="text-xs text-gray-500 truncate max-w-[200px] block">{r.disputeReason || '—'}</span>,
    },
    {
      key: 'createdAt', label: 'Opened',
      render: (r) => <span className="text-xs text-gray-400">{format(new Date(r.disputeOpenedAt || r.createdAt), 'MMM d, yyyy')}</span>,
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => (
        <EscrowActionButton escrow={r} action="resolve" label="Resolve" icon={ScaleIcon}
          color="text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20" />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Refunds & Disputes</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage refunds and dispute resolution</p>
      </div>

      {refundData?.data?.stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {refundData.data.stats.map(s => (
            <KPICard key={s._id}
              label={s._id === 'completed' ? 'Approved Refunds' : s._id === 'failed' ? 'Rejected Refunds' : `Refunds (${s._id})`}
              value={formatCurrency(s.total)} icon={ArrowUturnLeftIcon}
              color={s._id === 'completed' ? 'text-green-600' : s._id === 'failed' ? 'text-red-600' : 'text-yellow-600'}
              bg={s._id === 'completed' ? 'bg-green-50 dark:bg-green-900/20' : s._id === 'failed' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}
              sub={`${s.count} requests`} />
          ))}
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center">
            <ClockIcon className="w-4 h-4 text-yellow-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Pending Refunds</h2>
            <p className="text-xs text-gray-400 mt-0.5">Awaiting admin review</p>
          </div>
        </div>
        <div className="space-y-3">
          {refundData?.data?.pending?.length > 0 ? refundData.data.pending.map(r => (
            <div key={r._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">{r.payer?.firstName} {r.payer?.lastName}</p>
                <p className="text-[11px] text-gray-400">{r.reference} · {r.description}</p>
              </div>
              <span className="text-xs font-bold text-red-600">{formatCurrency(r.amount, r.currency)}</span>
            </div>
          )) : <p className="text-center text-sm text-gray-400 py-6">No pending refunds</p>}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Active Disputes</h3>
        </div>
        <DataTable loading={false} columns={disputeColumns} data={disputesData?.data || []} emptyMessage="No active disputes" />
        {disputesData?.meta && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <Pagination meta={disputesData.meta} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
