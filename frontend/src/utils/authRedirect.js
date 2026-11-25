const STORAGE_KEY = 'skillhub-invite-intent';
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const AUTH_SCREEN_RE = /^\/auth(?:\/|$)/;
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

const ROLE_HOME = {
  admin: '/admin/dashboard',
  freelancer: '/freelancer/dashboard',
  client: '/client/dashboard',
};

export const roleHomePath = (role) => ROLE_HOME[role] || '/';

export function isSafeInternalPath(value) {
  if (typeof value !== 'string') return false;
  const path = value.trim();
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (path.includes('\\')) return false;
  if (CONTROL_CHARS_RE.test(path)) return false;
  if (AUTH_SCREEN_RE.test(path)) return false;
  return true;
}

const asText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export function sanitizeInviteIntent(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const freelancerId = typeof raw.freelancerId === 'string' ? raw.freelancerId.trim() : '';
  if (!OBJECT_ID_RE.test(freelancerId)) return null;

  return {
    freelancerId,
    firstName: asText(raw.firstName, 60),
    lastName: asText(raw.lastName, 60),
    avatarUrl: asText(raw.avatarUrl, 500),
    tagline: asText(raw.tagline, 160),
    returnTo: isSafeInternalPath(raw.returnTo) ? raw.returnTo.trim() : '/freelancers',
  };
}

const sessionStore = () => (typeof window === 'undefined' ? null : window.sessionStorage || null);

export function stashInviteIntent(intent) {
  const safe = sanitizeInviteIntent(intent);
  if (!safe) return null;
  try {
    sessionStore()?.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    /* storage unavailable (private mode) — router state still carries the intent */
  }
  return safe;
}

export function readInviteIntent() {
  try {
    const raw = sessionStore()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const safe = sanitizeInviteIntent(JSON.parse(raw));
    if (!safe) clearInviteIntent();
    return safe;
  } catch {
    return null;
  }
}

export function clearInviteIntent() {
  try {
    sessionStore()?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export function inviteIntentFromCard(freelancer, profile, returnTo) {
  return sanitizeInviteIntent({
    freelancerId: freelancer?._id,
    firstName: freelancer?.firstName,
    lastName: freelancer?.lastName,
    avatarUrl: freelancer?.avatar?.url,
    tagline: profile?.tagline,
    returnTo,
  });
}

export function extractFromPath(state) {
  const from = state?.from;
  if (typeof from === 'string') return from;
  if (from && typeof from.pathname === 'string') {
    return `${from.pathname}${from.search || ''}${from.hash || ''}`;
  }
  return '';
}

export function buildAuthEntryLocation({ returnTo, invite } = {}) {
  const inviteIntent = invite ? sanitizeInviteIntent(invite) : null;
  const destination = isSafeInternalPath(returnTo) ? returnTo.trim() : inviteIntent?.returnTo;
  const state = {};
  if (inviteIntent) state.invite = inviteIntent;
  if (destination && isSafeInternalPath(destination)) {
    const [pathname, ...rest] = destination.split('?');
    state.from = { pathname, search: rest.length ? `?${rest.join('?')}` : '' };
  }
  return { to: { pathname: '/auth/login', search: '' }, state, replace: true };
}

export function resolvePostAuthDestination({ locationState, user } = {}) {
  const state = locationState && typeof locationState === 'object' ? locationState : {};
  const invite = sanitizeInviteIntent(state.invite);

  if (invite && user?.role === 'client') {
    return { to: invite.returnTo, state: { invite }, replace: true };
  }

  const fromPath = extractFromPath(state);
  if (isSafeInternalPath(fromPath)) {
    return { to: fromPath.trim(), state: {}, replace: true };
  }

  return { to: roleHomePath(user?.role), state: {}, replace: true };
}