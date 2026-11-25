import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { messageService } from '@/services/message.service';
import {
  getSocket,
  joinConversation, leaveConversation,
  emitTypingStart, emitTypingStop, emitMessagesRead,
} from '@/services/socket';
import { useAuthStore } from '@/store/authStore';
import Avatar from '@/components/ui/Avatar';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import AIToolsPanel from '@/components/chat/AIToolsPanel';
import MessageActions from '@/components/chat/MessageActions';
import ConversationMenu from '@/components/chat/ConversationMenu';
import ConfirmDialog from '@/components/chat/ConfirmDialog';
import ReportModal from '@/components/chat/ReportModal';
import ProfileCard from '@/components/ui/ProfileCard';
import MeetingBookingModal from '@/components/meetings/MeetingBookingModal';
import {
  PaperAirplaneIcon, PaperClipIcon, ChatBubbleLeftEllipsisIcon,
  SparklesIcon, MagnifyingGlassIcon, XMarkIcon,
  ArrowLeftIcon, StarIcon, BookmarkIcon, ArrowRightCircleIcon,
  PlusIcon, BellSlashIcon, NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

function formatMsgDate(date) {
  const d = new Date(date);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'MMM d, HH:mm');
}

function updateMessageInCache(queryData, updatedMsg) {
  if (!queryData?.data) return queryData;
  const exists = queryData.data.some(m => m._id === updatedMsg._id);
  if (exists) {
    return { ...queryData, data: queryData.data.map(m => m._id === updatedMsg._id ? { ...m, ...updatedMsg } : m) };
  }
  return { ...queryData, data: [...queryData.data, updatedMsg] };
}

function removeMessageFromCache(queryData, messageId) {
  if (!queryData?.data) return queryData;
  return { ...queryData, data: queryData.data.filter(m => m._id !== messageId) };
}

function ConversationItem({ conv, active, onClick, currentUserId, onProfileClick }) {
  const other = conv.participants?.find(p => p._id !== currentUserId);
  const unread = conv.myUnreadCount ?? 0;
  const isPinned = conv.userSettings?.some(s => String(s.user) === String(currentUserId) && s.isPinned);
  const isMuted = conv.userSettings?.some(s => String(s.user) === String(currentUserId) && s.isMuted);
  const isStarred = conv.userSettings?.some(s => String(s.user) === String(currentUserId) && s.isStarred);

  return (
    <button onClick={onClick} className={clsx(
      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-dark-700 relative',
      active ? 'bg-primary-50 dark:bg-primary-900/20 border-r-2 border-primary-600' : ''
    )}>
      <div onClick={e => { e.stopPropagation(); onProfileClick(other?._id); }}>
        <Avatar src={other?.avatar?.url} alt={`${other?.firstName}`} size="md" online={other?.isOnline} className="cursor-pointer hover:ring-primary-300 transition-all" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1">
            <span onClick={e => { e.stopPropagation(); onProfileClick(other?._id); }} className="hover:text-primary-600 cursor-pointer">
              {other?.firstName} {other?.lastName}
            </span>
            {isMuted && <BellSlashIcon className="w-3.5 h-3.5 text-gray-300" />}
          </p>
          {conv.lastMessage?.createdAt && (
            <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
              {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className={clsx('text-xs truncate', conv.lastMessagePreview === 'This message was deleted' ? 'italic text-gray-300 dark:text-gray-600' : 'text-gray-400')}>
            {conv.lastMessagePreview ?? conv.lastMessage?.content ?? 'No messages yet'}
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isPinned && <BookmarkIcon className="w-3 h-3 text-gray-300" />}
            {isStarred && <StarIcon className="w-3 h-3 text-yellow-400" />}
            {unread > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function ReplyPreview({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/10 border-l-2 border-primary-500 text-xs">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-primary-600 dark:text-primary-400">Replying to {[message.sender?.firstName, message.sender?.lastName].filter(Boolean).join(' ') || 'message'}</p>
        <p className="text-gray-500 dark:text-gray-400 truncate">{message.content}</p>
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
        <XMarkIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

const RELATIONSHIP_LABELS = {
  conversation: 'Existing Conversation',
  acceptedProposal: 'Accepted Proposal',
  contract: 'Active Contract',
  project: 'Active Project',
};

function NewConversationDialog({ open, onClose, currentUserId, onCreated }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [creatingId, setCreatingId] = useState(null);
  const qc = useQueryClient();

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await messageService.getEligibleContacts();
      const list = res.data?.data || res.data || [];
      setUsers(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load eligible contacts:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load contacts');
      setUsers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      fetchContacts();
    } else {
      setUsers([]);
      setError(null);
    }
  }, [open, fetchContacts]);

  const visibleUsers = users.filter(u => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return `${u.user?.firstName || ''} ${u.user?.lastName || ''}`.toLowerCase().includes(q);
  });

  const handleStartChat = async (userId) => {
    setCreatingId(userId);
    try {
      const res = await messageService.startConversation(userId);
      const conv = res.data?.data || res.data;
      qc.invalidateQueries({ queryKey: ['conversations'] });
      onCreated(conv._id);
      onClose();
    } catch (err) {
      console.error('Start conversation failed:', err);
      toast.error('Failed to start conversation');
    }
    setCreatingId(null);
  };

  if (!open) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">New Message</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-4 h-4" /></button>
        </div>
        <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search clients or freelancers..."
              className="input text-sm py-2 pl-9 w-full"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-400">Loading contacts...</div>
          ) : error ? (
            <div className="py-10 text-center px-4">
              <p className="text-sm text-red-500 mb-1">{error}</p>
              <button onClick={fetchContacts} className="text-xs text-primary-500 hover:underline">Retry</button>
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="py-10 text-center px-4">
              <ChatBubbleLeftEllipsisIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {query.trim() ? `No results for "${query}"` : 'No eligible contacts yet'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                You can message clients or freelancers after a proposal is accepted, a contract is started, or a project relationship is created.
              </p>
            </div>
          ) : (
            visibleUsers.map(c => {
              const u = c.user;
              return (
                <button
                  key={u._id}
                  onClick={() => handleStartChat(u._id)}
                  disabled={creatingId !== null}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors text-left disabled:opacity-50 border-b border-gray-50 dark:border-gray-700/30 last:border-0"
                >
                  <Avatar src={u.avatar?.url} alt={u.firstName} size="sm" online={u.isOnline} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{u.firstName} {u.lastName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 capitalize">{u.role}</span>
                      {c.relationshipType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                          {RELATIONSHIP_LABELS[c.relationshipType] || c.relationshipType}
                        </span>
                      )}
                    </div>
                  </div>
                  {creatingId === u._id ? (
                    <span className="text-xs text-primary-500">Starting...</span>
                  ) : (
                    <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ForwardDialog({ messageContent, conversations, currentUserId, activeConvId, onClose, onForward, isPending }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const filtered = conversations.filter(c => {
    if (c._id === activeConvId) return false;
    const other = c.participants?.find(p => p._id !== currentUserId);
    const name = `${other?.firstName || ''} ${other?.lastName || ''}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleForward = () => {
    if (selected.size > 0) onForward(Array.from(selected));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Forward Message</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-4 h-4" /></button>
        </div>
        {messageContent && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-dark-700 border-b border-gray-100 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 mb-0.5">Forwarding:</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{messageContent}</p>
          </div>
        )}
        <div className="p-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..."
            className="input text-sm py-2 w-full" autoFocus />
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/30">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              {search ? 'No matching conversations' : 'No other conversations to forward to'}
            </div>
          ) : filtered.map(conv => {
            const other = conv.participants?.find(p => p._id !== currentUserId);
            const isSelected = selected.has(conv._id);
            return (
              <button key={conv._id} onClick={() => toggle(conv._id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-dark-700'}`}>
                <Avatar src={other?.avatar?.url} alt={other?.firstName} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-900 dark:text-white">{other?.firstName} {other?.lastName}</span>
                  <p className="text-[10px] text-gray-400 capitalize">{other?.role}</p>
                </div>
                <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center border transition-colors',
                  isSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300 dark:border-gray-600')}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <button onClick={handleForward} disabled={selected.size === 0 || isPending}
            className="w-full py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50">
            {isPending ? 'Forwarding...' : selected.size > 1 ? `Forward to ${selected.size} chats` : 'Forward'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ChatPage() {
  const { conversationId: paramConvId } = useParams();
  const { user, accessToken } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeConvId, setActiveConvId] = useState(paramConvId ?? null);
  const [messageInput, setMessageInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [showAITools, setShowAITools] = useState(false);
  const [selectedMsgForAI, setSelectedMsgForAI] = useState(null);
  const [forwardMsgId, setForwardMsgId] = useState(null);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewConvDialog, setShowNewConvDialog] = useState(false);
  const [profileCardUserId, setProfileCardUserId] = useState(null);
  const [bookingFreelancer, setBookingFreelancer] = useState(null);
  const [convMenuOpen, setConvMenuOpen] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // { messageId, scope }
  const [reportTarget, setReportTarget] = useState(null); // { type, resourceId, label }
  const [convActionConfirm, setConvActionConfirm] = useState(null); // { action, title, message }
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);

  const { data: convsData, isLoading: convsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messageService.getConversations().then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: msgsData, isLoading: msgsLoading } = useQuery({
    queryKey: ['messages', activeConvId],
    queryFn: () => messageService.getMessages(activeConvId, { limit: 50 }).then(r => r.data),
    enabled: !!activeConvId,
  });

  const { data: pinnedData, isLoading: pinnedLoading } = useQuery({
    queryKey: ['pinned-messages', activeConvId],
    queryFn: () => messageService.getPinnedMessages(activeConvId).then(r => r.data),
    enabled: showPinned && !!activeConvId,
  });

  const { mutate: sendMsg, isPending: isSending } = useMutation({
    mutationFn: ({ convId, fd }) => messageService.sendMessage(convId, fd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', activeConvId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to send message'),
  });

  const { mutate: editMsg, isPending: isEditing } = useMutation({
    mutationFn: ({ messageId, content }) => messageService.editMessage(messageId, content),
    onSuccess: (res) => {
      const updated = res.data?.data;
      qc.setQueryData(['messages', activeConvId], (old) => updateMessageInCache(old, updated));
      qc.invalidateQueries({ queryKey: ['messages', activeConvId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setEditingMsg(null);
      setMessageInput('');
      toast.success('Message edited');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Unable to edit message');
    },
  });

  const { mutate: deleteMsg, isPending: isDeleting } = useMutation({
    mutationFn: ({ messageId, scope }) => messageService.deleteMessage(messageId, scope),
    onSuccess: (res, vars) => {
      if (vars.scope === 'me') {
        qc.setQueryData(['messages', activeConvId], (old) => removeMessageFromCache(old, vars.messageId));
      } else {
        qc.setQueryData(['messages', activeConvId], (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map(m => m._id === vars.messageId
              ? { ...m, isDeleted: true, content: '', attachments: [] }
              : m),
          };
        });
      }
      qc.invalidateQueries({ queryKey: ['messages', activeConvId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['pinned-messages'] });
      setPendingDelete(null);
      setConvActionConfirm(null);
      toast.success(vars.scope === 'me' ? 'Message deleted for you' : 'Message deleted for everyone');
    },
    onError: (err) => {
      setPendingDelete(null);
      setConvActionConfirm(null);
      toast.error(err?.response?.data?.message || 'Unable to delete message');
    },
  });

  const { mutate: pinMsg } = useMutation({
    mutationFn: (messageId) => messageService.togglePin(messageId),
    onSuccess: (res) => {
      const updated = res.data?.data;
      qc.setQueryData(['messages', activeConvId], (old) => updateMessageInCache(old, updated));
      qc.invalidateQueries({ queryKey: ['messages', activeConvId] });
      qc.invalidateQueries({ queryKey: ['pinned-messages'] });
      toast.success(updated?.pinnedBy?.some(id => String(id) === String(user?._id)) ? 'Message pinned' : 'Message unpinned');
    },
    onError: () => toast.error('Unable to pin message'),
  });

  const { mutate: starMsg } = useMutation({
    mutationFn: (messageId) => messageService.toggleStar(messageId),
    onSuccess: (res) => {
      const updated = res.data?.data;
      qc.setQueryData(['messages', activeConvId], (old) => updateMessageInCache(old, updated));
      qc.invalidateQueries({ queryKey: ['messages', activeConvId] });
      toast.success(updated?.starredBy?.some(id => String(id) === String(user?._id)) ? 'Message starred' : 'Message unstarred');
    },
    onError: () => toast.error('Unable to star message'),
  });

  const { mutate: updateConvSettings, isPending: isUpdatingConv } = useMutation({
    mutationFn: ({ convId, action, value }) => messageService.updateConversationSettings(convId, action, value),
    onSuccess: (res, vars) => {
      setConvActionConfirm(null);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (vars.action === 'deleteConversation') {
        qc.setQueryData(['conversations'], (old) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.filter(c => c._id !== vars.convId) };
        });
        setActiveConvId(null);
        setShowPinned(false);
        navigate('/messages', { replace: true });
        toast.success('Conversation deleted for you');
      } else if (vars.action === 'isBlocked') {
        const updated = res.data?.data;
        if (updated) {
          qc.setQueryData(['conversations'], (old) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: old.data.map(c => c._id === updated._id ? { ...c, userSettings: updated.userSettings } : c),
            };
          });
        }
        toast.success(updated?.userSettings?.[0]?.isBlocked ? 'User blocked' : 'User unblocked');
      } else if (vars.action === 'isArchived') {
        toast.success('Conversation archived');
      } else if (vars.action === 'isMuted') {
        toast.success('Notifications muted');
      } else {
        toast.success('Conversation updated');
      }
    },
    onError: (err) => {
      setConvActionConfirm(null);
      toast.error(err?.response?.data?.message || 'Unable to update conversation');
    },
  });

  const { mutate: forwardMsg, isPending: isForwarding } = useMutation({
    mutationFn: ({ messageId, targetConvIds }) => messageService.forwardMessage(messageId, targetConvIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', activeConvId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setForwardMsgId(null);
      toast.success('Message forwarded');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Unable to forward message');
    },
  });

  // Socket setup
  useEffect(() => {
    if (!accessToken) return;
    // The socket lifecycle is owned by the auth store (one shared connection).
    // ChatPage only subscribes to events on that shared instance.
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (msg) => {
      qc.setQueryData(['messages', msg.conversation], (old) => {
        if (!old?.data) return old;
        const alreadyExists = old.data.some(m => m._id === msg._id);
        if (alreadyExists) return old;
        return { ...old, data: [...old.data, msg] };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleEdited = (msg) => {
      qc.setQueryData(['messages', msg.conversation], (old) => updateMessageInCache(old, msg));
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleUpdated = (msg) => {
      qc.setQueryData(['messages', msg.conversation], (old) => updateMessageInCache(old, msg));
      qc.invalidateQueries({ queryKey: ['pinned-messages'] });
    };

    const handleDeleted = ({ messageId, conversationId }) => {
      qc.setQueryData(['messages', conversationId], (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map(m => m._id === messageId ? { ...m, isDeleted: true, content: '', attachments: [] } : m),
        };
      });
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['pinned-messages'] });
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:edited', handleEdited);
    socket.on('message:updated', handleUpdated);
    socket.on('message:deleted', handleDeleted);

    const handleDeletedForMe = ({ messageId, conversationId }) => {
      qc.setQueryData(['messages', conversationId], (old) => removeMessageFromCache(old, messageId));
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleForwarded = () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleConversationUpdated = () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleTypingStart = ({ userId: tid, conversationId }) => {
      setTypingUsers(prev => ({ ...prev, [conversationId]: [...(prev[conversationId] ?? []), tid] }));
    };

    const handleTypingStop = ({ userId: tid, conversationId }) => {
      setTypingUsers(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).filter(id => id !== tid),
      }));
    };

    const handleUserOnline = ({ userId }) => setOnlineUsers(prev => new Set([...prev, userId]));

    const handleUserOffline = ({ userId }) => setOnlineUsers(prev => { const n = new Set(prev); n.delete(userId); return n; });

    socket.on('message:deletedForMe', handleDeletedForMe);
    socket.on('message:forwarded', handleForwarded);
    socket.on('conversation:updated', handleConversationUpdated);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:edited', handleEdited);
      socket.off('message:updated', handleUpdated);
      socket.off('message:deleted', handleDeleted);
      socket.off('message:deletedForMe', handleDeletedForMe);
      socket.off('message:forwarded', handleForwarded);
      socket.off('conversation:updated', handleConversationUpdated);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
    };
  }, [accessToken, qc]);

  useEffect(() => {
    if (!activeConvId) return;
    joinConversation(activeConvId);
    return () => leaveConversation(activeConvId);
  }, [activeConvId]);

  useEffect(() => {
    if (msgsData?.data) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [msgsData?.data?.length]);

  useEffect(() => {
    if (paramConvId && paramConvId !== activeConvId) {
      setActiveConvId(paramConvId);
      setShowPinned(false);
      setConvMenuOpen(false);
    }
  }, [paramConvId]);

  const handleSelectConv = (convId) => {
    setActiveConvId(convId);
    setReplyTo(null);
    setEditingMsg(null);
    setSearchMode(false);
    setShowPinned(false);
    setConvMenuOpen(false);
    navigate(`/messages/${convId}`, { replace: true });
  };

  const handleTyping = useCallback(() => {
    if (!activeConvId) return;
    emitTypingStart(activeConvId);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTypingStop(activeConvId), 2000);
  }, [activeConvId]);

  const handleSend = () => {
    const content = messageInput.trim();
    if (!content && !attachments.length) return;
    if (!activeConvId) return;
    if (convIsBlocked) {
      toast.error('You blocked this user. Unblock them to send messages.');
      return;
    }

    if (editingMsg) {
      editMsg({ messageId: editingMsg._id, content });
      return;
    }

    const fd = new FormData();
    if (content) fd.append('content', content);
    fd.append('messageType', attachments.length ? 'file' : 'text');
    if (replyTo) fd.append('replyTo', replyTo._id);
    attachments.forEach(f => fd.append('files', f));

    sendMsg({ convId: activeConvId, fd }, {
      onSuccess: () => { setMessageInput(''); setAttachments([]); setReplyTo(null); },
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') {
      if (editingMsg) { setEditingMsg(null); setMessageInput(''); }
      if (replyTo) setReplyTo(null);
      setConvMenuOpen(false);
    }
  };

  const handleInsertAIText = (text) => {
    setMessageInput(text);
    messageInputRef.current?.focus();
    setShowAITools(false);
  };

  const handleProfileCardMessage = async (userId) => {
    try {
      const res = await messageService.startConversation(userId);
      const conv = res.data?.data || res.data;
      qc.invalidateQueries({ queryKey: ['conversations'] });
      handleSelectConv(conv._id);
    } catch {
      toast.error('Failed to start conversation');
    }
  };

  const handleDeleteForEveryone = (messageId) => {
    setPendingDelete({ messageId, scope: 'everyone' });
  };

  const scrollToMessage = (id) => {
    const el = document.getElementById(`message-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('ring-2', 'ring-primary-400');
      void el.offsetWidth;
      el.classList.add('ring-2', 'ring-primary-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary-400'), 1800);
    }
  };

  const handleConvAction = (action) => {
    if (!activeConvId) return;
    if (action === 'deleteConversation') {
      setConvActionConfirm({
        action,
        title: 'Delete conversation?',
        message: 'This will remove this conversation from your messages.',
      });
      return;
    }
    if (action === 'isBlocked') {
      setConvActionConfirm({
        action,
        title: convIsBlocked ? 'Unblock user?' : 'Block user?',
        message: convIsBlocked
          ? 'You will be able to send and receive messages from this user again.'
          : 'You will not receive messages from this user. You can unblock them anytime.',
      });
      return;
    }
    if (action === 'report') {
      if (otherUser?._id) {
        setReportTarget({
          type: 'user',
          resourceId: otherUser._id,
          label: `${otherUser.firstName} ${otherUser.lastName}`,
        });
      }
      return;
    }
    updateConvSettings({ convId: activeConvId, action });
  };

  const confirmConvAction = () => {
    if (!convActionConfirm || !activeConvId || isUpdatingConv) return;
    if (convActionConfirm.action === 'deleteConversation' || convActionConfirm.action === 'isBlocked') {
      updateConvSettings({ convId: activeConvId, action: convActionConfirm.action, value: convActionConfirm.action === 'isBlocked' ? !convIsBlocked : undefined });
    }
  };

  const conversations = convsData?.data ?? [];
  const messages = msgsData?.data ?? [];
  const pinnedMessages = pinnedData?.data ?? [];
  const activeConv = conversations.find(c => c._id === activeConvId);
  const otherUser = activeConv?.participants?.find(p => p._id !== user?._id);
  const isTyping = (typingUsers[activeConvId] ?? []).length > 0;

  const myConvSettings = activeConv?.userSettings?.[0];
  const convIsPinned = myConvSettings?.isPinned;
  const convIsMuted = myConvSettings?.isMuted;
  const convIsBlocked = myConvSettings?.isBlocked;
  const convHasUnread = (activeConv?.myUnreadCount ?? 0) > 0;

  const displayedMessages = searchMode && searchQuery
    ? messages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* Conversations sidebar */}
      <div className={clsx(
        'flex-shrink-0 border-r border-gray-100 dark:border-gray-700/50 bg-white dark:bg-dark-800 flex flex-col',
        activeConvId ? 'hidden md:flex w-72' : 'flex w-full md:w-72'
      )}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 font-semibold text-gray-900 dark:text-white flex items-center justify-between">
          <span>Messages</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-normal">{conversations.length}</span>
            <button onClick={() => setShowNewConvDialog(true)}
              className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center hover:bg-primary-200 dark:hover:bg-primary-900/40 transition-colors"
              title="New conversation">
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/30">
          {convsLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <ChatBubbleLeftEllipsisIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">No conversations yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Start a conversation with a freelancer or client</p>
              <button onClick={() => setShowNewConvDialog(true)} className="btn-primary btn-sm">
                <PlusIcon className="w-4 h-4 mr-1" /> New Conversation
              </button>
            </div>
          ) : (
            conversations.map(conv => (
              <ConversationItem key={conv._id} conv={conv} active={conv._id === activeConvId}
                onClick={() => handleSelectConv(conv._id)} currentUserId={user?._id}
                onProfileClick={(id) => id && setProfileCardUserId(id)} />
            ))
          )}
        </div>
      </div>

      {/* Message panel */}
      <div className={clsx('flex-1 flex flex-col min-w-0 relative', !activeConvId && 'hidden md:flex')}>
        {!activeConvId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={ChatBubbleLeftEllipsisIcon} title="Select a conversation"
              description="Choose a conversation from the left to start messaging." />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-dark-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => { setActiveConvId(null); navigate('/messages', { replace: true }); }}
                  className="md:hidden btn-icon btn-ghost">
                  <ArrowLeftIcon className="w-5 h-5" />
                </button>
                {otherUser && (
                  <>
                    <div onClick={() => setProfileCardUserId(otherUser._id)} className="cursor-pointer">
                      <Avatar src={otherUser.avatar?.url} alt={otherUser.firstName} size="sm"
                        online={onlineUsers.has(otherUser._id) || otherUser.isOnline} className="hover:ring-primary-300 transition-all" />
                    </div>
                    <div onClick={() => setProfileCardUserId(otherUser._id)} className="cursor-pointer">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white hover:text-primary-600">
                        {otherUser.firstName} {otherUser.lastName}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{otherUser.role}</p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setShowPinned(!showPinned); }}
                  className={clsx('btn-icon btn-ghost', showPinned ? 'text-primary-500' : 'text-gray-400')}
                  title="Pinned messages">
                  <BookmarkIcon className="w-5 h-5" />
                </button>
                <button onClick={() => { setSearchMode(!searchMode); if (searchMode) setSearchQuery(''); }}
                  className={clsx('btn-icon btn-ghost', searchMode ? 'text-primary-500' : 'text-gray-400')}>
                  <MagnifyingGlassIcon className="w-5 h-5" />
                </button>
                <button onClick={() => setShowAITools(!showAITools)}
                  className={clsx('btn-icon btn-ghost', showAITools ? 'text-primary-500' : 'text-gray-400')}>
                  <SparklesIcon className="w-5 h-5" />
                </button>
                <ConversationMenu
                  open={convMenuOpen}
                  onOpen={() => setConvMenuOpen(true)}
                  onClose={() => setConvMenuOpen(false)}
                  onAction={handleConvAction}
                  isPinned={convIsPinned}
                  isMuted={convIsMuted}
                  isBlocked={convIsBlocked}
                  hasUnread={convHasUnread}
                />
              </div>
            </div>

            {/* Search bar */}
            <AnimatePresence>
              {searchMode && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} className="border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-dark-800 overflow-hidden">
                  <div className="px-4 py-2 flex items-center gap-2">
                    <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search in conversation..." autoFocus
                      className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400" />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pinned messages panel */}
            <AnimatePresence>
              {showPinned && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-dark-900 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <BookmarkIcon className="w-3.5 h-3.5" /> Pinned messages
                    </p>
                    <button onClick={() => setShowPinned(false)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-4 h-4" /></button>
                  </div>
                  <div className="max-h-40 overflow-y-auto px-4 pb-2 space-y-1.5">
                    {pinnedLoading ? (
                      <p className="text-xs text-gray-400">Loading pinned messages...</p>
                    ) : pinnedMessages.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No pinned messages</p>
                    ) : pinnedMessages.map(pm => (
                      <button key={pm._id} onClick={() => { setShowPinned(false); scrollToMessage(pm._id); }}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700 rounded-lg hover:border-primary-300 transition-colors">
                        <BookmarkIcon className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-gray-900 dark:text-white truncate">
                            {pm.sender?.firstName} {pm.sender?.lastName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{pm.content || 'Attachment'}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{formatMsgDate(pm.createdAt)}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-dark-900">
              {msgsLoading ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
              ) : displayedMessages.length === 0 ? (
                <div className="text-center text-sm text-gray-400 pt-12">
                  {searchMode ? 'No messages match your search' : 'No messages yet. Say hello!'}
                </div>
              ) : (
                displayedMessages.map((msg) => {
                  const isMine = msg.sender?._id === user?._id || msg.sender === user?._id;
                  const replyMsg = msg.replyTo;
                  return (
                    <motion.div key={msg._id} id={`message-${msg._id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={clsx('flex gap-2 group relative rounded-lg transition-all', isMine ? 'flex-row-reverse' : 'flex-row')}
                      onClick={() => setSelectedMsgForAI(msg)}>
                      {!isMine && (
                        <div onClick={() => msg.sender?._id && setProfileCardUserId(msg.sender._id)} className="cursor-pointer">
                          <Avatar src={msg.sender?.avatar?.url} alt={msg.sender?.firstName} size="sm" className="hover:ring-primary-300 transition-all" />
                        </div>
                      )}
                      <div className={clsx('max-w-[70%] space-y-1 flex flex-col', isMine ? 'items-end' : 'items-start')}>
                        {/* Forwarded badge */}
                        {msg.forwardedFrom && !msg.isDeleted && (
                          <div className={clsx(
                            'text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1',
                            isMine
                              ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                              : 'bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400'
                          )}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                            Forwarded from {[msg.forwardedFrom.sender?.firstName, msg.forwardedFrom.sender?.lastName].filter(Boolean).join(' ') || 'user'}
                          </div>
                        )}

                        {/* Reply preview */}
                        {replyMsg && !msg.isDeleted && (
                          <button onClick={() => scrollToMessage(replyMsg._id)}
                            className={clsx(
                              'text-[10px] px-2 py-1 rounded-lg border-l-2 max-w-full truncate text-left transition-colors',
                              isMine
                                ? 'bg-primary-100 dark:bg-primary-900/20 border-primary-400 text-primary-700 dark:text-primary-300 hover:bg-primary-200'
                                : 'bg-gray-100 dark:bg-dark-700 border-gray-300 text-gray-500 dark:text-gray-400 hover:bg-gray-200'
                            )}>
                            Replying to: {replyMsg.content || 'message'}
                          </button>
                        )}

                        {msg.isDeleted ? (
                          <span className="text-xs italic text-gray-400 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-2xl">
                            This message was deleted
                          </span>
                        ) : (
                          <>
                            {!isMine && msg.sender && (
                              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 px-1">
                                {[msg.sender.firstName, msg.sender.lastName].filter(Boolean).join(' ')}
                              </p>
                            )}
                            <div className={clsx(
                              'px-3 py-2 rounded-2xl text-sm leading-relaxed relative',
                              isMine
                                ? 'bg-primary-600 text-white rounded-tr-sm'
                                : 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700 rounded-tl-sm'
                            )}>
                              {msg.content}
                              {msg.isEdited && (
                                <span className={clsx('text-[9px] ml-1', isMine ? 'text-primary-200' : 'text-gray-400')}>(edited)</span>
                              )}
                              {msg.attachments?.length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {msg.attachments.map(a => (
                                    <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer"
                                      className={clsx('flex items-center gap-1 text-xs underline break-all', isMine ? 'text-primary-100' : 'text-primary-600')}>
                                      <PaperClipIcon className="w-3 h-3 flex-shrink-0" />{a.originalName}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Message actions */}
                            <div>
                              <MessageActions
                                message={msg}
                                isMine={isMine}
                                currentUserId={user?._id}
                                onReply={() => setReplyTo(msg)}
                                onEdit={() => { setEditingMsg(msg); setMessageInput(msg.content); messageInputRef.current?.focus(); }}
                                onDeleteForMe={() => deleteMsg({ messageId: msg._id, scope: 'me' })}
                                onDeleteForEveryone={() => handleDeleteForEveryone(msg._id)}
                                onForward={() => setForwardMsgId(msg._id)}
                                onPin={() => pinMsg(msg._id)}
                                onStar={() => starMsg(msg._id)}
                                onReport={() => setReportTarget({ type: 'message', resourceId: msg._id, label: 'message' })}
                              />
                            </div>
                          </>
                        )}
                        <span className="text-[10px] text-gray-400 px-1">
                          {formatMsgDate(msg.createdAt)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
              {isTyping && (
                <div className="flex gap-2 items-center">
                  <Avatar src={otherUser?.avatar?.url} alt={otherUser?.firstName} size="sm" />
                  <div className="bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-2.5">
                    <div className="flex gap-1">
                      {[0, 0.2, 0.4].map(d => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: `${d}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply preview */}
            <ReplyPreview message={replyTo} onClose={() => setReplyTo(null)} />

            {/* Edit indicator */}
            {editingMsg && (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/10 border-l-2 border-yellow-500 text-xs">
                <span className="text-yellow-600 dark:text-yellow-400">Editing message</span>
                <button onClick={() => { setEditingMsg(null); setMessageInput(''); }}
                  className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-dark-800 flex-shrink-0">
              {convIsBlocked && (
                <div className="flex items-center justify-center gap-2 mb-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg">
                  <NoSymbolIcon className="w-4 h-4" />
                  You blocked this user. Messages are disabled until you unblock them.
                </div>
              )}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachments.map((f, i) => (
                    <span key={i} className="badge badge-primary flex items-center gap-1 text-xs">
                      {f.name}
                      <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                        className="hover:text-red-400" aria-label={`Remove ${f.name}`}><XMarkIcon className="w-3.5 h-3.5" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={convIsBlocked}
                  className="btn-icon btn-ghost flex-shrink-0 text-gray-400 disabled:opacity-40">
                  <PaperClipIcon className="w-5 h-5" />
                </button>
                <input ref={fileInputRef} type="file" multiple className="sr-only"
                  onChange={e => setAttachments(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
                <textarea
                  ref={messageInputRef}
                  value={messageInput}
                  disabled={convIsBlocked}
                  onChange={e => { setMessageInput(e.target.value); handleTyping(); }}
                  onKeyDown={handleKeyDown}
                  placeholder={convIsBlocked
                    ? 'This conversation is blocked'
                    : editingMsg ? 'Edit message... (Enter to save, Esc to cancel)' : "Type a message… (Enter to send)"}
                  rows={1}
                  className="input resize-none flex-1 py-2 max-h-32 overflow-y-auto disabled:opacity-50"
                  style={{ minHeight: '40px' }}
                />
                <button onClick={handleSend} disabled={isSending || isEditing || convIsBlocked || (!messageInput.trim() && !attachments.length)}
                  className="btn-primary btn-icon flex-shrink-0 disabled:opacity-40">
                  {isEditing ? 'Saving...' : <PaperAirplaneIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* AI Tools Panel */}
      <AnimatePresence>
        {showAITools && activeConvId && (
          <AIToolsPanel
            conversationId={activeConvId}
            activeMessage={selectedMsgForAI}
            onInsertText={handleInsertAIText}
            onClose={() => setShowAITools(false)}
          />
        )}
      </AnimatePresence>

      {/* Forward Dialog */}
      <AnimatePresence>
        {forwardMsgId && (
          <ForwardDialog
            messageContent={messages.find(m => m._id === forwardMsgId)?.content || ''}
            conversations={conversations}
            currentUserId={user?._id}
            activeConvId={activeConvId}
            onClose={() => setForwardMsgId(null)}
            onForward={(targetConvIds) => forwardMsg({ messageId: forwardMsgId, targetConvIds })}
            isPending={isForwarding}
          />
        )}
      </AnimatePresence>

      {/* New Conversation Dialog */}
      <AnimatePresence>
        {showNewConvDialog && (
          <NewConversationDialog
            open={showNewConvDialog}
            onClose={() => setShowNewConvDialog(false)}
            currentUserId={user?._id}
            onCreated={(convId) => { handleSelectConv(convId); }}
          />
        )}
      </AnimatePresence>

      {/* Profile Card Modal */}
      <ProfileCard
        userId={profileCardUserId}
        open={!!profileCardUserId}
        onClose={() => setProfileCardUserId(null)}
        onMessage={handleProfileCardMessage}
        onBookMeeting={(freelancer) => {
          setProfileCardUserId(null);
          setBookingFreelancer(freelancer);
        }}
      />

      {/* Meeting Booking Modal (reused from the public freelancer profile flow) */}
      <MeetingBookingModal
        open={!!bookingFreelancer}
        onClose={() => setBookingFreelancer(null)}
        freelancer={bookingFreelancer}
      />

      {/* Delete confirmations */}
      <ConfirmDialog
        open={!!pendingDelete}
        title={pendingDelete?.scope === 'everyone' ? 'Delete message for everyone?' : 'Delete message?'}
        message={pendingDelete?.scope === 'everyone'
          ? 'This will remove the message for all participants. This cannot be undone.'
          : 'This will remove the message from your view only.'}
        confirmLabel={pendingDelete?.scope === 'everyone' ? 'Delete for everyone' : 'Delete for me'}
        danger
        isPending={isDeleting}
        onConfirm={() => pendingDelete && deleteMsg(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />

      {/* Conversation action confirmations */}
      <ConfirmDialog
        open={!!convActionConfirm}
        title={convActionConfirm?.title}
        message={convActionConfirm?.message}
        confirmLabel={convActionConfirm?.action === 'deleteConversation' ? 'Delete'
          : convActionConfirm?.action === 'isBlocked' ? (convIsBlocked ? 'Unblock' : 'Block') : 'Confirm'}
        danger
        isPending={isUpdatingConv}
        onConfirm={confirmConvAction}
        onCancel={() => setConvActionConfirm(null)}
      />

      {/* Report Modal */}
      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        resourceType={reportTarget?.type}
        resourceId={reportTarget?.resourceId}
        resourceLabel={reportTarget?.label}
      />
    </div>
  );
}
