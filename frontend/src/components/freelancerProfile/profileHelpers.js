import { format, parseISO, isValid } from 'date-fns';
import { formatRate as formatRateBase } from '@/utils/currency';

// Single source of truth for availability. The UI must never show two
// availability values at once, so both sources are merged here:
// `user.availabilityStatus` (available | busy | vacation | offline) wins when
// valid; otherwise `profile.availability` (available | partially_available |
// not_available) is mapped onto the same set.
export const AVAILABILITY_STATUS = {
  available: { label: 'Available to work', tone: 'success', dot: 'bg-green-500' },
  busy: { label: 'Currently busy', tone: 'warning', dot: 'bg-amber-500' },
  vacation: { label: 'On vacation', tone: 'warning', dot: 'bg-amber-400' },
  offline: { label: 'Offline', tone: 'neutral', dot: 'bg-gray-400' },
};

const PROFILE_AVAILABILITY_TO_STATUS = {
  available: 'available',
  partially_available: 'busy',
  not_available: 'offline',
};

export const getAvailability = (user, profile) => {
  const key = AVAILABILITY_STATUS[user?.availabilityStatus]
    ? user.availabilityStatus
    : PROFILE_AVAILABILITY_TO_STATUS[profile?.availability] || 'available';
  return { key, ...AVAILABILITY_STATUS[key] };
};

// Rate rules: null / undefined / missing ⇒ "Rate not set". A real stored `0`
// renders "0 ETB/hr". Centralized here so every caller agrees.
export const formatRateOrUnset = (rate, currency = 'ETB') =>
  formatRate(rate, currency) ?? 'Rate not set';

export const LEVEL_LABELS = {
  newcomer: 'Newcomer',
  intermediate: 'Intermediate',
  experienced: 'Experienced',
  expert: 'Expert',
  top_rated_plus: 'Top Rated Plus',
};

export const SKILL_LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

export const PROFICIENCY_LABELS = {
  basic: 'Basic',
  conversational: 'Conversational',
  professional: 'Professional',
  native: 'Native',
};

export const TRUST_TIER_LABELS = {
  unrated: 'New',
  emerging: 'Emerging',
  reliable: 'Reliable',
  trusted: 'Trusted',
  elite: 'Elite',
};

export const fullName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

export const ROLE_LABELS = {
  freelancer: 'Freelancer',
  client: 'Client',
  admin: 'Administrator',
};

// Public-facing role label derived from the account's actual role. Never
// hardcode; falls back to a generic label when the role is unknown.
export const roleLabel = (user) => {
  const role = user?.role || user?.userType;
  return ROLE_LABELS[role] || (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member');
};

export const formatDate = (value, pattern = 'MMM yyyy') => {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(d) ? format(d, pattern) : null;
};

export const formatRange = (start, end, isCurrent) => {
  if (isCurrent) return start ? `${formatDate(start)} – Present` : 'Present';
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || null;
};

export const formatRate = (rate, currency = 'ETB') => formatRateBase(rate, currency);

export const displayLocation = (profile, user) => {
  const parts = [
    profile?.location?.city,
    profile?.location?.country || user?.country,
  ].filter(Boolean);
  return parts.join(', ') || null;
};

export const listLanguages = (profile) => {
  const list = Array.isArray(profile?.languages) ? profile.languages : [];
  return list
    .map((l) => (l?.name ? (PROFICIENCY_LABELS[l.proficiency] ? `${l.name} · ${PROFICIENCY_LABELS[l.proficiency]}` : l.name) : null))
    .filter(Boolean);
};

// Build Category → Subcategory → Skills hierarchy from real profile data.
// `profile.categories` holds main categories, `profile.subcategories` holds leaves.
export const buildCategoryHierarchy = (profile) => {
  const mains = Array.isArray(profile?.categories)
    ? profile.categories.filter((c) => c && !c.parent)
    : [];
  const subs = Array.isArray(profile?.subcategories)
    ? profile.subcategories.filter(Boolean)
    : [];

  const hierarchy = mains.map((main) => ({ main, subcategories: [] }));
  const mainKeys = new Set(hierarchy.map((h) => String(h.main._id)));
  const orphaned = [];

  subs.forEach((sub) => {
    const parentId = sub.parent?._id || sub.parent;
    const key = parentId ? String(parentId) : null;
    if (key && mainKeys.has(key)) {
      const bucket = hierarchy.find((h) => String(h.main._id) === key);
      bucket.subcategories.push(sub);
    } else {
      orphaned.push(sub);
    }
  });

  if (orphaned.length) hierarchy.push({ main: null, subcategories: orphaned });
  return hierarchy;
};

// Real years-of-experience estimate from skill years and work history dates.
export const computeYearsOfExperience = (profile) => {
  const skillYears = (profile?.skills || [])
    .map((s) => Number(s?.yearsOfExperience) || 0)
    .filter(Boolean);

  let fromHistory = 0;
  const history = profile?.experience || [];
  if (history.length) {
    const months = history.reduce((acc, e) => {
      if (!e?.startDate) return acc;
      const start = new Date(e.startDate);
      const end = e?.isCurrent ? new Date() : e?.endDate ? new Date(e.endDate) : start;
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return acc;
      return acc + Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    }, 0);
    fromHistory = Math.round(months / 12);
  }

  const maxSkill = skillYears.length ? Math.max(...skillYears) : 0;
  return Math.max(maxSkill, fromHistory) || null;
};

// Turn the review API's ratingDistribution into {1..5} counts. The API returns
// an object map ({ 5: 2, 4: 0, ... }); a flat array is also accepted for safety.
export const ratingBreakdown = (distribution = {}) => {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (Array.isArray(distribution)) {
    distribution.forEach((r) => {
      const k = Math.round(Number(r));
      if (k >= 1 && k <= 5) counts[k] += 1;
    });
  } else if (distribution && typeof distribution === 'object') {
    Object.entries(distribution).forEach(([key, value]) => {
      const k = Math.round(Number(key));
      if (k >= 1 && k <= 5) counts[k] = Number(value) || 0;
    });
  }
  return counts;
};
