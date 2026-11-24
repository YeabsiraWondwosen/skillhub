import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_PACKAGE_PRICE,
  TIER_ORDER,
  isValidPackagePrice,
  minPackagePriceMessage,
  getPackagePriceErrors,
  getFirstPackagePriceError,
} from '../pricing.js';

// Build a basic/standard/premium tier list with the given prices.
const tiers = (basic, standard, premium) => [
  { name: 'basic', price: basic },
  { name: 'standard', price: standard },
  { name: 'premium', price: premium },
];

test('exposes the canonical ascending tier order', () => {
  assert.deepEqual(TIER_ORDER, ['basic', 'standard', 'premium']);
});

test('exposes a positive numeric minimum', () => {
  assert.equal(typeof MIN_PACKAGE_PRICE, 'number');
  assert.ok(MIN_PACKAGE_PRICE > 0);
});

test('rejects a price below the minimum', () => {
  assert.equal(isValidPackagePrice(MIN_PACKAGE_PRICE - 1), false);
});

test('accepts a price equal to the minimum', () => {
  assert.equal(isValidPackagePrice(MIN_PACKAGE_PRICE), true);
});

test('accepts a price above the minimum', () => {
  assert.equal(isValidPackagePrice(MIN_PACKAGE_PRICE + 1), true);
  assert.equal(isValidPackagePrice(9999), true);
});

test('rejects zero and negative prices', () => {
  assert.equal(isValidPackagePrice(0), false);
  assert.equal(isValidPackagePrice(-5), false);
});

test('rejects empty and non-numeric prices', () => {
  assert.equal(isValidPackagePrice(''), false);
  assert.equal(isValidPackagePrice('abc'), false);
  assert.equal(isValidPackagePrice(null), false);
  assert.equal(isValidPackagePrice(undefined), false);
  assert.equal(isValidPackagePrice(NaN), false);
});

test('message names the minimum in ETB', () => {
  assert.equal(minPackagePriceMessage(), `Minimum price is ${MIN_PACKAGE_PRICE} ETB.`);
});

test('accepts strictly increasing prices', () => {
  const prices = tiers(MIN_PACKAGE_PRICE, MIN_PACKAGE_PRICE + 1, MIN_PACKAGE_PRICE + 2);
  assert.deepEqual(getPackagePriceErrors(prices), {});
  assert.equal(getFirstPackagePriceError(prices), null);
});

test('rejects equal Basic and Standard prices', () => {
  const errors = getPackagePriceErrors(tiers(MIN_PACKAGE_PRICE + 4, MIN_PACKAGE_PRICE + 4, MIN_PACKAGE_PRICE + 6));
  assert.ok(errors.standard);
  assert.equal(errors.basic, undefined);
});

test('rejects equal Standard and Premium prices', () => {
  const errors = getPackagePriceErrors(tiers(MIN_PACKAGE_PRICE, MIN_PACKAGE_PRICE + 5, MIN_PACKAGE_PRICE + 5));
  assert.ok(errors.premium);
});

test('rejects reversed prices', () => {
  const errors = getPackagePriceErrors(tiers(MIN_PACKAGE_PRICE + 10, MIN_PACKAGE_PRICE + 5, MIN_PACKAGE_PRICE + 1));
  assert.ok(errors.standard);
  assert.ok(errors.premium);
  assert.match(errors.standard, /Standard price must be greater than the Basic price/i);
  assert.match(errors.premium, /Premium price must be greater than the Standard price/i);
});

test('rejects a Basic price below the minimum', () => {
  const errors = getPackagePriceErrors(tiers(MIN_PACKAGE_PRICE - 1, MIN_PACKAGE_PRICE + 1, MIN_PACKAGE_PRICE + 2));
  assert.equal(errors.basic, minPackagePriceMessage());
});

test('accepts Basic exactly at the minimum when prices increase', () => {
  assert.deepEqual(
    getPackagePriceErrors(tiers(MIN_PACKAGE_PRICE, MIN_PACKAGE_PRICE + 1, MIN_PACKAGE_PRICE + 2)),
    {}
  );
});

test('tolerates a partial tier list without errors', () => {
  assert.deepEqual(getPackagePriceErrors([{ name: 'basic', price: MIN_PACKAGE_PRICE }]), {});
});
