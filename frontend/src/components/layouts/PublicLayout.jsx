import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Bars3Icon, XMarkIcon, MoonIcon, SunIcon, BriefcaseIcon, UsersIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';
import { useCategoryTree } from '@/hooks/useCategories';
import { subcategoryToProfession } from '@/utils/professions';
import CategoryIcon from '@/utils/categoryIcons';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import AIChatWidget from '@/components/support/AIChatWidget';
import Footer from '@/components/layouts/Footer';

export default function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [talentOpen, setTalentOpen] = useState(false);
  const [hoveredJobCat, setHoveredJobCat] = useState(null);
  const [hoveredTalentCat, setHoveredTalentCat] = useState(null);
  const jobsRef = useRef(null);
  const talentRef = useRef(null);
  const { user, isDark, toggleDark } = useAuthStore();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { data: categoryTree } = useCategoryTree();
  const categories = categoryTree?.data ?? [];

  useEffect(() => {
    const handle = (e) => {
      if (jobsRef.current && !jobsRef.current.contains(e.target)) setJobsOpen(false);
      if (talentRef.current && !talentRef.current.contains(e.target)) setTalentOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const dashLink = user
    ? user.role === 'admin' ? '/admin/dashboard'
    : user.role === 'freelancer' ? '/freelancer/dashboard' : '/client/dashboard'
    : null;

  const plainLinks = [
    { label: t('nav.about'), to: '/about' },
    { label: t('nav.contact'), to: '/contact' },
  ];

  const categoryLink = (kind) => (cat, sub) =>
    sub
      ? kind === 'jobs'
        ? `/jobs?category=${cat._id}&subcategory=${sub._id}`
        : `/freelancers?category=${cat._id}&subcategory=${sub._id}`
      : kind === 'jobs'
        ? `/jobs?category=${cat._id}`
        : `/freelancers?category=${cat._id}`;

  const closeDropdowns = () => { setJobsOpen(false); setTalentOpen(false); setHoveredJobCat(null); setHoveredTalentCat(null); };

  const chunkArray = (arr, size) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

  return (
    <div className="min-h-screen bg-white dark:bg-dark-900/50 flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 glass border-b border-gray-200/60 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-6">
          <Link to="/" className="flex items-center flex-shrink-0" aria-label="SkillHub Home">
            <img
              src="/images/skillhub-logo-dark.png"
              alt="SkillHub"
              className="h-10 w-auto object-contain dark:hidden"
            />
            <img
              src="/images/skillhub-logo-light.png"
              alt="SkillHub"
              className="h-10 w-auto object-contain hidden dark:block drop-shadow-[0_0_10px_rgba(129,140,248,0.4)]"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {/* Browse Jobs dropdown */}
            <div
              ref={jobsRef}
              className="relative"
              onMouseEnter={() => { setJobsOpen(true); setTalentOpen(false); }}
              onMouseLeave={() => setJobsOpen(false)}
            >
              <button
                type="button"
                onClick={() => { setJobsOpen(v => !v); setTalentOpen(false); }}
                className={clsx('px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
                  jobsOpen || location.pathname.startsWith('/jobs')
                    ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700'
                )}>
                {t('nav.browseJobs')}
                <ChevronDownIcon className={clsx('w-3.5 h-3.5 transition-transform', jobsOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {jobsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    className="absolute left-0 mt-2 flex card shadow-xl"
                  >
                    <div className="w-64 max-h-[70vh] overflow-y-auto py-1">
                      <Link to="/jobs" onClick={closeDropdowns}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-700">
                        <BriefcaseIcon className="w-4 h-4 text-primary-500" />
                        {t('jobs.allJobs')}
                      </Link>
                      <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                      {categories.map(cat => {
                        const active = hoveredJobCat?._id === cat._id;
                        return (
                          <button
                            key={cat._id}
                            type="button"
                            onMouseEnter={() => setHoveredJobCat(cat)}
                            onClick={() => setHoveredJobCat(cat)}
                            className={clsx('w-full flex items-center justify-between gap-2 px-4 py-2 text-sm transition-colors text-left',
                              active
                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700'
                            )}>
                            <span className="flex items-center gap-2.5 min-w-0">
                              <CategoryIcon icon={cat.icon} size={16} className="w-5 text-center flex-shrink-0" />
                              <span className="truncate">{cat.name}</span>
                            </span>
                            {cat.subcategories?.length > 0 && (
                              <ChevronRightIcon className={clsx('w-3.5 h-3.5 flex-shrink-0', active ? 'text-primary-400 dark:text-primary-500' : 'text-gray-300 dark:text-gray-600')} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {hoveredJobCat?.subcategories?.length > 0 && (
                      <div className="border-l border-gray-100 dark:border-gray-700">
                        <Link to={categoryLink('jobs')(hoveredJobCat)} onClick={closeDropdowns}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-700">
                          <CategoryIcon icon={hoveredJobCat.icon} size={16} className="w-5 text-center flex-shrink-0" />
                          <span className="truncate">All in {hoveredJobCat.name}</span>
                        </Link>
                        <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                        <div className="flex">
                          {chunkArray(hoveredJobCat.subcategories, 5).map((group, i) => (
                            <div key={i} className="w-56 max-h-[70vh] overflow-y-auto py-1 border-r border-gray-100 dark:border-gray-700 last:border-r-0">
                              {group.map(sub => (
                                <Link key={sub._id} to={categoryLink('jobs')(hoveredJobCat, sub)} onClick={closeDropdowns}
                                  className="block px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white">
                                  {sub.name}
                                </Link>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Find Talent dropdown */}
            <div
              ref={talentRef}
              className="relative"
              onMouseEnter={() => { setTalentOpen(true); setJobsOpen(false); }}
              onMouseLeave={() => setTalentOpen(false)}
            >
              <button
                type="button"
                onClick={() => { setTalentOpen(v => !v); setJobsOpen(false); }}
                className={clsx('px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
                  talentOpen || location.pathname.startsWith('/freelancers')
                    ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700'
                )}>
                {t('nav.findTalentShort')}
                <ChevronDownIcon className={clsx('w-3.5 h-3.5 transition-transform', talentOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {talentOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    className="absolute left-0 mt-2 flex card shadow-xl"
                  >
                    <div className="w-64 max-h-[70vh] overflow-y-auto py-1">
                      <Link to="/freelancers" onClick={closeDropdowns}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-700">
                        <UsersIcon className="w-4 h-4 text-primary-500" />
                        {t('nav.findTalentShort')}
                      </Link>
                      <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                      {categories.map(cat => {
                        const active = hoveredTalentCat?._id === cat._id;
                        return (
                          <button
                            key={cat._id}
                            type="button"
                            onMouseEnter={() => setHoveredTalentCat(cat)}
                            onClick={() => setHoveredTalentCat(cat)}
                            className={clsx('w-full flex items-center justify-between gap-2 px-4 py-2 text-sm transition-colors text-left',
                              active
                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700'
                            )}>
                            <span className="flex items-center gap-2.5 min-w-0">
                              <CategoryIcon icon={cat.icon} size={16} className="w-5 text-center flex-shrink-0" />
                              <span className="truncate">{cat.name}</span>
                            </span>
                            {cat.subcategories?.length > 0 && (
                              <ChevronRightIcon className={clsx('w-3.5 h-3.5 flex-shrink-0', active ? 'text-primary-400 dark:text-primary-500' : 'text-gray-300 dark:text-gray-600')} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {hoveredTalentCat?.subcategories?.length > 0 && (
                      <div className="border-l border-gray-100 dark:border-gray-700">
                        <Link to={categoryLink('freelancers')(hoveredTalentCat)} onClick={closeDropdowns}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-700">
                          <CategoryIcon icon={hoveredTalentCat.icon} size={16} className="w-5 text-center flex-shrink-0" />
                          <span className="truncate">All in {hoveredTalentCat.name}</span>
                        </Link>
                        <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                        <div className="flex">
                          {chunkArray(hoveredTalentCat.subcategories, 5).map((group, i) => (
                            <div key={i} className="w-56 max-h-[70vh] overflow-y-auto py-1 border-r border-gray-100 dark:border-gray-700 last:border-r-0">
                              {group.map(sub => (
                                <Link key={sub._id} to={categoryLink('freelancers')(hoveredTalentCat, sub)} onClick={closeDropdowns}
                                  className="block px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white">
                                  {subcategoryToProfession(sub.name)}
                                </Link>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {plainLinks.map(l => (
              <Link key={l.to} to={l.to}
                className={clsx('px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname === l.to
                    ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700'
                )}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={toggleDark} className="btn-icon btn-ghost">
              {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'am' : 'en')}
              className="btn-icon btn-ghost text-xs font-bold"
              title={i18n.language === 'en' ? 'Switch to Amharic' : 'Switch to English'}
            >
              {i18n.language === 'en' ? 'አማ' : 'EN'}
            </button>
            {user ? (
              <Link to={dashLink} className="btn-primary btn-sm">{t('nav.dashboard')}</Link>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link to="/auth/login" className="btn-secondary btn-sm">{t('nav.logIn')}</Link>
                <Link to="/auth/register" className="btn-primary btn-sm">{t('nav.signUp')}</Link>
              </div>
            )}
            <button onClick={() => setMobileOpen(v => !v)} className="btn-icon btn-ghost md:hidden">
              {mobileOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
              className="overflow-hidden border-t border-gray-100 dark:border-gray-700 md:hidden">
              <div className="px-4 py-3 space-y-1">
                <Link to="/jobs" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-gray-900 dark:text-white">
                  <BriefcaseIcon className="w-4 h-4 text-primary-500" />
                  {t('nav.browseJobs')}
                </Link>
                {categories.map(cat => (
                  <div key={cat._id}>
                    <Link to={categoryLink('jobs')(cat)} onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 pl-9 pr-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700">
                      <CategoryIcon icon={cat.icon} size={16} className="w-5 text-center flex-shrink-0" />
                      <span className="truncate">{cat.name}</span>
                    </Link>
                    {cat.subcategories?.length > 0 && (
                      <div className="pl-12 pr-2">
                        {cat.subcategories.map(sub => (
                          <Link key={sub._id} to={categoryLink('jobs')(cat, sub)} onClick={() => setMobileOpen(false)}
                            className="block px-2 py-1.5 rounded-md text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700">
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

                <Link to="/freelancers" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-gray-900 dark:text-white">
                  <UsersIcon className="w-4 h-4 text-primary-500" />
                  {t('nav.findTalentShort')}
                </Link>
                {categories.map(cat => (
                  <div key={cat._id}>
                    <Link to={categoryLink('freelancers')(cat)} onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 pl-9 pr-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700">
                      <CategoryIcon icon={cat.icon} size={16} className="w-5 text-center flex-shrink-0" />
                      <span className="truncate">{cat.name}</span>
                    </Link>
                    {cat.subcategories?.length > 0 && (
                      <div className="pl-12 pr-2">
                        {cat.subcategories.map(sub => (
                          <Link key={sub._id} to={categoryLink('freelancers')(cat, sub)} onClick={() => setMobileOpen(false)}
                            className="block px-2 py-1.5 rounded-md text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700">
                            {subcategoryToProfession(sub.name)}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

                {plainLinks.map(l => (
                  <Link key={l.to} to={l.to} onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700">
                    {l.label}
                  </Link>
                ))}
                {!user && <>
                  <Link to="/auth/login" onClick={() => setMobileOpen(false)} className="block btn-secondary btn-sm w-full text-center mt-2">{t('nav.logIn')}</Link>
                  <Link to="/auth/register" onClick={() => setMobileOpen(false)} className="block btn-primary btn-sm w-full text-center mt-2">{t('nav.signUp')}</Link>
                </>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1"><Outlet /></main>
      <AIChatWidget />
      <Footer />
    </div>
  );
}
