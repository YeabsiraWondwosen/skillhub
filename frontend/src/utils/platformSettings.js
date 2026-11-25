/**
 * Pure helpers for the admin platform settings UI.
 *
 * Keeping these free of React makes the form <-> server mapping easy to test.
 */

export const DEFAULT_CURRENCY = 'ETB';
export const DEFAULT_LANGUAGE = 'en';
export const DEFAULT_TIME_ZONE = 'Africa/Addis_Ababa';

export const buildPlatformFormValues = (settings) => ({
  name: settings?.name || '',
  tagline: settings?.tagline || '',
  description: settings?.description || '',
  focus: settings?.focus?._id || '',
  currency: settings?.currency || DEFAULT_CURRENCY,
  language: settings?.language || DEFAULT_LANGUAGE,
  timeZone: settings?.timeZone || DEFAULT_TIME_ZONE,
});

export const commissionPercentToFraction = (percent) => {
  if (percent === null || percent === undefined || String(percent).trim() === '') return null;
  const numeric = Number(percent);
  if (!Number.isFinite(numeric)) return null;
  return Math.round((numeric / 100) * 10000) / 10000;
};

/**
 * Request payload for PATCH /admin/settings/commission.
 *
 * The form works in percent (0–100) while the backend stores a fraction (0–1).
 * A blank/missing value maps to `null` so the backend can reject it — it is
 * never silently defaulted to zero.
 */
export const buildCommissionPayload = (percent) => ({
  commissionRate: commissionPercentToFraction(percent),
});

export const commissionFractionToPercent = (fraction) => {
  const numeric = Number(fraction);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100 * 100) / 100;
};
