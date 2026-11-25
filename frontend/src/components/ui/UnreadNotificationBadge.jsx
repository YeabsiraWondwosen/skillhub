import { clsx } from 'clsx';
import { useUnreadCount } from '@/hooks/useNotifications';
import { formatNotificationCount, getUnreadNotificationsLabel } from '@/utils/notificationCount';

/**
 * Reusable unread-notification count badge.
 *
 * Reads the SAME React Query cache (`['notifications', 'unread']`) as the
 * top-header bell, so both stay synchronized — new socket notifications,
 * mark-as-read, mark-all-as-read, delete and list refresh all flow through
 * the shared query cache without duplication.
 *
 * Hides itself when there is nothing unread (matching the header convention)
 * and caps the display at "99+" so long lists stay compact.
 */
export default function UnreadNotificationBadge({ className }) {
  const { data: unread = 0 } = useUnreadCount();

  if (unread <= 0) return null;

  const label = getUnreadNotificationsLabel(unread);

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full',
        'bg-gradient-to-br from-danger-500 to-rose-600 text-white',
        'text-[10px] font-bold leading-none shadow-md ring-2 ring-white dark:ring-dark-900',
        className
      )}
    >
      {formatNotificationCount(unread)}
    </span>
  );
}