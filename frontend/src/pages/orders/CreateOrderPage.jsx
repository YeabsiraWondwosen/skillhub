import { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon, ClockIcon, CheckIcon, BanknotesIcon,
  PaperClipIcon, XMarkIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useCatalog } from '@/hooks/useCatalogs';
import { useCreateOrder } from '@/hooks/useOrders';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { SkeletonText } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/currency';
import { getMinDateValue, isDateOnlyInPast } from '@/utils/dateValidation';
import { clsx } from 'clsx';

const TIER_ORDER = ['basic', 'standard', 'premium'];

export default function CreateOrderPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { data: catalogData, isLoading } = useCatalog(slug);
  const catalog = catalogData?.data?.data;

  const { register, handleSubmit, formState: { errors } } = useForm();
  const { mutate: createOrder, isPending } = useCreateOrder();

  const [selectedTier, setSelectedTier] = useState(() => searchParams.get('tier') || null);
  const [attachments, setAttachments] = useState([]);

  if (isLoading) return <div className="page-container"><SkeletonText lines={12} /></div>;
  if (!catalog) return <div className="page-container text-center py-20"><h2>Service not found</h2></div>;

  const tiers = (catalog.pricingTiers || []).sort((a, b) => TIER_ORDER.indexOf(a.name) - TIER_ORDER.indexOf(b.name));
  const tier = tiers.find(t => t.name === selectedTier);
  const isOwnService = catalog.freelancer?._id === user?._id;

  const onSubmit = (values) => {
    if (!selectedTier) {
      toast.error('Please select a package');
      return;
    }
    const fd = new FormData();
    fd.append('serviceId', catalog._id);
    fd.append('tier', selectedTier);
    fd.append('title', values.title);
    if (values.description) fd.append('description', values.description);
    if (values.requirements) fd.append('requirements', values.requirements);
    if (values.expectedDelivery) fd.append('expectedDelivery', values.expectedDelivery);
    if (values.additionalNotes) fd.append('additionalNotes', values.additionalNotes);
    attachments.forEach(f => fd.append('files', f));
    createOrder(fd, {
      onSuccess: (res) => {
        const order = res.data?.data;
        navigate(`/services/orders/${order._id}`);
      },
    });
  };

  return (
    <div className="page-container max-w-4xl mx-auto space-y-6">
      <Link to={`/catalogs/${catalog.slug || slug}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeftIcon className="w-4 h-4" /> Back to service
      </Link>

      {isOwnService ? (
        <div className="card p-10 text-center">
          <h2 className="font-bold text-gray-900 dark:text-white mb-2">This is your own service</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">You cannot place an order on a service you publish yourself.</p>
          <Link to={`/catalogs/${catalog.slug || slug}`} className="btn-secondary btn-sm mt-4">View Service</Link>
        </div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="section-title mb-1">Place a Service Order</h1>
            <p className="section-sub mb-6">Choose a package, describe what you need, then fund escrow to get started.</p>
          </motion.div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Tier selector */}
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">1. Select a package</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {tiers.map(t => (
                  <button type="button" key={t.name} onClick={() => setSelectedTier(t.name)}
                    className={clsx(
                      'rounded-xl border-2 p-5 text-left transition-all hover:shadow-md',
                      selectedTier === t.name
                        ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-900/10 shadow-card'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}>
                    {t.name === 'standard' && (
                      <span className="text-[10px] bg-primary-500 text-white px-2 py-0.5 rounded-full font-semibold">Most Popular</span>
                    )}
                    <h3 className="font-bold text-gray-900 dark:text-white mt-2">{t.title || t.name}</h3>
                    <p className="text-xl font-black text-primary-600 mt-1">{formatCurrency(t.price, t.currency || 'ETB')}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{t.description}</p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-600 dark:text-gray-300">
                      <ClockIcon className="w-3.5 h-3.5" />
                      {t.deliveryTime} {t.deliveryUnit}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-300">
                      <ArrowPathIcon /> {t.revisions} revision{t.revisions !== 1 ? 's' : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Order details */}
            <div className="card p-6 space-y-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">2. Order details</h2>
              <Input
                label="Order title *"
                placeholder="e.g. Build a landing page for my coffee shop"
                error={errors.title?.message}
                {...register('title', {
                  required: 'Title is required',
                  minLength: { value: 3, message: 'Min 3 characters' },
                  maxLength: { value: 200, message: 'Max 200 characters' },
                })}
              />
              <Textarea
                label="Description"
                rows={4}
                placeholder="Describe what you need delivered in detail…"
                error={errors.description?.message}
                {...register('description')}
              />
              <Textarea
                label="Requirements"
                rows={4}
                placeholder="List any files, links, content or assets the freelancer will need…"
                error={errors.requirements?.message}
                {...register('requirements')}
              />
              <Input
                type="date"
                label="Expected delivery date (optional)"
                min={getMinDateValue()}
                error={errors.expectedDelivery?.message}
                {...register('expectedDelivery', {
                  validate: (v) => !v || isDateOnlyInPast(v).valid || isDateOnlyInPast(v).message,
                })}
              />
              <Textarea
                label="Additional notes"
                rows={3}
                placeholder="Anything else the freelancer should know?"
                error={errors.additionalNotes?.message}
                {...register('additionalNotes')}
              />

              {/* Attachments */}
              <div>
                <label className="label">Attachments (optional, up to 5)</label>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-dark-700 px-3 py-1.5 rounded-lg">
                      <PaperClipIcon className="w-3.5 h-3.5 text-gray-400" />
                      {f.name}
                      <button type="button" onClick={() => setAttachments(p => p.filter((_, j) => j !== i))}>
                        <XMarkIcon className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                      </button>
                    </span>
                  ))}
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-primary-600 dark:text-primary-400 cursor-pointer mt-2">
                  <PaperClipIcon className="w-4 h-4" />
                  Add file
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => setAttachments(p => [...p, ...Array.from(e.target.files ?? [])].slice(0, 5))}
                  />
                </label>
              </div>
            </div>

            {/* Summary */}
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">3. Summary</h2>
              {tier ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Service</span>
                    <span className="font-medium text-gray-900 dark:text-white">{catalog.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Package</span>
                    <span className="font-medium text-gray-900 dark:text-white">{tier.title || tier.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Price</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(tier.price, tier.currency || 'ETB')}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
                    <span className="font-medium text-gray-900 dark:text-white">Total to fund</span>
                    <span className="font-black text-primary-600">{formatCurrency(tier.price, tier.currency || 'ETB')}</span>
                  </div>
                  <p className="flex items-start gap-1.5 text-xs text-gray-400 pt-1">
                    <BanknotesIcon className="w-4 h-4 shrink-0 mt-0.5" />
                    Your payment is held in escrow and only released to the freelancer when you approve the delivery.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Select a package to see the order summary.</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={isPending} disabled={!selectedTier} size="lg">
                {isPending ? 'Placing order…' : `Continue — ${tier ? formatCurrency(tier.price, tier.currency || 'ETB') : 'Select package'}`}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

