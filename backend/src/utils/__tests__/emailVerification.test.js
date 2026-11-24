import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOtp,
  hashOtp,
  evaluateOtpAttempt,
  evaluateResend,
  isOtpExpired,
  OTP_STATUS,
  OTP_DEFAULTS,
} from '../emailVerification.js';

const SECRET = 'test-secret';

test('generateOtp produces zero-padded numeric codes of the default length', () => {
  for (let i = 0; i < 50; i++) {
    const otp = generateOtp();
    assert.match(otp, /^\d{6}$/);
  }
});

test('generateOtp clamps unsupported lengths to the default', () => {
  assert.match(generateOtp(2), /^\d{6}$/);
  assert.match(generateOtp(99), /^\d{6}$/);
});

test('hashOtp with a secret is deterministic and keyed', () => {
  const h1 = hashOtp('123456', SECRET);
  const h2 = hashOtp('123456', SECRET);
  assert.equal(h1, h2);
  assert.notEqual(h1, hashOtp('123456', 'other-secret'));
});

test('evaluateOtpAttempt: valid code returns VALID and resets attempts', () => {
  const otp = generateOtp();
  const result = evaluateOtpAttempt(
    { candidate: otp, storedHash: hashOtp(otp, SECRET), expiresAt: Date.now() + 60_000, attempts: 3 },
    { secret: SECRET }
  );
  assert.equal(result.status, OTP_STATUS.VALID);
  assert.equal(result.attempts, 0);
});

test('evaluateOtpAttempt: wrong code returns INVALID and increments attempts', () => {
  const otp = generateOtp();
  const result = evaluateOtpAttempt(
    { candidate: '000000', storedHash: hashOtp(otp, SECRET), expiresAt: Date.now() + 60_000, attempts: 1 },
    { secret: SECRET }
  );
  assert.equal(result.status, OTP_STATUS.INVALID);
  assert.equal(result.attempts, 2);
});

test('evaluateOtpAttempt: missing stored data returns MISSING', () => {
  const result = evaluateOtpAttempt({ candidate: '123456', attempts: 0 }, { secret: SECRET });
  assert.equal(result.status, OTP_STATUS.MISSING);
});

test('evaluateOtpAttempt: expired code returns EXPIRED even with a correct value', () => {
  const otp = generateOtp();
  const result = evaluateOtpAttempt(
    { candidate: otp, storedHash: hashOtp(otp, SECRET), expiresAt: Date.now() - 1, attempts: 0 },
    { secret: SECRET }
  );
  assert.equal(result.status, OTP_STATUS.EXPIRED);
});

test('evaluateOtpAttempt: reaching max attempts returns LOCKED', () => {
  const otp = generateOtp();
  const result = evaluateOtpAttempt(
    { candidate: '000000', storedHash: hashOtp(otp, SECRET), expiresAt: Date.now() + 60_000, attempts: OTP_DEFAULTS.maxAttempts },
    { secret: SECRET }
  );
  assert.equal(result.status, OTP_STATUS.LOCKED);
});

test('isOtpExpired returns true for missing or past expiry', () => {
  assert.equal(isOtpExpired(null), true);
  assert.equal(isOtpExpired(Date.now() - 1), true);
  assert.equal(isOtpExpired(Date.now() + 60_000), false);
});

test('evaluateResend: allows when no cooldown and under the limit', () => {
  const result = evaluateResend({ lastSentAt: Date.now() - 120_000, resendCount: 0 }, { cooldownMs: 60_000 });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, null);
});

test('evaluateResend: blocks within cooldown with retryAfterMs', () => {
  const result = evaluateResend(
    { lastSentAt: Date.now() - 10_000, resendCount: 0 },
    { cooldownMs: 60_000, now: Date.now() }
  );
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'cooldown');
  assert.ok(result.retryAfterMs > 0);
});

test('evaluateResend: blocks once the resend limit is reached', () => {
  const result = evaluateResend(
    { lastSentAt: Date.now() - 120_000, resendCount: OTP_DEFAULTS.maxResends },
    { cooldownMs: 60_000 }
  );
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'resend_limit');
});