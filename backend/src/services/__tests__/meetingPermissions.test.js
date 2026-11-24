import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeMeetingTransition,
  assertParticipantOrAdmin,
  refId,
  sameId,
} from '../meeting.service.js';
import { ApiError } from '../../utils/apiResponse.js';

// A realistic 24-hex id shape (values don't matter — refId never validates).
const CLIENT = '6acade3af609510e23d75b01';
const FREELANCER = '6acade3af609510e23d75b02';
const STRANGER = '6acade3af609510e23d75b03';
const ADMIN = '6acade3af609510e23d75b04';

const clientActor = { _id: CLIENT, role: 'client' };
const freelancerActor = { _id: FREELANCER, role: 'freelancer' };
const strangerActor = { _id: STRANGER, role: 'freelancer' };
const adminActor = { _id: ADMIN, role: 'admin' };

const rawPending = { _id: 'm1', status: 'pending', client: CLIENT, freelancer: FREELANCER };
// Simulates exactly what getMeetingDocument returns: populated User documents.
const populatedPending = {
  _id: 'm2',
  status: 'pending',
  client: { _id: CLIENT, firstName: 'C', role: 'client' },
  freelancer: { _id: FREELANCER, firstName: 'F', role: 'freelancer' },
};

const expectApiError = (fn, statusCode, matcher) => {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${err?.constructor?.name}`);
    assert.equal(err.statusCode, statusCode);
    if (matcher) assert.match(err.message, matcher);
    return true;
  });
};

// ─── refId / sameId ──────────────────────────────────────────────────────────

test('refId normalizes ObjectId, string, and populated-document refs', () => {
  assert.equal(refId(CLIENT), CLIENT);
  assert.equal(refId({ _id: CLIENT }), CLIENT);
  assert.equal(refId(null), '');
  assert.equal(refId(undefined), '');
});

test('sameId matches populated docs and raw ids, and never matches empty', () => {
  assert.equal(sameId({ _id: CLIENT }, CLIENT), true);
  assert.equal(sameId(CLIENT, { _id: CLIENT }), true);
  assert.equal(sameId(CLIENT, FREELANCER), false);
  assert.equal(sameId(null, null), false);
  assert.equal(sameId('', ''), false);
});

// ─── The bug: populated documents must not cause false 403s ──────────────────

test('assertParticipantOrAdmin accepts the freelancer when client/freelancer are POPULATED docs', () => {
  assert.doesNotThrow(() => assertParticipantOrAdmin(populatedPending, freelancerActor));
  assert.doesNotThrow(() => assertParticipantOrAdmin(populatedPending, clientActor));
});

test('assertParticipantOrAdmin rejects a non-participant with 403', () => {
  expectApiError(() => assertParticipantOrAdmin(populatedPending, strangerActor), 403, /not a participant/i);
});

// ─── Intended freelancer accepting a pending meeting ─────────────────────────

test('intended freelancer can accept a pending meeting (raw id refs)', () => {
  assert.equal(authorizeMeetingTransition({ meeting: rawPending, actor: freelancerActor, toStatus: 'accepted' }), true);
});

test('intended freelancer can accept a pending meeting (populated refs) — regression', () => {
  assert.equal(authorizeMeetingTransition({ meeting: populatedPending, actor: freelancerActor, toStatus: 'accepted' }), true);
});

test('intended freelancer can decline a pending meeting', () => {
  assert.equal(authorizeMeetingTransition({ meeting: populatedPending, actor: freelancerActor, toStatus: 'declined' }), true);
});

// ─── Different user must be denied ───────────────────────────────────────────

test('a different freelancer cannot accept someone else\'s meeting (403)', () => {
  expectApiError(
    () => authorizeMeetingTransition({ meeting: populatedPending, actor: strangerActor, toStatus: 'accepted' }),
    403,
    /not a participant/i
  );
});

test('the client participant cannot accept their own outgoing request (403)', () => {
  expectApiError(
    () => authorizeMeetingTransition({ meeting: populatedPending, actor: clientActor, toStatus: 'accepted' }),
    403,
    /not allowed to accept/i
  );
});

test('a freelancer-role user listed as the meeting client cannot accept (403)', () => {
  const mismatched = {
    _id: 'm3',
    status: 'pending',
    client: { _id: FREELANCER },
    freelancer: { _id: CLIENT },
  };
  expectApiError(
    () => authorizeMeetingTransition({ meeting: mismatched, actor: freelancerActor, toStatus: 'accepted' }),
    403,
    /only the freelancer can accept or decline/i
  );
});

// ─── Already-processed / invalid-state meetings ──────────────────────────────

test('accepting an already-accepted meeting returns 409', () => {
  const accepted = { ...populatedPending, status: 'accepted' };
  expectApiError(
    () => authorizeMeetingTransition({ meeting: accepted, actor: freelancerActor, toStatus: 'accepted' }),
    409,
    /already accepted/i
  );
});

test('transitioning from a terminal state (declined) returns 409, not 403', () => {
  const declined = { ...populatedPending, status: 'declined' };
  expectApiError(
    () => authorizeMeetingTransition({ meeting: declined, actor: freelancerActor, toStatus: 'accepted' }),
    409,
    /cannot transition/i
  );
});

test('transitioning from a terminal state (completed) returns 409', () => {
  const completed = { ...populatedPending, status: 'completed' };
  expectApiError(
    () => authorizeMeetingTransition({ meeting: completed, actor: clientActor, toStatus: 'cancelled' }),
    409,
    /cannot transition/i
  );
});

test('an unknown target status returns 400', () => {
  expectApiError(
    () => authorizeMeetingTransition({ meeting: populatedPending, actor: freelancerActor, toStatus: 'teleported' }),
    400,
    /status must be one of/i
  );
});

// ─── Admin and other valid transitions still work ────────────────────────────

test('an admin can accept a pending meeting they do not participate in', () => {
  assert.equal(authorizeMeetingTransition({ meeting: populatedPending, actor: adminActor, toStatus: 'accepted' }), true);
});

test('the client can cancel their own pending meeting', () => {
  assert.equal(authorizeMeetingTransition({ meeting: populatedPending, actor: clientActor, toStatus: 'cancelled' }), true);
});

test('the freelancer can complete an accepted meeting', () => {
  const accepted = { ...populatedPending, status: 'accepted' };
  assert.equal(authorizeMeetingTransition({ meeting: accepted, actor: freelancerActor, toStatus: 'completed' }), true);
});
