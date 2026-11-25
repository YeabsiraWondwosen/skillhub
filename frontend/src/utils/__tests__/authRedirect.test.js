import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildAuthEntryLocation,
  clearInviteIntent,
  extractFromPath,
  inviteIntentFromCard,
  isSafeInternalPath,
  readInviteIntent,
  resolvePostAuthDestination,
  roleHomePath,
  sanitizeInviteIntent,
  stashInviteIntent,
} from '../authRedirect.js';

const FREELANCER_ID = '64b7f1a2c3d4e5f6a7b8c9d0';
const VALID_INTENT = {
  freelancerId: FREELANCER_ID,
  firstName: 'Abebe',
  lastName: 'Bekele',
  avatarUrl: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
  tagline: 'Full-stack engineer',
  returnTo: '/freelancers?category=64b7f1a2c3d4e5f6a7b8c9d1',
};

const installFakeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  globalThis.window = {
    sessionStorage: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, v),
      removeItem: (k) => map.delete(k),
    },
  };
  return map;
};

test('accepts internal application paths', () => {
  assert.equal(isSafeInternalPath('/freelancers'), true);
  assert.equal(isSafeInternalPath('/freelancers?category=abc&page=2'), true);
  assert.equal(isSafeInternalPath('/freelancers/64b7f1a2c3d4e5f6a7b8c9d0'), true);
});

test('rejects anything that is not a safe internal path', () => {
  assert.equal(isSafeInternalPath('https://evil.example'), false);
  assert.equal(isSafeInternalPath('//evil.example'), false);
  assert.equal(isSafeInternalPath('/\\evil.example'), false);
  assert.equal(isSafeInternalPath('javascript:alert(1)'), false);
  assert.equal(isSafeInternalPath('/freelancers\r\nSet-Cookie: a=b'), false);
  assert.equal(isSafeInternalPath('/auth/login'), false, 'must not bounce back into auth screens');
  assert.equal(isSafeInternalPath('/auth/register'), false);
  assert.equal(isSafeInternalPath(''), false);
  assert.equal(isSafeInternalPath(null), false);
  assert.equal(isSafeInternalPath(undefined), false);
  assert.equal(isSafeInternalPath(42), false);
});

test('sanitizeInviteIntent keeps only real, bounded identity data', () => {
  const result = sanitizeInviteIntent(VALID_INTENT);
  assert.equal(result.freelancerId, FREELANCER_ID);
  assert.equal(result.firstName, 'Abebe');
  assert.equal(result.lastName, 'Bekele');
  assert.equal(result.tagline, 'Full-stack engineer');
  assert.equal(result.returnTo, VALID_INTENT.returnTo);
  assert.ok(result.firstName.length <= 60);
});

test('sanitizeInviteIntent rejects malformed freelancer ids', () => {
  assert.equal(sanitizeInviteIntent({ ...VALID_INTENT, freelancerId: undefined }), null);
  assert.equal(sanitizeInviteIntent({ ...VALID_INTENT, freelancerId: '[object Object]' }), null);
  assert.equal(sanitizeInviteIntent({ ...VALID_INTENT, freelancerId: '64b7f1a2c3d4e5f6a7b8c9' }), null, '23 chars');
  assert.equal(sanitizeInviteIntent({ ...VALID_INTENT, freelancerId: `${FREELANCER_ID}9` }), null, '25 chars');
  assert.equal(sanitizeInviteIntent({ ...VALID_INTENT, freelancerId: 'zzzzzzzzzzzzzzzzzzzzzzzz' }), null);
  assert.equal(sanitizeInviteIntent({ freelancerId: FREELANCER_ID, returnTo: { toString: () => 'x' } }).firstName, '');
});

test('sanitizeInviteIntent falls back to a safe return path', () => {
  assert.equal(sanitizeInviteIntent({ ...VALID_INTENT, returnTo: 'https://evil.example' }).returnTo, '/freelancers');
  assert.equal(sanitizeInviteIntent({ freelancerId: FREELANCER_ID }).returnTo, '/freelancers');
  assert.equal(sanitizeInviteIntent(null), null);
  assert.equal(sanitizeInviteIntent('nope'), null);
});

test('buildAuthEntryLocation targets the registered /auth/login route', () => {
  const entry = buildAuthEntryLocation({ invite: VALID_INTENT });
  assert.equal(entry.to.pathname, '/auth/login');
  assert.deepEqual(entry.state.invite.freelancerId, FREELANCER_ID);
  assert.equal(entry.state.from.pathname, '/freelancers');
  assert.equal(entry.replace, true);
});

test('buildAuthEntryLocation keeps state out of `to` (React Router v6 reads options.state only)', () => {
  const entry = buildAuthEntryLocation({ invite: VALID_INTENT });
  assert.equal(entry.to.state, undefined, 'to.state is silently dropped by react-router');
  assert.notEqual(entry.state, undefined);
});

test('buildAuthEntryLocation drops unusable destinations', () => {
  const noInvite = buildAuthEntryLocation({ returnTo: 'https://evil.example' });
  assert.equal(noInvite.to.pathname, '/auth/login');
  assert.deepEqual(noInvite.state, {});

  const badInvite = buildAuthEntryLocation({ invite: { freelancerId: 'nope' } });
  assert.deepEqual(badInvite.state, {});
});

test('extractFromPath reads both router location shapes', () => {
  assert.equal(extractFromPath({ from: { pathname: '/freelancers', search: '?page=2' } }), '/freelancers?page=2');
  assert.equal(extractFromPath({ from: '/jobs' }), '/jobs');
  assert.equal(extractFromPath({}), '');
  assert.equal(extractFromPath(undefined), '');
});

test('client returns to the invitation and keeps the intent', () => {
  const destination = resolvePostAuthDestination({
    locationState: buildAuthEntryLocation({ invite: VALID_INTENT }).state,
    user: { role: 'client', firstName: 'Client' },
  });
  assert.equal(destination.to, VALID_INTENT.returnTo);
  assert.equal(destination.state.invite.freelancerId, FREELANCER_ID);
  assert.equal(destination.replace, true);
});

test('non-client roles fall back to the visited page, never to the client dashboard', () => {
  for (const role of ['freelancer', 'admin']) {
    const destination = resolvePostAuthDestination({
      locationState: buildAuthEntryLocation({ invite: VALID_INTENT }).state,
      user: { role },
    });
    assert.equal(destination.to, VALID_INTENT.returnTo);
    assert.equal(destination.state.invite, undefined);
    assert.notEqual(destination.to, '/client/dashboard');
  }
});

test('open-redirect attempts in router state are discarded', () => {
  const destination = resolvePostAuthDestination({
    locationState: { from: { pathname: 'https://evil.example' } },
    user: { role: 'client' },
  });
  assert.equal(destination.to, '/client/dashboard');
});

test('auth screens are not used as a return destination', () => {
  const destination = resolvePostAuthDestination({
    locationState: { from: { pathname: '/auth/login' } },
    user: { role: 'client' },
  });
  assert.equal(destination.to, '/client/dashboard');
});

test('without any prior intent each role lands on its own dashboard', () => {
  assert.equal(resolvePostAuthDestination({ user: { role: 'admin' } }).to, '/admin/dashboard');
  assert.equal(resolvePostAuthDestination({ user: { role: 'freelancer' } }).to, '/freelancer/dashboard');
  assert.equal(resolvePostAuthDestination({ user: { role: 'client' } }).to, '/client/dashboard');
  assert.equal(resolvePostAuthDestination({ user: null }).to, '/');
  assert.equal(roleHomePath('unknown'), '/');
});

test('invite intent survives a full page load via sessionStorage', () => {
  installFakeStorage();
  stashInviteIntent(VALID_INTENT);
  const restored = readInviteIntent();
  assert.equal(restored.freelancerId, FREELANCER_ID);
  assert.equal(restored.tagline, 'Full-stack engineer');
  clearInviteIntent();
  assert.equal(readInviteIntent(), null);
  delete globalThis.window;
});

test('a tampered stored intent is discarded instead of trusted', () => {
  const store = installFakeStorage();
  store.set('skillhub-invite-intent', JSON.stringify({ freelancerId: 'not-an-id', returnTo: 'https://evil.example' }));
  assert.equal(readInviteIntent(), null);
  assert.equal(store.has('skillhub-invite-intent'), false);

  store.set('skillhub-invite-intent', '{not json');
  assert.equal(readInviteIntent(), null);
  delete globalThis.window;
});

test('inviteIntentFromCard maps a rendered talent card to a safe intent', () => {
  const intent = inviteIntentFromCard(
    { _id: FREELANCER_ID, firstName: 'Abebe', lastName: 'Bekele', avatar: { url: 'https://cdn/x.jpg' } },
    { tagline: 'Full-stack engineer' },
    '/freelancers?verified=true'
  );
  assert.equal(intent.freelancerId, FREELANCER_ID);
  assert.equal(intent.avatarUrl, 'https://cdn/x.jpg');
  assert.equal(intent.returnTo, '/freelancers?verified=true');

  assert.equal(inviteIntentFromCard({ firstName: 'No id' }, {}, '/freelancers'), null);
});

test('regression: Find Talent never navigates to the unregistered /login route', () => {
  const page = readFileSync(new URL('../../pages/public/BrowseFreelancersPage.jsx', import.meta.url), 'utf8');
  assert.equal(/navigate\(\s*['"`]\/login['"`]/.test(page), false);
  assert.equal(/to=['"`]\/login['"`]/.test(page), false);
});

test('regression: the login route the page targets is actually registered', () => {
  const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/auth\/login"/);
  assert.match(app, /path="\/auth\/register"/);
});

test('regression: invitation intent is never passed through to.state', () => {
  const page = readFileSync(new URL('../../pages/public/BrowseFreelancersPage.jsx', import.meta.url), 'utf8');
  const authLinks = [
    readFileSync(new URL('../../pages/auth/LoginPage.jsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../../pages/auth/RegisterPage.jsx', import.meta.url), 'utf8'),
  ].join('\n');

  assert.equal(/navigate\([^)]*\bto\.state/.test(page), false);
  assert.equal(/to=\{\{[^}]*\bstate:/.test(authLinks), false, 'Link state must use the state prop');
  assert.match(page, /navigate\(entry\.to, \{ state: entry\.state/);
  assert.match(authLinks, /state=\{location\.state\}/);
});