import crypto from 'crypto';

/**
 * Email-verification (OTP) policy.
 *
 * This module is intentionally PURE — it never touches the database, the
 * environment, or the network. Controllers/services pass plain values in and
 * get plain results back, which keeps the security rules easy to unit test.
 *
 * Security properties:
 *  - The OTP itself is generated with `crypto.randomInt` (a CSPRNG), never
 *    `Math.random`.
 *  - Only a keyed hash (HMAC-SHA256) of the OTP is ever persisted. A keyed hash
 *    means a database leak alone cannot be used to brute-force the 6-digit
 *    space offline without also knowing the server secret.
 *  - Verification uses a constant-time comparison to avoid timing leaks.
 */

// Numeric OTP (leading zeroes allowed).
export const OTP_DEFAULTS = Object.freeze({
  length: 6,
  ttlMs: 10 * 60 * 1000,      // 10 minutes
  maxAttempts: 5,             // wrong guesses before the code is locked
  cooldownMs: 60 * 1000,      // minimum wait between resends
  maxResends: 5,              // resends allowed per OTP lifecycle
});

export const OTP_STATUS = Object.freeze({
  VALID: 'valid',
  INVALID: 'invalid',
  EXPIRED: 'expired',
  MISSING: 'missing',
  LOCKED: 'locked',
});

const clampLength = (length) => {
  const n = Number.parseInt(length, 10);
  if (!Number.isFinite(n) || n < 4 || n > 10) return OTP_DEFAULTS.length;
  return n;
};

/**
 * Generate a cryptographically secure numeric OTP of the given length,
 * zero-padded (e.g. "004209").
 */
export function generateOtp(length = OTP_DEFAULTS.length) {
  const len = clampLength(length);
  const max = 10 ** len;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(len, '0');
}

/**
 * Hash an OTP with HMAC-SHA256 keyed by `secret`. Falls back to a plain
 * SHA-256 digest only when no secret is supplied (development/tests) — callers
 * in production always pass a secret.
 */
export function hashOtp(otp, secret) {
  const value = String(otp ?? '');
  if (secret) {
    return crypto.createHmac('sha256', String(secret)).update(value).digest('hex');
  }
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Constant-time comparison of two hex/digest strings. */
export function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

/** True when the stored OTP has passed its expiry time. */
export function isOtpExpired(expiresAt, now = Date.now()) {
  if (!expiresAt) return true;
  const ts = new Date(expiresAt).getTime();
  if (!Number.isFinite(ts)) return true;
  return ts <= now;
}

/**
 * Evaluate a single verification attempt against stored OTP state.
 *
 * @returns {{ status: string, attempts: number }}
 *  - VALID:  the code matched (attempts reset to 0)
 *  - INVALID: the code did not match (attempts incremented)
 *  - EXPIRED: the code's TTL has elapsed
 *  - MISSING: no code is currently stored
 *  - LOCKED: the maximum number of attempts has been reached
 */
export function evaluateOtpAttempt(
  { candidate, storedHash, expiresAt, attempts = 0 } = {},
  { secret, maxAttempts = OTP_DEFAULTS.maxAttempts, now = Date.now() } = {}
) {
  if (!storedHash || !expiresAt) return { status: OTP_STATUS.MISSING, attempts };
  if (attempts >= maxAttempts) return { status: OTP_STATUS.LOCKED, attempts };
  if (isOtpExpired(expiresAt, now)) return { status: OTP_STATUS.EXPIRED, attempts };

  const candidateHash = hashOtp(candidate, secret);
  if (safeEqual(candidateHash, storedHash)) {
    return { status: OTP_STATUS.VALID, attempts: 0 };
  }
  return { status: OTP_STATUS.INVALID, attempts: attempts + 1 };
}

/**
 * Decide whether a resend is allowed right now.
 *
 * @returns {{ allowed: boolean, reason: 'cooldown'|'resend_limit'|null, retryAfterMs: number }}
 */
export function evaluateResend(
  { lastSentAt, resendCount = 0 } = {},
  { cooldownMs = OTP_DEFAULTS.cooldownMs, maxResends = OTP_DEFAULTS.maxResends, now = Date.now() } = {}
) {
  if (resendCount >= maxResends) {
    return { allowed: false, reason: 'resend_limit', retryAfterMs: 0 };
  }
  if (lastSentAt) {
    const sentTs = new Date(lastSentAt).getTime();
    if (Number.isFinite(sentTs)) {
      const elapsed = now - sentTs;
      if (elapsed < cooldownMs) {
        return { allowed: false, reason: 'cooldown', retryAfterMs: cooldownMs - elapsed };
      }
    }
  }
  return { allowed: true, reason: null, retryAfterMs: 0 };
}

/**
 * Remaining attempts before an OTP is locked, clamped at 0.
 */
export function remainingAttempts(attempts = 0, maxAttempts = OTP_DEFAULTS.maxAttempts) {
  return Math.max(0, maxAttempts - attempts);
}
