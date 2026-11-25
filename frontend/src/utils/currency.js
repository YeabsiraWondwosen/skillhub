export const DEFAULT_CURRENCY = 'ETB';

const numberFormatter = new Intl.NumberFormat('en-US');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

export const formatNumber = (value) => {
  const n = toNumber(value);
  return n === null ? null : numberFormatter.format(n);
};

export const formatCurrency = (amount, currency = DEFAULT_CURRENCY) => {
  const n = toNumber(amount);
  if (n === null) return null;
  return `${numberFormatter.format(n)} ${currency || DEFAULT_CURRENCY}`;
};

export const formatRate = (rate, currency = DEFAULT_CURRENCY) => {
  const formatted = formatCurrency(rate, currency);
  return formatted ? `${formatted}/hr` : null;
};

export const formatCurrencyRange = (min, max, currency = DEFAULT_CURRENCY) => {
  const lo = toNumber(min);
  const hi = toNumber(max);
  if (lo === null && hi === null) return null;
  if (lo === null) return formatCurrency(hi, currency);
  if (hi === null) return formatCurrency(lo, currency);
  return `${numberFormatter.format(lo)} – ${numberFormatter.format(hi)} ${currency || DEFAULT_CURRENCY}`;
};

export const formatRateRange = (min, max, currency = DEFAULT_CURRENCY) => {
  const range = formatCurrencyRange(min, max, currency);
  return range ? `${range}/hr` : null;
};
