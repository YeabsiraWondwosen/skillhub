import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useEffect, useMemo, useState } from 'react';
import { useJob, useUpdateJob } from '@/hooks/useJobs';
import { useCategoryTree } from '@/hooks/useCategories';
import { getMinDateValue } from '@/utils/dateValidation';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { SkeletonText } from '@/components/ui/Skeleton';

export default function EditJobPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useJob(jobId);
  const { data: tree } = useCategoryTree();
  const parents = tree?.data ?? [];
  const { mutate: updateJob, isPending } = useUpdateJob();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const job = data?.data;

  const [selectedCatId, setSelectedCatId] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');
  const [initialized, setInitialized] = useState(false);

  const selectedMain = useMemo(() => parents.find(c => c._id === selectedCatId), [parents, selectedCatId]);
  const subs = selectedMain?.subcategories ?? [];

  useEffect(() => {
    if (job && parents.length && !initialized) {
      const jobCat = job.category?._id ?? job.category;
      const jobSub = Array.isArray(job.subcategories) ? job.subcategories[0] : job.subcategories;
      let mainId = jobCat ? String(jobCat) : '';
      let subId = jobSub ? String(jobSub) : '';
      if (jobSub) {
        const main = parents.find(p => p._id === mainId || p.subcategories?.some(s => s._id === subId));
        if (main) mainId = main._id;
      }
      setSelectedCatId(mainId);
      setSelectedSubId(subId);
      reset({
        title: job.title || '',
        description: job.description || '',
        category: mainId,
        experienceLevel: job.experienceLevel || 'intermediate',
        deadline: job.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : '',
        maxBudget: job.budget?.maxAmount ?? '',
        minBudget: job.budget?.minAmount ?? 0,
        budgetType: job.budget?.type ?? 'fixed',
        duration: job.duration || '',
        isUrgent: job.isUrgent || false,
        requiredSkills: Array.isArray(job.requiredSkills) ? job.requiredSkills.join(', ') : (job.requiredSkills || ''),
        subcategories: Array.isArray(job.subcategories) ? job.subcategories.join(', ') : (job.subcategories || ''),
      });
      setInitialized(true);
    }
  }, [job, parents, initialized, reset]);

  if (isLoading) return <div className="page-container"><SkeletonText lines={8} /></div>;

  const onSubmit = (data) => {
    const requiredSkills = data.requiredSkills
      ? String(data.requiredSkills)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const subcategories = selectedSubId ? [selectedSubId] : (data.subcategories
      ? String(data.subcategories).split(',').map(s => s.trim()).filter(Boolean)
      : []);

    const payload = {
      title: data.title,
      description: data.description,
      category: selectedSubId || selectedCatId || data.category,
      experienceLevel: data.experienceLevel,
      deadline: data.deadline,
      budget: { type: data.budgetType, maxAmount: Number(data.maxBudget), minAmount: Number(data.minBudget || 0) },
      duration: data.duration,
      isUrgent: data.isUrgent,
      requiredSkills,
      subcategories,
    };
    if (!payload.category) delete payload.category;

    updateJob({
      id: jobId,
      data: payload,
    }, { onSuccess: () => navigate('/client/jobs') });
  };

  return (
    <div className="page-container max-w-3xl">
      <h1 className="section-title mb-6">Edit Job</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="card p-6 space-y-4">
          <Input label="Job Title" error={errors.title?.message}
            {...register('title', { required: 'Required', minLength: { value: 10, message: 'Min 10 chars' } })} />
          <Textarea label="Description" rows={6} error={errors.description?.message}
            {...register('description', { required: 'Required' })} />
          <Input
            label="Required Skills (comma separated)"
            placeholder="e.g. React, Node.js, MongoDB"
            {...register('requiredSkills')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Main Category" value={selectedCatId} onChange={(e) => { setSelectedCatId(e.target.value); setSelectedSubId(''); }}>
              <option value="">Select main category</option>
              {parents.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </Select>
            <Select label="Subcategory" value={selectedSubId} onChange={(e) => setSelectedSubId(e.target.value)}>
              <option value="">Select subcategory</option>
              {subs.map(s => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Experience Level" {...register('experienceLevel')}>
              <option value="entry">Entry</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Budget Type" {...register('budgetType')}>
              <option value="fixed">Fixed</option>
              <option value="hourly">Hourly</option>
            </Select>
            <Input label="Min Budget (ETB)" type="number" {...register('minBudget')} />
            <Input label="Max Budget (ETB)" type="number" {...register('maxBudget')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Deadline"
              type="date"
              min={getMinDateValue()}
              {...register('deadline', {
                validate: (value) => {
                  if (!value) return true;
                  return new Date(value) >= new Date(getMinDateValue()) ? true : 'Deadline cannot be in the past';
                },
              })}
            />
            <Select label="Duration" {...register('duration')}>
              {['less_than_1_week','1_to_4_weeks','1_to_3_months','3_to_6_months','more_than_6_months'].map(d => (
                <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={() => navigate('/client/jobs')}>Cancel</Button>
          <Button type="submit" loading={isPending}>Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
