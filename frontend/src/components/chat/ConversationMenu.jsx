import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckIcon, EnvelopeOpenIcon, EnvelopeIcon, BookmarkIcon, BookmarkSlashIcon,
  BellIcon, BellSlashIcon, ArchiveBoxIcon, TrashIcon, NoSymbolIcon, FlagIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
}

export default function ConversationMenu({ open, onOpen, onClose, onAction, isPinned, isMuted, isBlocked, hasUnread }) {
  const [asSheet, setAsSheet] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 12, left: null });
  const anchorRef = useRef(null);
  const menuRef = useRef(null);

  const openMenu = () => {
    onOpen?.();
    const mobile = isMobile();
    setAsSheet(mobile);
    if (!mobile && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
        left: null,
      });
    }
  };

  useLayoutEffect(() => {
    if (!open || asSheet || !menuRef.current) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    let { top } = menuPos;
    if (menuRect.height > 0 && top + menuRect.height > vh - 8) {
      top = Math.max(8, vh - menuRect.height - 8);
    }
    setMenuPos((prev) => ({ ...prev, top }));
  }, [open, asSheet, menuPos.top]);

  const run = (action) => {
    onClose();
    onAction?.(action);
  };

  const items = [
    hasUnread
      ? { key: 'markRead', label: 'Mark as read', icon: CheckIcon }
      : { key: 'markUnread', label: 'Mark as unread', icon: EnvelopeIcon },
    isPinned
      ? { key: 'isPinned', label: 'Unpin conversation', icon: BookmarkSlashIcon }
      : { key: 'isPinned', label: 'Pin conversation', icon: BookmarkIcon },
    isMuted
      ? { key: 'isMuted', label: 'Unmute notifications', icon: BellIcon }
      : { key: 'isMuted', label: 'Mute notifications', icon: BellSlashIcon },
    { key: 'isArchived', label: 'Archive conversation', icon: ArchiveBoxIcon },
    isBlocked
      ? { key: 'isBlocked', label: 'Unblock user', icon: NoSymbolIcon }
      : { key: 'isBlocked', label: 'Block user', icon: NoSymbolIcon },
  ];

  const renderItem = ({ key, label, icon: Icon }) => (
    <button key={key} onClick={() => run(key)} role="menuitem"
      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </button>
  );

  return (
    <>
      <button ref={anchorRef} onClick={openMenu}
        className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
        title="Conversation actions" aria-label="Conversation actions" aria-haspopup="menu" aria-expanded={open}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
        </svg>
      </button>

      <AnimatePresence>
        {open && !asSheet && (
          <>
            <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
            <motion.div ref={menuRef}
              initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }} role="menu"
              className="fixed z-50 min-w-[210px] bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1.5"
              style={{ top: menuPos.top, right: menuPos.right }}>
              {items.map(renderItem)}
              <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
              <button onClick={() => run('report')} role="menuitem"
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
                <FlagIcon className="w-4 h-4 flex-shrink-0" />
                <span>Report user</span>
              </button>
              <button onClick={() => run('deleteConversation')} role="menuitem"
                className={clsx('w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20')}>
                <TrashIcon className="w-4 h-4 flex-shrink-0" />
                <span>Delete conversation</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && asSheet && (
          <>
            <motion.div className="fixed inset-0 bg-black/40 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }} role="menu"
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-dark-800 rounded-t-2xl shadow-2xl p-2 pb-6">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto mb-2" />
              {items.map(renderItem)}
              <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
              <button onClick={() => run('report')} role="menuitem"
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
                <FlagIcon className="w-4 h-4 flex-shrink-0" />
                <span>Report user</span>
              </button>
              <button onClick={() => run('deleteConversation')} role="menuitem"
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <TrashIcon className="w-4 h-4 flex-shrink-0" />
                <span>Delete conversation</span>
              </button>
              <button onClick={onClose}
                className="w-full mt-1 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 rounded-xl transition-colors">
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
