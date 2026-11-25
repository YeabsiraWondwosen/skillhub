import { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageService } from '@/services/message.service';
import {
  FaceSmileIcon, EllipsisVerticalIcon, PencilIcon, TrashIcon,
  ForwardIcon, FlagIcon, ClipboardDocumentIcon, ArrowUturnLeftIcon,
  StarIcon as StarOutline, BookmarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon, BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥'];

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
}

export default function MessageActions({
  message,
  isMine,
  currentUserId,
  onReply,
  onForward,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onPin,
  onStar,
  onReport,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [asSheet, setAsSheet] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, right: null, align: 'left' });
  const anchorRef = useRef(null);
  const menuRef = useRef(null);
  const pickerRef = useRef(null);
  const qc = useQueryClient();

  const reactionMut = useMutation({
    mutationFn: (emoji) => messageService.toggleReaction(message._id, emoji),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', message.conversation] });
      setShowEmojiPicker(false);
    },
    onError: () => toast.error('Unable to add reaction'),
  });

  const toggleReaction = (emoji) => {
    if (reactionMut.isPending) return;
    reactionMut.mutate(emoji);
  };

  // Close the emoji picker on Escape or outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowEmojiPicker(false); };
    const onPointer = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowEmojiPicker(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [showEmojiPicker]);

  const isPinned = message.pinnedBy?.some((id) => String(id) === String(currentUserId));
  const isStarred = message.starredBy?.some((id) => String(id) === String(currentUserId));
  const reactions = message.reactions || [];

  const groupedReactions = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
    acc[r.emoji].count++;
    acc[r.emoji].users.push(r.user);
    return acc;
  }, {});

  const openMenu = () => {
    const mobile = isMobile();
    setAsSheet(mobile);
    if (!mobile && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        left: isMine ? null : rect.left,
        right: isMine ? window.innerWidth - rect.right : null,
        align: isMine ? 'right' : 'left',
      });
    }
    setShowEmojiPicker(false);
    setShowMenu(true);
  };

  useLayoutEffect(() => {
    if (!showMenu || asSheet || !menuRef.current) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { top, left, right } = menuPos;

    if (menuRect.height > 0 && top + menuRect.height > vh - 8) {
      top = Math.max(8, vh - menuRect.height - 8);
    }
    if (left != null && left + menuRect.width > vw - 8) {
      left = Math.max(8, vw - menuRect.width - 8);
    }
    setMenuPos((prev) => ({ ...prev, top, left, right }));
  }, [showMenu, asSheet, menuPos.left, menuPos.right]);

  const closeMenu = useCallback(() => setShowMenu(false), []);

  const handleCopy = async () => {
    const text = message.content || '';
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast.success('Message copied');
    } catch {
      toast.error('Unable to copy message');
    }
    setShowMenu(false);
  };

  const run = (fn) => {
    setShowMenu(false);
    fn?.();
  };

  const menuItems = [];

  const push = (key, label, icon, onClick, danger = false) => {
    menuItems.push({ key, label, icon, onClick, danger });
  };

  push('reply', 'Reply', ArrowUturnLeftIcon, () => run(onReply));
  push('forward', 'Forward', ForwardIcon, () => run(onForward));
  push('copy', 'Copy', ClipboardDocumentIcon, handleCopy);
  if (isMine) push('edit', 'Edit', PencilIcon, () => run(onEdit));
  push('deleteMe', 'Delete for me', TrashIcon, () => run(onDeleteForMe));
  if (isMine) push('deleteAll', 'Delete for everyone', TrashIcon, () => run(onDeleteForEveryone), true);
  push('pin', isPinned ? 'Unpin' : 'Pin message', isPinned ? BookmarkSolidIcon : BookmarkIcon, () => run(onPin));
  push('star', isStarred ? 'Unstar' : 'Star message', isStarred ? StarSolidIcon : StarOutline, () => run(onStar));
  if (!isMine) push('report', 'Report', FlagIcon, () => run(onReport), true);

  // Split destructive actions at the end
  const normalItems = menuItems.filter((i) => !i.danger);
  const dangerItems = menuItems.filter((i) => i.danger);

  const renderItem = (item) => (
    <button
      key={item.key}
      onClick={item.onClick}
      role="menuitem"
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
        item.danger
          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700'
      )}
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      <span>{item.label}</span>
    </button>
  );

  return (
    <>
      <div className={clsx('transition-opacity', showEmojiPicker || showMenu ? 'opacity-100' : 'md:opacity-0 md:group-hover:opacity-100')}>
        <div className="relative flex items-center gap-0.5">
          {/* Reactions quick action */}
          <button
            onClick={() => setShowEmojiPicker(p => !p)}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            title="React"
            aria-label="React to message"
          >
            <FaceSmileIcon className="w-3.5 h-3.5" />
          </button>
          {/* Three-dot menu */}
          <button
            ref={anchorRef}
            onClick={openMenu}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            title="Message actions"
            aria-label="Message actions"
            aria-haspopup="menu"
            aria-expanded={showMenu}
          >
            <EllipsisVerticalIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            className={clsx(
              'absolute flex items-center gap-1 bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl px-2 py-1.5 z-30',
              isMine ? 'right-0' : 'left-0'
            )}
            style={{ bottom: '100%', marginBottom: 4 }}
            ref={pickerRef}
          >
            {QUICK_EMOJIS.map(emoji => (
              <button key={emoji} onClick={() => toggleReaction(emoji)} disabled={reactionMut.isPending}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-sm disabled:opacity-50"
                title={emoji}>
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop dropdown menu */}
      <AnimatePresence>
        {showMenu && !asSheet && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMenu}
            />
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              role="menu"
              className="fixed z-50 min-w-[200px] bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1.5 overflow-hidden max-h-[70vh] overflow-y-auto"
              style={{
                top: menuPos.top,
                ...(menuPos.align === 'right' ? { right: menuPos.right } : { left: menuPos.left }),
              }}
            >
              {normalItems.map(renderItem)}
              {dangerItems.length > 0 && (
                <>
                  <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                  {dangerItems.map(renderItem)}
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {showMenu && asSheet && (
          <>
            <motion.div className="fixed inset-0 bg-black/40 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeMenu} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              role="menu"
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-dark-800 rounded-t-2xl shadow-2xl p-2 pb-6"
            >
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto mb-2" />
              {normalItems.map(renderItem)}
              {dangerItems.length > 0 && (
                <>
                  <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                  {dangerItems.map(renderItem)}
                </>
              )}
              <button onClick={closeMenu}
                className="w-full mt-1 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 rounded-xl transition-colors">
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Display existing reactions */}
      {Object.keys(groupedReactions).length > 0 && (
        <div className={clsx('flex flex-wrap gap-1 mt-1', isMine ? 'justify-end' : 'justify-start')}>
          {Object.values(groupedReactions).map(({ emoji, count, users }) => {
            const iReacted = users.some(u => String(u) === String(currentUserId));
            return (
              <button key={emoji} onClick={() => toggleReaction(emoji)} disabled={reactionMut.isPending}
                title={`${count} reaction${count > 1 ? 's' : ''}`}
                className={clsx(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors disabled:opacity-60',
                  iReacted
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
                    : 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600'
                )}>
                <span>{emoji}</span>
                <span className="text-gray-500 dark:text-gray-400">{count}</span>
              </button>
            );
          })}
          <button onClick={() => setShowEmojiPicker(p => !p)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-xs text-gray-500 dark:text-gray-400 transition-colors"
            title="Add reaction">
            <FaceSmileIcon className="w-3 h-3" />
            <span>React</span>
          </button>
        </div>
      )}

      {/* Pin indicator */}
      {isPinned && (
        <div className={clsx('flex items-center gap-1 mt-1', isMine ? 'justify-end' : 'justify-start')}>
          <BookmarkSolidIcon className="w-3 h-3 text-primary-500" />
          <span className="text-[10px] text-primary-500">Pinned</span>
        </div>
      )}
    </>
  );
}
