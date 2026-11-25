import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useProject, useAddTask, useUpdateTask, useDeleteTask, projectKeys } from '@/hooks/useProjects';
import { useAuthStore } from '@/store/authStore';
import { getSocket, joinProject, leaveProject } from '@/services/socket';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { SkeletonText } from '@/components/ui/Skeleton';
import DeliveriesPanel from '@/components/projects/DeliveriesPanel';
import {
  PlusIcon, ChatBubbleLeftRightIcon, FolderIcon,
  PencilSquareIcon, TrashIcon, CheckIcon, ArrowPathIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { formatCurrency } from '@/utils/currency';
import { getMinDateValue, isDateOnlyInPast } from '@/utils/dateValidation';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'];
const TASK_STATUS_COLORS = {
  todo: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  in_progress: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  review: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
  done: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
};

export default function ProjectWorkspace() {
  const { projectId } = useParams();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Join the project room so order/delivery events arrive in real time.
  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected) return;
    joinProject(projectId);
    const handleUpdate = () => {
      qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      qc.invalidateQueries({ queryKey: projectKeys.milestones(projectId) });
    };
    const handleTask = () => {
      qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    };
    socket.on('project:update', handleUpdate);
    socket.on('task:added', handleTask);
    socket.on('task:updated', handleTask);
    socket.on('task:deleted', handleTask);
    return () => {
      leaveProject(projectId);
      socket.off('project:update', handleUpdate);
      socket.off('task:added', handleTask);
      socket.off('task:updated', handleTask);
      socket.off('task:deleted', handleTask);
    };
  }, [projectId, qc]);

  const { data, isLoading } = useProject(projectId);
  const { mutate: addTask, isPending: isAddingTask } = useAddTask();
  const { mutate: updateTask } = useUpdateTask();
  const { mutate: deleteTask, isPending: isDeletingTask } = useDeleteTask();

  const { register: regTask, handleSubmit: handleTask, reset: resetTask, formState: { errors: taskErrors } } = useForm();
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, formState: { errors: editErrors } } = useForm();

  // Prefill the edit form whenever a task is picked for editing.
  useEffect(() => {
    if (!editTask) return;
    resetEdit({
      title: editTask.title,
      description: editTask.description || '',
      priority: editTask.priority || 'medium',
      dueDate: editTask.dueDate ? String(editTask.dueDate).slice(0, 10) : '',
    });
  }, [editTask, resetEdit]);

  const project = data?.data;
  if (isLoading) return <div className="page-container"><SkeletonText lines={10} /></div>;
  if (!project) return <div className="page-container"><p className="text-gray-500">Project not found.</p></div>;

  const isClient = project.client?._id === user?._id || project.client === user?._id;
  const isFreelancer = project.freelancer?._id === user?._id || project.freelancer === user?._id;

  // Milestone-driven contracts store each submission on the milestone
  // (submittedAt / deliveryNote / deliveryFiles). Project-level deliveries are a
  // separate, optional workflow. Surface BOTH here — every item is real data.
  const projectDeliveries = project.deliveries ?? [];
  const milestoneDeliveries = (project.milestones ?? [])
    .filter((m) => m.submittedAt)
    .map((m) => ({
      _id: m._id,
      isMilestoneDelivery: true,
      title: m.title,
      message: m.deliveryNote || `Work submitted for milestone "${m.title}".`,
      demoUrl: '',
      files: m.deliveryFiles ?? [],
      screenshots: [],
      submittedAt: m.submittedAt,
      status: ['approved', 'released'].includes(m.status)
        ? 'approved'
        : m.status === 'revision_requested'
          ? 'revision_requested'
          : 'pending',
      revisionNote: m.revisionNote || '',
      reviewedAt: m.approvedAt || m.escrowReleasedAt || null,
    }));
  const allDeliveries = [...projectDeliveries, ...milestoneDeliveries];

  const allFiles = [
    ...(project.files ?? []),
    ...projectDeliveries.flatMap((d) =>
      [...(d.files ?? []), ...(d.screenshots ?? [])].map((f) => ({ ...f, category: f.category || 'delivery' }))
    ),
    ...(project.milestones ?? [])
      .filter((m) => m.submittedAt)
      .flatMap((m) =>
        (m.deliveryFiles ?? []).map((f) => ({
          ...f,
          category: f.category || 'delivery',
          description: m.deliveryNote || '',
        }))
      ),
  ];

  const onAddTask = (values) => {
    addTask({ projectId, data: values }, {
      onSuccess: () => { setAddTaskOpen(false); resetTask(); },
    });
  };

  const freelancerLabel = project.freelancer
    ? `${project.freelancer.firstName ?? ''} ${project.freelancer.lastName ?? ''}`.trim() || 'the freelancer'
    : 'the freelancer';

  const moveTaskStatus = (task, status) =>
    updateTask({ projectId, taskId: task._id, data: { status } });

  const onEditTask = (values) => {
    if (!editTask) return;
    const data = { title: values.title, description: values.description || '', priority: values.priority };
    if (values.dueDate) data.dueDate = values.dueDate;
    updateTask({ projectId, taskId: editTask._id, data }, {
      onSuccess: () => setEditTask(null),
    });
  };

  // Role-aware task controls. The backend enforces the same rules; the UI only
  // surfaces the actions each role is actually allowed to perform.
  const renderTaskActions = (task) => {
    const actions = [];
    if (isFreelancer) {
      const fAction = {
        todo: { label: 'Start Work', to: 'in_progress' },
        in_progress: { label: 'Submit for Review', to: 'review' },
      }[task.status];
      if (fAction) actions.push(fAction);
    }
    if (isClient) {
      if (task.status === 'review') {
        actions.push({ label: 'Request Changes', to: 'in_progress' });
        actions.push({ label: 'Approve', to: 'done', primary: true });
      }
      actions.push({ label: 'Edit', kind: 'edit' });
      actions.push({ label: 'Delete', kind: 'delete' });
    }
    if (actions.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-black/5 dark:border-white/10">
        {actions.map((a, i) => {
          if (a.kind === 'edit') {
            return (
              <button key={`${a.kind}-${i}`} type="button" onClick={() => setEditTask(task)}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-primary-600 hover:border-primary-400 transition-colors">
                <PencilSquareIcon className="w-3 h-3" /> Edit
              </button>
            );
          }
          if (a.kind === 'delete') {
            return (
              <button key={`${a.kind}-${i}`} type="button" onClick={() => setDeleteTarget(task)}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <TrashIcon className="w-3 h-3" /> Delete
              </button>
            );
          }
          const Icon = a.primary ? CheckIcon : a.to === 'in_progress' ? ArrowPathIcon : ArrowRight;
          return (
            <button key={`${a.label}-${i}`} type="button" onClick={() => moveTaskStatus(task, a.to)}
              className={clsx('inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors',
                a.primary || isFreelancer
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-primary-600 hover:border-primary-400')}>
              <Icon className="w-3 h-3" /> {a.label}
            </button>
          );
        })}
      </div>
    );
  };

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: `Tasks (${project.tasks?.length ?? 0})` },
    { id: 'deliveries', label: `Deliveries (${allDeliveries.length})` },
    { id: 'files', label: `Files (${allFiles.length})` },
  ];

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to={isFreelancer ? '/freelancer/projects' : '/client/contracts'}
            className="text-sm text-gray-400 hover:text-primary-600 inline-flex items-center gap-1"><ArrowLeft size={14} /> Back to Projects</Link>
          <h1 className="section-title mt-1">{project.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge status={project.status} />
            <span className="text-xs text-gray-400">{project.progress ?? 0}% complete</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/messages`} className="btn-secondary btn-sm flex items-center gap-1.5">
            <ChatBubbleLeftRightIcon className="w-4 h-4" /> Message
          </Link>
          <Link to={`/projects/${projectId}/milestones`} className="btn-secondary btn-sm">
            Milestones
          </Link>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-gray-700 dark:text-gray-300">Progress</span>
          <span className="text-primary-600 font-semibold">{project.progress ?? 0}%</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${project.progress ?? 0}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-700">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === t.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Project Details</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {project.description || 'No description provided.'}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card p-5 space-y-3 text-sm">
              <h3 className="font-semibold text-gray-900 dark:text-white">Info</h3>
              <div className="space-y-2">
                {[
                  { label: 'Budget', value: formatCurrency(project.budget?.agreedAmount) },
                  { label: 'Deadline', value: project.timeline?.deadline ? format(new Date(project.timeline.deadline), 'MMM d, yyyy') : '—' },
                  { label: 'Started', value: project.status === 'pending_payment' || !project.timeline?.startDate ? 'Not started' : format(new Date(project.timeline.startDate), 'MMM d, yyyy') },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-gray-400">{r.label}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Team</h3>
              {[
                { label: 'Client', person: project.client },
                { label: 'Freelancer', person: project.freelancer },
              ].map(({ label, person }) => (
                <div key={label} className="flex items-center gap-2 mb-2">
                  <Avatar src={person?.avatar?.url} alt={`${person?.firstName}`} size="sm" online={person?.isOnline} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {person?.firstName} {person?.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {isClient && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setAddTaskOpen(true)}>
                <PlusIcon className="w-4 h-4" /> Add Task
              </Button>
            </div>
          )}
          {project.tasks?.length === 0 ? (
            <div className="card p-12 text-center text-gray-400 text-sm">
              <p>No tasks yet</p>
              {isClient && (
                <p className="mt-1 text-xs">Break the work into tasks and assign them to {freelancerLabel}.</p>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-4 gap-4">
              {TASK_STATUSES.map(status => (
                <div key={status} className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                    {status.replace('_', ' ')} ({project.tasks?.filter(t => t.status === status).length ?? 0})
                  </p>
                  {project.tasks?.filter(t => t.status === status).map(task => (
                    <div key={task._id} className={clsx('card p-3 text-sm space-y-2', TASK_STATUS_COLORS[status])}>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{task.title}</p>
                        {task.description && <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5 line-clamp-2">{task.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-300 flex-wrap">
                        <span className="uppercase">{task.priority}</span>
                        {task.dueDate && (
                          <span className="flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" /> Due {format(new Date(task.dueDate), 'MMM d, yyyy')}
                          </span>
                        )}
                        <span>{task.assignedTo ? `• ${freelancerLabel}` : '• Unassigned'}</span>
                      </div>
                      {task.completedAt && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-300">
                          Completed {format(new Date(task.completedAt), 'MMM d, yyyy')}
                        </p>
                      )}
                      {renderTaskActions(task)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Deliveries Tab */}
      {activeTab === 'deliveries' && (
        <DeliveriesPanel
          project={project}
          milestoneDeliveries={milestoneDeliveries}
          isClient={isClient}
          isFreelancer={isFreelancer}
        />
      )}

      {/* Files Tab */}
      {activeTab === 'files' && (
        <div className="space-y-3">
          {allFiles.length === 0 ? (
            <div className="card p-12 text-center text-gray-400 text-sm">No files uploaded yet</div>
          ) : (
            allFiles.map(f => (
              <div key={f._id || f.url} className="card p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                    <FolderIcon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{f.originalName}</p>
                    <p className="text-xs text-gray-400">
                      {f.fileSize ? `${(f.fileSize / 1024).toFixed(1)} KB` : ''} · {f.category || 'delivery'}
                    </p>
                  </div>
                </div>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                  Download
                </a>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Task Modal */}
      <Modal open={addTaskOpen} onClose={() => setAddTaskOpen(false)} title="Add Task" size="sm">
        <form onSubmit={handleTask(onAddTask)} className="space-y-3">
          <Input label="Task Title" placeholder="e.g. Implement login page"
            error={taskErrors.title?.message}
            {...regTask('title', { required: 'Title required' })} />
          <Textarea label="Description" rows={2} {...regTask('description')} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Priority" {...regTask('priority')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
            <Input label="Due Date" type="date" min={getMinDateValue()} error={taskErrors.dueDate?.message}
              {...regTask('dueDate', {
                validate: (v) => !v || isDateOnlyInPast(v).valid || isDateOnlyInPast(v).message,
              })} />
          </div>
          <p className="text-xs text-gray-400">This task will be assigned to {freelancerLabel}.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" size="sm" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" loading={isAddingTask}>Add Task</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Task Modal (client) */}
      <Modal open={!!editTask} onClose={() => setEditTask(null)} title="Edit Task" size="sm">
        <form onSubmit={handleEdit(onEditTask)} className="space-y-3">
          <Input label="Task Title" placeholder="e.g. Implement login page"
            error={editErrors.title?.message}
            {...regEdit('title', { required: 'Title required' })} />
          <Textarea label="Description" rows={2} {...regEdit('description')} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Priority" {...regEdit('priority')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
            <Input label="Due Date" type="date" min={getMinDateValue()} error={editErrors.dueDate?.message}
              {...regEdit('dueDate', {
                validate: (v) => {
                  if (!v) return true;
                  const result = isDateOnlyInPast(v);
                  if (result.valid) return true;
                  const current = editTask?.dueDate ? String(editTask.dueDate).slice(0, 10) : '';
                  return v === current || result.message;
                },
              })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" size="sm" onClick={() => setEditTask(null)}>Cancel</Button>
            <Button type="submit" size="sm">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Task Confirm */}
      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTask({ projectId, taskId: deleteTarget?._id }, { onSuccess: () => setDeleteTarget(null) })}
        title="Delete Task"
        message={deleteTarget ? `Delete "${deleteTarget.title}"? This removes the task from the project plan.` : ''}
        confirmLabel="Delete Task" loading={isDeletingTask} />
    </div>
  );
}
