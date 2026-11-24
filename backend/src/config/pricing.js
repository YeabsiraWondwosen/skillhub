import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Single source of truth for the minimum a freelancer may charge for any
// pricing package (basic / standard / premium). Overridable per deployment via
// MIN_PACKAGE_PRICE so the floor can be raised without a code change.
const parsedMinPackagePrice = parseFloat(process.env.MIN_PACKAGE_PRICE);

export const MIN_PACKAGE_PRICE =
  Number.isFinite(parsedMinPackagePrice) && parsedMinPackagePrice > 0 ? parsedMinPackagePrice : 1;

export const minPackagePriceMessage = () => `Minimum price is ${MIN_PACKAGE_PRICE} ETB.`;

// Canonical, ascending package order. Prices must strictly increase along it.
export const TIER_ORDER = ['basic', 'standard', 'premium'];
const TIER_LABELS = { basic: 'Basic', standard: 'Standard', premium: 'Premium' };

// A package price is valid only when it is a real, finite number at or above the
// platform minimum. Rejects empty, non-numeric, zero and negative values.
export const isValidPackagePrice = (price) => {
  const value = Number(price);
  return Number.isFinite(value) && value >= MIN_PACKAGE_PRICE;
};

// Returns a map of { tierName: message } for every invalid package price.
// Covers the minimum/finite rule and the strict ordering rule
// (Basic < Standard < Premium). Empty map means the pricing is valid.
export const getPackagePriceErrors = (tiers) => {
  const errors = {};
  if (!Array.isArray(tiers)) return errors;

  const byName = {};
  for (const tier of tiers) {
    if (tier && TIER_ORDER.includes(tier.name)) byName[tier.name] = tier;
  }

  // Minimum / finite check per tier.
  const belowMinimum = {};
  for (const name of TIER_ORDER) {
    const tier = byName[name];
    if (tier && !isValidPackagePrice(tier.price)) {
      errors[name] = minPackagePriceMessage();
      belowMinimum[name] = true;
    }
  }

  // Strict ascending order check between consecutive tiers. Ordering is only
  // skipped when one of the compared prices is below the minimum, so each
  // otherwise-valid tier still reports its own ordering problem.
  for (let i = 1; i < TIER_ORDER.length; i += 1) {
    const prevName = TIER_ORDER[i - 1];
    const name = TIER_ORDER[i];
    const prev = byName[prevName];
    const tier = byName[name];
    if (!prev || !tier) continue;
    if (belowMinimum[prevName] || belowMinimum[name]) continue;
    if (Number(tier.price) <= Number(prev.price)) {
      errors[name] = `${TIER_LABELS[name]} price must be greater than the ${TIER_LABELS[prevName]} price.`;
    }
  }

  return errors;
};

// Convenience: first error message for the given tiers, or null when valid.
export const getFirstPackagePriceError = (tiers) =>
  Object.values(getPackagePriceErrors(tiers))[0] || null;
