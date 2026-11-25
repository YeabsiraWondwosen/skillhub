import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useWalletBalance, useWithdraw } from '@/hooks/usePayments';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { CurrencyDollarIcon, BanknotesIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import { Landmark, Smartphone, CreditCard, Check, ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { formatCurrency } from '@/utils/currency';

const METHODS = [
  { id: 'bank_transfer', label: 'Bank Transfer', desc: 'Direct to your bank account', icon: Landmark, min: 10, max: 500000, fields: [
    { name: 'bankName', label: 'Bank Name', placeholder: 'e.g. Commercial Bank of Ethiopia', required: true },
    { name: 'accountNumber', label: 'Account Number', placeholder: '1000XXXXXXX', required: true },
    { name: 'accountName', label: 'Account Holder Name', placeholder: 'Full name on account', required: true },
  ]},
  { id: 'telebirr', label: 'Telebirr', desc: 'Ethio Telecom mobile money', icon: Smartphone, min: 10, max: 500000, fields: [
    { name: 'phone', label: 'Phone Number', placeholder: '+251 9XX XXX XXX', required: true },
  ]},
  { id: 'cbe_birr', label: 'CBE Birr', desc: 'Commercial Bank of Ethiopia', icon: Landmark, min: 10, max: 500000, fields: [
    { name: 'accountNumber', label: 'CBE Account Number', placeholder: '1000XXXXXXX', required: true },
  ]},
  { id: 'chapa', label: 'Chapa', desc: 'Withdraw via Chapa gateway', icon: CreditCard, min: 10, max: 50000, fields: [
    { name: 'email', label: 'Chapa Email', placeholder: 'you@example.com', required: true },
  ]},
];

export default function WithdrawPage() {
  const [methodId, setMethodId] = useState('bank_transfer');
  const [amount, setAmount] = useState('');
  const [success, setSuccess] = useState(false);

  const { data: balanceData, isLoading: balanceLoading } = useWalletBalance();
  const { mutate: withdraw, isPending } = useWithdraw();

  const { register, handleSubmit, formState: { errors }, setValue, reset } = useForm();

  const balance = balanceData?.data;
  const available = (balance?.balance ?? 0) - (balance?.escrowBalance ?? 0);
  const method = METHODS.find(m => m.id === methodId);

  const onSubmit = (formData) => {
    const parsed = parseFloat(amount);
    if (parsed < (method?.min || 10)) {
      toast.error(`Minimum withdrawal is ${method?.min || 10} ETB`);
      return;
    }
    if (parsed > available) {
      toast.error(`Insufficient balance. Available: ${formatCurrency(available)}`);
      return;
    }

    const details = {};
    (method?.fields || []).forEach(f => {
      details[f.name] = formData[f.name];
    });

    withdraw({ amount: parsed, method: methodId, details, currency: 'ETB' }, {
      onSuccess: () => {
        setSuccess(true);
        reset();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Withdrawal failed');
      },
    });
  };

  if (success) {
    return (
      <div className="page-container max-w-md flex flex-col items-center text-center space-y-4 pt-12">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Check size={30} className="text-green-600" strokeWidth={3} />
        </motion.div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Withdrawal Initiated!</h2>
        <p className="text-sm text-gray-500">
          Your withdrawal is being processed. It may take 1-3 business days to reach your account.
        </p>
        <div className="flex gap-3">
          <Link to="/payments/wallet" className="btn-primary">Back to Wallet</Link>
          <Link to="/payments/transactions" className="btn-secondary">View Transactions</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg space-y-6">
      <div>
        <Link to="/payments/wallet" className="text-sm text-gray-400 hover:text-primary-600 inline-flex items-center gap-1"><ArrowLeft size={14} /> Wallet</Link>
        <h1 className="section-title mt-1">Withdraw Funds</h1>
        <p className="section-sub">Transfer money from your wallet to your bank or mobile account</p>
      </div>

      {/* Available Balance */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Available Balance</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {balanceLoading ? '...' : formatCurrency(available)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <BanknotesIcon className="w-6 h-6 text-green-600" />
          </div>
        </div>
        {(balance?.escrowBalance ?? 0) > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            {formatCurrency(balance?.escrowBalance)} is held in escrow and cannot be withdrawn.
          </p>
        )}
      </div>

      {/* Method Selection */}
      <div>
        <label className="label mb-2">Withdrawal Method</label>
        <div className="grid grid-cols-2 gap-3">
          {METHODS.map(m => (
            <button key={m.id} type="button"
              onClick={() => { setMethodId(m.id); setAmount(''); reset(); }}
              className={clsx('card p-4 text-left transition-all',
                methodId === m.id ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'hover:border-primary-300')}>
              <span className="text-2xl flex items-center"><m.icon className="w-6 h-6" aria-hidden="true" /></span>
              <p className="font-semibold text-sm text-gray-900 dark:text-white mt-1">{m.label}</p>
              <p className="text-xs text-gray-400">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Withdrawal Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4">
        <Input
          label={`Amount (ETB) — Min ${method.min}`}
          type="number"
          min={method.min}
          max={Math.min(method.max, available)}
          placeholder={`e.g. ${method.min * 10}`}
          icon={CurrencyDollarIcon}
          error={errors.amount?.message}
          value={amount}
          {...register('amount', {
            required: 'Amount is required',
            min: { value: method.min, message: `Minimum is ${method.min} ETB` },
            max: { value: Math.min(method.max, available), message: 'Amount exceeds available balance' },
          })}
          onChange={e => { setAmount(e.target.value); setValue('amount', e.target.value); }}
        />

        {method.fields.map(field => (
          <Input
            key={field.name}
            label={field.label}
            type={field.name === 'phone' ? 'tel' : 'text'}
            placeholder={field.placeholder}
            error={errors[field.name]?.message}
            {...register(field.name, {
              required: field.required ? `${field.label} is required` : false,
            })}
          />
        ))}

        <Button type="submit" loading={isPending} className="w-full btn-lg">
          Withdraw via {method.label}
        </Button>
        <p className="text-xs text-center text-gray-400">
          Withdrawals are typically processed within 1-3 business days.
        </p>
      </form>
    </div>
  );
}
