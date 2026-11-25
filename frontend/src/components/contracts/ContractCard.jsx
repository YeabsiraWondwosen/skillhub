import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/currency';
import { PaperClipIcon } from '@heroicons/react/24/outline';

export default function ContractCard({ contract, role, index = 0 }) {
  const counterparty = role === 'client' ? contract.freelancer : contract.client;
  const isFinalized = contract.paymentStatus?.key === 'released' || contract.projectStatus?.key === 'completed';
  const effectiveProjectKey = isFinalized ? 'completed' : contract.projectStatus?.key;
  const effectivePaymentKey = isFinalized ? 'released' : contract.paymentStatus?.key;
  const isDelivered =
    !isFinalized && (
      contract.projectStatus?.key === 'submitted' ||
      contract.deliverables?.some((d) => d.status === 'pending')
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="card p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar src={counterparty?.avatar?.url || counterparty?.avatar} alt={counterparty?.firstName || counterparty?.email || 'Profile'} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/contracts/${contract._id}`}
                className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 truncate"
              >
                {contract.title}
              </Link>
              <Badge status={effectiveProjectKey}>{effectiveProjectKey === 'completed' ? 'Completed' : (contract.projectStatus?.label || 'Not Started')}</Badge>
              <Badge status={effectivePaymentKey}>{effectivePaymentKey === 'released' ? 'Released' : (contract.paymentStatus?.label || 'Pending Payment')}</Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {role === 'client' ? 'Freelancer' : 'Client'}: {counterparty?.firstName || counterparty?.email || (role === 'client' ? 'Freelancer' : 'Client')} {counterparty?.lastName || ''}
              <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
              <span className="font-mono text-xs">{contract.contractNumber}</span>
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
              <span className="font-medium text-gray-600 dark:text-gray-300">
                {formatCurrency(contract.amount, contract.currency)}
              </span>
              <span>·</span>
              <span>Deadline: {contract.deadline ? format(new Date(contract.deadline), 'MMM d, yyyy') : '—'}</span>
              {isDelivered && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <PaperClipIcon className="w-3.5 h-3.5" /> Delivery in review
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <Link to={`/contracts/${contract._id}`} className="btn-primary btn-sm flex-shrink-0">
          Manage
        </Link>
      </div>
      <div className="mt-3">
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-primary-500 h-1.5 rounded-full transition-all"
            style={{ width: `${contract.progress ?? 0}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}
