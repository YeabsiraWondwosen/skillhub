import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserGroupIcon, CheckCircleIcon, ClockIcon, ExclamationCircleIcon,
  TrashIcon, StarIcon, ArrowPathIcon, ChatBubbleLeftEllipsisIcon,
} from '@heroicons/react/24/outline';
import { useRemoveMember, useUpdateMemberStatus } from '@/hooks/useTeamHiring';
import { useConfirm } from '@/components/ui/DialogProvider';
import { clsx } from 'clsx';
import { formatRate } from '@/utils/currency';

const STATUS_CONFIG = {
  pending: { color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', icon: ClockIcon, label: 'Pending' },
  invited: { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400', icon: ClockIcon, label: 'Invited' },
  accepted: { color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400', icon: CheckCircleIcon, label: 'Accepted' },
  active: { color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400', icon: CheckCircleIcon, label: 'Active' },
  paused: { color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400', icon: ExclamationCircleIcon, label: 'Paused' },
  declined: { color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400', icon: ExclamationCircleIcon, label: 'Declined' },
  removed: { color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400', icon: TrashIcon, label: 'Removed' },
};

function MemberCard({ member, teamId, onMessage }) {
  const [showActions, setShowActions] = useState(false);
  const confirm = useConfirm();
  const { mutate: updateStatus } = useUpdateMemberStatus();
  const { mutate: removeMember } = useRemoveMember();

  const status = STATUS_CONFIG[member.status] || STATUS_CONFIG.pending;
  const Icon = status.icon;

  const handleRemove = async () => {
    const ok = await confirm({
      title: 'Remove team member',
      message: `Remove ${member.freelancer?.name || 'this member'} from the team? They will lose access to team projects and tasks.`,
      confirmLabel: 'Remove member',
      destructive: true,
    });
    if (ok) removeMember({ teamId, memberId: member._id });
  };

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className={clsx('card p-4 relative', member.status === 'removed' && 'opacity-50')}
      onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {member.freelancer?.avatar ? (
            <img src={member.freelancer.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-primary-600">
              {(member.freelancer?.name || '?')[0]}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {member.freelancer?.name || 'Unknown'}
          </p>
          <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">{member.role}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{member.freelancer?.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', status.color)}>
          <Icon className="w-3 h-3" />
          {status.label}
        </span>
        {member.hourlyRate && (
          <span className="text-[10px] text-gray-500">{formatRate(member.hourlyRate)}</span>
        )}
        {member.weeklyHours && (
          <span className="text-[10px] text-gray-500">{member.weeklyHours}h/wk</span>
        )}
      </div>

      {member.responsibilities?.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] text-gray-400 mb-1">Responsibilities:</p>
          <div className="flex flex-wrap gap-1">
            {member.responsibilities.slice(0, 3).map((r, i) => (
              <span key={i} className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                {r}
              </span>
            ))}
            {member.responsibilities.length > 3 && (
              <span className="text-[10px] text-gray-400">+{member.responsibilities.length - 3}</span>
            )}
          </div>
        </div>
      )}

      {member.performance?.tasksCompleted > 0 && (
        <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500">
          <span>{member.performance.tasksCompleted}/{member.performance.tasksTotal} tasks</span>
          {member.performance.avgRating > 0 && (
            <span className="flex items-center gap-0.5">
              <StarIcon className="w-3 h-3 text-yellow-400" />
              {member.performance.avgRating.toFixed(1)}
            </span>
          )}
        </div>
      )}

      {/* Permissions badges */}
      {member.permissions && (
        <div className="mt-2 flex items-center gap-1">
          {member.permissions.canManageMembers && (
            <span className="text-[9px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 px-1 py-0.5 rounded font-medium">Admin</span>
          )}
          {member.permissions.canManageBudget && (
            <span className="text-[9px] bg-green-100 dark:bg-green-900/30 text-green-600 px-1 py-0.5 rounded font-medium">Budget</span>
          )}
          {member.permissions.canManageMilestones && (
            <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-1 py-0.5 rounded font-medium">Milestones</span>
          )}
        </div>
      )}

      {/* Actions overlay */}
      <AnimatePresence>
        {showActions && member.status !== 'removed' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute top-2 right-2 flex items-center gap-1">
            {onMessage && (
              <button onClick={() => onMessage(member)} className="p-1 rounded bg-white dark:bg-gray-700 shadow text-gray-500 hover:text-primary-600">
                <ChatBubbleLeftEllipsisIcon className="w-3.5 h-3.5" />
              </button>
            )}
            {member.status === 'pending' && (
              <button onClick={() => updateStatus({ teamId, memberId: member._id, status: 'active' })}
                className="p-1 rounded bg-white dark:bg-gray-700 shadow text-green-500 hover:text-green-600">
                <CheckCircleIcon className="w-3.5 h-3.5" />
              </button>
            )}
            {member.status === 'active' && (
              <button onClick={() => updateStatus({ teamId, memberId: member._id, status: 'paused' })}
                className="p-1 rounded bg-white dark:bg-gray-700 shadow text-orange-500 hover:text-orange-600">
                <ArrowPathIcon className="w-3.5 h-3.5" />
              </button>
            )}
            {member.status === 'paused' && (
              <button onClick={() => updateStatus({ teamId, memberId: member._id, status: 'active' })}
                className="p-1 rounded bg-white dark:bg-gray-700 shadow text-green-500 hover:text-green-600">
                <CheckCircleIcon className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={handleRemove}
              className="p-1 rounded bg-white dark:bg-gray-700 shadow text-red-500 hover:text-red-600">
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TeamBoard({ team, onMessageMember }) {
  if (!team) return null;

  const activeMembers = team.members?.filter(m => m.status === 'active') || [];
  const pendingMembers = team.members?.filter(m => ['pending', 'invited'].includes(m.status)) || [];
  const pausedMembers = team.members?.filter(m => m.status === 'paused') || [];

  return (
    <div className="space-y-4">
      {/* Active Members */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />
          Active ({activeMembers.length})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {activeMembers.map(m => (
            <MemberCard key={m._id} member={m} teamId={team._id} onMessage={onMessageMember} />
          ))}
          {activeMembers.length === 0 && (
            <p className="text-xs text-gray-400 col-span-full">No active members</p>
          )}
        </div>
      </div>

      {/* Pending / Invited */}
      {pendingMembers.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ClockIcon className="w-3.5 h-3.5 text-blue-500" />
            Pending ({pendingMembers.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pendingMembers.map(m => (
              <MemberCard key={m._id} member={m} teamId={team._id} onMessage={onMessageMember} />
            ))}
          </div>
        </div>
      )}

      {/* Paused */}
      {pausedMembers.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ExclamationCircleIcon className="w-3.5 h-3.5 text-orange-500" />
            Paused ({pausedMembers.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pausedMembers.map(m => (
              <MemberCard key={m._id} member={m} teamId={team._id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
