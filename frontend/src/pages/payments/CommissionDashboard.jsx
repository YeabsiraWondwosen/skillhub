import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useCommissionReport, useProviderStats } from '@/hooks/usePayments';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { CurrencyDollarIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { formatCurrency } from '@/utils/currency';
import { ArrowLeft } from 'lucide-react';

const PROVIDER_COLORS = {
  stripe: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  chapa: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  telebirr: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  cbe_birr: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  wallet: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  manual: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

export default function CommissionDashboard() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: commissionData, isLoading: loadingCommission } = useCommissionReport({ page, limit: 15, startDate: startDate || undefined, endDate: endDate || undefined });
  const { data: providerData, isLoading: loadingProviders } = useProviderStats();

  const report = commissionData?.data;
  const summary = report?.summary;
  const transactions = report?.transactions ?? [];
  const meta = report?.meta;
  const providers = providerData?.data?.byProvider ?? [];
  const allTime = providerData?.data?.allTime;

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/admin" className="text-sm text-gray-400 hover:text-primary-600 inline-flex items-center gap-1"><ArrowLeft size={14} /> {t('dashboard.commission.backToAdmin')}</Link>
          <h1 className="section-title mt-1">{t('dashboard.commission.title')}</h1>
          <p className="section-sub">{t('dashboard.commission.subtitle')}</p>
        </div>
      </div>

      {/* All-time summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('dashboard.commission.summary.totalTransactions'), value: allTime?.totalTransactions ?? 0 },
          { label: t('dashboard.commission.summary.totalVolume'), value: formatCurrency(allTime?.totalAmount) },
          { label: t('dashboard.commission.summary.totalCommission'), value: formatCurrency(allTime?.totalCommission) },
          { label: t('dashboard.commission.summary.avgCommission'), value: formatCurrency(summary?.avgCommission) },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="card p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-2">
              <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Provider breakdown */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-primary-500" /> {t('dashboard.commission.providers.title')}
        </h3>
        {loadingProviders ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
          </div>
        ) : providers.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">{t('dashboard.commission.providers.noData')}</p>
        ) : (
          <div className="space-y-3">
            {providers.map(p => {
              const totalDeposits = providers.reduce((sum, x) => sum + (x.totalDeposits || 0), 0) || 1;
              const pct = Math.round(((p.totalDeposits || 0) / totalDeposits) * 100);
              return (
                <div key={p._id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize', PROVIDER_COLORS[p._id] || PROVIDER_COLORS.manual)}>
                        {p._id?.replace(/_/g, ' ') || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-400">{p.totalDeposits} {t('dashboard.commission.providers.deposits')}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(p.totalAmount)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: pct + '%' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Date filter */}
      <div className="flex gap-3 items-end flex-wrap">
        <div>
            <label className="label">{t('dashboard.commission.filters.startDate')}</label>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className="input-field" />
          </div>
          <div>
            <label className="label">{t('dashboard.commission.filters.endDate')}</label>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className="input-field" />
          </div>
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium pb-1">
              {t('dashboard.commission.filters.clear')}
            </button>
          )}
      </div>

      {/* Commission transactions table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('dashboard.commission.transactions.title')}</h3>
        </div>
        {loadingCommission ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">{t('dashboard.commission.transactions.noData')}</p>
        ) : (
          <>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/40">
              {transactions.map(tx => (
                <div key={tx._id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                      <CurrencyDollarIcon className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {tx.user?.firstName} {tx.user?.lastName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{tx.description || tx.reference}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-green-600">+{formatCurrency(tx.amount)}</p>
                    <p className="text-xs text-gray-400">{format(new Date(tx.createdAt), 'MMM d, yyyy')}</p>
                  </div>
                  <Badge status={tx.status} />
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
              <Pagination meta={meta} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
