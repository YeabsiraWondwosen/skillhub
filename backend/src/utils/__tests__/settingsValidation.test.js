import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCommissionRate,
  toCommissionPercent,
  normalizePlatformName,
  normalizeOptionalText,
  normalizeCurrency,
  normalizeLanguage,
  normalizeTimeZone,
  normalizeLogo,
  buildInfrastructureStatus,
  PLATFORM_NAME_MAX,
} from '../settings.validation.js';

test('parseCommissionRate accepts fractions within 0–100%', () => {
  assert.equal(parseCommissionRate(0), 0);
  assert.equal(parseCommissionRate(0.1), 0.1);
  assert.equal(parseCommissionRate(1), 1);
  assert.equal(parseCommissionRate('0.125'), 0.125);
});

test('parseCommissionRate converts percentage input to a fraction', () => {
  assert.equal(parseCommissionRate(10), 0.1);
  assert.equal(parseCommissionRate(100), 1);
  assert.equal(parseCommissionRate(1.5), 0.015);
  assert.equal(parseCommissionRate(2.52), 0.0252);
  assert.equal(parseCommissionRate('12.5'), 0.125);
});

test('parseCommissionRate rejects out-of-range and non-numeric values', () => {
  assert.throws(() => parseCommissionRate(-0.01), /between 0% and 100%/);
  assert.throws(() => parseCommissionRate(101), /between 0% and 100%/);
  assert.throws(() => parseCommissionRate(100.5), /between 0% and 100%/);
  assert.throws(() => parseCommissionRate('nope'), /must be a number/);
  assert.throws(() => parseCommissionRate(null), /required/);
  assert.throws(() => parseCommissionRate(''), /required/);
});

test('parseCommissionRate rejects missing values instead of defaulting to zero', () => {
  assert.throws(() => parseCommissionRate(undefined), /required/);
  assert.throws(() => parseCommissionRate('   '), /required/);
  assert.throws(() => parseCommissionRate({}), /must be a number/);
  // An explicit zero is valid and preserved as a fraction.
  assert.equal(parseCommissionRate(0), 0);
  assert.equal(parseCommissionRate('0'), 0);
});

test('toCommissionPercent rounds to two decimals', () => {
  assert.equal(toCommissionPercent(0.1), 10);
  assert.equal(toCommissionPercent(0.1234), 12.34);
  assert.equal(toCommissionPercent(null), null);
});

test('normalizePlatformName trims and validates length', () => {
  assert.equal(normalizePlatformName('  SkillHub  '), 'SkillHub');
  assert.throws(() => normalizePlatformName('   '), /cannot be empty/);
  assert.throws(() => normalizePlatformName('x'.repeat(PLATFORM_NAME_MAX + 1)), /cannot exceed/);
});

test('normalizeOptionalText trims and enforces max length', () => {
  assert.equal(normalizeOptionalText('  hi  ', { max: 10 }), 'hi');
  assert.equal(normalizeOptionalText(undefined, { max: 10 }), '');
  assert.throws(() => normalizeOptionalText('x'.repeat(11), { max: 10, label: 'Tagline' }), /Tagline cannot exceed/);
});

test('normalizeCurrency / language / timezone validate formats', () => {
  assert.equal(normalizeCurrency('etb'), 'ETB');
  assert.throws(() => normalizeCurrency('e'), /2–8 letter/);
  assert.throws(() => normalizeCurrency('ETB1'), /2–8 letter/);

  assert.equal(normalizeLanguage('EN'), 'en');
  assert.equal(normalizeLanguage('en-US'), 'en-us');
  assert.throws(() => normalizeLanguage('english'), /language code/);

  assert.equal(normalizeTimeZone(' UTC '), 'UTC');
  assert.throws(() => normalizeTimeZone('  '), /cannot be empty/);
});

test('normalizeLogo handles clear, url and object shapes', () => {
  assert.equal(normalizeLogo(undefined), undefined);
  assert.equal(normalizeLogo(null), null);
  assert.equal(normalizeLogo(''), null);
  assert.deepEqual(normalizeLogo('https://cdn.example.com/logo.png'), {
    url: 'https://cdn.example.com/logo.png',
    publicId: '',
  });
  assert.deepEqual(normalizeLogo({ url: 'http://x/y.png', publicId: 'abc' }), {
    url: 'http://x/y.png',
    publicId: 'abc',
  });
  assert.throws(() => normalizeLogo('ftp://x'), /http:\/\/ or https:\/\//);
  assert.throws(() => normalizeLogo(42), /Logo must be/);
});

test('buildInfrastructureStatus reports demo mode without leaking secrets', () => {
  const status = buildInfrastructureStatus({
    paymentMode: 'demo',
    platform: { name: 'SkillHub' },
    stripe: { secretKey: 'sk_live_SHOULD_NOT_LEAK' },
    chapa: {},
    telebirr: {},
    cbeBirr: {},
    cloudinary: { cloudName: 'c', apiKey: 'k', apiSecret: 's' },
    ai: { provider: 'gemini' },
    gemini: { apiKey: 'g', model: 'gemini-flash-latest' },
    openai: {},
  });

  assert.equal(status.paymentMode, 'demo');
  assert.ok(status.paymentProviders.every((p) => p.status === 'demo'));
  assert.equal(status.paymentProviders.find((p) => p.provider === 'stripe').mode, 'demo');
  assert.equal(status.storage.configured, true);
  assert.equal(status.ai.configured, true);

  const serialized = JSON.stringify(status);
  assert.equal(serialized.includes('SHOULD_NOT_LEAK'), false);
  assert.equal(serialized.includes('sk_live'), false);
});

test('buildInfrastructureStatus reports configured/missing in live mode', () => {
  const status = buildInfrastructureStatus({
    paymentMode: 'stripe',
    stripe: { secretKey: 'sk' },
    chapa: {},
    telebirr: {},
    cbeBirr: {},
    ai: { provider: 'openai' },
    openai: { apiKey: 'o', model: 'gpt-4o-mini' },
  });

  const stripe = status.paymentProviders.find((p) => p.provider === 'stripe');
  const chapa = status.paymentProviders.find((p) => p.provider === 'chapa');
  assert.equal(stripe.status, 'configured');
  assert.equal(stripe.mode, 'live');
  assert.equal(chapa.status, 'missing');
  assert.equal(status.ai.provider, 'openai');
  assert.equal(status.ai.configured, true);
});
