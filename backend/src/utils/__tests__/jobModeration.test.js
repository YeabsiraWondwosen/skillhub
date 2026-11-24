import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateJobHideRestriction,
  assertJobCanBeHidden,
  isProjectFunded,
  isProjectInProgress,
  isProjectCompleted,
  isProjectRestrictingHide,
} from '../jobModeration.js';

const openJob = { status: 'open' };

const project = (overrides = {}) => ({
  status: 'pending_payment',
  budget: { paidAmount: 0 },
  ...overrides,
});

test('an accepted application blocks hiding', () => {
  const result = evaluateJobHideRestriction({ job: openJob, acceptedApplications: 1, projects: [] });
  assert.equal(result.restricted, true);
  assert.match(result.reason, /hired|accepted/i);
});

test('a funded project (paid amount) blocks hiding', () => {
  const result = evaluateJobHideRestriction({
    job: openJob,
    acceptedApplications: 0,
    projects: [project({ status: 'active', budget: { paidAmount: 500 } })],
  });
  assert.equal(result.restricted, true);
  assert.match(result.reason, /funded/i);
});

test('a funded project (escrow reference) blocks hiding', () => {
  const result = evaluateJobHideRestriction({
    job: openJob,
    projects: [project({ escrowPaymentId: 'escrow_123' })],
  });
  assert.equal(result.restricted, true);
  assert.match(result.reason, /funded/i);
});

test('an in-progress project blocks hiding', () => {
  const result = evaluateJobHideRestriction({
    job: openJob,
    projects: [project({ status: 'active' })],
  });
  assert.equal(result.restricted, true);
  assert.match(result.reason, /in progress/i);
});

test('every in-flight project status blocks hiding', () => {
  for (const status of ['active', 'on_hold', 'pending_delivery', 'in_revision', 'disputed']) {
    const result = evaluateJobHideRestriction({ job: openJob, projects: [project({ status })] });
    assert.equal(result.restricted, true, `expected ${status} to block hiding`);
  }
});

test('a completed project blocks hiding', () => {
  const result = evaluateJobHideRestriction({
    job: openJob,
    projects: [project({ status: 'completed' })],
  });
  assert.equal(result.restricted, true);
  assert.match(result.reason, /completed/i);
});

test('a job that is itself in progress blocks hiding', () => {
  const result = evaluateJobHideRestriction({ job: { status: 'in_progress' } });
  assert.equal(result.restricted, true);
  assert.match(result.reason, /in progress/i);
});

test('a job that is itself completed blocks hiding', () => {
  const result = evaluateJobHideRestriction({ job: { status: 'completed' } });
  assert.equal(result.restricted, true);
  assert.match(result.reason, /completed/i);
});

test('a pending_payment project is NOT treated as funded or in progress', () => {
  const pending = project({ status: 'pending_payment', budget: { paidAmount: 0 } });
  assert.equal(isProjectFunded(pending), false);
  assert.equal(isProjectInProgress(pending), false);
  assert.equal(isProjectCompleted(pending), false);
  assert.equal(isProjectRestrictingHide(pending), false);
});

test('an eligible job may still be hidden', () => {
  const result = evaluateJobHideRestriction({
    job: openJob,
    acceptedApplications: 0,
    projects: [project({ status: 'pending_payment', budget: { paidAmount: 0 } })],
  });
  assert.equal(result.restricted, false);
  assert.equal(result.reason, null);
});

test('a job with no applications and no projects is eligible', () => {
  const result = evaluateJobHideRestriction({ job: openJob });
  assert.equal(result.restricted, false);
  assert.equal(result.reason, null);
});

test('a cancelled project does not by itself block hiding', () => {
  const result = evaluateJobHideRestriction({
    job: openJob,
    projects: [project({ status: 'cancelled' })],
  });
  assert.equal(result.restricted, false);
});

test('combines multiple restrictions into a single clear reason', () => {
  const result = evaluateJobHideRestriction({
    job: { status: 'in_progress' },
    acceptedApplications: 1,
    projects: [project({ status: 'active', budget: { paidAmount: 500 } })],
  });
  assert.equal(result.restricted, true);
  assert.match(result.reason, /accepted application/i);
  assert.match(result.reason, /funded/i);
  assert.match(result.reason, /in progress/i);
  assert.match(result.reason, /^Cannot hide this job because /);
});

test('assertJobCanBeHidden throws a 409 ApiError for restricted jobs', () => {
  assert.throws(
    () => assertJobCanBeHidden({ job: openJob, acceptedApplications: 1 }),
    (err) => err.statusCode === 409 && /Cannot hide this job/.test(err.message)
  );
});

test('assertJobCanBeHidden resolves for eligible jobs', () => {
  assert.doesNotThrow(() => assertJobCanBeHidden({ job: openJob }));
  assert.equal(assertJobCanBeHidden({ job: openJob }), true);
});
