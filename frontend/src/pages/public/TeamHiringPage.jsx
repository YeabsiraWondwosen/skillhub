import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserGroupIcon, PlusIcon, BriefcaseIcon, CheckCircleIcon,
  ClockIcon, Cog6ToothIcon, ChartBarIcon, SparklesIcon,
  PaperAirplaneIcon, XMarkIcon, TrashIcon, ArrowPathIcon,
  ChatBubbleLeftEllipsisIcon, CurrencyDollarIcon, FlagIcon,
} from '@heroicons/react/24/outline';
import {
  useTeams, useTeam, useCreateTeam, useDeleteTeam,
  useTeamAnalytics, useTeamDashboard,
  useAddTask, useUpdateTask, useDeleteTask,
  useSendMessage, useTeamMessages,
  useGenerateTeamRecommendation,
} from '@/hooks/useTeamHiring';
import TeamBoard from '@/components/team-hiring/TeamBoard';
import RoleAssignment from '@/components/team-hiring/RoleAssignment';
import TeamInvitation from '@/components/team-hiring/TeamInvitation';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { formatRate } from '@/utils/currency';

const STATUS_COLORS = {
  planning: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700',
  recruiting: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700',
  active: 'bg-green-100 dark:bg-green-900/30 text-green-700',
  on_hold: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700',
  completed: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700',
};

const TASK_STATUS = {
  todo: { color: 'bg-gray-100 dark:bg-gray-800 text-gray-600', label: 'To Do' },
  in_progress: { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600', label: 'In Progress' },
  review: { color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600', label: 'Review' },
  done: { color: 'bg-green-100 dark:bg-green-900/30 text-green-600', label: 'Done' },
  blocked: { color: 'bg-red-100 dark:bg-red-900/30 text-red-600', label: 'Blocked' },
};

const PRIORITY_COLORS = {
  low: 'bg-gray-200 dark:bg-gray-700 text-gray-500',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600',
  high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600',
  critical: 'bg-red-100 dark:bg-red-900/30 text-red-600',
};

function TaskBoard({ team }) {
  const [showAdd, setShowAdd] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', assignedRole: '', priority: 'medium' });
  const { mutate: addTask } = useAddTask();
  const { mutate: updateTask } = useUpdateTask();

  const tasks = team?.tasks || [];
  const statuses = ['todo', 'in_progress', 'review', 'done'];

  const handleAdd = () => {
    if (!taskForm.title.trim()) return;
    addTask({ teamId: team._id, data: taskForm }, {
      onSuccess: () => { setShowAdd(false); setTaskForm({ title: '', assignedRole: '', priority: 'medium' }); },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Cog6ToothIcon className="w-4 h-4 text-primary-500" />
          Team Tasks ({tasks.length})
        </h3>
        <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm flex items-center gap-1 text-xs">
          <PlusIcon className="w-3.5 h-3.5" /> Add Task
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white">New Task</h4>
                <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <input type="text" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                className="input-field w-full text-sm" placeholder="Task title" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Assign to Role</label>
                  <select value={taskForm.assignedRole} onChange={e => setTaskForm(p => ({ ...p, assignedRole: e.target.value }))}
                    className="input-field w-full text-xs">
                    <option value="">Unassigned</option>
                    {team.requiredRoles?.map(r => <option key={r._id} value={r.title}>{r.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Priority</label>
                  <select value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}
                    className="input-field w-full text-xs">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAdd(false)} className="btn-outline btn-sm text-xs">Cancel</button>
                <button onClick={handleAdd} className="btn-primary btn-sm text-xs">Create</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {statuses.map(status => {
          const st = TASK_STATUS[status];
          const statusTasks = tasks.filter(t => t.status === status);
          return (
            <div key={status} className="space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <span className={clsx('w-2 h-2 rounded-full', st.color.split(' ')[0])} />
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{st.label}</span>
                <span className="text-[10px] text-gray-400">{statusTasks.length}</span>
              </div>
              <div className="space-y-1.5 min-h-[60px]">
                {statusTasks.map(task => (
                  <motion.div key={task._id} layout
                    className={clsx('card p-2.5 cursor-pointer hover:shadow-md transition-shadow border-l-2',
                      task.priority === 'critical' && 'border-l-red-500',
                      task.priority === 'high' && 'border-l-orange-400',
                      task.priority === 'medium' && 'border-l-yellow-400',
                      task.priority === 'low' && 'border-l-gray-300',
                    )}
                    onClick={() => {
                      const next = status === 'todo' ? 'in_progress' : status === 'in_progress' ? 'review' : status === 'review' ? 'done' : 'done';
                      updateTask({ teamId: team._id, taskId: task._id, data: { status: next } });
                    }}>
                    <p className="text-xs font-medium text-gray-900 dark:text-white">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {task.assignedRole && (
                        <span className="text-[9px] bg-primary-50 dark:bg-primary-900/20 text-primary-600 px-1 py-0.5 rounded">
                          {task.assignedRole}
                        </span>
                      )}
                      <span className={clsx('text-[9px] px-1 py-0.5 rounded', PRIORITY_COLORS[task.priority])}>
                        {task.priority}
                      </span>
                    </div>
                  </motion.div>
                ))}
                {statusTasks.length === 0 && (
                  <p className="text-[10px] text-gray-400 text-center py-3">No tasks</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamChat({ team }) {
  const [msg, setMsg] = useState('');
  const { data: msgData } = useTeamMessages(team?._id, {});
  const { mutate: sendMessage } = useSendMessage();

  const messages = Array.isArray(msgData) ? msgData : (msgData?.messages || []);

  const handleSend = () => {
    if (!msg.trim()) return;
    sendMessage({ teamId: team._id, data: { content: msg, type: 'text' } }, {
      onSuccess: () => setMsg(''),
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-primary-500" />
        Team Chat
      </h3>
      <div className="card p-3 max-h-[300px] overflow-y-auto space-y-2">
        {messages.map(m => (
          <div key={m._id} className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-primary-600">{m.sender?.name?.[0] || '?'}</span>
            </div>
            <div>
              <p className="text-[10px] font-medium text-gray-500">{m.sender?.name || 'Unknown'}</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">{m.content}</p>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-xs text-gray-400 text-center py-3">No messages yet</p>}
      </div>
      <div className="flex gap-2">
        <input type="text" value={msg} onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          className="input-field flex-1 text-sm" placeholder="Type a message..." />
        <button onClick={handleSend} className="btn-primary btn-sm">
          <PaperAirplaneIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function TeamHiringPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamForm, setTeamForm] = useState({ title: '', description: '', projectId: '' });

  const { data: dashboard } = useTeamDashboard();
  const { data: teamsRes, isLoading } = useTeams({});
  const { data: teamDetail } = useTeam(selectedTeam);
  const { data: analytics } = useTeamAnalytics(selectedTeam);

  const { mutate: createTeam, isPending: creating } = useCreateTeam();
  const { mutate: deleteTeam } = useDeleteTeam();
  const { mutate: genRec, isPending: generatingRec } = useGenerateTeamRecommendation();

  const teams = Array.isArray(teamsRes) ? teamsRes : (teamsRes?.teams || []);

  const handleCreate = () => {
    if (!teamForm.title.trim()) return;
    createTeam(teamForm, {
      onSuccess: (res) => {
        const id = res?.data?._id || res?._id;
        if (id) setSelectedTeam(id);
        setShowCreateModal(false);
        setTeamForm({ title: '', description: '', projectId: '' });
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <UserGroupIcon className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Team Hiring</h1>
                <p className="text-xs text-gray-500">Build and manage teams for your projects</p>
              </div>
            </div>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary btn-sm flex items-center gap-2">
              <PlusIcon className="w-4 h-4" /> New Team
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar - Teams List */}
          <div className="col-span-12 lg:col-span-3">
            <div className="card p-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">Teams</h3>
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {teams.map(t => (
                  <button key={t._id} onClick={() => { setSelectedTeam(t._id); setActiveTab('members'); }}
                    className={clsx(
                      'w-full text-left px-3 py-2 rounded-lg text-xs transition-all',
                      selectedTeam === t._id
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                    )}>
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <span className={clsx('px-1 py-0 rounded text-[8px] font-medium', STATUS_COLORS[t.status])}>
                        {t.status}
                      </span>
                      {t.members?.length || 0} members
                    </p>
                  </button>
                ))}
                {teams.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No teams yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-12 lg:col-span-9">
            {/* Tabs */}
            <div className="flex items-center gap-1 mb-4 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-200 dark:border-gray-700 overflow-x-auto">
              {[
                { key: 'members', label: 'Members', icon: UserGroupIcon },
                { key: 'roles', label: 'Roles', icon: BriefcaseIcon },
                { key: 'tasks', label: 'Tasks', icon: Cog6ToothIcon },
                { key: 'invitations', label: 'Invitations', icon: PaperAirplaneIcon },
                { key: 'chat', label: 'Chat', icon: ChatBubbleLeftEllipsisIcon },
                { key: 'analytics', label: 'Analytics', icon: ChartBarIcon },
              ].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                    activeTab === t.key
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                  )}>
                  <t.icon className="w-3.5 h-3.5" />{t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {selectedTeam && teamDetail ? (
              <AnimatePresence mode="wait">
                {activeTab === 'members' && (
                  <motion.div key="members" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <TeamBoard team={teamDetail} />
                  </motion.div>
                )}

                {activeTab === 'roles' && (
                  <motion.div key="roles" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <RoleAssignment team={teamDetail} />
                  </motion.div>
                )}

                {activeTab === 'tasks' && (
                  <motion.div key="tasks" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <TaskBoard team={teamDetail} />
                  </motion.div>
                )}

                {activeTab === 'invitations' && (
                  <motion.div key="inv" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <TeamInvitation team={teamDetail} />
                  </motion.div>
                )}

                {activeTab === 'chat' && (
                  <motion.div key="chat" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <TeamChat team={teamDetail} />
                  </motion.div>
                )}

                {activeTab === 'analytics' && (
                  <motion.div key="analytics" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div className="space-y-4">
                      {/* Analytics Cards */}
                      {analytics && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: 'Active Members', value: analytics.activeMembers || 0 },
                            { label: 'Tasks Done', value: `${analytics.completedTasks || 0}/${analytics.totalTasks || 0}` },
                            { label: 'Overdue', value: analytics.overdueTasks || 0 },
                            { label: 'Completion', value: `${analytics.completionRate || 0}%` },
                          ].map((s, i) => (
                            <div key={i} className="card p-4 text-center">
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* AI Recommendation */}
                      <div className="card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <SparklesIcon className="w-4 h-4 text-primary-500" />
                            AI Team Recommendation
                          </h3>
                          <button onClick={() => genRec(teamDetail._id)} disabled={generatingRec}
                            className="btn-outline btn-sm text-xs flex items-center gap-1">
                            <SparklesIcon className="w-3.5 h-3.5" />
                            {generatingRec ? 'Generating...' : 'Get Recommendation'}
                          </button>
                        </div>
                        {teamDetail.aiRecommendations && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-bold text-primary-600">
                                {teamDetail.aiRecommendations.teamCompositionScore}/100
                              </span>
                              <span className="text-xs text-gray-500">Team Composition Score</span>
                            </div>
                            {teamDetail.aiRecommendations.suggestedRoles?.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Suggested Roles</p>
                                <div className="space-y-1">
                                  {teamDetail.aiRecommendations.suggestedRoles.map((r, i) => (
                                    <div key={i} className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-2 flex items-center gap-3">
                                      <span className="font-medium text-gray-900 dark:text-white">{r.title}</span>
                                      <span className="text-gray-500">{r.skills?.join(', ')}</span>
                                       <span className="text-primary-600 ml-auto">{formatRate(r.estimatedRate)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {teamDetail.aiRecommendations.riskFactors?.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Risk Factors</p>
                                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                                  {teamDetail.aiRecommendations.riskFactors.map((r, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                      <span className="w-1 h-1 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                                      {r}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            ) : (
              <div className="card p-8 text-center">
                <UserGroupIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Select a team to manage or create a new one.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Team Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">New Team</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Team Name *</label>
                  <input type="text" value={teamForm.title} onChange={e => setTeamForm(p => ({ ...p, title: e.target.value }))}
                    className="input-field w-full" placeholder="Frontend Team Alpha" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <textarea value={teamForm.description} onChange={e => setTeamForm(p => ({ ...p, description: e.target.value }))}
                    className="input-field w-full text-sm resize-none" rows={3} placeholder="What is this team for?" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowCreateModal(false)} className="btn-outline btn-sm">Cancel</button>
                <button onClick={handleCreate} disabled={creating || !teamForm.title.trim()} className="btn-primary btn-sm">
                  {creating ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
