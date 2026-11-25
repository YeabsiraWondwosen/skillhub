import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useWallet } from '@/hooks/usePayments';
import { useAuthStore } from '@/store/authStore';
import {
  CurrencyDollarIcon, ArrowUpIcon, ArrowDownIcon,
  ClockIcon, ShieldCheckIcon, BanknotesIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';

export default function WalletPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data, isLoading } = useWallet();
  const wallet = data?.data;

  const stats = [
    {
      label: t('payments.wallet.stats.availableBalance'), icon: CurrencyDollarIcon,
      value: formatCurrency((wallet?.balance ?? 0) - (wallet?.escrowBalance ?? 0)),
      color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20',
      desc: t('payments.wallet.stats.availableBalanceDesc'),
    },
    {
      label: t('payments.wallet.stats.inEscrow'), icon: ShieldCheckIcon,
      value: formatCurrency(wallet?.escrowBalance ?? 0),
      color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      desc: t('payments.wallet.stats.inEscrowDesc'),
    },
    {
      label: t('payments.wallet.stats.totalEarned'), icon: ArrowDownIcon,
      value: formatCurrency(wallet?.totalEarned ?? 0),
      color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20',
      desc: t('payments.wallet.stats.totalEarnedDesc'),
    },
    {
      label: t('payments.wallet.stats.totalSpent'), icon: ArrowUpIcon,
      value: formatCurrency(wallet?.totalSpent ?? 0),
      color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20',
      desc: user?.role === 'client'
        ? t('payments.wallet.stats.totalSpentClientDesc')
        : t('payments.wallet.stats.totalSpentFreelancerDesc'),
    },
  ];

  const quickActions = [
    {
      label: t('payments.wallet.actions.depositStripe.label'),
      to: '/payments/deposit?method=stripe',
      desc: t('payments.wallet.actions.depositStripe.desc'),
      icon: CurrencyDollarIcon,
    },
    {
      label: t('payments.wallet.actions.depositChapa.label'),
      to: '/payments/deposit?method=chapa',
      desc: t('payments.wallet.actions.depositChapa.desc'),
      icon: CurrencyDollarIcon,
    },
    {
      label: t('payments.wallet.actions.depositTelebirr.label'),
      to: '/payments/deposit?method=telebirr',
      desc: t('payments.wallet.actions.depositTelebirr.desc'),
      icon: CurrencyDollarIcon,
    },
    {
      label: t('payments.wallet.actions.depositCbeBirr.label'),
      to: '/payments/deposit?method=cbe_birr',
      desc: t('payments.wallet.actions.depositCbeBirr.desc'),
      icon: CurrencyDollarIcon,
    },
    {
      label: t('payments.wallet.actions.withdraw.label'),
      to: '/payments/withdraw',
      desc: t('payments.wallet.actions.withdraw.desc'),
      icon: BanknotesIcon,
    },
    {
      label: t('payments.wallet.actions.escrow.label'),
      to: '/payments/escrow',
      desc: t('payments.wallet.actions.escrow.desc'),
      icon: ShieldCheckIcon,
    },
    {
      label: t('payments.wallet.actions.transactions.label'),
      to: '/payments/transactions',
      desc: t('payments.wallet.actions.transactions.desc'),
      icon: ClockIcon,
    },
  ];

  const walletInfo = [
    { label: t('payments.wallet.info.currency'), value: wallet?.currency ?? 'ETB' },
    { label: t('payments.wallet.info.status'), value: wallet?.isActive ? t('payments.wallet.info.statusActive') : t('payments.wallet.info.statusInactive') },
    { label: t('payments.wallet.info.availableToWithdraw'), value: formatCurrency((wallet?.balance ?? 0) - (wallet?.escrowBalance ?? 0)) },
  ];

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-title">{t('payments.wallet.title')}</h1>
          <p className="section-sub">{t('payments.wallet.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Link to="/payments/deposit" className="btn-primary">{t('payments.wallet.buttons.deposit')}</Link>
          <Link to="/payments/withdraw" className="btn-secondary">
            <BanknotesIcon className="w-4 h-4 inline mr-1" /> {t('payments.wallet.buttons.withdraw')}
          </Link>
          <Link to="/payments/transactions" className="btn-secondary">{t('payments.wallet.buttons.transactions')}</Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }} className="stat-card">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="stat-value">{s.value}</p>
              <p className="stat-label">{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{t('payments.wallet.quickActions.title')}</h2>
          <div className="space-y-3">
            {quickActions.map(a => (
              <Link key={a.to} to={a.to}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all">
                <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                  <a.icon className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{a.label}</p>
                  <p className="text-xs text-gray-400">{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{t('payments.wallet.info.title')}</h2>
          <div className="space-y-3 text-sm">
            {walletInfo.map(r => (
              <div key={r.label} className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                <span className="text-gray-400">{r.label}</span>
                <span className="font-medium text-gray-900 dark:text-white">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
