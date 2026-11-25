// Shared formatting for the unread-notification badge.
//
// The same helpers feed the top-header bell, the sidebar nav item and the
// compact (icon-only) rail so the badge value and its accessible label stay
// identical everywhere. Kept free of React/browser APIs so it can be unit
// tested with the project's `node --test` setup.

export const formatNotificationCount = (count) => {
  const value = Number(count);
  if (!Number.isFinite(value) || value <= 0) return '0';
  return value > 99 ? '99+' : String(Math.floor(value));
};

export const getUnreadNotificationsLabel = (count) => {
  const value = Number(count);
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${formatNotificationCount(safe)} unread notification${safe === 1 ? '' : 's'}`;
};
