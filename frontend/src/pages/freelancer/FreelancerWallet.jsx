import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useWallet, useMyEscrows,
  useTransactions, useWithdrawals, usePaymentMethods,
  useSetDefaultPaymentMethod, useDeletePaymentMethod,
} from '@/hooks/usePayments';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonStats } from '@/components/ui/Skeleton';
import { useConfirm } from '@/components/ui/DialogProvider';
import { format } from 'date-fns';
import {
  WalletIcon, CurrencyDollarIcon, ShieldCheckIcon, BanknotesIcon,
  ClockIcon, ArrowDownIcon, ArrowUpIcon,
  CreditCardIcon, ArrowPathIcon,
  CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { formatCurrency } from '@/utils/currency';
import { Landmark, Smartphone, CreditCard, ArrowRight } from 'lucide-react';

const ESCROW_ICONS = {
  pending: ClockIcon, funded: ShieldCheckIcon, in_progress: ArrowPathIcon,
  submitted: ExclamationTriangleIcon, released: CheckCircleIcon,
  refunded: XCircleIcon, disputed: ExclamationTriangleIcon,
};

const ESCROW_BADGE_STATUS = {
  funded: 'info', in_progress: 'warning', submitted: 'warning',
  released: 'success', refunded: 'info', disputed: 'danger', pending: 'default',
};

const TX_TYPES = ['', 'escrow_release', 'commission', 'withdrawal', 'escrow_hold'];

const PAYMENT_METHOD_ICONS = {
  bank_transfer: Landmark,
  telebirr: Smartphone,
  cbe_birr: Landmark,
  chapa: CreditCard,
};

function MethodIcon({ type, size = 16, className }) {
  const Icon = PAYMENT_METHOD_ICONS[type] || CreditCard;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

export default function FreelancerWallet() {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('overview');
  const [txPage, setTxPage] = useState(1);
  const [txType, setTxType] = useState('');
  const [escrowPage, setEscrowPage] = useState(1);
  const [escrowFilter, setEscrowFilter] = useState('');
  const [withdrawPage, setWithdrawPage] = useState(1);
  const [withdrawFilter, setWithdrawFilter] = useState('');

  const { data: walletData, isLoading: walletLoading } = useWallet();
  const { data: escrowData, isLoading: escrowsLoading } = useMyEscrows({ status: escrowFilter || undefined, page: escrowPage, limit: 5 });
  const { data: txData, isLoading: txLoading } = useTransactions({ page: txPage, limit: 10, type: txType || undefined });
  const { data: withdrawData, isLoading: withdrawLoading } = useWithdrawals({ status: withdrawFilter || undefined, page: withdrawPage, limit: 10 });
  const { data: methodsData } = usePaymentMethods();
  const { mutate: setDefault } = useSetDefaultPaymentMethod();
  const { mutate: removeMethod } = useDeletePaymentMethod();

  const handleRemoveMethod = async (id) => {
    const ok = await confirm({
      title: 'Remove payment method',
      message: 'Remove this payment method? You can add it again later.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) removeMethod(id);
  };

  const wallet = walletData?.data;
  const escrows = escrowData?.data ?? [];
  const escrowMeta = escrowData?.meta;
  const transactions = txData?.data ?? [];
  const txMeta = txData?.meta;
  const withdrawals = withdrawData?.data ?? [];
  const withdrawMeta = withdrawData?.meta;
  const paymentMethods = methodsData?.data ?? [];

  const availableBalance = (wallet?.balance ?? 0) - (wallet?.escrowBalance ?? 0);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: WalletIcon },
    { id: 'escrow', label: 'Escrow', icon: ShieldCheckIcon },
    { id: 'withdrawals', label: 'Withdrawals', icon: BanknotesIcon },
    { id: 'transactions', label: 'Transactions', icon: ClockIcon },
    { id: 'methods', label: 'Payment Methods', icon: CreditCardIcon },
  ];

  const balanceCards = [
    { label: 'Available Balance', value: availableBalance, icon: CurrencyDollarIcon, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', desc: 'Ready to withdraw or use' },
    { label: 'In Escrow', value: wallet?.pendingEarnings ?? 0, icon: ShieldCheckIcon, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', desc: 'Held for active milestones' },
    { label: 'Pending Balance', value: wallet?.pendingBalance ?? 0, icon: ClockIcon, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', desc: 'Pending clearance' },
    { label: 'Total Withdrawn', value: wallet?.totalWithdrawn ?? 0, icon: ArrowUpIcon, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', desc: 'Withdrawn to your accounts' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-title">Freelancer Wallet</h1>
          <p className="section-sub">Manage your funds, escrow, and withdrawals</p>
        </div>
        <div className="flex gap-2">
          <Link to="/payments/withdraw" className="btn-primary btn-sm">
            <BanknotesIcon className="w-4 h-4 inline mr-1" /> Withdraw Funds
          </Link>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-gray-700">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all flex-shrink-0',
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            {walletLoading ? <SkeletonStats /> : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {balanceCards.map((c, i) => (
                    <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }} className="stat-card">
                      <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                        <c.icon className={`w-5 h-5 ${c.color}`} />
                      </div>
                      <p className="stat-value">{c.value.toFixed(2)} <span className="text-xs font-normal text-gray-400">ETB</span></p>
                      <p className="stat-label">{c.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{c.desc}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 card p-5">
                    <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        { label: 'Withdraw Funds', to: '/payments/withdraw', icon: BanknotesIcon, desc: 'Transfer to bank or mobile money' },
                        { label: 'View Escrow', to: '/payments/escrow', icon: ShieldCheckIcon, desc: 'Track escrowed payments' },
                        { label: 'Transaction History', to: '/payments/transactions', icon: ClockIcon, desc: 'View all transactions' },
                        { label: 'Payment Methods', to: '#', icon: CreditCardIcon, desc: 'Manage payout methods', onClick: () => setActiveTab('methods') },
                        { label: 'Deposit Funds', to: '/payments/deposit', icon: CurrencyDollarIcon, desc: 'Add funds to your wallet' },
                      ].map(a => (
                        a.to && a.to !== '#' ? (
                          <Link key={a.label} to={a.to}
                            className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all">
                            <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                              <a.icon className="w-5 h-5 text-primary-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{a.label}</p>
                              <p className="text-xs text-gray-400 truncate">{a.desc}</p>
                            </div>
                          </Link>
                        ) : (
                          <button key={a.label} onClick={a.onClick}
                            className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all text-left">
                            <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                              <a.icon className="w-5 h-5 text-primary-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{a.label}</p>
                              <p className="text-xs text-gray-400 truncate">{a.desc}</p>
                            </div>
                          </button>
                        )
                      ))}
                    </div>
                  </div>

                  <div className="card p-5">
                    <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Wallet Info</h2>
                    <div className="space-y-3 text-sm">
                      {[
                        { label: 'Currency', value: wallet?.currency ?? 'ETB' },
                        { label: 'Status', value: wallet?.isActive ? 'Active' : 'Inactive' },
                        { label: 'Available to Withdraw', value: formatCurrency(Math.max(0, availableBalance)) },
                        { label: 'Total Balance', value: formatCurrency(wallet?.balance) },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                          <span className="text-gray-400">{r.label}</span>
                          <span className="font-medium text-gray-900 dark:text-white">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'escrow' && (
          <motion.div key="escrow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {['', 'funded', 'in_progress', 'submitted', 'released', 'refunded'].map(s => (
                <button key={s || 'all'} onClick={() => { setEscrowFilter(s); setEscrowPage(1); }}
                  className={clsx('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize',
                    escrowFilter === s ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400')}>
                  {s ? s.replace(/_/g, ' ') : 'All'}
                </button>
              ))}
            </div>
            {escrowsLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
            ) : escrows.length === 0 ? (
              <EmptyState icon={ShieldCheckIcon} title="No escrows" description="Escrows will appear here when clients fund milestones" />
            ) : (
              <div className="space-y-3">
                {escrows.map((e, i) => {
                  const Icon = ESCROW_ICONS[e.status] || ClockIcon;
                  const isActive = ['funded', 'in_progress', 'submitted'].includes(e.status);
                  return (
                    <motion.div key={e._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={clsx('card p-4 border-l-4',
                        isActive ? 'border-l-yellow-400' : e.status === 'released' ? 'border-l-green-400' : e.status === 'refunded' ? 'border-l-blue-400' : 'border-l-gray-200 dark:border-l-gray-600')}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <Icon className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold text-sm text-gray-900 dark:text-white">{e.project?.title || 'Project'}</span>
                            <Badge status={ESCROW_BADGE_STATUS[e.status] || e.status} className="text-[10px]" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div><span className="text-gray-400">Amount</span><p className="font-bold text-gray-900 dark:text-white">{formatCurrency(e.amount)}</p></div>
                            <div><span className="text-gray-400">Client</span><p className="font-medium text-gray-700 dark:text-gray-200">{e.client?.firstName} {e.client?.lastName}</p></div>
                            <div><span className="text-gray-400">Commission</span><p className="font-medium text-red-500">{formatCurrency(e.commissionAmount)}</p></div>
                            <div><span className="text-gray-400">You Get</span><p className="font-medium text-green-600">{formatCurrency(e.freelancerAmount)}</p></div>
                          </div>
                          <div className="flex gap-3 text-[10px] text-gray-400 mt-2">
                            {e.fundedAt && <span>Funded {format(new Date(e.fundedAt), 'MMM d')}</span>}
                            {e.releasedAt && <span>Released {format(new Date(e.releasedAt), 'MMM d')}</span>}
                            {e.expiresAt && isActive && <span>Expires {format(new Date(e.expiresAt), 'MMM d')}</span>}
                          </div>
                        </div>
                        <Link to={`/payments/escrow`} className="btn-secondary btn-xs flex-shrink-0">
                          <EyeIcon className="w-3 h-3" /> View
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
            {escrowMeta && escrowMeta.totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination meta={escrowMeta} onPageChange={setEscrowPage} />
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'withdrawals' && (
          <motion.div key="withdrawals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Available to Withdraw', value: formatCurrency(availableBalance), color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                { label: 'Pending Withdrawals', value: formatCurrency(withdrawals.filter(w => w.status === 'pending' || w.status === 'processing').reduce((s, w) => s + w.amount, 0)), color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
                { label: 'Completed', value: withdrawals.filter(w => w.status === 'completed').length, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Total Withdrawn', value: formatCurrency(wallet?.totalWithdrawn), color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20' },
              ].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }} className="stat-card">
                  <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
                    <BanknotesIcon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <p className="stat-label">{s.label}</p>
                  <p className={`stat-value ${s.color}`}>{s.value}</p>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Link to="/payments/withdraw" className="btn-primary btn-sm">
                <BanknotesIcon className="w-4 h-4 inline mr-1" /> Withdraw Funds
              </Link>
              <div className="flex gap-2">
                {['', 'pending', 'processing', 'completed', 'failed'].map(s => (
                  <button key={s || 'all'} onClick={() => { setWithdrawFilter(s); setWithdrawPage(1); }}
                    className={clsx('px-3 py-1 rounded-full text-xs font-medium border capitalize',
                      withdrawFilter === s ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400')}>
                    {s || 'All'}
                  </button>
                ))}
              </div>
            </div>

            {withdrawLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
            ) : withdrawals.length === 0 ? (
              <EmptyState icon={BanknotesIcon} title="No withdrawals yet" description="Your withdrawal history will appear here" />
            ) : (
              <div className="card overflow-hidden">
                <div className="divide-y divide-gray-50 dark:divide-gray-700/40">
                  {withdrawals.map(w => (
                    <div key={w._id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg"><MethodIcon type={w.method} size={16} /></span>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{w.method?.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-gray-400">{format(new Date(w.createdAt), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(w.amount)}</p>
                        {w.fee > 0 && <p className="text-[10px] text-gray-400">Fee: {formatCurrency(w.fee)}</p>}
                        <Badge status={w.status} className="text-[10px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {withdrawMeta && withdrawMeta.totalPages > 1 && (
              <Pagination meta={withdrawMeta} onPageChange={setWithdrawPage} />
            )}
          </motion.div>
        )}

        {activeTab === 'transactions' && (
          <motion.div key="transactions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {TX_TYPES.map(t => (
                <button key={t || 'all'} onClick={() => { setTxType(t); setTxPage(1); }}
                  className={clsx('filter-pill flex-shrink-0 capitalize',
                    txType === t && 'filter-pill-active')}>
                  {t ? t.replace(/_/g, ' ') : 'All'}
                </button>
              ))}
            </div>

            {txLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
            ) : transactions.length === 0 ? (
              <div className="card p-8">
                <EmptyState icon={ClockIcon} title="No transactions" description="Your transaction history will appear here" />
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        {['Reference', 'Type', 'Gross', 'Commission', 'Net', 'Status', 'Date'].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => {
                        const hasSnapshots = tx.balanceBefore != null && tx.balanceAfter != null;
                        const isNeutral = tx.type === 'escrow_release' && hasSnapshots && tx.balanceAfter <= tx.balanceBefore;
                        const isCredit = isNeutral ? false : ['escrow_release', 'deposit', 'refund'].includes(tx.type);
                        const showCommission = tx.type === 'escrow_release' && tx.fee > 0;
                        return (
                          <tr key={tx._id}>
                            <td>
                              <p className="text-xs font-mono text-gray-500">{tx.reference}</p>
                              {tx.projectId?.title && <p className="text-[10px] text-gray-400">{tx.projectId.title}</p>}
                            </td>
                            <td>
                              <span className="capitalize text-xs font-medium text-gray-700 dark:text-gray-200">{tx.type?.replace(/_/g, ' ')}</span>
                            </td>
                            <td className="font-medium">{formatCurrency(tx.amount)}</td>
                            <td>{showCommission ? <span className="text-red-500">{formatCurrency(tx.fee)}</span> : <span className="text-gray-300">&mdash;</span>}</td>
                            <td className={isNeutral ? 'text-gray-500 font-medium' : clsx('font-bold', isCredit ? 'text-green-600' : 'text-red-500')}>
                              {isNeutral ? formatCurrency(tx.netAmount) : (isCredit ? '+' : '-') + formatCurrency(tx.netAmount)}
                            </td>
                            <td><Badge status={tx.status} className="text-[10px]" /></td>
                            <td className="text-xs text-gray-400">{format(new Date(tx.createdAt), 'MMM d, yyyy')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {txMeta && txMeta.totalPages > 1 && (
              <Pagination meta={txMeta} onPageChange={setTxPage} />
            )}
            <div className="text-center">
              <Link to="/payments/transactions" className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1">
                View Full History <ArrowRight size={14} />
              </Link>
            </div>
          </motion.div>
        )}

        {activeTab === 'methods' && (
          <motion.div key="methods" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Payout Methods</h2>
              <Link to="/payments/withdraw" className="btn-primary btn-sm">
                <CreditCardIcon className="w-4 h-4 inline mr-1" /> Add Method
              </Link>
            </div>

            {paymentMethods.length === 0 ? (
              <EmptyState icon={CreditCardIcon} title="No payment methods"
                description="Add a bank account, Telebirr, or CBE Birr to receive withdrawals"
                ><Link to="/payments/withdraw" className="btn-primary btn-sm">Add Payment Method</Link></EmptyState>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map(m => (
                  <div key={m._id} className="card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl"><MethodIcon type={m.type} size={20} /></span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white capitalize">{m.label || m.type?.replace(/_/g, ' ')}</p>
                          {m.isDefault && <Badge status="success" className="text-[10px]">Default</Badge>}
                        </div>
                        <p className="text-xs text-gray-400">
                          {m.type === 'bank_transfer' && `${m.bankName} \u2022\u2022\u2022\u2022${m.accountNumber?.slice(-4)}`}
                          {m.type === 'telebirr' && m.phone}
                          {m.type === 'cbe_birr' && `\u2022\u2022\u2022\u2022${m.cbeAccountNumber?.slice(-4)}`}
                          {m.type === 'chapa' && m.chapaEmail}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!m.isDefault && (
                        <button onClick={() => setDefault(m._id)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Set Default</button>
                      )}
                      <button onClick={() => handleRemoveMethod(m._id)}
                        className="text-xs text-red-500 hover:text-red-600 font-medium">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}