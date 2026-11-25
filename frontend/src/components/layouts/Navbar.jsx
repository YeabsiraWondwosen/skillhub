import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import {
  BellIcon, ChatBubbleLeftEllipsisIcon, SunIcon, MoonIcon,
  Bars3Icon, ChevronDownIcon, MagnifyingGlassIcon,
  HomeIcon, Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { useUnreadCount, useNotifications, useMarkAllAsRead, useMarkAsRead, subscribeToNewNotifications, getNotificationErrorMessage } from '@/hooks/useNotifications';
import { getUnreadNotificationsLabel } from '@/utils/notificationCount';
import Avatar from '@/components/ui/Avatar';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function Navbar({ onMenuToggle }) {
  const { user, isDark, toggleDark } = useAuthStore();
  const { mutate: logout } = useLogout();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: notifData, isLoading: notifLoading, isError: notifError, error: notifErrorData } = useNotifications({ limit: 5 });
  const { mutate: markAllRead } = useMarkAllAsRead();
  const { mutate: markAsRead } = useMarkAsRead();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bellRinging, setBellRinging] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Ring the bell (brief shake + badge pop) only on real socket notifications.
  useEffect(
    () =>
      subscribeToNewNotifications(() => {
        setBellRinging(true);
        const timer = setTimeout(() => setBellRinging(false), 700);
        return () => clearTimeout(timer);
      }),
    []
  );

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/freelancers?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 glass border-b border-gray-200/50 dark:border-white/10">
      <div className="flex h-16 items-center px-4 lg:px-6 gap-3">
        {/* Mobile menu toggle */}
        <button onClick={onMenuToggle} className="btn-icon btn-ghost lg:hidden">
          <Bars3Icon className="w-5 h-5" />
        </button>

        {/* Logo — always links to home */}
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

        <div className="flex-1" />

        {/* Search */}
        <div ref={searchRef} className="relative hidden sm:block">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="btn-icon btn-ghost"
            title={t('nav.search') || 'Search'}
          >
            <MagnifyingGlassIcon className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {searchOpen && (
              <motion.form
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                onSubmit={handleSearch}
                className="absolute right-0 mt-2 w-72"
              >
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('nav.searchPlaceholder') || 'Search freelancers, jobs...'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  />
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Dark mode toggle */}
        <button onClick={toggleDark} className="btn-icon btn-ghost" title={isDark ? 'Light mode' : 'Dark mode'}>
          {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>

        {/* Language toggle */}
        <button
          onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'am' : 'en')}
          className="btn-icon btn-ghost text-xs font-bold"
          title={i18n.language === 'en' ? 'Switch to Amharic' : 'Switch to English'}
        >
          {i18n.language === 'en' ? 'አማ' : 'EN'}
        </button>

        {/* Messages */}
        <Link to="/messages" className="btn-icon btn-ghost relative" title={t('nav.messages') || 'Messages'}>
          <ChatBubbleLeftEllipsisIcon className="w-5 h-5" />
        </Link>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button onClick={() => setNotifOpen(!notifOpen)} className="btn-icon btn-ghost relative" title={t('nav.notifications') || 'Notifications'} aria-label={unreadCount > 0 ? getUnreadNotificationsLabel(unreadCount) : (t('nav.notifications') || 'Notifications')}>
            <motion.span
              animate={bellRinging ? { rotate: [0, -14, 10, -6, 3, 0], scale: [1, 1.08, 1] } : { rotate: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
              className="inline-flex"
            >
              <BellIcon className="w-5 h-5" />
            </motion.span>
            {unreadCount > 0 && (
              <motion.span
                animate={bellRinging ? { scale: [0.6, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 0.35 }}
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-danger-500 to-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-white dark:ring-dark-900"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </button>
          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                className="absolute right-0 mt-2 w-80 card shadow-xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-semibold text-sm">{t('notifications.title')}</h3>
                  {unreadCount > 0 && (
                    <button onClick={() => markAllRead()} className="text-xs text-primary-600 hover:underline">
                      {t('notifications.markAllRead')}
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
                  {notifLoading ? (
                    <div className="p-3 space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                  ) : notifData?.data?.length ? notifData.data.map((n) => (
                    <Link
                      key={n._id}
                      to={n.actionUrl && n.actionUrl !== '#' ? n.actionUrl : '/notifications'}
                      onClick={() => {
                        if (!n.isRead) markAsRead(n._id);
                        setNotifOpen(false);
                      }}
                      className={`flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors ${!n.isRead ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}
                    >
                      {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary-500 shrink-0" />}
                      <div className={!n.isRead ? '' : 'pl-4'}>
                        <p className="text-xs font-medium text-gray-900 dark:text-white">{n.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </Link>
                  )) : notifError ? (
                    <div className="py-8 px-4 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">{getNotificationErrorMessage(notifErrorData)}</p>
                      <p className="text-[11px] text-gray-400 mt-1">We'll keep retrying automatically.</p>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-gray-400">{t('notifications.noNotifications')}</div>
                  )}
                </div>
                <Link
                  to="/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="block text-center text-xs text-primary-600 py-2.5 border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                >
                  {t('notifications.viewAll')}
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
            <Avatar src={user?.avatar?.url} alt={`${user?.firstName} ${user?.lastName}`} size="sm" />
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium leading-none text-gray-900 dark:text-white">{user?.firstName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-0.5">{user?.role}</p>
            </div>
            <ChevronDownIcon className="w-4 h-4 text-gray-400 hidden md:block" />
          </button>
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                className="absolute right-0 mt-2 w-56 card shadow-xl overflow-hidden py-1"
              >
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-400">{user?.email}</p>
                </div>
                <div className="py-1">
                  <Link
                    to="/"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                  >
                    <HomeIcon className="w-4 h-4" />
                    {t('nav.home') || 'Home'}
                  </Link>
                  <Link
                    to={user?.role === 'freelancer' ? '/freelancer/dashboard' : user?.role === 'admin' ? '/admin/dashboard' : '/client/dashboard'}
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                  >
                    <Squares2X2Icon className="w-4 h-4" />
                    {t('profile.dashboard') || 'Dashboard'}
                  </Link>
                  {user?.role === 'freelancer' && (
                    <Link
                      to="/freelancer/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                    >
                      {t('profile.myProfile') || 'My Profile'}
                    </Link>
                  )}
                  <Link
                    to="/messages"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                  >
                    <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
                    {t('profile.messages') || 'Messages'}
                  </Link>
                  {user?.role !== 'admin' && (
                    <Link
                      to="/payments/wallet"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                    >
                      {t('profile.wallet') || 'Wallet'}
                    </Link>
                  )}
                  <Link
                    to={user?.role === 'admin' ? '/admin/support' : '/support'}
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                  >
                    {t('profile.helpAndSupport') || 'Help & Support'}
                  </Link>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                  <button
                    onClick={() => { setProfileOpen(false); logout(); }}
                    className="w-full text-left px-4 py-2 text-sm text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                  >
                    {t('profile.signOut') || 'Sign Out'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
