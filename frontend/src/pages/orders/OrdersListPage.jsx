import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingBagIcon, ClockIcon, CheckCircleIcon, XCircleIcon,
  BanknotesIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useOrders, useOrderStats } from '@/hooks/useOrders';
import OrderCard from '@/components/orders/OrderCard';
import EmptyState from '@/components/ui/EmptyState';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import { SkeletonCard } from '@/components/ui/Skeleton';
import PageHeader from '@/components/ui/PageHeader';
import { formatCurrency } from '@/utils/currency';

const STATUS_TABS = ['all', 'pending_payment', 'funded', 'accepted', 'delivered', 'completed', 'declined', 'cancelled'];

export default function OrdersListPage({ as, basePath }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useOrders({ as, status: status || undefined, page, limit: 10 });
  const { data: statsData } = useOrderStats(as);

  const orders = data?.data ?? [];
  const meta = data?.meta;
  const stats = statsData?.data || {};

  const isFreelancer = as === 'freelancer';

  const statCards = [
    {
      icon: ClockIcon, label: isFreelancer ? 'Awaiting Response' : 'Pending',
      value: stats.pending ?? 0, to: basePath,
      color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    },
    {
      icon: ShoppingBagIcon, label: 'Active Orders',
      value: stats.active ?? 0, to: basePath,
      color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      icon: CheckCircleIcon, label: 'Completed',
      value: stats.completed ?? 0, to: basePath,
      color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20',
    },
    ...(isFreelancer
      ? [{
          icon: BanknotesIcon, label: 'Gross Revenue (completed)',
          value: formatCurrency(stats.grossRevenue), to: '/freelancer/earnings',
          color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20',
        }]
      : [{
          icon: XCircleIcon, label: 'Closed',
          value: stats.cancelled ?? 0, to: basePath,
          color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-700',
        }]),
  ];

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={ShoppingBagIcon}
        title={isFreelancer ? 'Service Orders' : 'My Service Orders'}
        subtitle={isFreelancer
          ? 'Orders clients placed on your published services'
          : 'Orders you have placed on services'}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Link to={s.to} className="stat-card block hover:shadow-card-hover transition-all duration-200">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="stat-value">{s.value}</p>
              <p className="stat-label">{s.label}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Status filter */}
      <div className="max-w-xs">
        <Select
          value={status || 'all'}
          onChange={e => { setStatus(e.target.value === 'all' ? '' : e.target.value); setPage(1); }}
          aria-label="Filter orders by status"
        >
          {STATUS_TABS.map(t => (
            <option key={t} value={t}>
              {t === 'all' ? 'All' : t.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : orders.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={isFreelancer ? ArrowPathIcon : ShoppingBagIcon}
            title={isFreelancer ? 'No service orders yet' : 'No orders placed yet'}
            description={isFreelancer
              ? 'When a client orders one of your published services, it will appear here.'
              : 'Browse services and place your first order to get started.'}
            action={
              isFreelancer
                ? <Link to="/freelancer/catalogs" className="btn-primary btn-sm">Manage My Services</Link>
                : <Link to="/catalogs" className="btn-primary btn-sm">Browse Services</Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <OrderCard key={order._id} order={order} index={i} as={as} />
          ))}
        </div>
      )}

      <Pagination meta={meta} onPageChange={setPage} />
    </div>
  );
}
