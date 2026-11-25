import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  useMyEscrows, useFundEscrow, useReleaseEscrow, useRefundEscrow,
} from '@/hooks/usePayments';
import { useAuthStore } from '@/store/authStore';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import {
  ShieldCheckIcon, CurrencyDollarIcon, ArrowPathIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { formatCurrency } from '@/utils/currency';
import { ArrowLeft, Star } from 'lucide-react';

const STATUS_FILTERS = ['', 'pending', 'funded', 'in_progress', 'submitted', 'released', 'refunded', 'disputed'];

const STATUS_ICONS = {
  pending: ClockIcon,
  funded: ShieldCheckIcon,
  in_progress: ArrowPathIcon,
  submitted: ExclamationTriangleIcon,
  released: CheckCircleIcon,
  refunded: XCircleIcon,
  disputed: ExclamationTriangleIcon,
};

export default function EscrowPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [fundId, setFundId] = useState(null);
  const [releaseId, setReleaseId] = useState(null);
  const [refundId, setRefundId] = useState(null);
  const [rating, setRating] = useState(0);
  const [refundReason, setRefundReason] = useState('');

  const { data, isLoading } = useMyEscrows({ status: status || undefined, page, limit: 10 });
  const { mutate: fundEscrow, isPending: isFunding } = useFundEscrow();
  const { mutate: releaseEscrow, isPending: isReleasing } = useReleaseEscrow();
  const { mutate: refundEscrow, isPending: isRefunding } = useRefundEscrow();

  const escrows = data?.data ?? [];

  const stats = {
    active: escrows.filter(e => ['funded', 'in_progress', 'submitted'].includes(e.status)).length,
    totalHeld: escrows.filter(e => ['funded', 'in_progress', 'submitted'].includes(e.status))
      .reduce((s, e) => s + (e.amount || 0), 0),
    totalReleased: escrows.filter(e => e.status === 'released')
      .reduce((s, e) => s + (e.amount || 0), 0),
    completed: escrows.filter(e => e.status === 'released').length,
  };

  const getStatusLabel = (statusKey) =>
    statusKey ? t(`payments.escrow.statusFilters.${statusKey}`) : t('payments.escrow.statusFilters.all');

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/payments/wallet" className="text-sm text-gray-400 hover:text-primary-600 inline-flex items-center gap-1">
            <ArrowLeft size={14} /> {t('payments.escrow.backToWallet')}
          </Link>
          <h1 className="section-title mt-1">{t('payments.escrow.title')}</h1>
          <p className="section-sub">{t('payments.escrow.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: t('payments.escrow.stats.activeEscrows'), value: stats.active,
            icon: ShieldCheckIcon, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          },
          {
            label: t('payments.escrow.stats.totalHeld'), value: formatCurrency(stats.totalHeld),
            icon: CurrencyDollarIcon, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20',
          },
          {
            label: t('payments.escrow.stats.totalReleased'), value: formatCurrency(stats.totalReleased),
            icon: CheckCircleIcon, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20',
          },
          {
            label: t('payments.escrow.stats.completed'), value: stats.completed,
            icon: CheckCircleIcon, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20',
          },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }} className="stat-card">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="stat-value">{s.value}</p>
            <p className="stat-label">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {STATUS_FILTERS.map(s => (
          <button key={s || 'all'} onClick={() => { setStatus(s); setPage(1); }}
            className={clsx('flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
              status === s
                ? 'bg-primary-600 text-white border-primary-600'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400')}>
            {getStatusLabel(s)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : escrows.length === 0 ? (
        <EmptyState
          icon={ShieldCheckIcon}
          title={t('payments.escrow.empty.title')}
          description={t('payments.escrow.empty.description')}
        />
      ) : (
        <div className="space-y-4">
          {escrows.map((escrow, i) => {
            const Icon = STATUS_ICONS[escrow.status] || ClockIcon;
            const isActive = ['funded', 'in_progress', 'submitted'].includes(escrow.status);
            const isClient = escrow.client?._id === user?._id || escrow.client === user?._id;

            return (
              <motion.div key={escrow._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={clsx('card p-5 border-l-4',
                  isActive ? 'border-l-yellow-400' :
                    escrow.status === 'released' ? 'border-l-green-400' :
                      escrow.status === 'refunded' ? 'border-l-blue-400' :
                        'border-l-gray-200 dark:border-l-gray-600')}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {escrow.project?.title || t('payments.escrow.project')}
                      </span>
                      <Badge status={escrow.status} />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-gray-400 text-xs">{t('payments.escrow.amount')}</p>
                        <p className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(escrow.amount, escrow.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">{t('payments.escrow.freelancer')}</p>
                        <p className="font-medium text-gray-700 dark:text-gray-200">
                          {escrow.freelancer?.firstName} {escrow.freelancer?.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">{t('payments.escrow.commission')}</p>
                        <p className="font-medium text-red-500">
                          {formatCurrency(escrow.commissionAmount, escrow.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">{t('payments.escrow.freelancerGets')}</p>
                        <p className="font-medium text-green-600">
                          {formatCurrency(escrow.freelancerAmount, escrow.currency)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-400 mt-3">
                      {escrow.fundedAt && <span>{t('payments.escrow.history.funded')} {format(new Date(escrow.fundedAt), 'MMM d, yyyy')}</span>}
                      {escrow.submittedAt && <span>{t('payments.escrow.history.submitted')} {format(new Date(escrow.submittedAt), 'MMM d, yyyy')}</span>}
                      {escrow.releasedAt && <span>{t('payments.escrow.history.released')} {format(new Date(escrow.releasedAt), 'MMM d, yyyy')}</span>}
                      {escrow.expiresAt && isActive && <span>{t('payments.escrow.history.expires')} {format(new Date(escrow.expiresAt), 'MMM d, yyyy')}</span>}
                    </div>

                    {escrow.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{escrow.description}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {isClient && escrow.status === 'pending' && (
                      <Button size="sm" onClick={() => setFundId(escrow._id)}>
                        <CurrencyDollarIcon className="w-4 h-4" /> {t('payments.escrow.actions.fund')}
                      </Button>
                    )}
                    {isClient && ['funded', 'submitted'].includes(escrow.status) && (
                      <Button size="sm" onClick={() => { setReleaseId(escrow._id); setRating(0); }}>
                        <CheckCircleIcon className="w-4 h-4" /> {t('payments.escrow.actions.release')}
                      </Button>
                    )}
                    {isClient && ['funded', 'submitted', 'disputed'].includes(escrow.status) && (
                      <Button size="sm" variant="danger" onClick={() => { setRefundId(escrow._id); setRefundReason(''); }}>
                        <XCircleIcon className="w-4 h-4" /> {t('payments.escrow.actions.refund')}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Fund Confirm */}
      <ConfirmModal
        open={!!fundId}
        onClose={() => setFundId(null)}
        onConfirm={() => fundEscrow(fundId, { onSuccess: () => setFundId(null) })}
        title={t('payments.escrow.modal.fundTitle')}
        message={t('payments.escrow.modal.fundMessage')}
        confirmLabel={t('payments.escrow.modal.fundConfirm')}
        loading={isFunding}
      />

      {/* Release Modal */}
      <Modal open={!!releaseId} onClose={() => setReleaseId(null)} title={t('payments.escrow.modal.releaseTitle')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {t('payments.escrow.modal.releaseDescription')}
          </p>
          <div>
            <label className="label">{t('payments.escrow.modal.ratingLabel')}</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} type="button" onClick={() => setRating(star)}
                  className={clsx('w-8 h-8 rounded-lg text-lg transition-colors',
                    star <= rating ? 'bg-yellow-100 text-yellow-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400')}>
                  <Star size={18} className={star <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setReleaseId(null)}>{t('payments.escrow.modal.cancel')}</Button>
            <Button size="sm" loading={isReleasing}
              onClick={() => releaseEscrow({ escrowId: releaseId, data: { rating: rating || undefined } },
                { onSuccess: () => { setReleaseId(null); setRating(0); } })}>
              {t('payments.escrow.modal.releasePayment')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Refund Modal */}
      <Modal open={!!refundId} onClose={() => setRefundId(null)} title={t('payments.escrow.modal.refundTitle')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {t('payments.escrow.modal.refundDescription')}
          </p>
          <Textarea label={t('payments.escrow.modal.reasonLabel')} rows={3} placeholder={t('payments.escrow.modal.reasonPlaceholder')}
            value={refundReason} onChange={e => setRefundReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRefundId(null)}>{t('payments.escrow.modal.cancel')}</Button>
            <Button size="sm" variant="danger" loading={isRefunding}
              onClick={() => refundEscrow({ escrowId: refundId, data: { reason: refundReason } },
                { onSuccess: () => { setRefundId(null); setRefundReason(''); } })}>
              {t('payments.escrow.modal.refundEscrow')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
