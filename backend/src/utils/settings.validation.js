import { ApiError } from './apiResponse.js';

/**
 * Pure validation/normalisation helpers for platform settings.
 *
 * These functions never touch the database or the environment config, so they
 * can be unit tested in isolation. Anything that needs persistence lives in
 * services/settings.service.js.
 */

export const PLATFORM_NAME_MAX = 100;
export const PLATFORM_TAGLINE_MAX = 160;
export const PLATFORM_DESCRIPTION_MAX = 1000;
export const PLATFORM_LOGO_URL_MAX = 600;
export const PLATFORM_CURRENCY_MAX = 8;
export const PLATFORM_LANGUAGE_MAX = 12;
export const PLATFORM_TIMEZONE_MAX = 64;

// Commission is stored as a fraction of the gross amount. 0.10 === 10%.
// The safe range is 0% – 100% inclusive.
export const COMMISSION_MIN = 0;
export const COMMISSION_MAX = 1;
export const COMMISSION_MIN_PERCENT = 0;
export const COMMISSION_MAX_PERCENT = 100;

export const DEFAULT_CURRENCY = 'ETB';
export const DEFAULT_LANGUAGE = 'en';
export const DEFAULT_TIME_ZONE = 'Africa/Addis_Ababa';

/**
 * Trim and validate the platform display name. An empty name is only allowed
 * when the caller explicitly wants to clear it (not supported today), so an
 * empty string is rejected.
 */
export const normalizePlatformName = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) throw new ApiError(400, 'Platform name cannot be empty');
  if (trimmed.length > PLATFORM_NAME_MAX) {
    throw new ApiError(400, `Platform name cannot exceed ${PLATFORM_NAME_MAX} characters`);
  }
  return trimmed;
};

/**
 * Normalise an optional free-text field. Empty values are stored as '' rather
 * than left undefined so callers can intentionally clear a field.
 */
export const normalizeOptionalText = (value, { max, label } = {}) => {
  const trimmed = String(value ?? '').trim();
  if (max && trimmed.length > max) {
    throw new ApiError(400, `${label || 'Value'} cannot exceed ${max} characters`);
  }
  return trimmed;
};

export const normalizeCurrency = (value) => {
  const trimmed = String(value ?? '').trim().toUpperCase();
  if (!trimmed) throw new ApiError(400, 'Currency cannot be empty');
  if (!/^[A-Z]{2,8}$/.test(trimmed)) {
    throw new ApiError(400, 'Currency must be a 2–8 letter code (e.g. ETB)');
  }
  return trimmed;
};

export const normalizeLanguage = (value) => {
  const trimmed = String(value ?? '').trim().toLowerCase();
  if (!trimmed) throw new ApiError(400, 'Language cannot be empty');
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(trimmed)) {
    throw new ApiError(400, 'Language must be a language code such as "en" or "en-us"');
  }
  return trimmed;
};

export const normalizeTimeZone = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) throw new ApiError(400, 'Time zone cannot be empty');
  if (trimmed.length > PLATFORM_TIMEZONE_MAX) {
    throw new ApiError(400, `Time zone cannot exceed ${PLATFORM_TIMEZONE_MAX} characters`);
  }
  return trimmed;
};

/**
 * A logo payload may be:
 *   - undefined  → leave unchanged
 *   - null / ''  → clear the logo
 *   - a string   → treated as a hosted URL (publicId kept empty)
 *   - an object  → { url, publicId }
 */
export const normalizeLogo = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === 'string') {
    const url = value.trim();
    if (!url) return null;
    assertValidLogoUrl(url);
    return { url, publicId: '' };
  }

  if (typeof value === 'object') {
    const url = String(value.url ?? '').trim();
    const publicId = String(value.publicId ?? '').trim();
    if (!url) return null;
    assertValidLogoUrl(url);
    return { url, publicId };
  }

  throw new ApiError(400, 'Logo must be a URL, an object, or null');
};

const assertValidLogoUrl = (url) => {
  if (url.length > PLATFORM_LOGO_URL_MAX) {
    throw new ApiError(400, `Logo URL cannot exceed ${PLATFORM_LOGO_URL_MAX} characters`);
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new ApiError(400, 'Logo URL must start with http:// or https://');
  }
};

/**
 * Parse a commission rate expressed as a fraction (0 – 1). Numbers provided as
 * a percentage (e.g. 10 meaning 10%) are accepted for convenience and converted
 * to a fraction, as long as they fall inside 0 – 100.
 */
export const parseCommissionRate = (value) => {
  const isBlank = value === null
    || value === undefined
    || (typeof value === 'string' && value.trim() === '');
  if (isBlank) {
    throw new ApiError(400, 'Commission rate is required');
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new ApiError(400, 'Commission rate must be a number');
  }

  // Accept percentage input (values above 1 and up to 100) by converting it.
  const fraction = numeric > COMMISSION_MAX && numeric <= COMMISSION_MAX_PERCENT
    ? numeric / 100
    : numeric;

  if (fraction < COMMISSION_MIN || fraction > COMMISSION_MAX) {
    throw new ApiError(400, 'Commission rate must be between 0% and 100%');
  }

  // Round to 4 decimal places (0.01% precision) so floating point noise from a
  // percentage input like 12.5 does not leak into stored values.
  return Math.round(fraction * 10000) / 10000;
};

export const toCommissionPercent = (fraction) => {
  if (fraction === null || fraction === undefined || fraction === '') return null;
  if (!Number.isFinite(Number(fraction))) return null;
  return Math.round(Number(fraction) * 100 * 100) / 100;
};

/**
 * Build the safe, read-only infrastructure descriptor returned to admins.
 * Never includes secret values — only whether a provider is configured, the
 * active payment mode, and (when known) a status label.
 */
export const buildInfrastructureStatus = (configLike = {}) => {
  const mode = configLike.paymentMode || 'demo';
  const isDemo = mode === 'demo';

  const providerStatus = (configured) => {
    if (isDemo) return 'demo';
    return configured ? 'configured' : 'missing';
  };

  const paymentProviders = [
    { provider: 'stripe', kind: 'card', configured: Boolean(configLike.stripe?.secretKey) },
    { provider: 'chapa', kind: 'local', configured: Boolean(configLike.chapa?.secretKey) },
    {
      provider: 'telebirr',
      kind: 'mobile_money',
      configured: Boolean(configLike.telebirr?.appSecret || configLike.telebirr?.appKey),
    },
    { provider: 'cbe_birr', kind: 'mobile_money', configured: Boolean(configLike.cbeBirr?.apiKey) },
  ].map((p) => ({
    ...p,
    mode: isDemo ? 'demo' : 'live',
    status: providerStatus(p.configured),
  }));

  const aiProvider = configLike.ai?.provider === 'openai' ? 'openai' : 'gemini';
  const aiModel = aiProvider === 'openai'
    ? (configLike.openai?.model || 'gpt-4o-mini')
    : (configLike.gemini?.model || 'gemini-flash-latest');

  const storageConfigured = Boolean(
    configLike.cloudinary?.cloudName
    && configLike.cloudinary?.apiKey
    && configLike.cloudinary?.apiSecret
  );

  return {
    platformName: configLike.platform?.name || 'SkillHub',
    paymentMode: mode,
    paymentProviders,
    storage: {
      provider: 'cloudinary',
      configured: storageConfigured,
      status: storageConfigured ? 'configured' : 'missing',
    },
    ai: {
      provider: aiProvider,
      model: aiModel,
      configured: aiProvider === 'openai'
        ? Boolean(configLike.openai?.apiKey)
        : Boolean(configLike.gemini?.apiKey),
      status: (aiProvider === 'openai'
        ? Boolean(configLike.openai?.apiKey)
        : Boolean(configLike.gemini?.apiKey))
        ? 'configured'
        : 'missing',
    },
  };
};
