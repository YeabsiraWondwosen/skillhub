import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { adminService } from '@/services/admin.service';
import { useCategoryTree } from '@/hooks/useCategories';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  buildPlatformFormValues,
  buildCommissionPayload,
} from '@/utils/platformSettings';
import {
  CheckCircleIcon, XCircleIcon, GlobeAltIcon, CreditCardIcon,
  CloudIcon, SparklesIcon, PhotoIcon, CurrencyDollarIcon, IdentificationIcon,
} from '@heroicons/react/24/outline';

const PLATFORM_QUERY_KEY = ['admin', 'settings', 'platform'];
const FINANCE_COMMISSION_KEY = ['admin-finance-commission-settings'];

const providerLabel = (provider) =>
  provider === 'cbe_birr'
    ? 'CBE Birr'
    : provider.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const STATUS_STYLES = {
  configured: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  demo: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  missing: 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-gray-400',
};

function StatusPill({ status }) {
  const key = status || 'missing';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[key] || STATUS_STYLES.missing}`}>
      {key}
    </span>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-gray-100 dark:border-gray-700 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            active === t.id
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-dark-700'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function GeneralTab({ settings, categories }) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [saveState, setSaveState] = useState(null);
  const {
    register, handleSubmit, reset,
    formState: { errors, isDirty },
  } = useForm();

  const derived = useMemo(() => buildPlatformFormValues(settings), [settings]);

  // Only re-sync the form from server data when the admin has no unsaved edits,
  // so a background refetch can never silently revert in-progress changes.
  useEffect(() => {
    if (!isDirty) reset(derived);
  }, [derived, isDirty, reset]);

  useEffect(() => {
    const handler = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => adminService.updatePlatformSettings(data),
    onSuccess: (res) => {
      // Reflect the server-confirmed document immediately (no stale cache).
      queryClient.setQueryData(PLATFORM_QUERY_KEY, res.data);
      setSaveState('success');
      toast.success('Platform settings saved');
    },
    onError: (e) => {
      setSaveState('error');
      toast.error(e.response?.data?.message || 'Failed to save platform settings');
    },
  });

  const { mutate: uploadLogo, isPending: uploading } = useMutation({
    mutationFn: (formData) => adminService.uploadPlatformLogo(formData),
    onSuccess: (res) => {
      queryClient.setQueryData(PLATFORM_QUERY_KEY, res.data);
      toast.success('Logo updated');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to upload logo'),
  });

  const onSubmit = handleSubmit((values) => {
    setSaveState('saving');
    save({
      name: values.name,
      tagline: values.tagline,
      description: values.description,
      focus: values.focus || null,
      currency: values.currency,
      language: values.language,
      timeZone: values.timeZone,
    });
  });

  const logoUrl = settings?.logo?.url;

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-5">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <GlobeAltIcon className="w-5 h-5 text-primary-600" />
          Branding
        </h2>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-dark-700 shrink-0">
            {logoUrl
              ? <img src={logoUrl} alt="Platform logo" className="w-full h-full object-contain" />
              : <PhotoIcon className="w-7 h-7 text-gray-400" />}
          </div>
          <div className="space-y-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('logo', file);
                uploadLogo(formData);
                e.target.value = '';
              }}
            />
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} loading={uploading}>
              Upload logo
            </Button>
            <p className="text-xs text-gray-400">PNG, JPG, WEBP, GIF or SVG · max 5MB</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Platform Name"
            maxLength={100}
            placeholder="SkillHub"
            error={errors.name?.message}
            hint="Display name shown across the platform"
            {...register('name', {
              required: 'Platform name is required',
              validate: (v) => (v && v.trim() ? true : 'Platform name cannot be empty'),
            })}
          />
          <Input
            label="Tagline"
            maxLength={160}
            placeholder="Hire skilled freelancers in minutes"
            error={errors.tagline?.message}
            {...register('tagline', { maxLength: { value: 160, message: 'Max 160 characters' } })}
          />
          <Textarea
            label="Description"
            rows={3}
            maxLength={1000}
            placeholder="A short description of the platform"
            error={errors.description?.message}
            {...register('description', { maxLength: { value: 1000, message: 'Max 1000 characters' } })}
          />
          <Select label="Platform Focus" error={errors.focus?.message} {...register('focus')}>
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Currency" maxLength={8} placeholder="ETB" {...register('currency')} />
            <Input label="Language" maxLength={12} placeholder="en" {...register('language')} />
            <Input label="Time zone" maxLength={64} placeholder="Africa/Addis_Ababa" {...register('timeZone')} />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" loading={isPending}>Save Changes</Button>
            {isDirty && <span className="text-sm text-amber-600 dark:text-amber-400">Unsaved changes</span>}
            {!isDirty && saveState === 'success' && (
              <span className="text-sm text-emerald-600 flex items-center gap-1">
                <CheckCircleIcon className="w-4 h-4" />
                Saved
              </span>
            )}
            {saveState === 'error' && (
              <span className="text-sm text-red-600 flex items-center gap-1">
                <XCircleIcon className="w-4 h-4" />
                Failed to save
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function CommissionTab({ settings }) {
  const queryClient = useQueryClient();
  const {
    register, handleSubmit, reset,
    formState: { errors, isDirty },
  } = useForm({ defaultValues: { commissionRate: 10 } });

  useEffect(() => {
    if (settings && !isDirty) {
      reset({ commissionRate: settings.commissionPercent ?? 10 });
    }
  }, [settings, isDirty, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (percent) => adminService.updateCommission(buildCommissionPayload(percent)),
    onSuccess: (res, percent) => {
      toast.success('Commission rate updated');
      reset({ commissionRate: res.data?.data?.settings?.commissionPercent ?? percent });
      queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: FINANCE_COMMISSION_KEY });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update commission rate'),
  });

  const onSubmit = handleSubmit(({ commissionRate }) => mutate(commissionRate));

  return (
    <div className="card p-6 space-y-5">
      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <CurrencyDollarIcon className="w-5 h-5 text-primary-600" />
        Commission Settings
      </h2>
      <p className="text-sm text-gray-400">
        The rate is snapshotted on each escrow when a client funds a project, so changing it here never
        alters transactions that have already been funded.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Platform Commission Rate (%)"
          type="number"
          step="0.1"
          min={0}
          max={100}
          hint="Percentage taken from each successful payment (0 – 100, e.g. 10 = 10%)"
          error={errors.commissionRate?.message}
          {...register('commissionRate', {
            required: 'Required',
            min: { value: 0, message: 'Min 0%' },
            max: { value: 100, message: 'Max 100%' },
          })}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" loading={isPending} disabled={!isDirty}>Save Commission Rate</Button>
          {isDirty && <span className="text-sm text-amber-600 dark:text-amber-400">Unsaved changes</span>}
        </div>
      </form>
    </div>
  );
}

function InfrastructureTab({ info }) {
  if (!info) return <SkeletonCard />;

  return (
    <div className="card p-6 space-y-5">
      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <CreditCardIcon className="w-5 h-5 text-primary-600" />
        Infrastructure Status
      </h2>
      <p className="text-sm text-gray-400">
        Read-only view of the backend configuration. Only configuration state is shown — secret values
        are never exposed.
      </p>

      <div className="text-sm">
        <div className="flex items-center gap-2 text-gray-400 mb-2">
          <CreditCardIcon className="w-4 h-4" />
          Payment Providers
          <span className="ml-auto text-xs">
            Mode: <span className="capitalize font-medium text-gray-600 dark:text-gray-300">{info.paymentMode}</span>
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {info.paymentProviders?.map((p) => (
            <div key={p.provider} className="flex items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2">
              <span className="font-medium text-gray-900 dark:text-white">{providerLabel(p.provider)}</span>
              <span className="ml-auto"><StatusPill status={p.status} /></span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2.5 text-sm">
        <div className="flex items-center gap-2">
          <CloudIcon className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white">Storage</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400 capitalize">{info.storage?.provider || 'cloudinary'}</span>
          <StatusPill status={info.storage?.status || (info.storage?.configured ? 'configured' : 'missing')} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2.5 text-sm">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white">AI Provider</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400 capitalize">{info.ai?.provider}</span>
          {info.ai?.model && <span className="text-gray-500 dark:text-gray-400">· {info.ai.model}</span>}
          <StatusPill status={info.ai?.status || (info.ai?.configured ? 'configured' : 'missing')} />
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-400">
        <IdentificationIcon className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          "Demo" means payments are simulated and no real money moves. "Missing" means the provider has no
          credentials configured on the server.
        </p>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const { data, isLoading } = useQuery({
    queryKey: PLATFORM_QUERY_KEY,
    queryFn: () => adminService.getPlatformSettings().then((r) => r.data),
  });
  const payload = data?.data;
  const settings = payload?.settings;
  const info = payload?.info;

  const { data: treeData } = useCategoryTree();
  const categories = treeData?.data ?? [];

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'commission', label: 'Commission' },
    { id: 'infrastructure', label: 'Infrastructure' },
  ];

  return (
    <div className="page-container max-w-3xl space-y-6">
      <div>
        <h1 className="section-title">Platform Settings</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage branding, commission and review infrastructure configuration.
        </p>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        <>
          {activeTab === 'general' && <GeneralTab settings={settings} categories={categories} />}
          {activeTab === 'commission' && <CommissionTab settings={settings} />}
          {activeTab === 'infrastructure' && <InfrastructureTab info={info} />}
        </>
      )}
    </div>
  );
}
