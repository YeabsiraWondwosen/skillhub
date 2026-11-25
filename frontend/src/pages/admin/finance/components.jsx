import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { SkeletonText } from '@/components/ui/Skeleton';
import { ArrowUpIcon, ArrowDownIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { CreditCard, ShieldCheck, Smartphone, Landmark, Building2, Wallet, User, FlaskConical } from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export const GATEWAY_ICONS = {
  stripe: CreditCard,
  chapa: ShieldCheck,
  telebirr: Smartphone,
  cbe_birr: Landmark,
  bank_transfer: Building2,
  wallet: Wallet,
  manual: User,
  demo: FlaskConical,
};

export function GatewayIcon({ provider, className = 'w-4 h-4', size }) {
  const Icon = GATEWAY_ICONS[provider] || CreditCard;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

export const GATEWAYS = ['stripe', 'chapa', 'telebirr', 'cbe_birr', 'wallet', 'bank_transfer', 'manual', 'demo'];

export const PAYMENT_TYPES = ['deposit', 'withdrawal', 'milestone_payment', 'project_payment', 'escrow', 'escrow_release', 'refund', 'commission'];

export const DATE_PRESETS = [
  { label: 'Today', value: () => ({ start: format(new Date(), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
  { label: '7 Days', value: () => ({ start: format(subDays(new Date(), 7), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
  { label: '30 Days', value: () => ({ start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'This Month', value: () => ({ start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') }) },
  { label: 'Last Month', value: () => ({ start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd') }) },
];

export function KPICard({ label, value, icon: Icon, color, bg, sub, delay = 0, trend, onClick }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.05 }}
      onClick={onClick}
      className={clsx('card p-5 relative overflow-hidden group hover:shadow-card-hover transition-shadow', onClick && 'cursor-pointer hover:-translate-y-0.5')}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-[3rem] ${bg} opacity-50 -mr-6 -mt-6 group-hover:scale-110 transition-transform`} />
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3 relative z-10`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white relative z-10">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 relative z-10">{label}</p>
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-2 mt-1.5 relative z-10">
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
          {trend !== undefined && (
            <span className={clsx('text-xs font-semibold flex items-center gap-0.5', trend >= 0 ? 'text-green-600' : 'text-red-500')}>
              {trend >= 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

export function SectionHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {Icon && <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center"><Icon className="w-4 h-4 text-primary-600" /></div>}
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function DateRangeFilter({ dateRange, setDateRange, live, onLiveToggle }) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const active = DATE_PRESETS.find(p => {
    const v = p.value();
    return dateRange.startDate === v.start && dateRange.endDate === v.end;
  });
  const isAllTime = !dateRange.startDate && !dateRange.endDate;
  const isCustom = !active && !isAllTime && !!(dateRange.startDate || dateRange.endDate);
  const label = isCustom ? 'Custom Range' : active ? active.label : 'All Time';
  const applyPreset = (p) => {
    const v = p.value();
    setDateRange({ startDate: v.start, endDate: v.end });
    setOpen(false);
  };
  const selectAllTime = () => {
    setDateRange({ startDate: '', endDate: '' });
    setShowCustom(false);
    setOpen(false);
  };
  const selectCustom = () => {
    setShowCustom(true);
    setOpen(false);
  };
  const optionClass = (on) => clsx('w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition-colors',
    on ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700');
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {live !== undefined && onLiveToggle && (
        <button onClick={onLiveToggle} title="Toggle live activity polling"
          className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
            live ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600')}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', live ? 'bg-white animate-pulse' : 'bg-gray-400')} />
          Live
        </button>
      )}
      <div className="relative">
        <button onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600">
          <span>{label}</span>
          <ChevronDownIcon className={clsx('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-dark-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-1.5 z-40">
              <button onClick={selectAllTime} className={optionClass(isAllTime)}>All Time</button>
              {DATE_PRESETS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p)} className={optionClass(active?.label === p.label)}>
                  {p.label}
                </button>
              ))}
              <div className="h-px bg-gray-100 dark:bg-gray-700 my-1.5" />
              <button onClick={selectCustom} className={optionClass(showCustom || isCustom)}>Custom Range</button>
            </div>
          </>
        )}
      </div>
      {(showCustom || isCustom) && (
        <>
          <input type="date" value={dateRange.startDate || ''} onChange={e => setDateRange(p => ({ ...p, startDate: e.target.value }))}
            className="px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={dateRange.endDate || ''} onChange={e => setDateRange(p => ({ ...p, endDate: e.target.value }))}
            className="px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300" />
        </>
      )}
    </div>
  );
}

export function DataTable({ columns, data, loading, emptyMessage = 'No data found' }) {
  if (loading) return <div className="p-4"><SkeletonText lines={8} /></div>;
  if (!data?.length) return <p className="text-center text-sm text-gray-400 py-12">{emptyMessage}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-dark-700">
          <tr>{columns.map(col => (
            <th key={col.key} className={clsx('px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider', col.align === 'right' && 'text-right')}>
              {col.header ? col.header() : col.label}
            </th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
          {data.map((row, i) => (
            <tr key={row._id || i} className="hover:bg-gray-50/50 dark:hover:bg-dark-700/50 transition-colors">
              {columns.map(col => (
                <td key={col.key} className={clsx('px-4 py-3', col.align === 'right' && 'text-right')}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ActionModal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className={clsx('bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto',
            size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg', 'w-full')}>
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
          <div className="p-5">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function LiveIndicator({ active }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium">
      <span className={clsx('w-2 h-2 rounded-full', active ? 'bg-green-500 animate-pulse' : 'bg-gray-300')} />
      {active ? 'Live' : 'Offline'}
    </span>
  );
}

export function FilterPills({ options, value, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1 flex-wrap">
      {options.map(opt => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? (val ? val.replace(/_/g, ' ') : 'All') : opt.label;
        return (
          <button key={val} onClick={() => onChange(val || undefined)}
            className={clsx('px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
              (val === '' && !value) || value === val ? 'bg-white dark:bg-dark-800 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function SelectFilter({ label, value, onChange, options }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value || undefined)}
      className="px-3 py-2 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300">
      <option value="">{label}</option>
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? val.replace(/_/g, ' ') : o.label;
        return <option key={val} value={val}>{lbl}</option>;
      })}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative flex-1 max-w-md">
      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        className="w-full pl-9 pr-4 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
    </div>
  );
}
