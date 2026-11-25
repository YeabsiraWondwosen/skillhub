import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import { userService } from '@/services/user.service';
import Button from '@/components/ui/Button';

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money (CBE Birr / M-Pesa)' },
  { value: 'card', label: 'Credit / Debit Card' },
  { value: 'paypal', label: 'PayPal' },
];

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500';

const EMPTY_BILLING = {
  defaultPaymentMethod: 'bank_transfer',
  billingName: '',
  company: '',
  taxId: '',
  billingAddress: '',
  defaultInvoiceInfo: '',
};

export default function BillingSettings() {
  const qc = useQueryClient();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => userService.getMyProfile().then((r) => r.data),
  });
  const profile = profileData?.data;

  const [billing, setBilling] = useState(EMPTY_BILLING);

  useEffect(() => {
    if (profile?.billing) {
      setBilling({ ...EMPTY_BILLING, ...profile.billing });
    }
  }, [profile]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => userService.updateProfile({ billing: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      toast.success('Billing settings saved!');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save billing settings'),
  });

  const setField = (key) => (e) => setBilling((prev) => ({ ...prev, [key]: e.target.value }));

  if (isLoading || !profile) {
    return (
      <div className="card p-6 animate-pulse space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <CreditCardIcon className="w-5 h-5 text-primary-500" /> Billing
        </h2>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <CreditCardIcon className="w-5 h-5 text-primary-500" /> Billing
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Manage your billing details used for invoices and payments.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Default payment method
          </label>
          <select
            className={inputCls}
            value={billing.defaultPaymentMethod}
            onChange={setField('defaultPaymentMethod')}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Billing name
          </label>
          <input
            type="text"
            className={inputCls}
            value={billing.billingName}
            onChange={setField('billingName')}
            placeholder="Your name as it appears on invoices"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Company <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            className={inputCls}
            value={billing.company}
            onChange={setField('company')}
            placeholder="Company or organization name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tax ID <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            className={inputCls}
            value={billing.taxId}
            onChange={setField('taxId')}
            placeholder="TIN / VAT number if applicable"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Billing address
          </label>
          <input
            type="text"
            className={inputCls}
            value={billing.billingAddress}
            onChange={setField('billingAddress')}
            placeholder="Street, city, region, country"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Default invoice information
          </label>
          <textarea
            className={`${inputCls} min-h-24 resize-y`}
            value={billing.defaultInvoiceInfo}
            onChange={setField('defaultInvoiceInfo')}
            placeholder="Notes shown by default on your invoices (e.g. payment terms, contact details)"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button loading={isPending} onClick={() => save(billing)}>Save Billing Settings</Button>
      </div>
    </div>
  );
}
