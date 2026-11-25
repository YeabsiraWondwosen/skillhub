import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '@/services/notification.service';
import { getSocket, onNewNotification } from '@/services/socket';
import { playNotificationSound } from '@/utils/notificationSound';
import { subscribe as subscribeToBus, emit as emitToBus } from '@/utils/notificationBus';
import { BellIcon } from '@heroicons/react/24/outline';

export const useNotifications = (params) =>
  useQuery({ queryKey: ['notifications', params], queryFn: () => notificationService.getAll(params).then(r => r.data), refetchInterval: 30000 });

// Without params returns the global unread count (navbar bell). With params
// (e.g. { category, aiOnly }) returns the unread count scoped to the current
// filter, so a page header can never contradict the list it accompanies.
export const useUnreadCount = (params) =>
  useQuery({
    queryKey: params ? ['notifications', 'unread', params] : ['notifications', 'unread'],
    queryFn: () => notificationService.getUnreadCount(params).then(r => r.data?.data?.total ?? 0),
    refetchInterval: 15000,
  });

// ─── Cache helpers ───────────────────────────────────────────────────────────
// Main notification list queries are shaped ['notifications', params] where
// params is an object (e.g. { limit: 5 }). The unread count and preferences
// queries live at ['notifications','unread'] / ['notifications','preferences'].
const isMainListQuery = (entry) =>
  Array.isArray(entry.queryKey) &&
  entry.queryKey[0] === 'notifications' &&
  entry.queryKey[1] &&
  typeof entry.queryKey[1] === 'object';

const listCaches = (qc) => qc.getQueriesData({ queryKey: ['notifications'] }).filter(isMainListQuery);

// The server emits every created notification over the socket, but polls and
// refetches re-deliver the same records. Dedupe by _id so a record that is
// already in a cached list is treated as a refresh echo, never as a new one.
const isInAnyListCache = (qc, notificationId) =>
  listCaches(qc).some(([, cache]) => Array.isArray(cache?.data) && cache.data.some((n) => n?._id === notificationId));

const prependToListCaches = (qc, notification) => {
  listCaches(qc).forEach(([key, cache]) => {
    if (!Array.isArray(cache?.data)) return;
    if (cache.data.some((n) => n?._id === notification._id)) return;
    qc.setQueryData(key, { ...cache, data: [notification, ...cache.data] });
  });
};

const patchInListCaches = (qc, notificationId, patch) => {
  listCaches(qc).forEach(([key, cache]) => {
    if (!Array.isArray(cache?.data)) return;
    const next = cache.data.map((n) => (n?._id === notificationId ? { ...n, ...patch } : n));
    qc.setQueryData(key, { ...cache, data: next });
  });
};

const invalidateMainQueries = (qc) =>
  qc.invalidateQueries({
    queryKey: ['notifications'],
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'notifications' &&
      (query.queryKey[1] === 'unread' || (query.queryKey[1] && typeof query.queryKey[1] === 'object')),
  });

// Friendly error messages for the 401/403/500 cases surfaced in the UI.
export const getNotificationErrorMessage = (error) => {
  const status = error?.response?.status;
  if (status === 401) return 'Your session expired. Please log in again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'Notification not found. It may have been removed.';
  if (status === 500 || status === 502 || status === 503 || status === 504)
    return 'The notifications service is having trouble right now. Please try again in a moment.';
  return error?.response?.data?.message || 'Something went wrong loading notifications.';
};

// ─── Time helpers ────────────────────────────────────────────────────────────
export const timeAgo = (date) => {
  if (!date) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

// ─── Real-time fan-out (bell animation) ──────────────────────────────────────
// Delegates to the shared, deduplicating bus so repeated subscriptions of the
// same listener (StrictMode re-runs, multiple mounts) are collapsed to one.
export const subscribeToNewNotifications = (listener) => subscribeToBus(listener);

// ─── Real-time socket integration ────────────────────────────────────────────
export const useNotificationRealtime = () => {
  const qc = useQueryClient();
  useEffect(() => {
    const unsub = onNewNotification((notification) => {
      if (!notification?._id) return;
      if (isInAnyListCache(qc, notification._id)) return;

      const unreadCount = qc.getQueryData(['notifications', 'unread']);
      qc.setQueryData(['notifications', 'unread'], typeof unreadCount === 'number' ? unreadCount + 1 : 1);
      prependToListCaches(qc, notification);
      invalidateMainQueries(qc);

      emitToBus(notification);
      playNotificationSound();

      if (notification.title || notification.message) {
        // Key the toast by notification id so the same record delivered twice
        // (duplicate socket emit / refetch echo) replaces its toast instead of
        // stacking a second one. Distinct notifications keep distinct toasts.
        toast.custom((t) => <NotificationToast notification={notification} toastId={t.id} />, {
          duration: 500,
          id: `notif-${notification._id}`,
        });
      }
    });
    return unsub;
  }, [qc]);
  return getSocket()?.connected;
};

function NotificationToast({ notification, toastId }) {
  const navigate = useNavigate();
  const markAsRead = useMarkAsRead();
  const handleClick = () => {
    const target = notification?.actionUrl || '/notifications';
    toast.dismiss(toastId);
    if (notification?._id && !notification?.isRead) markAsRead.mutate(notification._id);
    navigate(target);
  };
  return (
    <button
      onClick={handleClick}
      className="flex items-start gap-3 w-full max-w-sm rounded-xl bg-white dark:bg-dark-800 p-3 pr-4 text-left shadow-lg ring-1 ring-gray-200 dark:ring-dark-700 hover:shadow-xl transition-shadow"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md">
        <BellIcon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{notification.title}</span>
        {notification.message && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-gray-600 dark:text-gray-300">{notification.message}</span>
        )}
        <span className="mt-1 block text-[11px] font-medium text-indigo-500 dark:text-indigo-400">{timeAgo(notification.createdAt)}</span>
      </span>
      <span className="mt-1 shrink-0 text-[11px] font-semibold text-indigo-500 dark:text-indigo-400">View</span>
    </button>
  );
}

// ─── Browser tab badge ───────────────────────────────────────────────────────
const BASE_TITLE = 'SkillHub - Freelance Platform for Web Developers';

// Shows the unread count in the browser tab (e.g. "(3) SkillHub") so the user
// can see new notifications even when the app is not the active tab.
export const useNotificationTabBadge = () => {
  const { data: unread = 0 } = useUnreadCount();
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) ${BASE_TITLE}` : BASE_TITLE;
  }, [unread]);
};

export const useMarkAsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: (_data, id) => {
      patchInListCaches(qc, id, { isRead: true });
      const unreadCount = qc.getQueryData(['notifications', 'unread']);
      if (typeof unreadCount === 'number') {
        qc.setQueryData(['notifications', 'unread'], Math.max(0, unreadCount - 1));
      }
      invalidateMainQueries(qc);
    },
  });
};

export const useMarkAllAsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      listCaches(qc).forEach(([key, cache]) => {
        if (!Array.isArray(cache?.data)) return;
        qc.setQueryData(key, { ...cache, data: cache.data.map((n) => ({ ...n, isRead: true })) });
      });
      qc.setQueryData(['notifications', 'unread'], 0);
      invalidateMainQueries(qc);
    },
  });
};

export const useDismissNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationService.dismissNotification,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

// AI notification hooks
export const useAiRecommendations = (params) =>
  useQuery({
    queryKey: ['notifications', 'ai-recommendations', params],
    queryFn: () => notificationService.getAiRecommendations(params).then(r => r.data),
    refetchInterval: 60000,
  });

export const useNotificationPreferences = () =>
  useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => notificationService.getPreferences().then(r => r.data),
  });

export const useUpdateNotificationPreferences = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationService.updatePreferences,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'preferences'] });
      toast.success('Notification preferences saved');
    },
    onError: (e) =>
      toast.error(e.response?.data?.message || 'Failed to save notification preferences'),
  });
};

export const useTriggerAiNotifications = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationService.triggerAiNotifications,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

export const useTriggerSpecificAi = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type) => notificationService.triggerSpecificAi(type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

export const useAiStats = (params) =>
  useQuery({
    queryKey: ['notifications', 'ai-stats', params],
    queryFn: () => notificationService.getAiStats(params).then(r => r.data),
  });
