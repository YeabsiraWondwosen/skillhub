// Shared pricing rules for freelancer service packages (basic / standard /
// premium). Must stay in sync with the backend config at
// backend/src/config/pricing.js — both default to 1 ETB and can be raised via
// the MIN_PACKAGE_PRICE / VITE_MIN_PACKAGE_PRICE environment variables.
const parsedMinPackagePrice = Number(import.meta.env?.VITE_MIN_PACKAGE_PRICE);

export const MIN_PACKAGE_PRICE =
  Number.isFinite(parsedMinPackagePrice) && parsedMinPackagePrice > 0 ? parsedMinPackagePrice : 1;

export const minPackagePriceMessage = () => `Minimum price is ${MIN_PACKAGE_PRICE} ETB.`;

// Canonical, ascending package order. Prices must strictly increase along it.
export const TIER_ORDER = ['basic', 'standard', 'premium'];
const TIER_LABELS = { basic: 'Basic', standard: 'Standard', premium: 'Premium' };

// A package price is valid only when it is a real, finite number at or above the
// platform minimum. Rejects empty, non-numeric, zero and negative values.
export const isValidPackagePrice = (price) => {
  if (price === '' || price === null || price === undefined) return false;
  const value = Number(price);
  return Number.isFinite(value) && value >= MIN_PACKAGE_PRICE;
};

// Returns a map of { tierName: message } for every invalid package price.
// Covers the minimum/finite rule and the strict ordering rule
// (Basic < Standard < Premium). Empty object means the pricing is valid.
export const getPackagePriceErrors = (tiers) => {
  const errors = {};
  if (!Array.isArray(tiers)) return errors;

  const byName = {};
  for (const tier of tiers) {
    if (tier && TIER_ORDER.includes(tier.name)) byName[tier.name] = tier;
  }

  const belowMinimum = {};
  for (const name of TIER_ORDER) {
    const tier = byName[name];
    if (tier && !isValidPackagePrice(tier.price)) {
      errors[name] = minPackagePriceMessage();
      belowMinimum[name] = true;
    }
  }

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

export const getFirstPackagePriceError = (tiers) =>
  Object.values(getPackagePriceErrors(tiers))[0] || null;
