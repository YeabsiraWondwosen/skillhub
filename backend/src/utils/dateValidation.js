/**
 * Centralized date validation utilities for SkillHub.
 *
 * Philosophy:
 * - FUTURE-ORIENTED fields (deadline, dueDate, scheduledAt, startTime, expectedDelivery, etc.)
 *   must NOT be in the past when creating or updating.
 * - HISTORICAL fields (createdAt, updatedAt, completedAt, paidAt, etc.) are NEVER validated.
 * - DATE-ONLY inputs: compare calendar dates (ignore time component).
 * - DATETIME inputs: compare full timestamps.
 * - All comparisons use UTC internally for consistency.
 */

/**
 * Get today's date at 00:00:00 UTC (for date-only comparisons).
 * This avoids timezone issues: "today" always means the UTC calendar date.
 */
export const getTodayUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

/**
 * Check if a DATE-ONLY value (e.g. "2026-09-15") is in the past.
 * A date-only value is treated as midnight UTC on that day.
 * "Today" (the current calendar date) is NOT considered past.
 *
 * @param {Date|string} value - The date to check
 * @returns {{ valid: boolean, message: string }}
 */
export const isDateOnlyInPast = (value) => {
  if (!value) return { valid: true, message: '' };

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { valid: false, message: 'Invalid date format' };
  }

  const today = getTodayUTC();
  const inputUTC = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  if (inputUTC < today) {
    return { valid: false, message: 'Please select today or a future date.' };
  }

  return { valid: true, message: '' };
};

/**
 * Check if a DATETIME value is in the past.
 * Uses the full timestamp for comparison.
 *
 * @param {Date|string} value - The datetime to check
 * @param {number} graceMs - Optional grace period in milliseconds (default 0)
 * @returns {{ valid: boolean, message: string }}
 */
export const isDateTimeInPast = (value, graceMs = 0) => {
  if (!value) return { valid: true, message: '' };

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { valid: false, message: 'Invalid date format' };
  }

  if (date.getTime() < Date.now() - graceMs) {
    return { valid: false, message: 'Please select a future date and time.' };
  }

  return { valid: true, message: '' };
};

/**
 * Check that an end date is not before a start date (cross-field validation).
 *
 * @param {Date|string} start - The start date
 * @param {Date|string} end - The end date
 * @param {string} label - Optional label for error messages (e.g., "end date")
 * @returns {{ valid: boolean, message: string }}
 */
export const isEndDateBeforeStart = (start, end, label = 'end date') => {
  if (!start || !end) return { valid: true, message: '' };

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { valid: true, message: '' };
  }

  if (endDate < startDate) {
    return { valid: false, message: `${label.charAt(0).toUpperCase() + label.slice(1)} cannot be before the start date.` };
  }

  return { valid: true, message: '' };
};

/**
 * Get the minimum value for an <input type="date"> (YYYY-MM-DD string).
 * Returns today's date in the user's LOCAL timezone so the browser's
 * date picker correctly highlights "today" as selectable.
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
 * Get the minimum value for an <input type="datetime-local"> (YYYY-MM-DDTHH:MM string).
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
 * Validate a datetime-local value: ensure it represents a future moment.
 * Uses local timezone comparison (matching what the user sees).
 *
 * @param {string} value - datetime-local value (YYYY-MM-DDTHH:MM)
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
 * Build a reusable Mongoose validator that rejects PAST dates for
 * future-oriented fields (deadline, dueDate, nextAvailableDate, ...).
 *
 * It is deliberately conservative to avoid breaking existing data:
 *  - Only enforces the "not in the past" rule when the field is actively
 *    being modified (document `save()` path) or on new documents.
 *  - For `findOneAndUpdate` update validators the path is always the one
 *    being updated, so the rule always applies there.
 *  - Historic values that are left untouched (e.g. an already-passed
 *    deadline on a legacy job) are never rejected.
 *
 * @param {string} path - The schema path, used for isModified() checks.
 * @returns {import('mongoose').SchemaTypeOptions['validate']}
 */
export const futureDateValidator = (path = '-') => ({
  validator(value) {
    if (!value) return true;

    // Document-level updates that do NOT touch this field must keep working
    // even if a legacy value has already passed.
    if (typeof this.isModified === 'function' && !this.isModified(path)) return true;

    return isDateOnlyInPast(value).valid;
  },
  message: () => 'Must be today or a future date',
});

/**
 * Same as futureDateValidator but for DATETIME fields (meeting start/end,
 * exact delivery moments, etc.) that require a strictly future timestamp.
 *
 * @param {string} path - The schema path, used for isModified() checks.
 * @returns {import('mongoose').SchemaTypeOptions['validate']}
 */
export const futureDateTimeValidator = (path = '-') => ({
  validator(value) {
    if (!value) return true;

    if (typeof this.isModified === 'function' && !this.isModified(path)) return true;

    return isDateTimeInPast(value).valid;
  },
  message: () => 'Must be in the future',
});
