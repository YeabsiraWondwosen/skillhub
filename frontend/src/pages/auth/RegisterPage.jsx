import { Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { UserIcon, EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useRegister } from '@/hooks/useAuth';
import { sanitizeInviteIntent } from '@/utils/authRedirect';
import { useCategoryTree, useSkillsByCategory } from '@/hooks/useCategories';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import PasswordRequirements from '@/components/ui/PasswordRequirements';
import { clsx } from 'clsx';

export default function RegisterPage() {
  const { mutate: doRegister, isPending } = useRegister();
  const { data: treeData } = useCategoryTree();
  const location = useLocation();
  const inviteIntent = sanitizeInviteIntent(location.state?.invite);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({ defaultValues: { role: inviteIntent ? 'client' : 'freelancer' } });
  const role = watch('role');
  const primaryCategory = watch('primaryCategory');
  const subcategory = watch('subcategory');
  const password = watch('password') || '';
  const categories = treeData?.data ?? [];
  const subs = categories.find(c => c._id === primaryCategory)?.subcategories ?? [];
  const { data: skillsData } = useSkillsByCategory(subcategory);
  const availableSkills = skillsData?.data ?? [];
  const { t } = useTranslation();

  const toggleSkill = (name) => {
    const current = watch('skills') || [];
    if (current.includes(name)) setValue('skills', current.filter(s => s !== name));
    else if (current.length < 20) setValue('skills', [...current, name]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50/30 to-secondary-50/20 dark:from-dark-900 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center p-4 py-12">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center">
            <img src="/images/skillhub-logo-dark.png" alt="SkillHub" className="h-10 w-auto object-contain dark:hidden" />
            <img src="/images/skillhub-logo-light.png" alt="SkillHub" className="h-10 w-auto object-contain hidden dark:block" />
          </Link>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">{t('auth.createYourAccount')}</p>
        </div>

        <div className="card p-8 shadow-xl">
          <form onSubmit={handleSubmit(doRegister)} className="space-y-5">
            <div>
              <label className="label">{t('auth.role')}</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'freelancer', label: t('auth.freelancer'), desc: t('auth.freelancerDesc') },
                  { value: 'client', label: t('auth.client'), desc: t('auth.clientDesc') },
                ].map(opt => (
                  <label key={opt.value} className={clsx(
                    'relative flex flex-col gap-0.5 p-3 rounded-xl border-2 cursor-pointer transition-all',
                    role === opt.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                  )}>
                    <input type="radio" value={opt.value} {...register('role')} className="sr-only" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{opt.label}</span>
                    <span className="text-xs text-gray-500">{opt.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {role === 'freelancer' && categories.length > 0 && (
              <>
                <div>
                  <label className="label">{t('auth.primaryCategory')}</label>
                  <select
                    name="primaryCategory"
                    value={primaryCategory || ''}
                    onChange={(e) => { setValue('primaryCategory', e.target.value); setValue('subcategory', ''); setValue('skills', []); }}
                    className="input w-full"
                  >
                    <option value="">{t('auth.selectCategory')}</option>
                    {categories.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">{t('auth.categoryHint')}</p>
                </div>

                {primaryCategory && (
                  <div>
                    <label className="label">Subcategory</label>
                    <select
                      name="subcategory"
                      value={subcategory || ''}
                      onChange={(e) => { setValue('subcategory', e.target.value); setValue('skills', []); }}
                      className="input w-full"
                    >
                      <option value="">Select a subcategory</option>
                      {subs.map(s => (
                        <option key={s._id} value={s._id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {subcategory && (
                  <div>
                    <label className="label">Skills</label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                      {availableSkills.map(s => {
                        const selected = (watch('skills') || []).includes(s.name);
                        return (
                          <button
                            key={s._id}
                            type="button"
                            onClick={() => toggleSkill(s.name)}
                            className={clsx(
                              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                              selected
                                ? 'bg-primary-600 border-primary-600 text-white'
                                : 'bg-white dark:bg-dark-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary-400'
                            )}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                      {availableSkills.length === 0 && <span className="text-xs text-gray-400">No skills available for this subcategory</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Up to 20 skills</p>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input label={t('auth.firstName')} placeholder={t('auth.firstNamePlaceholder')} icon={UserIcon}
                error={errors.firstName?.message}
                {...register('firstName', { required: t('auth.required'), minLength: { value: 2, message: t('auth.min2Chars') } })}
              />
              <Input label={t('auth.lastName')} placeholder={t('auth.lastNamePlaceholder')}
                error={errors.lastName?.message}
                {...register('lastName', { required: t('auth.required'), minLength: { value: 2, message: t('auth.min2Chars') } })}
              />
            </div>

            <Input label={t('auth.email')} type="email" placeholder={t('auth.emailPlaceholder')} icon={EnvelopeIcon}
              error={errors.email?.message}
              {...register('email', { required: t('auth.emailRequired'), pattern: { value: /\S+@\S+\.\S+/, message: t('auth.invalidEmail') } })}
            />

            <Input label={t('auth.password')} type="password" placeholder={t('auth.newPasswordPlaceholder')} icon={LockClosedIcon}
              error={errors.password?.message}
              {...register('password', {
                required: t('auth.passwordRequired'),
                validate: v =>
                  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(v) || t('auth.passwordPattern'),
              })}
            />
            <PasswordRequirements value={password} />

            <Button type="submit" loading={isPending} className="w-full btn-lg">
              {t('auth.register')}
            </Button>

            <p className="text-xs text-center text-gray-400">
              {t('auth.agreeTerms')}{' '}
              <a href="#" className="text-primary-600 hover:underline dark:text-primary-400">{t('auth.termsOfService')}</a> {t('auth.and')}{' '}
              <a href="#" className="text-primary-600 hover:underline dark:text-primary-400">{t('auth.privacyPolicy')}</a>
            </p>
          </form>

          <div className="mt-5 text-center text-sm text-gray-500">
            {t('auth.hasAccount')}{' '}
            <Link to={{ pathname: '/auth/login', search: '' }} state={location.state} className="text-primary-600 font-semibold hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">{t('auth.login')}</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
