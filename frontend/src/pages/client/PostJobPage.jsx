import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCreateJob } from '@/hooks/useJobs';
import { useCategoryTree } from '@/hooks/useCategories';
import { categoryService } from '@/services/category.service';
import CategoryIcon from '@/utils/categoryIcons';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { XMarkIcon, ChevronRightIcon, ArrowUpLeftIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { getMinDateValue } from '@/utils/dateValidation';

export default function PostJobPage() {
  const navigate = useNavigate();
  const { mutate: createJob, isPending } = useCreateJob();
  const { data: tree } = useCategoryTree();
  const parents = tree?.data ?? [];
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { budgetType: 'fixed', experienceLevel: 'intermediate' },
  });

  const [selectedCatId, setSelectedCatId] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [attachments, setAttachments] = useState([]);

  const selectedMain = parents.find(c => c._id === selectedCatId) ?? null;
  const subs = selectedMain?.subcategories ?? [];
  const selectedSub = subs.find(s => s._id === selectedSubId) ?? null;

  const { data: skillsData } = useQuery({
    queryKey: ['skills', selectedSubId],
    queryFn: () => categoryService.getSkillsByCategory(selectedSubId).then(r => r.data),
    enabled: !!selectedSubId,
    staleTime: 60_000,
  });
  const availableSkills = skillsData?.data ?? [];

  // Already-selected skills are filtered out so the picker cannot add duplicates.
  const filteredSkills = availableSkills.filter(
    s =>
      !skills.includes(s.name) &&
      (!skillInput.trim() || s.name.toLowerCase().includes(skillInput.toLowerCase()))
  );

  const addSkill = (name) => {
    if (!skills.includes(name)) setSkills(p => [...p, name]);
    setSkillInput('');
  };

  const onSubmit = (data) => {
    const fd = new FormData();
    fd.append('title', data.title);
    fd.append('description', data.description);
    const categoryId = selectedSubId || selectedCatId;
    fd.append('category', categoryId);
    fd.append('experienceLevel', data.experienceLevel);
    fd.append('deadline', data.deadline);
    fd.append('duration', data.duration);
    fd.append('budget[type]', data.budgetType);
    fd.append('budget[maxAmount]', data.maxBudget);
    if (data.minBudget) fd.append('budget[minAmount]', data.minBudget);
    skills.forEach((s, i) => fd.append(`requiredSkills[${i}]`, s));
    if (data.isUrgent) fd.append('isUrgent', 'true');
    attachments.forEach(f => fd.append('attachments', f));
    createJob(fd, { onSuccess: () => navigate('/client/jobs') });
  };

  return (
    <div className="page-container max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="section-title mb-1">Post a Job</h1>
        <p className="section-sub mb-6">Fill in the details to attract the right talent.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Job Details ────────────────────────────────── */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Job Details</h2>

            <Input
              label="Job Title"
              placeholder="e.g. Build a React E-Commerce Website"
              error={errors.title?.message}
              {...register('title', {
                required: 'Title is required',
                minLength: { value: 10, message: 'Min 10 chars' },
              })}
            />

            <Textarea
              label="Job Description"
              rows={7}
              placeholder="Describe the project scope, requirements, deliverables and what success looks like…"
              error={errors.description?.message}
              {...register('description', {
                required: 'Description is required',
                minLength: { value: 50, message: 'Min 50 chars' },
              })}
            />

            {/* ── Category picker ─────────────────────────── */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
                {!selectedCatId && (
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">(required)</span>
                )}
              </label>

              {/* Selected breadcrumb */}
              {selectedMain && (
                <div className="flex items-center gap-1.5 text-sm mb-3 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                    onClick={() => { setSelectedCatId(''); setSelectedSubId(''); setSkills([]); }}
                  >
                    <CategoryIcon icon={selectedMain.icon} size={16} />
                    <span>{selectedMain.name}</span>
                    <XMarkIcon className="w-3.5 h-3.5 opacity-60" />
                  </span>
                  {selectedSub && (
                    <>
                      <ChevronRightIcon className="w-3.5 h-3.5 text-gray-300" />
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                        onClick={() => { setSelectedSubId(''); setSkills([]); }}
                      >
                        {selectedSub.name}
                        <XMarkIcon className="w-3.5 h-3.5 opacity-60" />
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Two-column picker */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden flex">
                {/* Left — main categories */}
                <div className="w-1/2 border-r border-gray-100 dark:border-gray-700 max-h-56 overflow-y-auto bg-gray-50/50 dark:bg-dark-900/30">
                  <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Category
                  </p>
                  {parents.map(cat => (
                    <button
                      key={cat._id}
                      type="button"
                      onClick={() => {
                        setSelectedCatId(cat._id);
                        setSelectedSubId('');
                        setSkills([]);
                      }}
                      className={clsx(
                        'w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors',
                        selectedCatId === cat._id
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-dark-700'
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <CategoryIcon icon={cat.icon} size={16} className="w-5 text-center flex-shrink-0" />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      {cat.subcategories?.length > 0 && (
                        <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Right — subcategories */}
                <div className="w-1/2 max-h-56 overflow-y-auto">
                  {selectedMain ? (
                    <>
                      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Specialization
                      </p>
                      {/* "Any subcategory" option */}
                      <button
                        type="button"
                        onClick={() => { setSelectedSubId(''); setSkills([]); }}
                        className={clsx(
                          'w-full text-left px-3 py-2.5 text-sm transition-colors',
                          !selectedSubId
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700'
                        )}
                      >
                        All in {selectedMain.name}
                      </button>
                      {subs.map(sub => (
                        <button
                          key={sub._id}
                          type="button"
                          onClick={() => { setSelectedSubId(sub._id); setSkills([]); }}
                          className={clsx(
                            'w-full text-left px-3 py-2 text-sm transition-colors',
                            selectedSubId === sub._id
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'
                          )}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-8 px-4 text-center">
                      <ArrowUpLeftIcon className="w-6 h-6 text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Select a category first
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Skills (visible once subcategory chosen) ─── */}
            <AnimatePresence>
              {selectedSub && availableSkills.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Required Skills
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">
                        for {selectedSub.name}
                      </span>
                    </label>

                    {/* Selected skill chips */}
                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {skills.map(s => (
                          <span
                            key={s}
                            className="badge badge-primary flex items-center gap-1 text-xs"
                          >
                            {s}
                            <button
                              type="button"
                              onClick={() => setSkills(p => p.filter(x => x !== s))}
                              aria-label={`Remove ${s}`}
                              className="hover:text-red-500"
                            >
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Skill picker — search filters the visible list below */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                      <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                        <input
                          value={skillInput}
                          onChange={e => setSkillInput(e.target.value)}
                          placeholder="Search and add skills…"
                          className="input w-full text-sm"
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          Available Skills
                        </p>
                        {filteredSkills.length > 0 ? (
                          filteredSkills.map(s => (
                            <button
                              key={s._id}
                              type="button"
                              onClick={() => addSkill(s.name)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                            >
                              {s.name}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-400">No matching skills</div>
                        )}
                      </div>
                    </div>

                    {skills.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1">Add at least one skill</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Experience level */}
            <Select
              label="Experience Level"
              {...register('experienceLevel', { required: true })}
            >
              <option value="entry">Entry Level</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </Select>
          </div>

          {/* ── Budget & Timeline ──────────────────────────── */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Budget & Timeline</h2>
            <div className="grid grid-cols-3 gap-4">
              <Select label="Budget Type" {...register('budgetType')}>
                <option value="fixed">Fixed Price</option>
                <option value="hourly">Hourly Rate</option>
              </Select>
              <Input
                label="Min Budget (ETB)"
                type="number" min={0} placeholder="0"
                {...register('minBudget')}
              />
              <Input
                label="Max Budget (ETB)"
                type="number" min={1} placeholder="e.g. 2000"
                error={errors.maxBudget?.message}
                {...register('maxBudget', {
                  required: 'Max budget is required',
                  min: { value: 1, message: 'Min 1 ETB' },
                })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Deadline"
                type="date"
                min={getMinDateValue()}
                error={errors.deadline?.message}
                {...register('deadline', {
                  required: 'Deadline is required',
                  validate: (value) => {
                    if (!value) return 'Deadline is required';
                    return new Date(value) >= new Date(getMinDateValue()) ? true : 'Deadline cannot be in the past';
                  },
                })}
              />
              <Select label="Duration" {...register('duration')}>
                <option value="less_than_1_week">Less than 1 week</option>
                <option value="1_to_4_weeks">1 to 4 weeks</option>
                <option value="1_to_3_months">1 to 3 months</option>
                <option value="3_to_6_months">3 to 6 months</option>
                <option value="more_than_6_months">More than 6 months</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('isUrgent')}
                className="w-4 h-4 rounded text-primary-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Mark as Urgent</span>
            </label>
          </div>

          {/* ── Attachments ────────────────────────────────── */}
          <div className="card p-6 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Attachments{' '}
              <span className="text-xs text-gray-400 font-normal">(optional, max 5)</span>
            </h2>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.zip,.png,.jpg"
              onChange={e => setAttachments(Array.from(e.target.files ?? []).slice(0, 5))}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100 transition-colors"
            />
            {attachments.length > 0 && (
              <p className="text-xs text-gray-400">{attachments.length} file(s) selected</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => navigate('/client/jobs')}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending} disabled={!selectedCatId || skills.length === 0}>
              Post Job
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
