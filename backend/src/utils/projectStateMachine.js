import { ApiError } from './apiResponse.js';

/**
 * Centralized Project status state machine.
 *
 * Every Project.status mutation must be validated here so contracts can never
 * jump between arbitrary statuses. Terminal states (completed / cancelled) are
 * protected and can never be exited, which is what guarantees a refund can
 * never move a completed project back to pending_payment.
 */
export const PROJECT_STATUSES = [
  'pending_payment',
  'active',
  'on_hold',
  'pending_delivery',
  'in_revision',
  'disputed',
  'completed',
  'cancelled',
];

// Terminal statuses — once reached, no further transition is permitted.
export const TERMINAL_PROJECT_STATUSES = ['completed', 'cancelled'];

// Statuses that count as "active" work for a client/freelancer.
export const ACTIVE_PROJECT_STATUSES = ['active', 'pending_delivery', 'in_revision'];

const ALLOWED_TRANSITIONS = {
  pending_payment: ['active', 'cancelled', 'disputed'],
  active: ['on_hold', 'pending_delivery', 'in_revision', 'completed', 'disputed', 'cancelled'],
  on_hold: ['active', 'pending_delivery', 'completed', 'disputed', 'cancelled'],
  pending_delivery: ['in_revision', 'completed', 'disputed'],
  in_revision: ['active', 'pending_delivery', 'completed', 'disputed', 'cancelled'],
  disputed: ['active', 'pending_delivery', 'in_revision', 'completed', 'pending_payment', 'cancelled'],
  completed: [],
  cancelled: [],
};

/**
 * Validate a transition. Throws a 400 ApiError if the transition is illegal.
 * @param {string} from current status
 * @param {string} to   requested next status
 */
export const assertProjectTransition = (from, to) => {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    throw new ApiError(400, `Unknown project status: "${from}"`);
  }
  if (!allowed.includes(to)) {
    throw new ApiError(
      400,
      `Invalid project status transition: ${from} → ${to}. ` +
      `Allowed: ${allowed.length ? allowed.join(', ') : 'none (terminal status)'}`
    );
  }
  return true;
};

/**
 * Apply a validated transition to a Project document. Mutates `project.status`
 * in place after validating the transition. Pass a plain object or a Mongoose doc.
 */
export const applyProjectTransition = (project, to, opts = {}) => {
  const from = project.status || project.get?.('status');
  assertProjectTransition(from, to);
  project.status = to;
  return project;
};