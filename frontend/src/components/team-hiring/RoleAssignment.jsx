import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, XMarkIcon,
  BriefcaseIcon, WrenchIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import { useAddRequiredRole, useUpdateRequiredRole, useDeleteRequiredRole } from '@/hooks/useTeamHiring';
import { useConfirm } from '@/components/ui/DialogProvider';
import { clsx } from 'clsx';

const URGENCY_BADGE = {
  low: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600',
  high: 'bg-red-100 dark:bg-red-900/30 text-red-600',
};

function RoleCard({ role, teamId, members }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...role });
  const confirm = useConfirm();

  const { mutate: updateRole } = useUpdateRequiredRole();
  const { mutate: deleteRole } = useDeleteRequiredRole();

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete role',
      message: `Delete the "${role.title}" role? This cannot be undone.`,
      confirmLabel: 'Delete role',
      destructive: true,
    });
    if (ok) deleteRole({ teamId, roleId: role._id });
  };

  const filledMembers = members?.filter(m =>
    m.role === role.title && !['removed', 'declined'].includes(m.status),
  ) || [];

  const handleSave = () => {
    updateRole({ teamId, roleId: role._id, data: form }, {
      onSuccess: () => setEditing(false),
    });
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={clsx('card p-4 transition-all', role.filled && 'bg-green-50/20 dark:bg-green-900/5')}>
      <div className="flex items-start gap-3">
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
          role.filled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-primary-100 dark:bg-primary-900/30')}>
          <BriefcaseIcon className={clsx('w-4 h-4', role.filled ? 'text-green-600' : 'text-primary-600')} />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="input-field w-full text-sm" placeholder="Role title" />
              <textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="input-field w-full text-xs resize-none" rows={2} placeholder="Description" />
              <input type="text" value={form.skills?.join(', ') || ''}
                onChange={e => setForm(p => ({ ...p, skills: e.target.value.split(',').map(s => s.trim()) }))}
                className="input-field w-full text-xs" placeholder="Skills (comma-separated)" />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Min Exp (yrs)</label>
                  <input type="number" value={form.minExperience || ''} onChange={e => setForm(p => ({ ...p, minExperience: Number(e.target.value) }))}
                    className="input-field w-full text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Max Rate (ETB/hr)</label>
                  <input type="number" value={form.maxRate || ''} onChange={e => setForm(p => ({ ...p, maxRate: Number(e.target.value) }))}
                    className="input-field w-full text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Hrs/Week</label>
                  <input type="number" value={form.hoursPerWeek || ''} onChange={e => setForm(p => ({ ...p, hoursPerWeek: Number(e.target.value) }))}
                    className="input-field w-full text-xs" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} className="btn-primary btn-sm text-xs">Save</button>
                <button onClick={() => setEditing(false)} className="btn-outline btn-sm text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{role.title}</h4>
                {role.filled && (
                  <span className="text-[10px] font-medium text-green-600 bg-green-100 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                    Filled
                  </span>
                )}
                <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded', URGENCY_BADGE[role.urgency])}>
                  {role.urgency}
                </span>
              </div>
              {role.description && (
                <p className="text-xs text-gray-500 mt-1">{role.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                {role.skills?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <WrenchIcon className="w-3 h-3" />
                    {role.skills.slice(0, 4).join(', ')}{role.skills.length > 4 ? '...' : ''}
                  </span>
                )}
                {role.minExperience && <span>{role.minExperience}+ yrs</span>}
                {role.maxRate && <span>Up to {role.maxRate} ETB/hr</span>}
                {role.hoursPerWeek && <span>{role.hoursPerWeek}h/wk</span>}
              </div>
              {filledMembers.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400">Assigned:</span>
                  {filledMembers.map(m => (
                    <span key={m._id} className="text-[10px] bg-green-50 dark:bg-green-900/20 text-green-600 px-1.5 py-0.5 rounded font-medium">
                      {m.freelancer?.name || 'Unknown'}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-primary-600">
              <PencilIcon className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete}
              className="p-1 text-gray-400 hover:text-red-500">
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function RoleAssignment({ team }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newRole, setNewRole] = useState({ title: '', description: '', skills: '', urgency: 'medium' });
  const { mutate: addRole, isPending } = useAddRequiredRole();

  if (!team) return null;

  const handleAdd = () => {
    if (!newRole.title.trim()) return;
    addRole({
      teamId: team._id,
      data: {
        ...newRole,
        skills: newRole.skills.split(',').map(s => s.trim()).filter(Boolean),
      },
    }, {
      onSuccess: () => {
        setShowAdd(false);
        setNewRole({ title: '', description: '', skills: '', urgency: 'medium' });
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BriefcaseIcon className="w-4 h-4 text-primary-500" />
          Required Roles ({team.requiredRoles?.length || 0})
        </h3>
        <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm flex items-center gap-1 text-xs">
          <PlusIcon className="w-3.5 h-3.5" /> Add Role
        </button>
      </div>

      {/* Add Role Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white">New Role</h4>
                <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <input type="text" value={newRole.title} onChange={e => setNewRole(p => ({ ...p, title: e.target.value }))}
                className="input-field w-full text-sm" placeholder="e.g. Frontend Developer" />
              <textarea value={newRole.description} onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))}
                className="input-field w-full text-xs resize-none" rows={2} placeholder="Role description..." />
              <input type="text" value={newRole.skills} onChange={e => setNewRole(p => ({ ...p, skills: e.target.value }))}
                className="input-field w-full text-xs" placeholder="React, TypeScript, Node.js (comma-separated)" />
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Urgency</label>
                  <select value={newRole.urgency} onChange={e => setNewRole(p => ({ ...p, urgency: e.target.value }))}
                    className="input-field text-xs">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="flex-1" />
                <button onClick={handleAdd} disabled={isPending || !newRole.title.trim()} className="btn-primary btn-sm text-xs">
                  {isPending ? 'Adding...' : 'Add Role'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Cards */}
      <div className="space-y-2">
        {team.requiredRoles?.map(role => (
          <RoleCard key={role._id} role={role} teamId={team._id} members={team.members} />
        ))}
        {(!team.requiredRoles || team.requiredRoles.length === 0) && (
          <p className="text-xs text-gray-400 text-center py-4">No roles defined yet. Add roles to start building your team.</p>
        )}
      </div>
    </div>
  );
}
