import { ApiError } from './apiResponse.js';

/**
 * Shared rules that decide whether an admin is allowed to hide / unpublish a
 * job. Once a freelancer has been hired — or money has actually moved and a
 * contract is under way — the job listing can no longer be pulled from the
 * marketplace because a real engagement depends on it.
 *
 * These helpers are intentionally pure (no DB access) so the decision logic is
 * unit-testable and reused unchanged by the controller and by the read APIs
 * that decorate jobs with `canHide` / `hideRestrictionReason` for the UI.
 */

// An application in this state means the client already hired the freelancer.
export const ACCEPTED_APPLICATION_STATUS = 'accepted';

// Job statuses that indicate the engagement is already running or finished.
export const JOB_STATUSES_BLOCKING_HIDE = ['in_progress', 'completed'];

// Project statuses that represent work already in flight. NOTE: `pending_payment`
// is deliberately absent — a freshly hired contract that has not been funded yet
// is NOT considered in progress.
export const PROJECT_STATUSES_IN_PROGRESS = [
  'active',
  'on_hold',
  'pending_delivery',
  'in_revision',
  'disputed',
];

export const PROJECT_STATUSES_COMPLETED = ['completed'];

/**
 * A project counts as funded only when money has actually been committed:
 * either funds were captured (`budget.paidAmount > 0`) or an escrow payment
 * reference exists. A bare `pending_payment` project is explicitly NOT funded.
 */
export const isProjectFunded = (project) => {
  if (!project) return false;
  const paidAmount = Number(project.budget?.paidAmount || 0);
  return paidAmount > 0 || Boolean(project.escrowPaymentId);
};

export const isProjectInProgress = (project) =>
  PROJECT_STATUSES_IN_PROGRESS.includes(project?.status);

export const isProjectCompleted = (project) =>
  PROJECT_STATUSES_COMPLETED.includes(project?.status);

/** A project blocks hiding when it is funded, in progress, or completed. */
export const isProjectRestrictingHide = (project) =>
  isProjectFunded(project) || isProjectInProgress(project) || isProjectCompleted(project);

const joinWithAnd = (items) => {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
};

/**
 * Evaluate whether a job may be hidden.
 *
 * @param {object}   context
 * @param {object}   context.job                  job document/plain object
 * @param {number}   [context.acceptedApplications=0] count of accepted applications
 * @param {Array}    [context.projects=[]]        related projects (any shape)
 * @returns {{ restricted: boolean, reason: string|null }}
 */
export const evaluateJobHideRestriction = ({ job, acceptedApplications = 0, projects = [] } = {}) => {
  const reasons = [];

  if (acceptedApplications > 0) {
    reasons.push('a freelancer has already been hired (accepted application)');
  }

  const restrictingProjects = projects.filter(isProjectRestrictingHide);
  if (restrictingProjects.length > 0) {
    const descriptors = [];
    if (restrictingProjects.some(isProjectFunded)) descriptors.push('funded');
    if (restrictingProjects.some(isProjectInProgress)) descriptors.push('in progress');
    if (restrictingProjects.some(isProjectCompleted)) descriptors.push('completed');
    reasons.push(`a related project is ${joinWithAnd(descriptors)}`);
  }

  if (JOB_STATUSES_BLOCKING_HIDE.includes(job?.status)) {
    reasons.push(`the job is ${String(job.status).replace(/_/g, ' ')}`);
  }

  if (reasons.length === 0) return { restricted: false, reason: null };

  return {
    restricted: true,
    reason: `Cannot hide this job because ${joinWithAnd(reasons)}.`,
  };
};

/**
 * Throw an HTTP 409 ApiError when the job may not be hidden. Controllers should
 * call this BEFORE mutating `isApproved`, so a restricted job is never updated.
 */
export const assertJobCanBeHidden = (context) => {
  const { restricted, reason } = evaluateJobHideRestriction(context);
  if (restricted) throw new ApiError(409, reason);
  return true;
};
