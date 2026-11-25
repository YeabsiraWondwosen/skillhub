import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BellIcon, CheckCircleIcon, TrashIcon, SparklesIcon, XMarkIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline';
import {
  useNotifications, useMarkAsRead, useMarkAllAsRead, useDismissNotification,
  useAiRecommendations, useUnreadCount, getNotificationErrorMessage,
} from '@/hooks/useNotifications';
import {
  NOTIFICATION_TABS, RECOMMENDATIONS_TAB, buildNotificationQuery,
  unreadCountQuery, entityLabel, notificationTarget, hasNotificationTarget,
} from '@/utils/notificationFilters';
import { notificationService } from '@/services/notification.service';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { BriefcaseBusiness, Folder, CreditCard, MessageCircle, Settings, User, Sparkles, Lightbulb } from 'lucide-react';

const TYPE_COLORS = {
  job_application_accepted: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  payment_received: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  project_completed: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
  new_message: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  review_received: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
};

const PRIORITY_BADGES = {
  urgent: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  high: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  medium: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  low: 'bg-gray-100 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

const CATEGORY_ICONS = {
  job: BriefcaseBusiness,
  project: Folder,
  payment: CreditCard,
  message: MessageCircle,
  system: Settings,
  social: User,
  ai: Sparkles,
};

function PriorityBadge({ priority }) {
  if (!priority || priority === 'low') return null;
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border', PRIORITY_BADGES[priority])}>
      {priority.toUpperCase()}
    </span>
  );
}

function CategoryIcon({ category }) {
  const Icon = CATEGORY_ICONS[category];
  if (!Icon) return null;
  return <Icon size={18} className="text-gray-500 dark:text-gray-400" title={category} aria-hidden="true" />;
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showAiOnly, setShowAiOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'ai' | category
  const qc = useQueryClient();

  // All filtering (category tab, unread-only, AI-only) is applied server-side
  // so the list, count and pagination always describe the same result set.
  const { data, isLoading, isError, error } = useNotifications(
    buildNotificationQuery({ activeTab, unreadOnly, aiOnly: showAiOnly, page, limit: 15 })
  );

  const { data: aiRecs, isLoading: aiLoading } = useAiRecommendations({ limit: 10 });
  const { data: unreadData } = useUnreadCount(unreadCountQuery({ activeTab, aiOnly: showAiOnly }));

  const { mutate: markAsRead } = useMarkAsRead();
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllAsRead();
  const { mutate: dismiss } = useDismissNotification();

  const { mutate: deleteNotif } = useMutation({
    mutationFn: (id) => notificationService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: () => toast.error('Failed to delete notification'),
  });

  const notifications = data?.data ?? [];
  const meta = data?.meta;
  const recommendations = aiRecs?.data ?? [];
  const aiTotal = aiRecs?.meta?.total ?? recommendations.length;
  const total = meta?.total ?? 0;
  const unread = meta?.unread ?? unreadData ?? 0;
  const isAiTab = activeTab === RECOMMENDATIONS_TAB;

  const handleClick = (n) => {
    if (!n.isRead) markAsRead(n._id);
  };

  const handleDismiss = (n) => {
    dismiss(n._id);
  };

  return (
    <div className="page-container max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <BellIcon className="w-7 h-7 text-primary-600" />
            Notifications
          </h1>
          <p className="section-sub">
            {total} notification{total !== 1 ? 's' : ''}
            {unread > 0 && ` · ${unread} unread`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={e => { setUnreadOnly(e.target.checked); setPage(1); }}
              className="w-4 h-4 rounded text-primary-600"
            />
            Unread only
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-primary-600">
            <input
              type="checkbox"
              checked={showAiOnly}
              onChange={e => { setShowAiOnly(e.target.checked); setPage(1); }}
              className="w-4 h-4 rounded text-primary-600"
            />
            <SparklesIcon className="w-3.5 h-3.5" />
            AI only
          </label>
          <button
            onClick={() => markAllRead()}
            disabled={isMarkingAll}
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            <CheckCircleIcon className="w-4 h-4" />
            Mark all read
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
        {NOTIFICATION_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setPage(1); }}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            )}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => { setActiveTab(RECOMMENDATIONS_TAB); setPage(1); }}
          className={clsx(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
            isAiTab
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          )}
        >
          <SparklesIcon className="w-4 h-4" />
          AI Recommendations
          {aiTotal > 0 && (
            <span className="ml-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs px-1.5 py-0.5 rounded-full">
              {aiTotal}
            </span>
          )}
        </button>
      </div>

      {/* AI Recommendations tab content */}
      {isAiTab && (
        <div className="space-y-3">
          {aiLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : recommendations.length === 0 ? (
            <EmptyState
              icon={SparklesIcon}
              title="No AI recommendations"
              description="AI-powered suggestions will appear here as we analyze your activity."
            />
          ) : (
            recommendations.map((rec, i) => (
              <motion.div
                key={rec._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={clsx(
                  'card p-4 border-l-4 transition-all',
                  rec.priority === 'urgent' && 'border-l-red-500 bg-red-50/30 dark:bg-red-900/10',
                  rec.priority === 'high' && 'border-l-orange-500 bg-orange-50/30 dark:bg-orange-900/10',
                  rec.priority === 'medium' && 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10',
                  rec.priority === 'low' && 'border-l-gray-300 dark:border-l-gray-600',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <CategoryIcon category={rec.category} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{rec.title}</h3>
                      <PriorityBadge priority={rec.priority} />
                      {rec.aiConfidence > 0 && (
                        <span className="text-[10px] text-gray-400">
                          {Math.round(rec.aiConfidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{rec.message}</p>
                    {rec.aiReasoning && (
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 italic mt-1 flex items-start gap-1">
                        <Lightbulb size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" /> {rec.aiReasoning}
                      </p>
                    )}
                    {rec.actions?.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        {rec.actions.map((action, j) => (
                          <Link
                            key={j}
                            to={action.url}
                            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            {action.label}
                            <ArrowRightIcon className="w-3 h-3" />
                          </Link>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      {formatDistanceToNow(new Date(rec.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDismiss(rec)}
                    className="btn-icon btn-ghost text-gray-400 hover:text-gray-600 flex-shrink-0"
                    title="Dismiss"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Notification list — every tab except the AI recommendations tab */}
      {!isAiTab && (
        isError ? (
          <EmptyState
            icon={BellIcon}
            title="Couldn't load notifications"
            description={getNotificationErrorMessage(error)}
          />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={BellIcon}
            title="No notifications"
            description={
              unreadOnly
                ? 'You have no unread notifications.'
                : activeTab !== 'all'
                  ? 'No notifications in this category.'
                  : 'You have no notifications yet.'
            }
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((n, i) => (
              <motion.div
                key={n._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={clsx(
                  'card p-4 flex items-start gap-3 transition-all',
                  !n.isRead && 'border-l-4 border-l-primary-500 bg-primary-50/30 dark:bg-primary-900/10'
                )}
              >
                <div className="mt-1 flex-shrink-0">
                  {!n.isRead
                    ? <span className="w-2.5 h-2.5 rounded-full bg-primary-500 block" />
                    : <span className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 block" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {n.isAiGenerated && <SparklesIcon className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />}
                    {hasNotificationTarget(n) ? (
                      <Link
                        to={notificationTarget(n)}
                        onClick={() => handleClick(n)}
                        className="block hover:text-primary-600 transition-colors"
                      >
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{n.title}</p>
                      </Link>
                    ) : (
                      <button onClick={() => handleClick(n)} className="text-left w-full">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{n.title}</p>
                      </button>
                    )}
                    <PriorityBadge priority={n.priority} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{n.message}</p>
                  {n.aiReasoning && (
                    <p className="text-[11px] text-gray-400 italic mt-1 flex items-start gap-1">
                      <Lightbulb size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" /> {n.aiReasoning}
                    </p>
                  )}
                  {n.actions?.length > 0 && (
                    <div className="flex items-center gap-2 mt-1.5">
                      {n.actions.map((action, j) => (
                        <Link
                          key={j}
                          to={action.url}
                          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {action.label}
                          <ArrowRightIcon className="w-3 h-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                    <span>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                    {entityLabel(n) && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 capitalize">
                        {entityLabel(n)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!n.isRead && (
                    <button
                      onClick={() => markAsRead(n._id)}
                      className="btn-icon btn-ghost text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                      title="Mark as read"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotif(n._id)}
                    className="btn-icon btn-ghost text-gray-400 hover:text-red-500"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {!isAiTab && <Pagination meta={meta} onPageChange={setPage} />}
    </div>
  );
}
