import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlatformFormValues,
  buildCommissionPayload,
  commissionPercentToFraction,
  commissionFractionToPercent,
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE,
  DEFAULT_TIME_ZONE,
} from '../platformSettings.js';

test('buildPlatformFormValues maps server settings, including populated focus', () => {
  const values = buildPlatformFormValues({
    name: 'SkillHub',
    tagline: 'Learn fast',
    description: 'desc',
    focus: { _id: 'cat1', name: 'Design' },
    currency: 'USD',
    language: 'fr',
    timeZone: 'Europe/Paris',
  });
  assert.deepEqual(values, {
    name: 'SkillHub',
    tagline: 'Learn fast',
    description: 'desc',
    focus: 'cat1',
    currency: 'USD',
    language: 'fr',
    timeZone: 'Europe/Paris',
  });
});

test('buildPlatformFormValues falls back to safe defaults', () => {
  const values = buildPlatformFormValues(undefined);
  assert.equal(values.name, '');
  assert.equal(values.focus, '');
  assert.equal(values.currency, DEFAULT_CURRENCY);
  assert.equal(values.language, DEFAULT_LANGUAGE);
  assert.equal(values.timeZone, DEFAULT_TIME_ZONE);
});

test('commission percent <-> fraction round-trips', () => {
  assert.equal(commissionPercentToFraction(10), 0.1);
  assert.equal(commissionPercentToFraction(12.5), 0.125);
  assert.equal(commissionPercentToFraction(0), 0);
  assert.equal(commissionPercentToFraction('nope'), null);
  assert.equal(commissionFractionToPercent(0.1), 10);
  assert.equal(commissionFractionToPercent(0.125), 12.5);
  assert.equal(commissionFractionToPercent(undefined), 0);
});

test('a blank commission percent never becomes a silent zero', () => {
  assert.equal(commissionPercentToFraction(''), null);
  assert.equal(commissionPercentToFraction('   '), null);
  assert.equal(commissionPercentToFraction(null), null);
  assert.equal(commissionPercentToFraction(undefined), null);
  // An explicit zero is a real, valid business value.
  assert.equal(commissionPercentToFraction(0), 0);
  assert.equal(commissionPercentToFraction('0'), 0);
});

test('buildCommissionPayload sends the backend fraction field shape', () => {
  assert.deepEqual(buildCommissionPayload(10), { commissionRate: 0.1 });
  assert.deepEqual(buildCommissionPayload('12.5'), { commissionRate: 0.125 });
  assert.deepEqual(buildCommissionPayload(0), { commissionRate: 0 });
  assert.deepEqual(buildCommissionPayload(''), { commissionRate: null });
  assert.deepEqual(buildCommissionPayload(undefined), { commissionRate: null });
});
