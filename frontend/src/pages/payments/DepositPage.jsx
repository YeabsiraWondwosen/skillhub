import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useDepositStripe, useDepositChapa, useDepositTelebirr, useDepositCbeBirr } from '@/hooks/usePayments';
import { paymentService } from '@/services/payment.service';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { CreditCard, Landmark, Smartphone, ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';

const METHODS = [
  { id: 'stripe', label: 'Stripe', desc: 'Credit/Debit card worldwide', icon: CreditCard, currency: 'ETB', symbol: 'Br', quickAmounts: [250, 500, 1000, 2500, 5000, 10000], min: 10, max: 500000, type: 'card' },
  { id: 'chapa', label: 'Chapa', desc: 'Ethiopian payment gateway', icon: CreditCard, currency: 'ETB', symbol: 'ETB ', quickAmounts: [100, 200, 500, 1000, 2000, 5000], min: 10, max: 50000, type: 'mobile' },
  { id: 'telebirr', label: 'Telebirr', desc: 'Ethio Telecom mobile money', icon: Smartphone, currency: 'ETB', symbol: 'ETB ', quickAmounts: [100, 200, 500, 1000, 2000, 5000], min: 10, max: 500000, type: 'mobile' },
  { id: 'cbe_birr', label: 'CBE Birr', desc: 'Commercial Bank of Ethiopia', icon: Landmark, currency: 'ETB', symbol: 'ETB ', quickAmounts: [100, 200, 500, 1000, 2000, 5000], min: 10, max: 500000, type: 'bank' },
];

export default function DepositPage() {
  const [params] = useSearchParams();
  const [methodId, setMethodId] = useState(params.get('method') ?? 'stripe');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [success, setSuccess] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(null);

  useEffect(() => {
    paymentService.getPaymentMode()
      .then((res) => setIsDemoMode(res.data?.data?.isDemo ?? false))
      .catch(() => setIsDemoMode(false));
  }, []);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm();
  const { mutate: depositStripe, isPending: isStripe } = useDepositStripe();
  const { mutate: depositChapa, isPending: isChapa } = useDepositChapa();
  const { mutate: depositTelebirr, isPending: isTelebirr } = useDepositTelebirr();
  const { mutate: depositCbeBirr, isPending: isCbeBirr } = useDepositCbeBirr();

  const method = METHODS.find(m => m.id === methodId) ?? METHODS[0];
  const isPending = isStripe || isChapa || isTelebirr || isCbeBirr;

  const onSubmit = ({ amount: amt }) => {
    const parsed = parseFloat(amt);
    const onSuccessCommon = () => setSuccess(true);

    if (isDemoMode) {
      depositStripe({ amount: parsed, currency: 'ETB' }, {
        onSuccess: onSuccessCommon,
        onError: (err) => toast.error(err.response?.data?.message || 'Demo deposit failed'),
      });
      return;
    }

    if (methodId === 'stripe') {
      depositStripe({ amount: parsed, currency: 'ETB' }, {
        onSuccess: () => setSuccess(true),
        onError: (err) => toast.error(err.response?.data?.message || 'Stripe deposit failed'),
      });
    } else if (methodId === 'chapa') {
      depositChapa({ amount: parsed, currency: 'ETB' }, {
        onSuccess: (res) => {
          const url = res.data?.data?.checkoutUrl;
          if (url) window.location.href = url;
          else toast.error('Chapa did not return a checkout URL');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Chapa deposit failed'),
      });
    } else if (methodId === 'telebirr') {
      depositTelebirr({ amount: parsed, currency: 'ETB', phone: phone || undefined }, {
        onSuccess: (res) => {
          const url = res.data?.data?.checkoutUrl || res.data?.data?.payLink;
          if (url) window.location.href = url;
          else { toast.success('Telebirr payment initiated. Check your phone.'); setSuccess(true); }
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Telebirr deposit failed'),
      });
    } else if (methodId === 'cbe_birr') {
      depositCbeBirr({ amount: parsed, currency: 'ETB', accountNumber: accountNumber || undefined }, {
        onSuccess: (res) => {
          const url = res.data?.data?.checkoutUrl;
          const ussd = res.data?.data?.ussdCode;
          if (url) window.location.href = url;
          else if (ussd) { toast.success('Dial ' + ussd + ' to complete payment', { duration: 500 }); setSuccess(true); }
          else setSuccess(true);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'CBE Birr deposit failed'),
      });
    }
  };

  if (success) {
    return (
      <div className="page-container max-w-md flex flex-col items-center text-center space-y-4 pt-12">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <span className="text-3xl">&#10003;</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Deposit Initiated!</h2>
        <p className="text-sm text-gray-500">Your payment is being processed and will reflect in your wallet shortly.</p>
        <Link to="/payments/wallet" className="btn-primary">Back to Wallet</Link>
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg space-y-6">
      <div>
        <Link to="/payments/wallet" className="text-sm text-gray-400 hover:text-primary-600 inline-flex items-center gap-1"><ArrowLeft size={14} /> Wallet</Link>
        <h1 className="section-title mt-1">Deposit Funds</h1>
        <p className="section-sub">Add money to your SkillHub wallet</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {METHODS.map(m => (
          <button key={m.id} type="button" onClick={() => { setMethodId(m.id); setAmount(''); setValue('amount', ''); setPhone(''); setAccountNumber(''); }}
            className={clsx('card p-4 text-left transition-all',
              methodId === m.id ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'hover:border-primary-300')}>
            <m.icon size={26} aria-hidden="true" />
            <p className="font-semibold text-sm text-gray-900 dark:text-white mt-1">{m.label}</p>
            <p className="text-xs text-gray-400">{m.desc}</p>
            <p className="text-xs text-primary-600 font-medium mt-1">{m.currency}</p>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4">
        <div>
          <label className="label">Quick Amount ({method.currency})</label>
          <div className="grid grid-cols-3 gap-2">
            {method.quickAmounts.map(a => (
              <button key={a} type="button"
                onClick={() => { setAmount(String(a)); setValue('amount', a); }}
                className={clsx('py-2 rounded-lg text-sm font-semibold border transition-colors',
                  amount === String(a) ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-primary-400')}>
                {method.symbol}{a}
              </button>
            ))}
          </div>
        </div>

        <Input
          label={'Custom amount (' + method.currency + ')'}
          type="number"
          min={method.min}
          max={method.max}
          placeholder={'e.g. ' + (methodId === 'stripe' ? '150' : '500 ETB')}
          icon={CurrencyDollarIcon}
          error={errors.amount?.message}
          value={amount}
          {...register('amount', {
            required: 'Amount is required',
            min: { value: method.min, message: 'Minimum amount is ' + method.min },
            max: { value: method.max, message: 'Maximum is ' + method.max + ' ' + method.currency },
          })}
          onChange={e => { setAmount(e.target.value); setValue('amount', e.target.value); }}
        />

        {methodId === 'telebirr' && (
          <Input
            label="Phone Number (optional)"
            type="tel"
            placeholder="+251 9XX XXX XXX"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        )}

        {methodId === 'cbe_birr' && (
          <Input
            label="CBE Account Number (optional)"
            type="text"
            placeholder="1000XXXXXXX"
            value={accountNumber}
            onChange={e => setAccountNumber(e.target.value)}
          />
        )}

        {isDemoMode && (
          <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg px-3 py-2">
            <strong>Demo Mode:</strong> Deposits are simulated instantly. No real money is charged. Perfect for testing.
          </div>
        )}

        <Button type="submit" loading={isPending} className="w-full btn-lg">
          Deposit via {method.label}
        </Button>
        <p className="text-xs text-center text-gray-400">
          All transactions are secured and encrypted.
        </p>
      </form>
    </div>
  );
}
