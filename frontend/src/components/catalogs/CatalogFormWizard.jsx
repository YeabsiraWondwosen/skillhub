import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useCategoryTree } from '@/hooks/useCategories';
import { useSkillsByCategory } from '@/hooks/useCategories';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { CheckIcon, PlusIcon, TrashIcon, ChevronRightIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { formatCurrency } from '@/utils/currency';
import { MIN_PACKAGE_PRICE, getPackagePriceErrors } from '@/utils/packagePricing';
import CategoryIcon from '@/utils/categoryIcons';

const EMPTY_TIER = (name) => ({
  name,
  title: '',
  description: '',
  price: 0,
  deliveryTime: 7,
  deliveryUnit: 'days',
  revisions: 1,
  features: [''],
});

const STEPS = [
  { id: 1, label: 'Category', title: 'Choose a Category' },
  { id: 2, label: 'Subcategory', title: 'Choose a Subcategory' },
  { id: 3, label: 'Service Info', title: 'Service Information' },
];

const toId = (ref) => (typeof ref === 'object' && ref !== null ? ref._id : ref || '');

export default function CatalogFormWizard({ initialData = null, submitLabel = 'Create Service', loading = false, onSubmit, onCancel }) {
  const isEdit = !!initialData;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => {
    const tiers = initialData?.pricingTiers?.length
      ? initialData.pricingTiers.map(({ _id, ...tier }) => ({
          ...tier,
          features: tier.features?.length ? tier.features : [''],
        }))
      : [EMPTY_TIER('basic'), EMPTY_TIER('standard'), EMPTY_TIER('premium')];
    return {
      title: initialData?.title || '',
      shortDescription: initialData?.shortDescription || '',
      description: initialData?.description || '',
      categoryId: toId(initialData?.category),
      subcategoryId: toId(initialData?.subcategory),
      skills: initialData?.skills || [],
      tags: initialData?.tags || [],
      pricingTiers: tiers,
    };
  });

  const [existingImages] = useState(initialData?.images || []);
  const [newImages, setNewImages] = useState([]);
  const [stepError, setStepError] = useState('');

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const { data: treeData } = useCategoryTree();
  const parents = treeData?.data ?? [];
  const selectedMain = parents.find((c) => c._id === form.categoryId) ?? null;
  const subs = selectedMain?.subcategories ?? [];

  const { data: skillsData, isLoading: skillsLoading } = useSkillsByCategory(form.subcategoryId);
  const taxonomySkills = skillsData?.data ?? [];

  const priceErrors = useMemo(() => getPackagePriceErrors(form.pricingTiers), [form.pricingTiers]);

  const step1Valid = !!form.categoryId;
  const step2Valid = !!form.subcategoryId;
  const step3Valid =
    form.title.trim().length >= 3 &&
    form.shortDescription.trim().length >= 5 &&
    form.description.trim().length >= 10 &&
    Object.keys(priceErrors).length === 0 &&
    form.pricingTiers.every((t) => t.title.trim() && t.description.trim() && t.deliveryTime >= 1);

  const stepValid = [step1Valid, step2Valid, step3Valid][step - 1];

  const next = () => {
    if (!stepValid) {
      setStepError(
        ['Please select a category to continue.', 'Please select a subcategory to continue.', 'Please fill in the required service details and pricing packages.'][
          step - 1
        ]
      );
      return;
    }
    setStepError('');
    setStep((s) => Math.min(s + 1, 3));
  };

  const back = () => {
    setStepError('');
    setStep((s) => Math.max(s - 1, 1));
  };

  const selectCategory = (id) => {
    update('categoryId', id);
    update('subcategoryId', '');
    update('skills', []);
  };

  const toggleSkill = (name) => {
    const has = form.skills.includes(name);
    update('skills', has ? form.skills.filter((s) => s !== name) : [...form.skills, name]);
  };

  const addTag = () => update('tags', [...form.tags, '']);
  const updateTag = (i, val) => update('tags', form.tags.map((t, idx) => (idx === i ? val : t)));
  const removeTag = (i) => update('tags', form.tags.filter((_, idx) => idx !== i));

  const updateTier = (i, field, value) =>
    update('pricingTiers', form.pricingTiers.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));

  const addFeature = (i) => update('pricingTiers', form.pricingTiers.map((t, idx) => (idx === i ? { ...t, features: [...t.features, ''] } : t)));
  const updateFeature = (tierIdx, featIdx, val) =>
    update(
      'pricingTiers',
      form.pricingTiers.map((t, i) => (i === tierIdx ? { ...t, features: t.features.map((f, fi) => (fi === featIdx ? val : f)) } : t))
    );
  const removeFeature = (tierIdx, featIdx) =>
    update('pricingTiers', form.pricingTiers.map((t, i) => (i === tierIdx ? { ...t, features: t.features.filter((_, fi) => fi !== featIdx) } : t)));

  const startPrice = useMemo(() => Math.min(...form.pricingTiers.map((t) => t.price || 0)), [form.pricingTiers]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!step3Valid) {
      setStepError('Please complete the required service details and pricing packages.');
      return;
    }
    const formData = new FormData();
    formData.append('title', form.title.trim());
    formData.append('shortDescription', form.shortDescription.trim());
    formData.append('description', form.description.trim());
    formData.append('category', form.categoryId);
    if (form.subcategoryId) formData.append('subcategory', form.subcategoryId);
    form.skills.forEach((skill) => formData.append('skills', skill));
    form.tags.filter(Boolean).forEach((tag) => formData.append('tags', tag.trim()));
    formData.append(
      'pricingTiers',
      JSON.stringify(
        form.pricingTiers.map((t) => ({
          name: t.name,
          title: t.title.trim(),
          description: t.description.trim(),
          price: Number(t.price),
          deliveryTime: Number(t.deliveryTime),
          deliveryUnit: t.deliveryUnit || 'days',
          revisions: Number(t.revisions) || 0,
          features: t.features.map((f) => f.trim()).filter(Boolean),
        }))
      )
    );
    newImages.forEach((img) => formData.append('images', img));
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Progress stepper */}
      <div className="flex items-center gap-2 sm:gap-4">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 sm:gap-4 flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => (s.id < step ? setStep(s.id) : next())}
              className={`flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 text-sm font-semibold transition-all ${
                step === s.id
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                  : s.id < step
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 dark:bg-dark-700 dark:text-gray-500'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${step === s.id ? 'bg-white/20' : s.id < step ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-dark-600'}`}>
                {s.id < step ? <CheckIcon className="h-3 w-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={`h-px flex-1 ${step > s.id ? 'bg-primary-500' : 'bg-gray-200 dark:bg-dark-600'}`} />}
          </div>
        ))}
      </div>

      {/* ─── Step 1: Choose Category ────────────────────────────────────── */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-1">{STEPS[0].title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Choose the main category that best describes your service.</p>

          {parents.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading categories…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {parents.map((cat) => {
                const selected = form.categoryId === cat._id;
                return (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => selectCategory(cat._id)}
                    className={clsx(
                      'relative text-left p-4 rounded-2xl border transition-all group',
                      selected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:shadow-md'
                    )}
                  >
                    {selected && (
                      <span className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary-500 text-white flex items-center justify-center">
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <CategoryIcon icon={cat.icon} size={28} />
                    <h3 className="mt-3 font-semibold text-gray-900 dark:text-white text-sm">{cat.name}</h3>
                    {cat.description && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{cat.description}</p>
                    )}
                    <p className="mt-3 text-xs font-medium text-primary-600 dark:text-primary-400 flex items-center gap-1">
                      {cat.subcategories?.length || 0} specializations
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── Step 2: Choose Subcategory ─────────────────────────────────── */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-900 dark:text-white">{STEPS[1].title}</h2>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              Change category
            </button>
          </div>
          {selectedMain && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-2">
              <CategoryIcon icon={selectedMain.icon} size={22} className="flex-shrink-0" />
              {selectedMain.name}
              <ChevronRightIcon className="w-4 h-4 text-gray-300" />
              <span className="font-medium text-gray-700 dark:text-gray-200">Choose a specialization</span>
            </p>
          )}

          {subs.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No subcategories available for this category yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {subs.map((sub) => {
                const selected = form.subcategoryId === sub._id;
                return (
                  <button
                    key={sub._id}
                    type="button"
                    onClick={() => update('subcategoryId', sub._id)}
                    className={clsx(
                      'text-left px-4 py-3.5 rounded-2xl border transition-all',
                      selected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">{sub.name}</span>
                      {selected && (
                        <span className="h-5 w-5 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0">
                          <CheckIcon className="h-3 w-3" />
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── Step 3: Service Information ────────────────────────────────── */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Selected category summary */}
          {selectedMain && (
            <div className="card p-4 bg-gradient-to-br from-primary-500/5 to-secondary-500/5 dark:from-primary-500/10 dark:to-secondary-500/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 min-w-0">
                <CategoryIcon icon={selectedMain.icon} size={22} className="flex-shrink-0" />
                <span className="truncate">{selectedMain.name}</span>
                <ChevronRightIcon className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <span className="font-semibold text-gray-900 dark:text-white truncate">
                  {subs.find((s) => s._id === form.subcategoryId)?.name || '—'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0"
              >
                Change
              </button>
            </div>
          )}

          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">{STEPS[2].title}</h2>
            <Input
              label="Service Title"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g., I will build a modern React website"
              required
            />
            <Input
              label="Short Description"
              value={form.shortDescription}
              onChange={(e) => update('shortDescription', e.target.value)}
              placeholder="Brief summary (shown in listings)"
              maxLength={200}
              required
            />
            <div>
              <label className="label">Full Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                className="input min-h-[180px]"
                placeholder="Describe your service in detail..."
                required
              />
            </div>
            <div>
              <label className="label">Images (up to 5)</label>
              {existingImages.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-3">
                  {existingImages.map((img) => (
                    <div key={img.publicId || img.url} className="relative">
                      <img src={img.url} alt="" className="h-20 w-20 object-cover rounded-xl border border-gray-200 dark:border-gray-700" />
                      <span className="absolute -top-1.5 -right-1.5 text-[10px] font-semibold bg-gray-900 text-white px-1.5 py-0.5 rounded-full">current</span>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setNewImages(Array.from(e.target.files).slice(0, 5 - existingImages.length))}
                className="input"
              />
              {newImages.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">{newImages.length} new image{newImages.length > 1 ? 's' : ''} selected</p>
              )}
            </div>
          </div>

          <div className="card p-6 space-y-6">
            <div>
              <label className="label flex items-center gap-1.5">
                <SparklesIcon className="w-4 h-4 text-primary-500" /> Skills
              </label>
              {form.subcategoryId ? (
                skillsLoading ? (
                  <p className="text-sm text-gray-400">Loading skills…</p>
                ) : taxonomySkills.length === 0 ? (
                  <p className="text-sm text-gray-400">No skills available for this subcategory yet.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {taxonomySkills.map((skill) => {
                        const selected = form.skills.includes(skill.name);
                        return (
                          <button
                            key={skill._id}
                            type="button"
                            onClick={() => toggleSkill(skill.name)}
                            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                              selected
                                ? 'bg-primary-500 border-primary-500 text-white shadow-sm'
                                : 'bg-white dark:bg-dark-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300'
                            }`}
                          >
                            {selected && <CheckIcon className="w-3 h-3 inline -mt-0.5 mr-1" />}
                            {skill.name}
                          </button>
                        );
                      })}
                    </div>
                    {form.skills.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{form.skills.length} skill{form.skills.length > 1 ? 's' : ''} selected</p>
                    )}
                  </>
                )
              ) : (
                <p className="text-sm text-gray-400">Select a subcategory to see its skills.</p>
              )}
            </div>

            <div>
              <label className="label">Tags</label>
              <div className="space-y-2">
                {form.tags.map((tag, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={tag}
                      onChange={(e) => updateTag(i, e.target.value)}
                      placeholder="e.g., responsive, modern"
                      className="input flex-1"
                    />
                    {form.tags.length > 1 && (
                      <button type="button" onClick={() => removeTag(i)} className="btn-icon btn-ghost text-red-500">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addTag} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                  <PlusIcon className="w-4 h-4" /> Add Tag
                </button>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Pricing Packages</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Define basic, standard and premium packages for your service.</p>

            {form.pricingTiers.map((tier, i) => (
              <div key={tier.name} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 space-y-3">
                <h3 className="font-medium text-gray-900 dark:text-white capitalize flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${i === 1 ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400'}`}>{tier.name}</span>
                  {i === 1 && <span className="text-xs text-primary-500 font-semibold">Most Popular</span>}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Package Title"
                    value={tier.title}
                    onChange={(e) => updateTier(i, 'title', e.target.value)}
                    placeholder={`e.g., ${tier.name} package`}
                    required
                  />
                  <Input
                    label="Price (ETB)"
                    type="number"
                    value={tier.price}
                    onChange={(e) => updateTier(i, 'price', parseFloat(e.target.value) || 0)}
                    min={MIN_PACKAGE_PRICE}
                    error={priceErrors[tier.name]}
                    required
                  />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    value={tier.description}
                    onChange={(e) => updateTier(i, 'description', e.target.value)}
                    className="input min-h-[60px]"
                    placeholder="What's included"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="Delivery Time"
                    type="number"
                    value={tier.deliveryTime}
                    onChange={(e) => updateTier(i, 'deliveryTime', parseInt(e.target.value) || 1)}
                    min={1}
                    required
                  />
                  <div>
                    <label className="label">Delivery Unit</label>
                    <select
                      value={tier.deliveryUnit}
                      onChange={(e) => updateTier(i, 'deliveryUnit', e.target.value)}
                      className="input"
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                    </select>
                  </div>
                  <Input
                    label="Revisions"
                    type="number"
                    value={tier.revisions}
                    onChange={(e) => updateTier(i, 'revisions', parseInt(e.target.value) || 0)}
                    min={0}
                  />
                </div>
                <div>
                  <label className="label">Features</label>
                  <div className="space-y-2">
                    {tier.features.map((feature, fi) => (
                      <div key={fi} className="flex gap-2">
                        <input
                          value={feature}
                          onChange={(e) => updateFeature(i, fi, e.target.value)}
                          placeholder="Feature included"
                          className="input flex-1"
                        />
                        {tier.features.length > 1 && (
                          <button type="button" onClick={() => removeFeature(i, fi)} className="btn-icon btn-ghost text-red-500">
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => addFeature(i)} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                      <PlusIcon className="w-3 h-3" /> Add Feature
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Review summary */}
          <div className="card p-6 bg-gradient-to-br from-primary-500/5 to-secondary-500/5 dark:from-primary-500/10 dark:to-secondary-500/10">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Review</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Category</p>
                <p className="font-medium text-gray-900 dark:text-white line-clamp-1">
                  {selectedMain ? <span className="inline-flex items-center gap-1.5"><CategoryIcon icon={selectedMain.icon} size={14} /> {selectedMain.name}</span> : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Skills</p>
                <p className="font-medium text-gray-900 dark:text-white line-clamp-1">{form.skills.length ? `${form.skills.length} selected` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Starting at</p>
                <p className="font-black text-primary-600">{startPrice > 0 ? formatCurrency(startPrice) : '—'}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {stepError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-sm px-4 py-3">
          {stepError}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => (step === 1 ? onCancel?.() : back())} className="btn-secondary">
          {step === 1 ? 'Cancel' : 'Back'}
        </button>
        {step < 3 ? (
          <Button type="button" onClick={next}>Continue</Button>
        ) : (
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>Edit Category</Button>
            <Button type="submit" loading={loading}>{submitLabel}</Button>
          </div>
        )}
      </div>
    </form>
  );
}
