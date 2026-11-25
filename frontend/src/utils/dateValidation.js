/**
 * Centralized date validation utilities for SkillHub Frontend.
 *
 * Mirrors the backend dateValidation.js logic for consistency.
 * Uses LOCAL timezone for browser-facing date comparisons.
 */

/**
 * Get the minimum value for an <input type="date"> (YYYY-MM-DD string).
 * Returns today's date in the user's LOCAL timezone.
 * This is the ONLY correct way to compute "today" for HTML date inputs.
 *
 * @returns {string} Today's date as YYYY-MM-DD
 */
export const getMinDateValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get the minimum value for an <input type="datetime-local"> (YYYY-MM-DDTHH:MM).
 * Returns the current moment in the user's LOCAL timezone.
 *
 * @returns {string} Current datetime as YYYY-MM-DDTHH:MM
 */
export const getMinDateTimeValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Validate a DATE-ONLY value (YYYY-MM-DD from <input type="date">).
 * "Today" is valid; only strictly past dates are rejected.
 *
 * @param {string} value - The YYYY-MM-DD string
 * @returns {{ valid: boolean, message: string }}
 */
export const isDateOnlyInPast = (value) => {
  if (!value) return { valid: true, message: '' };

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { valid: false, message: 'Invalid date format' };
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  if (value < todayStr) {
    return { valid: false, message: 'Please select today or a future date.' };
  }

  return { valid: true, message: '' };
};

/**
 * Validate a datetime-local value (YYYY-MM-DDTHH:MM).
 * Rejects past times. Uses local timezone (matching what the user sees).
 *
 * @param {string} value - The datetime-local string
 * @returns {{ valid: boolean, message: string }}
 */
export const isDateTimeLocalInPast = (value) => {
  if (!value) return { valid: true, message: '' };

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { valid: false, message: 'Invalid date format' };
  }

  if (date.getTime() < Date.now()) {
    return { valid: false, message: 'Please select a future date and time.' };
  }

  return { valid: true, message: '' };
};

/**
 * Validate that an end date is not before a start date.
 * Both are YYYY-MM-DD strings from date inputs.
 *
 * @param {string} startDate - The start date string
 * @param {string} endDate - The end date string
 * @param {string} [label='end date'] - Label for the error message
 * @returns {{ valid: boolean, message: string }}
 */
export const isEndDateBeforeStart = (startDate, endDate, label = 'end date') => {
  if (!startDate || !endDate) return { valid: true, message: '' };

  if (endDate < startDate) {
    return { valid: false, message: `${label.charAt(0).toUpperCase() + label.slice(1)} cannot be before the start date.` };
  }

  return { valid: true, message: '' };
};

/**
 * Convert a date value to the format expected by <input type="date"> (YYYY-MM-DD).
 * Handles both ISO strings and Date objects. Returns empty string for falsy input.
 *
 * @param {Date|string|null} value
 * @returns {string}
 */
export const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Convert a date value to the format expected by <input type="datetime-local"> (YYYY-MM-DDTHH:MM).
 * Uses LOCAL timezone (not UTC) to avoid day-shift bugs.
 *
 * @param {Date|string|null} value
 * @returns {string}
 */
export const toDateTimeLocalInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};
