import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import UnreadNotificationBadge from '@/components/ui/UnreadNotificationBadge';
import { buildSidebarNav } from './sidebarNav';
import { ChevronDownIcon, ChevronRightIcon, ChevronLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState({});
  const collapseKey = `skillhub:sidebarCollapsed:${user?.role || 'guest'}`;
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(`skillhub:sidebarCollapsed:${user?.role || 'guest'}`) === 'true';
  });

  useEffect(() => {
    window.localStorage.setItem(collapseKey, String(collapsed));
  }, [collapsed, collapseKey]);

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCollapsed = () => setCollapsed(prev => !prev);

  const nav = buildSidebarNav({ role: user?.role, t, userId: user?._id });

  const renderGroup = (group) => {
    const groupKey = group.label;
    const hasActiveChild = group.section.some(child =>
      location.pathname === child.to || location.pathname.startsWith(`${child.to}/`)
    );
    const isExpanded = expandedGroups[groupKey] !== undefined ? expandedGroups[groupKey] : true;

    return (
      <div key={groupKey} className="pt-5">
        <button
          onClick={() => toggleGroup(groupKey)}
          aria-expanded={isExpanded}
          className={clsx(
            'w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors cursor-pointer select-none group',
            hasActiveChild
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
          )}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider">{group.label}</span>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
            <ChevronDownIcon className="w-3.5 h-3.5 opacity-50" />
          </motion.div>
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-1 space-y-0.5">
                {group.section.map(child => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    end={child.to === '/admin/finance'}
                    onClick={() => onClose?.()}
                    className={({ isActive }) =>
                      clsx(
                        'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                        isActive &&
                          'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-full before:bg-primary-500 dark:before:bg-primary-400 before:content-[\'\']',
                        isActive
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
                      )
                    }
                  >
                    <child.icon className="w-5 h-5 shrink-0" />
                    {child.label}
                    {child.showUnreadBadge && <UnreadNotificationBadge className="ml-auto shrink-0" />}
                  </NavLink>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderNavItem = (item) => {
    if (item.section) return renderGroup(item);

    if (item.children) {
      const groupKey = item.label;
      const hasActiveChild = item.children.some(child => location.pathname === child.to);
      const isExpanded = expandedGroups[groupKey] !== undefined ? expandedGroups[groupKey] : hasActiveChild;

      return (
        <div key={groupKey}>
          <button
            onClick={() => toggleGroup(groupKey)}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all duration-150',
              hasActiveChild
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDownIcon className="w-4 h-4 shrink-0 opacity-50" />
            </motion.div>
          </button>
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 dark:border-gray-700 pl-3">
                  {item.children.map(child => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.to === '/admin/finance'}
                      onClick={() => onClose?.()}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150',
                          isActive
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'text-gray-500 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-700 dark:hover:text-gray-300'
                        )
                      }
                    >
                      {child.label}
                      {child.showUnreadBadge && <UnreadNotificationBadge className="ml-auto shrink-0" />}
                    </NavLink>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === '/freelancer/dashboard' || item.to === '/client/dashboard' || item.to === '/admin/dashboard'}
        onClick={() => onClose?.()}
        className={({ isActive }) =>
          clsx('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
            isActive
              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
          )
        }
      >
        <item.icon className="w-5 h-5 shrink-0" />
        {item.label}
      </NavLink>
    );
  };

  const flatNav = nav.reduce((acc, item) => {
    if (item.section) return acc.concat(item.section);
    return acc.concat(item);
  }, []);

  const renderCollapsedNav = () => (
    <div className="flex flex-col items-center gap-1 py-1">
      {flatNav.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/admin/finance' || /^\/(admin|freelancer|client)\/dashboard$/.test(item.to)}
          onClick={() => onClose?.()}
          title={item.label}
          aria-label={item.label}
          className={({ isActive }) =>
            clsx(
              'relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors',
              isActive
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
            )
          }
        >
          <item.icon className="w-5 h-5 shrink-0" />
          {item.showUnreadBadge && (
            <UnreadNotificationBadge className="absolute -top-0.5 -right-0.5" />
          )}
        </NavLink>
      ))}
    </div>
  );

  // NOTE: this must stay a plain render function called inline (never a
  // component used as <SidebarContent/>). Defining it as a component inside
  // this render function would give it a NEW function identity on every render,
  // making React unmount/remount the whole subtree and resetting the nav
  // container's scrollTop to 0 — the sidebar "jumps" back to the top.
  const renderSidebarContent = (mobile = false) => {
    const rail = collapsed && !mobile;
    return (
      <div className="flex flex-1 flex-col min-h-0">
        {/* Pinned header: role label + collapse toggle (never scrolls away) */}
        <div className={clsx('flex items-center gap-2 shrink-0', rail ? 'justify-center px-0' : 'px-3', mobile ? 'pt-3 pb-0' : 'pt-4 pb-1')}>
          {!rail && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {user?.role === 'admin' ? t('sidebar.adminPanel') : user?.role === 'freelancer' ? t('sidebar.freelancer') : t('sidebar.client')}
            </p>
          )}
          {!mobile && (
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="btn-icon btn-ghost shrink-0"
            >
              {collapsed ? (
                <ChevronRightIcon className="w-4 h-4" />
              ) : (
                <ChevronLeftIcon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Single independently scrollable region — the only overflow container
            in the sidebar. Overflows do not chain to the page. */}
        <div className={clsx('flex-1 min-h-0 overflow-y-auto overscroll-contain pt-1 pb-4 space-y-0.5', rail ? 'px-2' : 'px-3')}>
          {rail ? renderCollapsedNav() : nav.map(renderNavItem)}
        </div>

        {/* Pinned footer */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-700/50 space-y-0.5 shrink-0">
          {!rail && (
            <div className="px-3 py-2 rounded-lg bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20">
              <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">{t('sidebar.pro')}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{t('sidebar.tagline')}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col self-start bg-white dark:bg-dark-900/80 backdrop-blur-xl border-r border-gray-100 dark:border-white/10 h-[calc(100vh-4rem)] sticky top-16 overflow-hidden transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {renderSidebarContent()}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-64 bg-white dark:bg-dark-900/95 backdrop-blur-xl shadow-2xl lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 dark:border-gray-700 shrink-0">
                <span className="font-bold text-gradient">SkillHub</span>
                <button onClick={onClose} className="btn-icon btn-ghost">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              {renderSidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
