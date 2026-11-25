import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { userService } from '@/services/user.service';
import { profileService } from '@/services/profile.service';
import { useAuthStore } from '@/store/authStore';
import { useCategoryTree } from '@/hooks/useCategories';
import CategoryIcon from '@/utils/categoryIcons';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/Modal';
import GitHubProfile from '@/components/github/GitHubProfile';
import AvatarSection from '@/components/accountSettings/AvatarSection';
import ProfileInfoSection from '@/components/accountSettings/ProfileInfoSection';
import ChangePasswordForm from '@/components/accountSettings/ChangePasswordForm';
import DangerZone from '@/components/accountSettings/DangerZone';
import { useLinkGitHub, useUnlinkGitHub, useRefreshGitHub } from '@/hooks/useGitHub';
import {
  CameraIcon, PlusIcon, TrashIcon, ArrowPathIcon, CheckCircleIcon,
  PencilIcon, XMarkIcon, EyeIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { ArrowRight } from 'lucide-react';

// Navigation is grouped into two compact, aligned rows so every section is
// reachable without an overlong single strip. Each row scrolls horizontally on
// small screens rather than overflowing.
const TAB_ROWS = [
  ['Overview', 'Skills', 'Experience', 'Education', 'Portfolio'],
  ['Certifications', 'GitHub', 'Languages', 'Social Links', 'Preferences', 'Account'],
];

const toDateInput = (d) => (d ? new Date(d).toISOString().substring(0, 10) : '');
const toArray = (str) => (typeof str === 'string' ? str.split(',').map(s => s.trim()).filter(Boolean) : str || []);
const fromArray = (arr) => (Array.isArray(arr) ? arr.join(', ') : arr || '');

// A stored URL must be an absolute http(s) URL. Empty is allowed (field cleared).
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const urlRule = {
  validate: (v) => !v || URL_PATTERN.test(v) || 'Enter a valid URL starting with http:// or https://',
};

const categoriesOf = (profile) => [
  ...(profile?.categories || []).map(c => (typeof c === 'object' ? c._id : c)),
  ...(profile?.subcategories || []).map(c => (typeof c === 'object' ? c._id : c)),
];

// Reusable bordered section wrapper used across the tab panels.
function Section({ title, description, actions, children, className }) {
  return (
    <div className={clsx('card p-5', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>}
            {description && <p className="text-sm text-gray-400 mt-0.5">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export default function FreelancerProfileEdit() {
  const { user, updateUser } = useAuthStore();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('Overview');
  const { data: treeData } = useCategoryTree();
  const parents = treeData?.data ?? [];
  const allCategories = parents.flatMap(p => [p, ...(p.subcategories || [])]);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => userService.getMyProfile().then(r => r.data),
  });

  const profile = profileData?.data;
  const completionScore = profile?.completionScore ?? 0;

  const { mutate: updateProfile, isPending: isSaving } = useMutation({
    mutationFn: (data) => userService.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      qc.invalidateQueries({ queryKey: ['freelancer', user?._id] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update profile'),
  });

  const { mutate: uploadAvatar, isPending: isUploadingAvatar } = useMutation({
    mutationFn: (file) => { const fd = new FormData(); fd.append('avatar', file); return userService.uploadAvatar(fd); },
    onSuccess: (res) => {
      updateUser({ avatar: res.data?.data?.avatar });
      toast.success('Avatar updated!');
      qc.invalidateQueries({ queryKey: ['freelancer', user?._id] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to upload avatar'),
  });

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="card p-10 text-center text-sm text-gray-400 animate-pulse">Loading profile…</div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-5">
      {/* Header — compact identity block with a real, server-computed completion score */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative self-start">
            <Avatar src={user?.avatar?.url} alt={`${user?.firstName || ''} ${user?.lastName || ''}`} size="xl" />
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center cursor-pointer hover:bg-primary-700 transition-colors">
              <CameraIcon className="w-4 h-4 text-white" />
              <input type="file" accept="image/*" className="sr-only"
                onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} disabled={isUploadingAvatar} />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {user?.firstName} {user?.lastName}
                </h1>
                <p className="text-sm text-gray-400 truncate">
                  {profile?.tagline || 'Add a tagline to attract clients'}
                </p>
              </div>
              <Link
                to={`/freelancers/${user?._id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary btn-sm flex-shrink-0"
              >
                <EyeIcon className="w-4 h-4" /> Preview public profile
              </Link>
            </div>
            <div className="mt-3 max-w-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Profile Completion</span>
                <span className="text-xs font-semibold text-primary-600">{completionScore}%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${completionScore}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-row, aligned section navigation */}
      <nav className="card p-3 space-y-2">
        {TAB_ROWS.map((row, i) => (
          <div key={i} className="flex gap-2 overflow-x-auto no-scrollbar">
            {row.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={clsx('filter-pill flex-shrink-0', activeTab === t && 'filter-pill-active')}
              >
                {t}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Overview */}
      {activeTab === 'Overview' && (
        <OverviewTab
          profile={profile}
          parents={parents}
          allCategories={allCategories}
          updateProfile={updateProfile}
          isSaving={isSaving}
        />
      )}

      {/* Skills */}
      {activeTab === 'Skills' && (
        <SkillsTab profile={profile} updateProfile={updateProfile} userId={user?._id} qc={qc} />
      )}

      {/* Experience */}
      {activeTab === 'Experience' && <ExperienceTab profile={profile} userId={user?._id} qc={qc} />}

      {/* Education */}
      {activeTab === 'Education' && <EducationTab profile={profile} userId={user?._id} qc={qc} />}

      {/* Portfolio */}
      {activeTab === 'Portfolio' && <PortfolioTab profile={profile} userId={user?._id} qc={qc} />}

      {/* Certifications + Resume */}
      {activeTab === 'Certifications' && <CertificationsTab profile={profile} userId={user?._id} qc={qc} />}

      {/* GitHub */}
      {activeTab === 'GitHub' && <GitHubTab userId={user?._id} />}

      {/* Languages */}
      {activeTab === 'Languages' && (
        <LanguagesTab profile={profile} updateProfile={updateProfile} />
      )}

      {/* Social Links */}
      {activeTab === 'Social Links' && <SocialLinksTab />}

      {/* Preferences */}
      {activeTab === 'Preferences' && (
        <PreferencesTab profile={profile} updateProfile={updateProfile} isSaving={isSaving} />
      )}

      {/* Account */}
      {activeTab === 'Account' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <AvatarSection />
          <ProfileInfoSection />
          <ChangePasswordForm />
          <DangerZone />
        </motion.div>
      )}
    </div>
  );
}

/* ─────────────────────────────── Overview ─────────────────────────────── */
function OverviewTab({ profile, parents, allCategories, updateProfile, isSaving }) {
  const [selectedCategories, setSelectedCategories] = useState(categoriesOf(profile));

  useEffect(() => { setSelectedCategories(categoriesOf(profile)); }, [profile?.categories, profile?.subcategories]);

  const summaryForm = useForm({ values: {
    tagline: profile?.tagline || '',
    bio: profile?.bio || '',
  } });

  const workForm = useForm({ values: {
    hourlyRate: profile?.hourlyRate ?? '',
    availability: profile?.availability || 'available',
    availabilityHoursPerWeek: profile?.availabilityHoursPerWeek ?? 40,
  } });

  const locationForm = useForm({ values: {
    'location.country': profile?.location?.country || '',
    'location.city': profile?.location?.city || '',
    'location.timezone': profile?.location?.timezone || 'UTC',
  } });

  const toggleCategory = (catId) => {
    setSelectedCategories(prev => {
      if (prev.includes(catId)) return prev.filter(id => id !== catId);
      if (prev.length >= 5) { toast.error('Maximum 5 categories'); return prev; }
      return [...prev, catId];
    });
  };

  const saveSummary = (d) => updateProfile(
    { tagline: d.tagline, bio: d.bio },
    { onSuccess: () => toast.success('Summary saved!') },
  );

  const saveWork = (d) => {
    // An empty rate is sent as null (backend accepts null and it clears the
    // value); a filled rate is coerced to a number.
    const payload = {
      hourlyRate: d.hourlyRate === '' || d.hourlyRate == null ? null : Number(d.hourlyRate),
      availability: d.availability,
      availabilityHoursPerWeek: d.availabilityHoursPerWeek === '' ? 0 : Number(d.availabilityHoursPerWeek),
      categories: selectedCategories,
    };
    return updateProfile(payload, { onSuccess: () => toast.success('Work details saved!') });
  };

  const saveLocation = (d) => updateProfile(
    { location: { country: d['location.country'], city: d['location.city'], timezone: d['location.timezone'] } },
    { onSuccess: () => toast.success('Location saved!') },
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <Section title="Professional Summary" description="A short pitch and a detailed introduction.">
        <form onSubmit={summaryForm.handleSubmit(saveSummary)} className="space-y-4">
          <Input
            label="Tagline"
            placeholder="e.g. Full-Stack React & Node.js Developer"
            error={summaryForm.formState.errors.tagline?.message}
            {...summaryForm.register('tagline', { maxLength: { value: 150, message: 'Tagline cannot exceed 150 characters' } })}
          />
          <Textarea
            label="Bio"
            rows={5}
            placeholder="Tell clients about your background, expertise and work style…"
            error={summaryForm.formState.errors.bio?.message}
            {...summaryForm.register('bio', { maxLength: { value: 2000, message: 'Bio cannot exceed 2000 characters' } })}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => summaryForm.reset()}>Cancel</Button>
            <Button type="submit" loading={isSaving}>Save</Button>
          </div>
        </form>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Work Details" description="Rate, availability and the categories you work in.">
          <form onSubmit={workForm.handleSubmit(saveWork)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Hourly Rate (ETB)"
                type="number" min={0} max={10000}
                error={workForm.formState.errors.hourlyRate?.message}
                {...workForm.register('hourlyRate', { min: { value: 0, message: 'Rate cannot be negative' }, max: { value: 10000, message: 'Rate is too high' } })}
              />
              <Select label="Availability" {...workForm.register('availability')}>
                <option value="available">Available</option>
                <option value="partially_available">Partially Available</option>
                <option value="not_available">Not Available</option>
              </Select>
            </div>
            <Input
              label="Hours Per Week"
              type="number" min={0} max={168}
              error={workForm.formState.errors.availabilityHoursPerWeek?.message}
              {...workForm.register('availabilityHoursPerWeek', { min: { value: 0, message: 'Cannot be negative' }, max: { value: 168, message: 'Max 168 hours' } })}
            />

            <div>
              <label className="label">Categories (up to 5)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedCategories.map(catId => {
                  const cat = allCategories.find(c => c._id === catId);
                  return cat ? (
                    <span key={catId} className="badge badge-primary flex items-center gap-1.5">
                      <CategoryIcon icon={cat.icon} size={14} className="inline-flex" /> {cat.name}
                      <button type="button" onClick={() => toggleCategory(catId)} className="hover:text-red-500 transition-colors">
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
                {selectedCategories.length === 0 && <span className="text-sm text-gray-400">No categories selected yet.</span>}
              </div>
              {selectedCategories.length < 5 && (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {parents.map(main => {
                    const subs = main.subcategories || [];
                    if (subs.length === 0) {
                      return (
                        <button
                          key={main._id}
                          type="button"
                          onClick={() => toggleCategory(main._id)}
                          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-dark-700 w-full text-left transition-colors"
                        >
                          <CategoryIcon icon={main.icon} size={16} className="inline-flex" />
                          {main.name}
                        </button>
                      );
                    }
                    return (
                      <details key={main._id} className="group">
                        <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 transition-colors flex items-center gap-2">
                          <CategoryIcon icon={main.icon} size={16} className="inline-flex" />
                          <span>{main.name}</span>
                        </summary>
                        <div className="ml-6 mt-1 space-y-1">
                          {subs.filter(s => !selectedCategories.includes(s._id)).map(sub => (
                            <button
                              key={sub._id}
                              type="button"
                              onClick={() => toggleCategory(sub._id)}
                              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-dark-700 w-full text-left transition-colors"
                            >
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => { workForm.reset(); setSelectedCategories(categoriesOf(profile)); }}>Cancel</Button>
              <Button type="submit" loading={isSaving}>Save</Button>
            </div>
          </form>
        </Section>

        <Section title="Location" description="Where you are based and the timezone you work in.">
          <form onSubmit={locationForm.handleSubmit(saveLocation)} className="space-y-4">
            <Input label="Country" placeholder="Ethiopia" {...locationForm.register('location.country', { maxLength: { value: 100, message: 'Max 100 characters' } })} />
            <Input label="City" placeholder="Addis Ababa" {...locationForm.register('location.city', { maxLength: { value: 100, message: 'Max 100 characters' } })} />
            <Input label="Timezone" placeholder="UTC+3" {...locationForm.register('location.timezone', { maxLength: { value: 50, message: 'Max 50 characters' } })} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => locationForm.reset()}>Cancel</Button>
              <Button type="submit" loading={isSaving}>Save</Button>
            </div>
          </form>
        </Section>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────── Skills ─────────────────────────────── */
function SkillsTab({ profile, updateProfile, userId, qc }) {
  const skills = profile?.skills || [];
  const [editingIdx, setEditingIdx] = useState(null);
  const [confirmIdx, setConfirmIdx] = useState(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState('intermediate');
  const [years, setYears] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['freelancer', userId] });

  const persist = (next, onDone) => updateProfile(
    { skills: next },
    { onSuccess: () => { invalidate(); onDone?.(); } },
  );

  const resetInputs = () => { setName(''); setLevel('intermediate'); setYears(''); };

  const addSkill = () => {
    const value = name.trim();
    if (!value) return;
    if (skills.some(s => s.name.toLowerCase() === value.toLowerCase())) {
      toast.error('That skill is already on your profile');
      return;
    }
    persist([...skills, { name: value, level, yearsOfExperience: years === '' ? undefined : Number(years) }], () => {
      resetInputs();
      toast.success('Skill added');
    });
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setName(skills[idx].name);
    setLevel(skills[idx].level || 'intermediate');
    setYears(skills[idx].yearsOfExperience != null ? String(skills[idx].yearsOfExperience) : '');
  };

  const saveEdit = () => {
    const value = name.trim();
    if (!value) { toast.error('Skill name is required'); return; }
    if (skills.some((s, i) => i !== editingIdx && s.name.toLowerCase() === value.toLowerCase())) {
      toast.error('That skill is already on your profile');
      return;
    }
    const next = skills.map((s, i) => i === editingIdx
      ? { ...s, name: value, level, yearsOfExperience: years === '' ? undefined : Number(years) }
      : s);
    persist(next, () => { setEditingIdx(null); resetInputs(); toast.success('Skill updated'); });
  };

  const cancelEdit = () => { setEditingIdx(null); resetInputs(); };

  const removeSkill = (idx) => {
    persist(skills.filter((_, i) => i !== idx), () => toast.success('Skill removed'));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <Section title="Add Skill" description="List the tools and technologies you are proficient in.">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <input
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editingIdx == null ? addSkill() : saveEdit(); } }}
            placeholder="Add a skill (e.g. React)…" className="input"
          />
          <select value={level} onChange={e => setLevel(e.target.value)} className="input">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
          <input value={years} onChange={e => setYears(e.target.value)} type="number" min={0} max={50} placeholder="Years" className="input" />
          {editingIdx == null ? (
            <Button type="button" onClick={addSkill} variant="secondary" size="sm"><PlusIcon className="w-4 h-4" /> Add</Button>
          ) : (
            <div className="flex gap-2">
              <Button type="button" onClick={saveEdit} size="sm" className="flex-1">Save</Button>
              <Button type="button" onClick={cancelEdit} variant="secondary" size="sm">Cancel</Button>
            </div>
          )}
        </div>
      </Section>

      <Section title={`Your Skills (${skills.length})`}>
        {skills.length === 0 ? (
          <p className="text-sm text-gray-400">No skills added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((s, i) => (
              <span
                key={s._id || i}
                className={clsx('badge badge-primary flex items-center gap-2 py-1.5', editingIdx === i && 'ring-2 ring-primary-400')}
              >
                <span>{s.name}</span>
                {s.level && <span className="text-[10px] uppercase tracking-wide opacity-70">{s.level}</span>}
                {s.yearsOfExperience != null && <span className="text-[10px] opacity-70">{s.yearsOfExperience}y</span>}
                <button type="button" onClick={() => startEdit(i)} className="hover:text-white transition-colors" title="Edit"><PencilIcon className="w-3 h-3" /></button>
                <button type="button" onClick={() => setConfirmIdx(i)} className="hover:text-red-500 transition-colors" title="Remove"><TrashIcon className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </Section>

      <ConfirmModal
        open={confirmIdx != null}
        onClose={() => setConfirmIdx(null)}
        onConfirm={() => { removeSkill(confirmIdx); setConfirmIdx(null); }}
        title="Remove skill"
        message={confirmIdx != null ? `Remove “${skills[confirmIdx]?.name}” from your profile?` : ''}
        confirmLabel="Remove"
        danger
      />
    </motion.div>
  );
}

/* ─────────────────────────────── Experience ─────────────────────────────── */
function ExperienceTab({ profile, userId, qc }) {
  const [editingId, setEditingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();
  const isCurrent = watch('isCurrent') ?? false;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-profile'] });
    qc.invalidateQueries({ queryKey: ['freelancer', userId] });
  };

  const addM = useMutation({ mutationFn: userService.addExperience, onSuccess: () => { toast.success('Experience added'); invalidate(); } });
  const updateM = useMutation({ mutationFn: ({ id, data }) => userService.updateExperience(id, data), onSuccess: () => { toast.success('Experience updated'); invalidate(); } });
  const deleteM = useMutation({ mutationFn: userService.deleteExperience, onSuccess: () => { toast.success('Experience removed'); invalidate(); } });

  const startEdit = (exp) => {
    setEditingId(exp._id);
    reset({
      title: exp.title, company: exp.company, location: exp.location || '',
      startDate: toDateInput(exp.startDate), endDate: toDateInput(exp.endDate),
      isCurrent: !!exp.isCurrent, description: exp.description || '',
      employmentType: exp.employmentType || 'full_time',
      technologies: fromArray(exp.technologies),
    });
  };

  const cancelEdit = () => { setEditingId(null); reset({}); };

  const submit = (d) => {
    const payload = {
      title: d.title, company: d.company, location: d.location,
      startDate: d.startDate, endDate: d.isCurrent ? null : d.endDate,
      isCurrent: !!d.isCurrent, description: d.description,
      employmentType: d.employmentType || null,
      technologies: toArray(d.technologies),
    };
    const opts = { onSuccess: () => { reset(); setEditingId(null); } };
    if (editingId) updateM.mutate({ id: editingId, data: payload }, opts);
    else addM.mutate(payload, opts);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {(profile?.experience || []).map(exp => (
        <div key={exp._id} className="card p-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900 dark:text-white">{exp.title}</p>
              {exp.employmentType && <span className="badge badge-secondary text-[10px]">{exp.employmentType.replace('_', ' ')}</span>}
            </div>
            <p className="text-sm text-gray-500">{exp.company}{exp.location ? ` · ${exp.location}` : ''}</p>
            {(exp.startDate || exp.endDate) && (
              <p className="text-xs text-gray-400 mt-0.5">
                {exp.isCurrent ? 'Current' : `${toDateInput(exp.startDate) || ''} – ${exp.endDate ? toDateInput(exp.endDate) : ''}`}
              </p>
            )}
            {exp.technologies?.length > 0 && <p className="text-xs text-gray-400 mt-1">{exp.technologies.join(', ')}</p>}
            {exp.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 whitespace-pre-line">{exp.description}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => startEdit(exp)} className="btn-icon btn-ghost text-gray-400 hover:text-primary-600" title="Edit"><PencilIcon className="w-4 h-4" /></button>
            <button onClick={() => setConfirmId(exp._id)} className="btn-icon btn-ghost text-red-400 hover:text-red-600" title="Delete"><TrashIcon className="w-4 h-4" /></button>
          </div>
        </div>
      ))}

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{editingId ? 'Edit Experience' : 'Add Experience'}</h3>
        <form onSubmit={handleSubmit(submit)} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Job Title" error={errors.title?.message} {...register('title', { required: 'Job title is required' })} />
            <Input label="Company" error={errors.company?.message} {...register('company', { required: 'Company is required' })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Location" {...register('location')} />
            <Select label="Employment Type" {...register('employmentType')}>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="freelance">Freelance</option>
              <option value="internship">Internship</option>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Start Date" type="date" error={errors.startDate?.message} {...register('startDate', { required: 'Start date is required' })} />
            <Input
              label="End Date" type="date" disabled={isCurrent}
              error={errors.endDate?.message}
              {...register('endDate', {
                validate: (v) => isCurrent || v || 'End date is required',
              })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" {...register('isCurrent')} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            I currently work here
          </label>
          <Input label="Technologies (comma-separated)" placeholder="React, Node.js, MongoDB" {...register('technologies')} />
          <Textarea label="Description" rows={3} {...register('description')} />
          <div className="flex justify-end gap-2">
            {editingId && <Button type="button" variant="secondary" size="sm" onClick={cancelEdit}><XMarkIcon className="w-4 h-4" /> Cancel</Button>}
            <Button type="submit" loading={addM.isPending || updateM.isPending} size="sm">{editingId ? 'Save Changes' : 'Add Experience'}</Button>
          </div>
        </form>
      </div>

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => { deleteM.mutate(confirmId); setConfirmId(null); }}
        title="Delete experience"
        message="Delete this work experience entry? This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </motion.div>
  );
}

/* ─────────────────────────────── Education ─────────────────────────────── */
function EducationTab({ profile, userId, qc }) {
  const [editingId, setEditingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();
  const isCurrent = watch('isCurrent') ?? false;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-profile'] });
    qc.invalidateQueries({ queryKey: ['freelancer', userId] });
  };

  const addM = useMutation({ mutationFn: userService.addEducation, onSuccess: () => { toast.success('Education added'); invalidate(); } });
  const updateM = useMutation({ mutationFn: ({ id, data }) => userService.updateEducation(id, data), onSuccess: () => { toast.success('Education updated'); invalidate(); } });
  const deleteM = useMutation({ mutationFn: userService.deleteEducation, onSuccess: () => { toast.success('Education removed'); invalidate(); } });

  const startEdit = (edu) => {
    setEditingId(edu._id);
    reset({
      institution: edu.institution, degree: edu.degree, fieldOfStudy: edu.fieldOfStudy || '',
      startDate: toDateInput(edu.startDate), endDate: toDateInput(edu.endDate),
      isCurrent: !!edu.isCurrent, grade: edu.grade || '', description: edu.description || '',
    });
  };

  const cancelEdit = () => { setEditingId(null); reset({}); };

  const submit = (d) => {
    const payload = {
      institution: d.institution, degree: d.degree, fieldOfStudy: d.fieldOfStudy,
      startDate: d.startDate, endDate: d.isCurrent ? null : d.endDate,
      isCurrent: !!d.isCurrent, grade: d.grade, description: d.description,
    };
    const opts = { onSuccess: () => { reset(); setEditingId(null); } };
    if (editingId) updateM.mutate({ id: editingId, data: payload }, opts);
    else addM.mutate(payload, opts);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {(profile?.education || []).map(edu => (
        <div key={edu._id} className="card p-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white">{edu.degree}</p>
            <p className="text-sm text-gray-500">{edu.institution}{edu.fieldOfStudy ? ` · ${edu.fieldOfStudy}` : ''}</p>
            {(edu.startDate || edu.endDate) && (
              <p className="text-xs text-gray-400 mt-0.5">
                {edu.isCurrent ? 'Current' : `${toDateInput(edu.startDate) || ''} – ${edu.endDate ? toDateInput(edu.endDate) : ''}`}
              </p>
            )}
            {edu.grade && <p className="text-xs text-gray-400 mt-0.5">Grade: {edu.grade}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => startEdit(edu)} className="btn-icon btn-ghost text-gray-400 hover:text-primary-600" title="Edit"><PencilIcon className="w-4 h-4" /></button>
            <button onClick={() => setConfirmId(edu._id)} className="btn-icon btn-ghost text-red-400 hover:text-red-600" title="Delete"><TrashIcon className="w-4 h-4" /></button>
          </div>
        </div>
      ))}

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{editingId ? 'Edit Education' : 'Add Education'}</h3>
        <form onSubmit={handleSubmit(submit)} className="space-y-3">
          <Input label="Institution" error={errors.institution?.message} {...register('institution', { required: 'Institution is required' })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Degree" error={errors.degree?.message} {...register('degree', { required: 'Degree is required' })} />
            <Input label="Field of Study" {...register('fieldOfStudy')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Start Date" type="date" error={errors.startDate?.message} {...register('startDate', { required: 'Start date is required' })} />
            <Input
              label="End Date" type="date" disabled={isCurrent}
              error={errors.endDate?.message}
              {...register('endDate', { validate: (v) => isCurrent || v || 'End date is required' })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" {...register('isCurrent')} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              I currently study here
            </label>
            <Input label="Grade / Score (optional)" placeholder="e.g. 3.8 GPA or 92%" {...register('grade')} />
          </div>
          <div className="flex justify-end gap-2">
            {editingId && <Button type="button" variant="secondary" size="sm" onClick={cancelEdit}><XMarkIcon className="w-4 h-4" /> Cancel</Button>}
            <Button type="submit" loading={addM.isPending || updateM.isPending} size="sm">{editingId ? 'Save Changes' : 'Add Education'}</Button>
          </div>
        </form>
      </div>

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => { deleteM.mutate(confirmId); setConfirmId(null); }}
        title="Delete education"
        message="Delete this education entry? This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </motion.div>
  );
}

/* ─────────────────────────────── Portfolio ─────────────────────────────── */
function PortfolioTab({ profile, userId, qc }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const [editingId, setEditingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-profile'] });
    qc.invalidateQueries({ queryKey: ['freelancer', userId] });
  };

  const buildFormData = (d) => {
    const fd = new FormData();
    Object.entries(d).forEach(([k, v]) => {
      if (k === 'images') {
        if (v && v.length) Array.from(v).forEach(f => fd.append('images', f));
        return;
      }
      if (v == null || v === '') {
        // A date field cannot be sent empty (backend validates a real date);
        // other empty strings are sent so the field can be cleared.
        if (k === 'completedAt') return;
        fd.append(k, '');
        return;
      }
      if (Array.isArray(v)) v.forEach(x => fd.append(k, x));
      else fd.append(k, v);
    });
    return fd;
  };

  const addM = useMutation({
    mutationFn: (data) => userService.addPortfolioItem(buildFormData({
      ...data, technologies: toArray(data.technologies), skillsUsed: toArray(data.skillsUsed), completedAt: data.completedAt || '',
    })),
    onSuccess: () => { toast.success('Portfolio item added!'); invalidate(); reset(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add item'),
  });

  const updateM = useMutation({
    mutationFn: ({ id, data }) => userService.updatePortfolioItem(id, buildFormData({
      ...data, technologies: toArray(data.technologies), skillsUsed: toArray(data.skillsUsed), completedAt: data.completedAt || '',
    })),
    onSuccess: () => { toast.success('Portfolio item updated!'); invalidate(); reset(); setEditingId(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update item'),
  });

  const deleteM = useMutation({
    mutationFn: userService.deletePortfolioItem,
    onSuccess: () => { toast.success('Portfolio item removed'); invalidate(); },
  });

  const startEdit = (p) => {
    setEditingId(p._id);
    reset({
      title: p.title, description: p.description || '',
      projectUrl: p.projectUrl || '', repositoryUrl: p.repositoryUrl || '',
      demoUrl: p.demoUrl || '', clientName: p.clientName || '',
      category: p.category || '', completedAt: toDateInput(p.completedAt),
      technologies: fromArray(p.technologies), skillsUsed: fromArray(p.skillsUsed),
      images: '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => { setEditingId(null); reset(); };

  const submit = (d) => {
    if (editingId) updateM.mutate({ id: editingId, data: d });
    else addM.mutate(d);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {(profile?.portfolio || []).length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {profile.portfolio.map(p => (
            <div key={p._id} className="card overflow-hidden flex flex-col">
              {p.images?.[0]?.url
                ? <img src={p.images[0].url} alt={p.title} className="w-full h-36 object-cover" />
                : <div className="w-full h-36 bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-xs text-gray-400">No image</div>}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{p.title}</p>
                    {p.category && <p className="text-xs text-gray-400 mt-0.5">{p.category}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button type="button" onClick={() => startEdit(p)} className="btn-icon btn-ghost text-gray-400 hover:text-primary-600" title="Edit"><PencilIcon className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setConfirmId(p._id)} className="btn-icon btn-ghost text-red-400 hover:text-red-600" title="Remove"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                </div>
                {p.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{p.description}</p>}
                {p.technologies?.length > 0 && <p className="text-xs text-gray-400 mt-1">{p.technologies.join(', ')}</p>}
                <div className="flex flex-wrap gap-3 mt-2">
                  {p.projectUrl && <a href={p.projectUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1">Live <ArrowRight size={12} /></a>}
                  {p.repositoryUrl && <a href={p.repositoryUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1">Code <ArrowRight size={12} /></a>}
                  {p.demoUrl && <a href={p.demoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1">Demo <ArrowRight size={12} /></a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">{editingId ? 'Edit Portfolio Item' : 'Add Portfolio Item'}</h3>
          {editingId && <button type="button" onClick={cancelEdit} className="btn-icon btn-ghost text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>}
        </div>
        <form onSubmit={handleSubmit(submit)} className="space-y-3">
          <Input label="Project Title" error={errors.title?.message} {...register('title', { required: 'Title is required', maxLength: { value: 100, message: 'Max 100 characters' } })} />
          <Textarea label="Description" rows={2} {...register('description')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Live URL" placeholder="https://…" error={errors.projectUrl?.message} {...register('projectUrl', urlRule)} />
            <Input label="Repository URL" placeholder="https://github.com/…" error={errors.repositoryUrl?.message} {...register('repositoryUrl', urlRule)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Demo URL" placeholder="https://demo.…" error={errors.demoUrl?.message} {...register('demoUrl', urlRule)} />
            <Input label="Client Name (optional)" placeholder="Acme Corp" {...register('clientName')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Category" placeholder="e.g. Web Development" {...register('category')} />
            <Input label="Completion Date" type="date" {...register('completedAt')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Technologies (comma-separated)" placeholder="React, Node.js, MongoDB" {...register('technologies')} />
            <Input label="Skills Used (comma-separated)" placeholder="UI Design, API Integration" {...register('skillsUsed')} />
          </div>
          <Input
            label={editingId ? 'Replace Images (optional, multiple)' : 'Images (optional, multiple)'}
            type="file" accept="image/*" multiple
            hint={editingId ? 'Uploading new images replaces the existing ones.' : undefined}
            {...register('images')}
          />
          <div className="flex justify-end gap-2">
            {editingId && <Button type="button" variant="secondary" size="sm" onClick={cancelEdit}>Cancel</Button>}
            <Button type="submit" size="sm" loading={addM.isPending || updateM.isPending}>{editingId ? 'Save Changes' : 'Add Item'}</Button>
          </div>
        </form>
      </div>

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => { deleteM.mutate(confirmId); setConfirmId(null); }}
        title="Remove portfolio item"
        message="Remove this portfolio item and its images? This cannot be undone."
        confirmLabel="Remove"
        danger
      />
    </motion.div>
  );
}

/* ─────────────────────────────── Certifications ─────────────────────────────── */
function CertificationsTab({ profile, userId, qc }) {
  const [editingId, setEditingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-profile'] });
    qc.invalidateQueries({ queryKey: ['freelancer', userId] });
  };

  const addM = useMutation({ mutationFn: userService.addCertification, onSuccess: () => { toast.success('Certification added'); invalidate(); } });
  const updateM = useMutation({ mutationFn: ({ id, data }) => userService.updateCertification(id, data), onSuccess: () => { toast.success('Certification updated'); invalidate(); } });
  const deleteM = useMutation({ mutationFn: userService.deleteCertification, onSuccess: () => { toast.success('Certification removed'); invalidate(); } });

  const uploadResumeM = useMutation({
    mutationFn: (file) => { const fd = new FormData(); fd.append('resume', file); return userService.uploadResume(fd); },
    onSuccess: () => { toast.success('Resume uploaded!'); qc.invalidateQueries({ queryKey: ['my-profile'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to upload resume'),
  });

  const startEdit = (c) => {
    setEditingId(c._id);
    reset({
      name: c.name, issuingOrganization: c.issuingOrganization,
      issueDate: toDateInput(c.issueDate), expirationDate: toDateInput(c.expirationDate),
      credentialId: c.credentialId || '', credentialUrl: c.credentialUrl || '',
    });
  };

  const cancelEdit = () => { setEditingId(null); reset({}); };

  const submit = (d) => {
    const opts = { onSuccess: () => { reset(); setEditingId(null); } };
    if (editingId) updateM.mutate({ id: editingId, data: d }, opts);
    else addM.mutate(d, opts);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <Section title="Certifications">
        <div className="space-y-2">
          {(profile?.certifications || []).map(c => (
            <div key={c._id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-gray-200/70 dark:border-dark-600">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{c.name}</p>
                  {c.expirationDate && new Date(c.expirationDate) < new Date() && (
                    <span className="badge badge-secondary text-[10px]">Expired</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{c.issuingOrganization}</p>
                {c.credentialId && <p className="text-xs text-gray-400 mt-0.5">ID: {c.credentialId}</p>}
                {c.credentialUrl && (
                  <a href={c.credentialUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline mt-0.5 inline-flex items-center gap-1">View credential <ArrowRight size={12} /></a>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => startEdit(c)} className="btn-icon btn-ghost text-gray-400 hover:text-primary-600" title="Edit"><PencilIcon className="w-4 h-4" /></button>
                <button onClick={() => setConfirmId(c._id)} className="btn-icon btn-ghost text-red-400 hover:text-red-600" title="Delete"><TrashIcon className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {(profile?.certifications || []).length === 0 && <p className="text-sm text-gray-400">No certifications added yet.</p>}
        </div>
      </Section>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{editingId ? 'Edit Certification' : 'Add Certification'}</h3>
        <form onSubmit={handleSubmit(submit)} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Certification Name" error={errors.name?.message} {...register('name', { required: 'Name is required' })} />
            <Input label="Issuing Organization" error={errors.issuingOrganization?.message} {...register('issuingOrganization', { required: 'Issuer is required' })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Issue Date" type="date" {...register('issueDate')} />
            <Input label="Expiration Date" type="date" {...register('expirationDate')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Credential ID" {...register('credentialId')} />
            <Input label="Credential URL" placeholder="https://verify.…" error={errors.credentialUrl?.message} {...register('credentialUrl', urlRule)} />
          </div>
          <div className="flex justify-end gap-2">
            {editingId && <Button type="button" variant="secondary" size="sm" onClick={cancelEdit}><XMarkIcon className="w-4 h-4" /> Cancel</Button>}
            <Button type="submit" size="sm" loading={addM.isPending || updateM.isPending}>{editingId ? 'Save Changes' : 'Add Certification'}</Button>
          </div>
        </form>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Resume Upload</h2>
        {profile?.resume?.url && (
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <span className="text-sm text-green-700 dark:text-green-400 truncate">Current resume: {profile.resume.originalName}</span>
            <a href={profile.resume.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline ml-auto flex-shrink-0">View</a>
          </div>
        )}
        <label className="block">
          <span className="btn-secondary cursor-pointer inline-flex items-center gap-2">
            <span>{uploadResumeM.isPending ? 'Uploading…' : 'Upload Resume (PDF)'}</span>
          </span>
          <input type="file" accept=".pdf,.doc,.docx" className="sr-only"
            onChange={e => e.target.files?.[0] && uploadResumeM.mutate(e.target.files[0])} disabled={uploadResumeM.isPending} />
        </label>
      </div>

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => { deleteM.mutate(confirmId); setConfirmId(null); }}
        title="Delete certification"
        message="Delete this certification? This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </motion.div>
  );
}

/* ─────────────────────────────── Languages ─────────────────────────────── */
function LanguagesTab({ profile, updateProfile }) {
  const languages = profile?.languages || [];
  const [editingIdx, setEditingIdx] = useState(null);
  const [confirmIdx, setConfirmIdx] = useState(null);
  const [langInput, setLangInput] = useState('');
  const [proficiency, setProficiency] = useState('professional');

  const persist = (next, onDone) => updateProfile({ languages: next }, { onSuccess: () => onDone?.() });
  const resetInputs = () => { setLangInput(''); setProficiency('professional'); };

  const addLanguage = () => {
    const value = langInput.trim();
    if (!value) return;
    if (languages.some(l => l.name.toLowerCase() === value.toLowerCase())) {
      toast.error('That language is already on your profile');
      return;
    }
    persist([...languages, { name: value, proficiency }], () => { resetInputs(); toast.success('Language added'); });
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setLangInput(languages[idx].name);
    setProficiency(languages[idx].proficiency || 'professional');
  };

  const saveEdit = () => {
    const value = langInput.trim();
    if (!value) { toast.error('Language name is required'); return; }
    if (languages.some((l, i) => i !== editingIdx && l.name.toLowerCase() === value.toLowerCase())) {
      toast.error('That language is already on your profile');
      return;
    }
    const next = languages.map((l, i) => i === editingIdx ? { ...l, name: value, proficiency } : l);
    persist(next, () => { setEditingIdx(null); resetInputs(); toast.success('Language updated'); });
  };

  const cancelEdit = () => { setEditingIdx(null); resetInputs(); };

  const removeLanguage = (idx) => persist(languages.filter((_, i) => i !== idx), () => toast.success('Language removed'));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <Section title={editingIdx == null ? 'Add Language' : 'Edit Language'} description="Languages you speak and your proficiency level.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            value={langInput} onChange={e => setLangInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editingIdx == null ? addLanguage() : saveEdit(); } }}
            placeholder="e.g. English, Amharic…" className="input"
          />
          <select value={proficiency} onChange={e => setProficiency(e.target.value)} className="input">
            <option value="basic">Basic</option>
            <option value="conversational">Conversational</option>
            <option value="professional">Professional</option>
            <option value="native">Native</option>
          </select>
          {editingIdx == null ? (
            <Button type="button" onClick={addLanguage} variant="secondary" size="sm"><PlusIcon className="w-4 h-4" /> Add</Button>
          ) : (
            <div className="flex gap-2">
              <Button type="button" onClick={saveEdit} size="sm" className="flex-1">Save</Button>
              <Button type="button" onClick={cancelEdit} variant="secondary" size="sm">Cancel</Button>
            </div>
          )}
        </div>
      </Section>

      <Section title={`Your Languages (${languages.length})`}>
        <div className="flex flex-wrap gap-2">
          {languages.map((l, i) => (
            <span key={l._id || i} className={clsx('badge badge-primary flex items-center gap-2 py-1.5', editingIdx === i && 'ring-2 ring-primary-400')}>
              <span>{l.name}</span>
              <span className="text-[10px] uppercase tracking-wide opacity-70">{l.proficiency}</span>
              <button type="button" onClick={() => startEdit(i)} className="hover:text-white transition-colors" title="Edit"><PencilIcon className="w-3 h-3" /></button>
              <button type="button" onClick={() => setConfirmIdx(i)} className="hover:text-red-500 transition-colors" title="Remove"><TrashIcon className="w-3 h-3" /></button>
            </span>
          ))}
          {languages.length === 0 && <p className="text-sm text-gray-400">No languages added yet.</p>}
        </div>
      </Section>

      <ConfirmModal
        open={confirmIdx != null}
        onClose={() => setConfirmIdx(null)}
        onConfirm={() => { removeLanguage(confirmIdx); setConfirmIdx(null); }}
        title="Remove language"
        message={confirmIdx != null ? `Remove “${languages[confirmIdx]?.name}” from your profile?` : ''}
        confirmLabel="Remove"
        danger
      />
    </motion.div>
  );
}

/* ─────────────────────────────── Social Links ─────────────────────────────── */
function SocialLinksTab() {
  const { user, updateUser } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm({ values: {
    linkedin: user?.socialLinks?.linkedin || '',
    website: user?.socialLinks?.website || '',
    twitter: user?.socialLinks?.twitter || '',
    behance: user?.socialLinks?.behance || '',
    dribbble: user?.socialLinks?.dribbble || '',
    stackoverflow: user?.socialLinks?.stackoverflow || '',
  } });

  const { mutate: saveLinks, isPending } = useMutation({
    mutationFn: (socialLinks) => userService.updateMe({ socialLinks }),
    onSuccess: (res) => {
      updateUser(res.data?.data);
      toast.success('Social links updated!');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update links'),
  });

  const links = [
    { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/…' },
    { key: 'website', label: 'Website', placeholder: 'https://…' },
    { key: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/…' },
    { key: 'behance', label: 'Behance', placeholder: 'https://behance.net/…' },
    { key: 'dribbble', label: 'Dribbble', placeholder: 'https://dribbble.com/…' },
    { key: 'stackoverflow', label: 'Stack Overflow', placeholder: 'https://stackoverflow.com/users/…' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Section title="Social Links" description="Add your professional links so clients can learn more about you.">
        <form onSubmit={handleSubmit(d => saveLinks(d))} className="space-y-4">
          {links.map(l => (
            <Input key={l.key} label={l.label} placeholder={l.placeholder} error={errors[l.key]?.message} {...register(l.key, urlRule)} />
          ))}
          <div className="flex justify-end"><Button type="submit" loading={isPending}>Save Links</Button></div>
        </form>
      </Section>
    </motion.div>
  );
}

/* ─────────────────────────────── Preferences ─────────────────────────────── */
function PreferencesTab({ profile, updateProfile, isSaving }) {
  const { user } = useAuthStore();
  const { register, handleSubmit, reset } = useForm({ values: profile ? {
    yearsOfExperience: profile.yearsOfExperience ?? '',
    responseTime: profile.responseTime || 'within_24h',
    'workingHours.start': profile.workingHours?.start || '',
    'workingHours.end': profile.workingHours?.end || '',
    'workingHours.timezone': profile.workingHours?.timezone || 'UTC',
    preferredContractType: profile.preferredContractType || 'hourly',
    preferredProjectSize: profile.preferredProjectSize || 'medium',
    'visibility.showHourlyRate': profile.visibility?.showHourlyRate ?? true,
    'visibility.showEarnings': profile.visibility?.showEarnings ?? true,
  } : {} });

  const { mutate: saveAvailability } = useMutation({
    mutationFn: profileService.updateAvailability,
    onSuccess: () => toast.success('Availability status updated!'),
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update availability'),
  });

  const submit = (d) => {
    updateProfile({
      yearsOfExperience: d.yearsOfExperience === '' || d.yearsOfExperience == null ? null : Number(d.yearsOfExperience),
      responseTime: d.responseTime,
      workingHours: {
        start: d['workingHours.start'], end: d['workingHours.end'],
        timezone: d['workingHours.timezone'],
      },
      preferredContractType: d.preferredContractType,
      preferredProjectSize: d.preferredProjectSize,
      visibility: {
        showHourlyRate: !!d['visibility.showHourlyRate'],
        showEarnings: !!d['visibility.showEarnings'],
      },
    }, { onSuccess: () => toast.success('Preferences updated!') });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <Section title="Working Preferences" description="How and when you prefer to take on work. Account and security settings live in the Account tab.">
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Years of Experience" type="number" min={0} max={50} {...register('yearsOfExperience')} />
            <Select label="Response Time" {...register('responseTime')}>
              <option value="within_hour">Within an hour</option>
              <option value="within_24h">Within 24 hours</option>
              <option value="within_48h">Within 48 hours</option>
              <option value="within_week">Within a week</option>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Working Hours Start" type="time" {...register('workingHours.start')} />
            <Input label="Working Hours End" type="time" {...register('workingHours.end')} />
            <Input label="Timezone" placeholder="UTC+3" {...register('workingHours.timezone')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Preferred Contract Type" {...register('preferredContractType')}>
              <option value="hourly">Hourly</option>
              <option value="fixed">Fixed price</option>
              <option value="milestone">Milestone-based</option>
            </Select>
            <Select label="Preferred Project Size" {...register('preferredProjectSize')}>
              <option value="small">Small (1-3 days)</option>
              <option value="medium">Medium (1-2 weeks)</option>
              <option value="large">Large (1+ month)</option>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" {...register('visibility.showHourlyRate')} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Show my hourly rate on my public profile
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" {...register('visibility.showEarnings')} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Show my earnings on my public profile
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => reset()}>Cancel</Button>
            <Button type="submit" loading={isSaving}>Save Preferences</Button>
          </div>
        </form>
      </Section>

      <Section title="Availability Status" description="Let clients know whether you are open to new work right now.">
        <div className="flex flex-wrap gap-2">
          {['available', 'busy', 'vacation', 'offline'].map(status => (
            <button
              key={status}
              type="button"
              onClick={() => saveAvailability({ availabilityStatus: status })}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors border',
                user?.availabilityStatus === status
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-700',
              )}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Current status: <span className="capitalize font-medium">{user?.availabilityStatus || 'available'}</span></p>
      </Section>
    </motion.div>
  );
}

/* ─────────────────────────────── GitHub ─────────────────────────────── */
function GitHubTab({ userId }) {
  const { user } = useAuthStore();
  const [githubInput, setGithubInput] = useState('');
  const { mutate: linkGitHub, isPending: isLinking } = useLinkGitHub();
  const { mutate: unlinkGitHub } = useUnlinkGitHub();
  const { mutate: refreshGitHub, isPending: isRefreshing } = useRefreshGitHub();
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  // The link is stored on the User (socialLinks.github); the profile only holds
  // the cached githubData. Reading from the auth user keeps the state correct.
  const githubUrl = user?.socialLinks?.github || '';
  const isLinked = !!githubUrl;

  const handleLink = () => {
    if (!githubInput.trim()) return;
    linkGitHub(githubInput, { onSuccess: () => setGithubInput('') });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <Section title="GitHub Integration" description="Linking showcases your public repositories — it does not grant a verified badge.">
        {isLinked ? (
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">GitHub linked</p>
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 dark:text-green-300 hover:underline truncate block">{githubUrl}</a>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={() => refreshGitHub()} loading={isRefreshing} className="text-gray-500">
                <ArrowPathIcon className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmUnlink(true)} className="text-red-400 hover:text-red-600">
                Unlink
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Link your GitHub profile to showcase your repositories, contributions, languages, and commit activity.</p>
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <Input label="GitHub Profile URL or Username" placeholder="https://github.com/username or username"
                value={githubInput} onChange={e => setGithubInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleLink())} />
              <Button onClick={handleLink} loading={isLinking} className="sm:mb-px">Link GitHub</Button>
            </div>
          </div>
        )}
      </Section>

      {isLinked && <GitHubProfile userId={userId} isOwnProfile={true} />}

      <ConfirmModal
        open={confirmUnlink}
        onClose={() => setConfirmUnlink(false)}
        onConfirm={() => { unlinkGitHub(); setConfirmUnlink(false); }}
        title="Unlink GitHub"
        message="Unlink your GitHub account? Cached repository data will be removed from your profile."
        confirmLabel="Unlink"
        danger
      />
    </motion.div>
  );
}
