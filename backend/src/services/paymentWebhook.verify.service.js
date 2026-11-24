import crypto from 'crypto';
import { config } from '../config/env.js';
import { ApiError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

/**
 * Secure webhook verification for non-Stripe payment providers.
 *
 * Security model (fail closed):
 *  - A webhook that announces a successful mobile-money payment may ONLY move
 *    money when the provider can PROVE authenticity by cryptographic signature.
 *  - If the provider's signature cannot be verified (missing secret, wrong
 *    format, or signature mismatch) the request is rejected and the payment is
 *    NOT credited. Providers receive a non-2xx status and must retry, which is
 *    the correct fail-closed behavior.
 *  - `req.body.status` is NEVER trusted on its own — it is only evaluated AFTER
 *    a valid signature has been verified.
 *
 * Required provider configuration:
 *  - Telebirr:  TELEBIRR_WEBHOOK_SECRET (shared HMAC-SHA256 secret issued by
 *    the provider). Signature is sent as `sign` in the callback body or in the
 *    `x-signature` header. The canonical message is the callback JSON with keys
 *    sorted lexicographically (recursively) and serialized without whitespace.
 *  - CBE Birr:  CBE_BIRR_WEBHOOK_SECRET (shared HMAC-SHA256 secret). Signature
 *    is sent as `signature` in the body or in the `x-signature` header.
 *
 * If the shared secret is not configured, webhooks are REJECTED rather than
 * silently accepted. Configure the secret during provider onboarding.
 */

const SIGNATURE_KEYS = ['sign', 'signature', 'hmac', 'webhookSign'];
const SIGNATURE_HEADERS = ['x-signature', 'x-webhook-signature', 'signature'];

export const FREQ_DEFAULT = 10 * 60 * 1000;

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest();

// Constant-time string comparison. Hash both sides first so equal-length is
// guaranteed and no timing side-channel leaks the length difference.
const safeEqual = (a, b) => {
  const keyA = sha256(a);
  const keyB = sha256(b);
  return crypto.timingSafeEqual(keyA, keyB);
};

const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const body = keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`);
    return `{${body.join(',')}}`;
  }
  return JSON.stringify(value);
};

const extractProvidedSignature = (body, headers = {}) => {
  for (const key of SIGNATURE_KEYS) {
    if (body[key]) return String(body[key]);
  }
  for (const header of SIGNATURE_HEADERS) {
    const value = headers[header];
    if (value) return String(value);
  }
  return null;
};

const computeHmac = (payload, secret) =>
  crypto.createHmac('sha256', secret).update(canonicalize(payload)).digest('hex');

export const requireWebhookSecret = (secretName, mode) => {
  const secret = process.env[secretName];
  if (!secret) {
    logger.error(
      `[WEBHOOK-SECURITY] ${mode} webhook received but ${secretName} is not configured. ` +
      `Rejecting webhook (fail-closed). Configure ${secretName} to receive ${mode} callbacks.`
    );
    throw new ApiError(
      503,
      `${mode} webhook processing is disabled: verification secret (${secretName}) is not configured`
    );
  }
  return secret;
};

export const verifyTelebirrWebhook = (body, headers = {}) => {
  const secret = requireWebhookSecret('TELEBIRR_WEBHOOK_SECRET', 'Telebirr');
  const provided = extractProvidedSignature(body, headers);
  if (!provided) {
    throw new ApiError(401, 'Telebirr webhook missing signature');
  }
  const expected = computeHmac(body, secret);
  if (!safeEqual(provided, expected)) {
    logger.warn('[WEBHOOK-SECURITY] Telebirr webhook rejected: signature mismatch');
    throw new ApiError(401, 'Telebirr webhook signature verification failed');
  }
  return true;
};

export const verifyCbeBirrWebhook = (body, headers = {}) => {
  const secret = requireWebhookSecret('CBE_BIRR_WEBHOOK_SECRET', 'CBE Birr');
  const provided = extractProvidedSignature(body, headers);
  if (!provided) {
    throw new ApiError(401, 'CBE Birr webhook missing signature');
  }
  const expected = computeHmac(body, secret);
  if (!safeEqual(provided, expected)) {
    logger.warn('[WEBHOOK-SECURITY] CBE Birr webhook rejected: signature mismatch');
    throw new ApiError(401, 'CBE Birr webhook signature verification failed');
  }
  return true;
};

export const isSuccessfulWebhookStatus = (status) =>
  ['000', '0000', '200', 'success', 'SUCCESS', 'completed', 'COMPLETED', 'paid', 'PAID'].includes(String(status));

export { canonicalize };