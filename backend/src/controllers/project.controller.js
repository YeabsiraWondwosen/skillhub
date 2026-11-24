import mongoose from 'mongoose';
import { Project, Milestone, User, Job, ServiceOrder, Escrow } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { isDateOnlyInPast } from '../utils/dateValidation.js';
import { uploadMultipleFiles } from '../services/cloudinary.service.js';
import { assertProjectTransition, TERMINAL_PROJECT_STATUSES } from '../utils/projectStateMachine.js';
import {
  notifyMilestoneUpdate,
  notifyProjectCompleted,
  notifyTaskAssigned,
  notifyTaskEvent,
} from '../services/notification.service.js';
import { sendProjectCompletedEmail } from '../services/email.service.js';
import { emitToProject } from '../services/socket.service.js';

/**
 * Keep a service order in sync with its project's delivery lifecycle.
 * Non-fatal: failures are logged but never block the underlying project flow.
 */
const syncServiceOrderOnDelivery = async ({ project, action, actor }) => {
  try {
    if (!project.serviceOrder) return;
    const order = await ServiceOrder.findById(project.serviceOrder);
    if (!order) return;

    if (action === 'submitted') {
      if (order.escrow && ['accepted', 'revision_requested'].includes(order.status)) {
        const { submitEscrowWork } = await import('../services/payment.service.js');
        await submitEscrowWork(order.escrow.toString(), actor._id);
      }
      order.status = 'delivered';
      order.timeline.deliveredAt = new Date();
      await order.save();
      const { notifyOrderDeliverySubmitted } = await import('../services/notification.service.js');
      await notifyOrderDeliverySubmitted(order, actor);
    } else if (action === 'approved') {
      // Idempotent: the escrow is normally released by reviewDelivery BEFORE
      // this sync runs. Guard here so a replay of the sync can never re-release
      // (which would throw and get swallowed), and never double-credit.
      const escrow = order.escrow ? await Escrow.findById(order.escrow) : null;
      const alreadyReleased = escrow && (escrow.status === 'released' || escrow.releaseTransaction);
      if (!alreadyReleased && order.escrow && order.status === 'delivered') {
        const { releaseEscrowFunds } = await import('../services/payment.service.js');
        await releaseEscrowFunds(order.escrow.toString(), actor._id);
      }
      order.status = 'completed';
      order.timeline.completedAt = new Date();
      await order.save();
      const { notifyOrderCompleted } = await import('../services/notification.service.js');
      await notifyOrderCompleted(order);
    } else if (action === 'revision_requested') {
      if (order.escrow) {
        await Escrow.findByIdAndUpdate(order.escrow, { status: 'in_progress' });
      }
      order.status = 'revision_requested';
      await order.save();
      const { notifyOrderRevisionRequested } = await import('../services/notification.service.js');
      await notifyOrderRevisionRequested(order, actor);
    }
  } catch (err) {
    // Order sync must never break the delivery flow it is attached to.
    console.error('Service order delivery sync error:', err.message);
  }
};

// ─── Get Projects ─────────────────────────────────────────────────────────────
export const getMyProjects = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;

  const filter = {
    $or: [{ client: req.user._id }, { freelancer: req.user._id }],
  };
  if (status) filter.status = status;

  const total = await Project.countDocuments(filter);
  const projects = await Project.find(filter)
    .populate('client', 'firstName lastName avatar')
    .populate('freelancer', 'firstName lastName avatar')
    .populate('job', 'title category')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Projects fetched', projects, paginationMeta(total, page, limit));
});

// ─── Get Single Project ───────────────────────────────────────────────────────
export const getProject = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.projectId)
    .populate('client', 'firstName lastName avatar isOnline')
    .populate('freelancer', 'firstName lastName avatar isOnline')
    .populate('job', 'title category budget')
    .populate('milestones');

  if (!project) throw new ApiError(404, 'Project not found');

  const isParticipant =
    project.client._id.toString() === req.user._id.toString() ||
    project.freelancer._id.toString() === req.user._id.toString() ||
    req.user.role === 'admin';

  if (!isParticipant) throw new ApiError(403, 'Not authorized');

  sendResponse(res, 200, 'Project fetched', project);
});

// ─── Update Project ───────────────────────────────────────────────────────────
// Only a strict allowlist of editable fields may be written by participants.
// Core identity fields (client, freelancer, job, application, serviceOrder),
// financial fields (budget, progress), and state-forging fields are NEVER
// editable via this endpoint — they change only through the workflow
// (fund -> work -> deliver -> review -> release). `status` is restricted to the
// validated on_hold/active pause toggle from the schema.
const PROJECT_EDITABLE_FIELDS = ['title', 'description', 'clientNotes', 'freelancerNotes', 'status'];
const PROJECT_BLOCKED_FIELDS = [
  'client', 'freelancer', 'job', 'application', 'serviceOrder',
  'progress', 'budget', 'startDate', 'completionDate', 'deliverySchema',
  'escrowPaymentId', 'dispute', 'timeline', 'createdAt', 'updatedAt',
];

export const updateProject = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const isParticipant =
    project.client.toString() === req.user._id.toString() ||
    project.freelancer.toString() === req.user._id.toString();
  if (!isParticipant) throw new ApiError(403, 'Not authorized');

  const providedFields = Object.keys(req.body);
  const blocked = providedFields.filter((k) => PROJECT_BLOCKED_FIELDS.includes(k));
  if (blocked.length > 0) {
    throw new ApiError(403, `Fields are not editable: ${blocked.join(', ')}`);
  }
  const disallowed = providedFields.filter((k) => !PROJECT_EDITABLE_FIELDS.includes(k));
  if (disallowed.length > 0) {
    throw new ApiError(400, `Unknown or readonly fields: ${disallowed.join(', ')}`);
  }

  PROJECT_EDITABLE_FIELDS.forEach((k) => {
    if (req.body[k] !== undefined) project[k] = req.body[k];
  });
  await project.save();

  const updates = PROJECT_EDITABLE_FIELDS.filter((k) => req.body[k] !== undefined);
  emitToProject(project._id.toString(), 'project:updated', { projectId: project._id, updates });
  sendResponse(res, 200, 'Project updated', project);
});

// ─── Task Management ──────────────────────────────────────────────────────────
// Tasks live inside the Project document (embedded taskSchema). Every mutation
// here is a REAL change persisted to MongoDB — no fake or in-memory state. The
// controllers describe the shipped business rules:
//   * the CLIENT creates, assigns and deletes tasks;
//   * the FREELANCER advances the status flow (todo → in_progress → review);
//   * the CLIENT approves (review → done) or requests changes (review → in_progress);
//   * the freelancer can NEVER mark a task done on their own.
//
// Update strategy: we fetch the document, mutate the embedded sub-document
// through `project.tasks.id(taskId)` and call `project.save()`. Mongoose then
// writes clean dot-paths (`tasks.$.status`, `tasks.$.updatedAt`, ...) instead of
// mixing a whole-array-element `tasks.$` replace with the auto-injected
// `tasks.$.updatedAt` — which is exactly what caused the MongoDB conflict error
// `Updating the path 'tasks.$.updatedAt' would create a conflict at 'tasks.$'`.

const TASK_TRANSITIONS = {
  // role:      { fromStatus: [allowedNextStatuses] }
  client: { review: ['done', 'in_progress'] },
  freelancer: { todo: ['in_progress'], in_progress: ['review'] },
  admin: {
    todo: ['in_progress', 'review', 'done'],
    in_progress: ['todo', 'review', 'done'],
    review: ['todo', 'in_progress', 'done'],
    done: ['todo', 'in_progress', 'review'],
  },
};

const TASK_CLIENT_FIELDS = ['title', 'description', 'priority', 'dueDate', 'assignedTo', 'order'];

// ─── Task-based progress ──────────────────────────────────────────────────────
// Projects with tasks derive progress from task completion rather than staying
// pinned at 0% or 100%.  The function is called after every task mutation.
// If a project has no tasks the progress is left untouched (milestone/delivery
// flow handles it).  Progress never exceeds 100 — the explicit completion
// endpoint is still needed to record `timeline.completedAt` and trigger
// reputation / wallet / escrow release.
function recalculateTaskProgress(project) {
  if (!project.tasks || project.tasks.length === 0) return false;
  if (project.status === 'completed') return false;            // already final
  const done = project.tasks.filter((t) => t.status === 'done').length;
  const newProgress = Math.round((done / project.tasks.length) * 100);
  if (newProgress !== project.progress) {
    project.progress = newProgress;
    return true;   // caller should persist
  }
  return false;
}

const projectActorRole = (project, userId) => {
  if (String(project.client) === String(userId)) return 'client';
  if (String(project.freelancer) === String(userId)) return 'freelancer';
  return null;
};

export const addTask = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const role = projectActorRole(project, req.user._id);
  if (role !== 'client' && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only the client can create tasks for this project');
  }

  let assignedTo = req.body.assignedTo || null;
  if (!assignedTo) {
    // No explicit assignment → the task goes to the project freelancer.
    assignedTo = String(project.freelancer);
  } else if (String(assignedTo) !== String(project.freelancer)) {
    throw new ApiError(400, 'Tasks can only be assigned to the project freelancer');
  }

  project.tasks.push({
    title: req.body.title,
    description: req.body.description || '',
    priority: req.body.priority || 'medium',
    dueDate: req.body.dueDate || null,
    assignedTo: new mongoose.Types.ObjectId(assignedTo),
    order: req.body.order || 0,
    status: 'todo',
  });
  await project.save();

  // Recalculate progress from task counts (new task may dilute % from prior done tasks).
  if (recalculateTaskProgress(project)) await project.save();

  const created = project.tasks[project.tasks.length - 1];
  await notifyTaskAssigned(String(project.freelancer), req.user._id, project, created);

  emitToProject(project._id.toString(), 'task:added', { projectId: project._id, task: created });
  sendResponse(res, 201, 'Task added', project.tasks);
});

export const updateTask = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const role = projectActorRole(project, req.user._id) || (req.user.role === 'admin' ? 'admin' : null);
  if (!role) throw new ApiError(403, 'Not authorized');

  const task = project.tasks.id(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found');

  // Freelancers may only drive the status flow; clients (and admins) edit details.
  const editable = role === 'freelancer' ? ['status'] : [...TASK_CLIENT_FIELDS, 'status'];
  const disallowed = Object.keys(req.body).filter((k) => !editable.includes(k));
  if (disallowed.length > 0) {
    throw new ApiError(403, role === 'freelancer'
      ? 'Freelancers may only update task status'
      : 'One or more fields are not editable for this task');
  }

  // Enforce the role-aware status transitions from real data (never skip checks).
  const prevStatus = task.status;
  const nextStatus = req.body.status ?? prevStatus;
  if (nextStatus !== prevStatus) {
    const allowed = TASK_TRANSITIONS[role]?.[prevStatus] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new ApiError(403, `Status transition '${prevStatus} → ${nextStatus}' is not allowed for ${role}`);
    }
  }

  let dirty = false;
  if (req.body.title !== undefined && req.body.title !== task.title) { task.title = req.body.title; dirty = true; }
  if (req.body.description !== undefined && req.body.description !== (task.description || '')) { task.description = req.body.description || ''; dirty = true; }
  if (req.body.priority !== undefined && req.body.priority !== task.priority) { task.priority = req.body.priority; dirty = true; }
  if (req.body.dueDate !== undefined && String(req.body.dueDate) !== String(task.dueDate || '')) {
    const newDue = req.body.dueDate || null;
    if (newDue) {
      const dueCheck = isDateOnlyInPast(newDue);
      if (!dueCheck.valid) {
        throw new ApiError(400, dueCheck.message);
      }
    }
    task.dueDate = newDue;
    dirty = true;
  }
  if (req.body.order !== undefined && Number(req.body.order) !== Number(task.order || 0)) { task.order = req.body.order; dirty = true; }
  if (req.body.assignedTo !== undefined) {
    const raw = req.body.assignedTo;
    if (raw) {
      if (String(raw) !== String(project.freelancer)) {
        throw new ApiError(400, 'Tasks can only be assigned to the project freelancer');
      }
      task.assignedTo = new mongoose.Types.ObjectId(raw);
    } else {
      task.assignedTo = null;
    }
    dirty = true;
  }
  if (req.body.status !== undefined && req.body.status !== prevStatus) { task.status = req.body.status; dirty = true; }

  if (task.status === 'done' && prevStatus !== 'done') {
    task.completedAt = new Date();
    dirty = true;
  } else if (prevStatus === 'done' && task.status !== 'done') {
    task.completedAt = undefined;
    dirty = true;
  }

  if (!dirty) return sendResponse(res, 200, 'Task unchanged', project.tasks);

  await project.save();

  // Persist task-based progress (only when the value actually changed).
  if (recalculateTaskProgress(project)) await project.save();

  // Real status events → real notifications to the other party.
  const statusAction =
    (prevStatus === 'todo' && task.status === 'in_progress') ? 'started'
    : (prevStatus === 'in_progress' && task.status === 'review') ? 'submitted_for_review'
    : (prevStatus === 'review' && task.status === 'done') ? 'approved'
    : (prevStatus === 'review' && task.status === 'in_progress') ? 'revision_requested'
    : null;

  if (statusAction) {
    const recipientId = ['started', 'submitted_for_review'].includes(statusAction)
      ? String(project.client)
      : String(project.freelancer);
    await notifyTaskEvent({ recipientId, senderId: req.user._id, project, task, action: statusAction });
  } else if (role !== 'freelancer') {
    const other = role === 'client' ? String(project.freelancer) : null;
    if (other) {
      await notifyTaskEvent({ recipientId: other, senderId: req.user._id, project, task, action: 'edited' });
    }
  }

  emitToProject(project._id.toString(), 'task:updated', {
    projectId: project._id,
    taskId: task._id,
    task,
    status: task.status,
    prevStatus,
  });

  sendResponse(res, 200, 'Task updated', project.tasks);
});

export const deleteTask = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const role = projectActorRole(project, req.user._id);
  if (role !== 'client' && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only the client can delete tasks for this project');
  }

  const task = project.tasks.id(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found');

  project.tasks.pull(task._id);
  await project.save();

  // Recalculate progress after removing a task.
  if (recalculateTaskProgress(project)) await project.save();

  await notifyTaskEvent({ recipientId: String(project.freelancer), senderId: req.user._id, project, task, action: 'deleted' });

  emitToProject(project._id.toString(), 'task:deleted', { projectId: project._id, taskId: req.params.taskId });
  sendResponse(res, 200, 'Task deleted', project.tasks);
});

// ─── Upload Project File ──────────────────────────────────────────────────────
export const uploadProjectFile = catchAsync(async (req, res) => {
  if (!req.files?.length) throw new ApiError(400, 'No files provided');

  const project = await Project.findById(req.params.projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const isParticipant =
    project.client.toString() === req.user._id.toString() ||
    project.freelancer.toString() === req.user._id.toString();
  if (!isParticipant) throw new ApiError(403, 'Not authorized');

  const uploaded = await uploadMultipleFiles(req.files, 'projects');
  const newFiles = uploaded.map((f) => ({
    ...f,
    uploadedBy: req.user._id,
    category: req.body.category || 'other',
    description: req.body.description || '',
  }));

  project.files.push(...newFiles);
  await project.save();

  emitToProject(project._id.toString(), 'file:uploaded', { files: newFiles, uploadedBy: req.user._id });
  sendResponse(res, 201, 'Files uploaded', project.files);
});

// ─── Submit Delivery ──────────────────────────────────────────────────────────
export const submitDelivery = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.projectId)) {
    throw new ApiError(400, 'Invalid project id');
  }

  const project = await Project.findOne({
    _id: req.params.projectId,
    freelancer: req.user._id,
    status: { $in: ['active', 'in_revision'] },
  });
  if (!project) throw new ApiError(404, 'Project not found or cannot submit delivery');

  const deliveryFiles = req.files?.files?.length
    ? await uploadMultipleFiles(req.files.files, 'deliveries')
    : [];
  const screenshots = req.files?.screenshots?.length
    ? await uploadMultipleFiles(req.files.screenshots, 'deliveries')
    : [];

  project.deliveries.push({
    submittedBy: req.user._id,
    title: req.body.title || '',
    message: req.body.message,
    demoUrl: req.body.demoUrl || '',
    files: deliveryFiles,
    screenshots,
    status: 'pending',
  });

  assertProjectTransition(project.status, 'pending_delivery');
  project.status = 'pending_delivery';
  await project.save();

  await notifyMilestoneUpdate({
    recipientId: project.client,
    senderId: req.user._id,
    projectTitle: project.title,
    milestoneTitle: 'Delivery',
    status: 'submitted',
    projectId: project._id,
  });
  emitToProject(project._id.toString(), 'delivery:submitted', { projectId: project._id });

  await syncServiceOrderOnDelivery({ project, action: 'submitted', actor: req.user });

  sendResponse(res, 201, 'Delivery submitted', project);
});

// ─── List Deliveries ──────────────────────────────────────────────────────────
export const getProjectDeliveries = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.projectId)) {
    throw new ApiError(400, 'Invalid project id');
  }

  const project = await Project.findById(req.params.projectId)
    .select('client freelancer deliveries')
    .populate('deliveries.submittedBy', 'firstName lastName avatar')
    .lean();
  if (!project) throw new ApiError(404, 'Project not found');

  const isParticipant =
    req.user.role === 'admin' ||
    String(project.client) === String(req.user._id) ||
    String(project.freelancer) === String(req.user._id);
  if (!isParticipant) throw new ApiError(403, 'Not authorized to view this project');

  const deliveries = [...(project.deliveries || [])].sort(
    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
  );
  sendResponse(res, 200, 'Deliveries fetched', {
    projectId: project._id,
    client: project.client,
    freelancer: project.freelancer,
    deliveries,
  });
});

// ─── Get Single Delivery ──────────────────────────────────────────────────────
export const getProjectDelivery = catchAsync(async (req, res) => {
  const { projectId, deliveryId } = req.params;
  if (!mongoose.isValidObjectId(projectId) || !mongoose.isValidObjectId(deliveryId)) {
    throw new ApiError(400, 'Invalid project or delivery id');
  }

  const project = await Project.findById(projectId)
    .select('client freelancer deliveries')
    .populate('deliveries.submittedBy', 'firstName lastName avatar')
    .lean();
  if (!project) throw new ApiError(404, 'Project not found');

  const isParticipant =
    req.user.role === 'admin' ||
    String(project.client) === String(req.user._id) ||
    String(project.freelancer) === String(req.user._id);
  if (!isParticipant) throw new ApiError(403, 'Not authorized to view this project');

  const delivery = (project.deliveries || []).find((d) => String(d._id) === String(deliveryId));
  if (!delivery) throw new ApiError(404, 'Delivery not found');

  sendResponse(res, 200, 'Delivery fetched', {
    projectId: project._id,
    client: project.client,
    freelancer: project.freelancer,
    delivery,
  });
});

// ─── Update Delivery (freelancer resubmission after revision) ─────────────────
export const updateProjectDelivery = catchAsync(async (req, res) => {
  const { projectId, deliveryId } = req.params;
  if (!mongoose.isValidObjectId(projectId) || !mongoose.isValidObjectId(deliveryId)) {
    throw new ApiError(400, 'Invalid project or delivery id');
  }

  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const isAuthor =
    req.user.role === 'admin' || String(project.freelancer) === String(req.user._id);
  if (!isAuthor) throw new ApiError(403, 'Only the freelancer can update a delivery');

  const delivery = project.deliveries.id(deliveryId);
  if (!delivery) throw new ApiError(404, 'Delivery not found');

  if (req.body.title !== undefined) delivery.title = req.body.title || '';
  if (req.body.message !== undefined) delivery.message = req.body.message;
  if (req.body.demoUrl !== undefined) delivery.demoUrl = req.body.demoUrl || '';

  if (req.files?.files?.length) {
    const uploaded = await uploadMultipleFiles(req.files.files, 'deliveries');
    delivery.files.push(...uploaded);
  }
  if (req.files?.screenshots?.length) {
    const uploaded = await uploadMultipleFiles(req.files.screenshots, 'deliveries');
    delivery.screenshots.push(...uploaded);
  }

  // A resubmission after revision goes back to the front of the client queue.
  if (delivery.status === 'revision_requested') {
    assertProjectTransition(project.status, 'pending_delivery');
    delivery.status = 'pending';
    delivery.submittedAt = new Date();
    delivery.revisionNote = '';
    delivery.reviewedAt = null;
    delivery.reviewedBy = null;
    project.status = 'pending_delivery';
  }

  await project.save();

  await notifyMilestoneUpdate({
    recipientId: project.client,
    senderId: req.user._id,
    projectTitle: project.title,
    milestoneTitle: 'Delivery',
    status: 'submitted',
    projectId: project._id,
  });
  emitToProject(project._id.toString(), 'delivery:submitted', { projectId: project._id });

  await syncServiceOrderOnDelivery({ project, action: 'submitted', actor: req.user });

  sendResponse(res, 200, 'Delivery updated', project);
});

// ─── Review Delivery ──────────────────────────────────────────────────────────
export const reviewDelivery = catchAsync(async (req, res) => {
  const { projectId, deliveryId } = req.params;
  const { action, revisionNote } = req.body;

  if (!mongoose.isValidObjectId(projectId) || !mongoose.isValidObjectId(deliveryId)) {
    throw new ApiError(400, 'Invalid project or delivery id');
  }

  const project = await Project.findOne({
    _id: projectId,
    client: req.user._id,
    status: 'pending_delivery',
  }).populate('freelancer', 'firstName lastName email');

  if (!project) {
    // Distinguish a missing/permission-ineligible project from a project that
    // simply isn't in review state, so clients don't chase a phantom 404.
    const exists = await Project.exists({ _id: projectId, client: req.user._id });
    if (!exists) throw new ApiError(404, 'Project not found');

    const milestone = await Milestone.findOne({ _id: deliveryId, project: projectId });
    if (milestone) {
      throw new ApiError(400, 'Milestone deliveries are reviewed via the milestone endpoint (/milestones/:milestoneId/approve or /revision).');
    }
    throw new ApiError(400, 'This project has no delivery pending review.');
  }

  const delivery = project.deliveries.id(deliveryId);
  if (!delivery) {
    const milestone = await Milestone.findOne({ _id: deliveryId, project: projectId });
    if (milestone) {
      throw new ApiError(400, 'Milestone deliveries are reviewed via the milestone endpoint (/milestones/:milestoneId/approve or /revision).');
    }
    throw new ApiError(404, 'Delivery not found');
  }

  // ENFORCE PAYMENT CHECK on approval
  if (action === 'approve') {
    const job = await Job.findById(project.job);
    if (job && job.paymentStatus !== 'funded') {
      throw new ApiError(400, 'Payment not funded. Please complete payment before approving delivery.');
    }
  }

  delivery.status = action === 'approve' ? 'approved' : 'revision_requested';
  delivery.revisionNote = revisionNote || '';
  delivery.reviewedAt = new Date();
  delivery.reviewedBy = req.user._id;

  if (action === 'approve') {
    // Release escrow BEFORE marking the project completed. For job-backed
    // contracts releaseProjectPayment() closes the whole chain transactionally
    // (and bumps user stats); for service orders releaseEscrowFunds() releases
    // the order escrow first. If the release fails, the project is never marked
    // completed and the error propagates to the client.
    let isServiceOrder = false;
    if (!project.serviceOrder) {
      const { releaseProjectPayment } = await import('../services/contract.service.js');
      await releaseProjectPayment({ project, releasedBy: req.user._id });
    } else {
      const order = await ServiceOrder.findById(project.serviceOrder);
      if (!order) throw new ApiError(404, 'Service order not found');
      if (order.status !== 'delivered') {
        throw new ApiError(400, `Service order is ${order.status}; only delivered orders can be completed`);
      }
      const { releaseEscrowFunds } = await import('../services/payment.service.js');
      // Money moves FIRST. On failure this throws and the project stays
      // pending_delivery — we never mark completion before the escrow release.
      await releaseEscrowFunds(order.escrow.toString(), req.user._id);
      isServiceOrder = true;
      // The escrow release already propagated the project to completed.
      assertProjectTransition(project.status, 'completed');
      project.status = 'completed';
      project.timeline.completedAt = new Date();
      project.progress = 100;
    }

    // Service-order escrow releases do not bump user stats, so do it here for
    // both parties. (Job-backed releaseProjectPayment already bumped both.)
    if (isServiceOrder) {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { 'stats.completedProjects': 1, 'stats.activeProjects': -1 },
      });
      await User.findByIdAndUpdate(project.freelancer._id, {
        $inc: { 'stats.completedProjects': 1, 'stats.activeProjects': -1 },
      });
    }

    // Trigger reputation recalculation for both parties
    try {
      const { calculateReputationScore } = await import('../services/reputation.service.js');
      const [freelancerRep, clientRep] = await Promise.all([
        calculateReputationScore(project.freelancer._id, 'project_completion', project._id),
        calculateReputationScore(req.user._id, 'project_completion', project._id),
      ]);
      if (freelancerRep) {
        await User.findByIdAndUpdate(project.freelancer._id, {
          'stats.reputationScore': freelancerRep.trustScore,
          'stats.trustTier': freelancerRep.trustTier,
        });
      }
      if (clientRep) {
        await User.findByIdAndUpdate(req.user._id, {
          'stats.reputationScore': clientRep.trustScore,
          'stats.trustTier': clientRep.trustTier,
        });
      }
    } catch (repErr) {
      console.error('Reputation recalculation error after project completion:', repErr.message);
    }

    await notifyProjectCompleted(project.freelancer._id, project.title, project._id);
    await sendProjectCompletedEmail(project.freelancer, project.title).catch(() => null);
  } else {
    assertProjectTransition(project.status, 'in_revision');
    project.status = 'in_revision';
    project.revisionsUsed += 1;
    await notifyMilestoneUpdate({
      recipientId: project.freelancer._id,
      senderId: req.user._id,
      projectTitle: project.title,
      milestoneTitle: 'Delivery',
      status: 'revision_requested',
      projectId: project._id,
    });
  }

  await project.save();
  emitToProject(project._id.toString(), 'delivery:reviewed', { action, projectId: project._id });

  await syncServiceOrderOnDelivery({
    project,
    action: action === 'approve' ? 'approved' : 'revision_requested',
    actor: req.user,
  });

  sendResponse(res, 200, `Delivery ${action === 'approve' ? 'approved' : 'revision requested'}`, project);
});

// ─── Complete Project ─────────────────────────────────────────────────────────
// Prevents completion while any escrow funds are still held (funded, in_progress,
// submitted, disputed) — the client must release or refund escrow first via the
// milestone/approval workflow. This prevents marking a project "complete" without
// the freelancer ever receiving payment.
const ACTIVE_ESCROW_STATUSES = ['funded', 'in_progress', 'submitted', 'disputed'];

export const completeProject = catchAsync(async (req, res) => {
  const project = await Project.findOne({
    _id: req.params.projectId,
    client: req.user._id,
  });
  if (!project) throw new ApiError(404, 'Project not found');
  if (project.status === 'completed') throw new ApiError(400, 'Project is already completed');

  // Block if escrow funds are still held
  const activeEscrows = await Escrow.countDocuments({
    project: project._id,
    status: { $in: ACTIVE_ESCROW_STATUSES },
  });
  if (activeEscrows > 0) {
    throw new ApiError(
      400,
      `Cannot complete project while ${activeEscrows} escrow(s) still hold funds. Release or refund pending escrows first.`
    );
  }

  assertProjectTransition(project.status, 'completed');
  project.status = 'completed';
  project.timeline.completedAt = new Date();
  project.progress = 100;
  await project.save();

  // Trigger reputation recalculation for both parties
  try {
    const { calculateReputationScore } = await import('../services/reputation.service.js');
    const [freelancerRep, clientRep] = await Promise.all([
      calculateReputationScore(project.freelancer, 'project_completion', project._id),
      calculateReputationScore(req.user._id, 'project_completion', project._id),
    ]);
    if (freelancerRep) {
      await User.findByIdAndUpdate(project.freelancer, {
        'stats.reputationScore': freelancerRep.trustScore,
        'stats.trustTier': freelancerRep.trustTier,
      });
    }
    if (clientRep) {
      await User.findByIdAndUpdate(req.user._id, {
        'stats.reputationScore': clientRep.trustScore,
        'stats.trustTier': clientRep.trustTier,
      });
    }
  } catch (repErr) {
    console.error('Reputation recalculation error after project completion:', repErr.message);
  }

  sendResponse(res, 200, 'Project marked as completed', project);
});

// ─── Raise Dispute ────────────────────────────────────────────────────────────
export const raiseDispute = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const isParticipant =
    project.client.toString() === req.user._id.toString() ||
    project.freelancer.toString() === req.user._id.toString();
  if (!isParticipant) throw new ApiError(403, 'Not authorized');
  if (project.dispute.isDisputed) throw new ApiError(400, 'Dispute already raised');
  if (TERMINAL_PROJECT_STATUSES.includes(project.status)) {
    throw new ApiError(400, `Cannot dispute a ${project.status} project`);
  }
  assertProjectTransition(project.status, 'disputed');

  project.dispute = {
    isDisputed: true,
    reason: req.body.reason,
    raisedBy: req.user._id,
    raisedAt: new Date(),
  };
  project.status = 'disputed';
  await project.save();

  sendResponse(res, 200, 'Dispute raised. Admin will review shortly.', project);
});
