import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCommission, resolveCommissionSnapshot } from '../helpers.js';

test('calculateCommission rounds to two decimals', () => {
  assert.deepEqual(calculateCommission(100, 0.1), { commission: 10, netAmount: 90, grossAmount: 100 });
  assert.deepEqual(calculateCommission(99.99, 0.1), { commission: 10, netAmount: 89.99, grossAmount: 99.99 });
});

test('resolveCommissionSnapshot prefers the stored escrow snapshot', () => {
  const escrow = { commissionRate: 0.07, commissionAmount: 7, freelancerAmount: 93 };
  // Even if the current platform rate is different, the historical snapshot wins.
  assert.deepEqual(resolveCommissionSnapshot(escrow, 100, 0.25), {
    commissionRate: 0.07,
    commission: 7,
    netAmount: 93,
  });
});

test('resolveCommissionSnapshot falls back to the provided rate', () => {
  assert.deepEqual(resolveCommissionSnapshot(null, 100, 0.1), {
    commissionRate: 0.1,
    commission: 10,
    netAmount: 90,
  });
  assert.deepEqual(resolveCommissionSnapshot({}, 200, 0.05), {
    commissionRate: 0.05,
    commission: 10,
    netAmount: 190,
  });
});

test('resolveCommissionSnapshot treats a zero-rate snapshot as valid', () => {
  const escrow = { commissionRate: 0, commissionAmount: 0, freelancerAmount: 100 };
  assert.deepEqual(resolveCommissionSnapshot(escrow, 100, 0.2), {
    commissionRate: 0,
    commission: 0,
    netAmount: 100,
  });
});
