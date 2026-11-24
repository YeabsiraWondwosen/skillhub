import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Unified AI client — free-first setup.
 *
 * Primary provider: Google Gemini (free tier).
 * OpenAI remains available in code but is NOT used by the normal execution path.
 * See openai.provider.js / OPENAI_API_KEY for future opt-in usage.
 */

export const AI_UNAVAILABLE_MESSAGE = 'AI service is temporarily unavailable. Please try again later.';

export class AIUnavailableError extends Error {
  constructor(message = AI_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

const MODEL_MAP = {
  'gemini-flash-latest': 'gemini-flash-latest',
  'gemini-2.5-flash': 'gemini-flash-latest',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-1.5-flash': 'gemini-flash-latest',
  'gemini-1.5-pro': 'gemini-2.5-pro',
};

// Secondary models used to ride out transient 503s ("high demand" overload) on
// the primary model without changing the user-facing result.
const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-2.5-pro'];

// Per-attempt hard cap so a hung/slow upstream never blocks requests for tens
// of seconds (log showed 10–27s hangs before failing).
const REQUEST_TIMEOUT_MS = 25000;
// Max attempts (incl. the first call) on each model before moving to the next.
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 1500];
const MAX_RETRY_DELAY_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let client = null;
const modelCache = new Map();
let availabilityChecked = false;

// ─── Quota protection ──────────────────────────────────────────────────────────
// Gemini's free tier allows only ~20 generateContent requests per day. Every AI
// feature shares that budget, so a single polling client could exhaust it in
// seconds and leave the whole platform on deterministic fallbacks for the rest
// of the day. Three guards keep the budget:
//   1. daily budget   — stop calling upstream once the local budget is spent
//   2. quota cooldown — after a 429, fail fast until the provider's retry time
//   3. response cache — identical prompts share one upstream call
const DEFAULT_DAILY_BUDGET = 15; // free tier is 20; leave headroom
const MAX_DAILY_BUDGET = 20;
const DEFAULT_COOLDOWN_MS = 60 * 1000;
const MAX_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
// Ceiling for one logical AI call across every candidate model. Without it a
// full outage costs candidates x MAX_ATTEMPTS x REQUEST_TIMEOUT_MS and the HTTP
// request hangs open for minutes.
const DEFAULT_CALL_DEADLINE_MS = 30 * 1000;
const MIN_CALL_DEADLINE_MS = 5 * 1000;
const MAX_CALL_DEADLINE_MS = 2 * 60 * 1000;

const DAILY_BUDGET = clampNumber(config.ai?.maxRequestsPerDay, 0, MAX_DAILY_BUDGET, DEFAULT_DAILY_BUDGET);
const RESPONSE_CACHE_TTL_MS = config.ai?.responseCacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
const FALLBACK_COOLDOWN_MS = config.ai?.quotaCooldownMs ?? DEFAULT_COOLDOWN_MS;
const CALL_DEADLINE_MS = clampNumber(
  config.ai?.callDeadlineMs,
  MIN_CALL_DEADLINE_MS,
  MAX_CALL_DEADLINE_MS,
  DEFAULT_CALL_DEADLINE_MS
);

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

let cooldownUntil = 0;
let cooldownLogged = false;
const usage = { day: startOfDay(), count: 0 };
const responseCache = new Map();
const inflight = new Map();

// Guard state survives restarts: without this, every `node --watch` reload or
// deploy re-pays the provider's (slow) failing round-trip to learn the quota is
// already exhausted for the day.
const GUARD_STATE_FILE = path.join(process.cwd(), '.cache', 'ai-guard.json');

const persistGuardState = () => {
  try {
    fs.mkdirSync(path.dirname(GUARD_STATE_FILE), { recursive: true });
    fs.writeFileSync(
      GUARD_STATE_FILE,
      JSON.stringify({ cooldownUntil, day: usage.day, count: usage.count }),
      'utf8',
    );
  } catch (err) {
    logger.debug(`[AI] Could not persist quota guard state: ${err.message}`);
  }
};

const restoreGuardState = () => {
  try {
    if (!fs.existsSync(GUARD_STATE_FILE)) return;
    const saved = JSON.parse(fs.readFileSync(GUARD_STATE_FILE, 'utf8'));
    if (saved.day === startOfDay() && Number.isFinite(saved.count)) {
      usage.count = saved.count;
      logger.debug(`[AI] Restored daily AI usage: ${usage.count}/${DAILY_BUDGET}`);
    }
    if (Number.isFinite(saved.cooldownUntil) && saved.cooldownUntil > Date.now()) {
      cooldownUntil = saved.cooldownUntil;
      cooldownLogged = true;
      logger.info(
        `[AI] Gemini quota cooldown active for another ${describeCooldown(getAICooldownRemainingMs())} (restored from disk)`
      );
    }
  } catch (err) {
    logger.debug(`[AI] Could not restore quota guard state: ${err.message}`);
  }
};

function startOfDay() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

function rollUsageWindow() {
  const today = startOfDay();
  if (usage.day !== today) {
    usage.day = today;
    usage.count = 0;
  }
}

export function isAIInCooldown() {
  return Date.now() < cooldownUntil;
}

export function getAICooldownRemainingMs() {
  return Math.max(0, cooldownUntil - Date.now());
}

/** Seconds left in the local daily AI budget (0 once spent). */
export function getAIBudgetRemaining() {
  rollUsageWindow();
  return Math.max(0, DAILY_BUDGET - usage.count);
}

const describeCooldown = (ms) => {
  if (ms >= 60 * 60 * 1000) return `${Math.round(ms / 3600000)}h`;
  if (ms >= 60 * 1000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 1000)}s`;
};

const parseDurationMs = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value * 1000 : null;
  const text = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text) * 1000;
  const pattern = /(\d+(?:\.\d+)?)\s*(ms|m|h|d|s)/gi;
  let total = 0;
  let matched = false;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(amount)) continue;
    if (unit === 'ms') total += amount;
    else if (unit === 's') total += amount * 1000;
    else if (unit === 'm') total += amount * 60 * 1000;
    else if (unit === 'h') total += amount * 60 * 60 * 1000;
    else if (unit === 'd') total += amount * 24 * 60 * 60 * 1000;
    else continue;
    matched = true;
  }
  return matched ? Math.round(total) : null;
};

/** Pull the provider's own "try again in ..." hint out of a 429 so we respect it. */
const extractCooldownMs = (err) => {
  const message = `${err?.message || ''}`;
  const candidates = [
    message.match(/please retry in\s+((?:\d+(?:\.\d+)?\s*(?:ms|m|h|d|s)\s*)+)/i)?.[1],
    message.match(/retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)/i)?.[1],
    message.match(/try again in\s+((?:\d+(?:\.\d+)?\s*(?:ms|m|h|d|s)\s*)+)/i)?.[1],
    err?.retryAfter,
    err?.response?.headers?.['retry-after'],
  ];
  for (const candidate of candidates) {
    const ms = parseDurationMs(candidate);
    if (ms && ms > 0) return clampNumber(ms, 0, MAX_COOLDOWN_MS, FALLBACK_COOLDOWN_MS);
  }
  return FALLBACK_COOLDOWN_MS;
};

const enterCooldown = (err) => {
  const until = Date.now() + extractCooldownMs(err);
  if (until > cooldownUntil) cooldownUntil = until;
  const remaining = getAICooldownRemainingMs();
  if (!cooldownLogged) {
    cooldownLogged = true;
    const daily = /PerDayPerModel|PerDayPerProject/i.test(`${err?.message || ''}`);
    logger.warn(
      `[AI] Gemini quota exhausted${daily ? ' (daily)' : ''} — AI paused for ${describeCooldown(remaining)}; using fallback responses until then`
    );
  }
  persistGuardState();
};

const exitCooldown = () => {
  cooldownUntil = 0;
  cooldownLogged = false;
  persistGuardState();
};

const cacheKey = (systemPrompt, userPrompt, modelId) =>
  `${modelId}\u0000${systemPrompt || ''}\u0000${userPrompt}`;

const readCache = (key) => {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  // refresh LRU position
  responseCache.delete(key);
  responseCache.set(key, hit);
  return hit.value;
};

const writeCache = (key, value) => {
  if (RESPONSE_CACHE_TTL_MS <= 0) return;
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest !== undefined) responseCache.delete(oldest);
  }
  responseCache.set(key, { value, expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS });
};

export function resolveModelId(requested) {
  return MODEL_MAP[requested] || requested;
}

function getModel(modelId) {
  const resolved = resolveModelId(modelId);
  if (modelCache.has(resolved)) return modelCache.get(resolved);
  const model = client.getGenerativeModel({ model: resolved });
  modelCache.set(resolved, model);
  return model;
}

function initialize() {
  if (availabilityChecked) return Boolean(client);
  availabilityChecked = true;

  if (!config.gemini?.apiKey) {
    logger.warn('[AI] No GEMINI_API_KEY configured — AI features will use fallback responses');
    return false;
  }

  try {
    client = new GoogleGenerativeAI(config.gemini.apiKey);
    const primary = resolveModelId(config.gemini.model || 'gemini-2.5-flash');
    logger.info(`[AI] Gemini client initialized with model: ${primary}`);
    restoreGuardState();
    return true;
  } catch (err) {
    logger.error(`[AI] Gemini initialization failed: ${err.message}`);
    client = null;
    return false;
  }
}

export function isAIAvailable() {
  return Boolean(config.gemini?.apiKey);
}

const isQuotaError = (err) => {
  const status = err?.status || err?.statusCode || err?.response?.status;
  const message = `${err?.message || ''} ${err?.statusText || ''}`.toLowerCase();
  return (
    status === 429 ||
    /quota|rate.?limit|resource.?exhausted|too many requests|\b429\b/.test(message)
  );
};

const isTransientError = (err) => {
  const status = err?.status || err?.statusCode || err?.response?.status;
  const code = err?.code || '';
  const message = `${code} ${err?.message || ''} ${err?.statusText || ''}`.toLowerCase();
  if (status === 429 || (status >= 500 && status !== 501)) return true;
  return /fetch failed|econnreset|etimedout|enotfound|eai_again|socket hang up|service unavailable|high demand|network error|timeout|aborted/i.test(message);
};

/**
 * Gemini reports capacity exhaustion as 503 / "This model is currently
 * experiencing high demand". Those windows last seconds-to-minutes, so re-sending
 * the identical request a fraction of a second later only burns latency — the
 * fastest recovery is to fail over to the next candidate model immediately.
 * Retryable-but-not-overloaded failures (socket resets, timeouts) still get their
 * attempts, because those often clear immediately.
 */
const isOverloadError = (err) => {
  const status = err?.status || err?.statusCode || err?.response?.status;
  const message = `${err?.code || ''} ${err?.message || ''} ${err?.statusText || ''}`.toLowerCase();
  return (
    status === 503 ||
    status === 529 ||
    /\b503\b|service unavailable|high demand|overloaded|currently experiencing/.test(message)
  );
};

/** Provider-supplied retry hint, capped so it can never stall the request. */
const retryAfterMs = (err) => {
  const header = err?.response?.headers?.['retry-after'] ?? err?.retryAfter;
  const ms = parseDurationMs(header);
  return ms != null && ms > 0 ? Math.min(ms, MAX_RETRY_DELAY_MS) : null;
};

const retryDelayMs = (err, attempt) => {
  const hinted = retryAfterMs(err);
  if (hinted != null) return hinted;
  const base = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  // Jitter keeps a burst of clients from stampeding the same endpoint in lockstep.
  return Math.round(base * (0.75 + Math.random() * 0.5));
};

const toAIUnavailableError = (err) => {
  if (err instanceof AIUnavailableError) return err;
  if (isQuotaError(err)) {
    enterCooldown(err);
    return new AIUnavailableError();
  }
  return null;
};

async function callModel(modelId, systemPrompt, userPrompt, temperature, maxTokens, deadline) {
  const fullText = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
  let lastError;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (Date.now() >= deadline) {
      logger.warn(
        `[AI] Gemini ${modelId} not attempted — call deadline of ${CALL_DEADLINE_MS}ms reached`
      );
      return lastError
        ? { transient: true, error: lastError }
        : { transient: true, error: new Error(`AI call exceeded ${CALL_DEADLINE_MS}ms`) };
    }

    try {
      const result = await getModel(modelId).generateContent(
        {
          contents: [{ role: 'user', parts: [{ text: fullText }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        },
        { timeout: Math.min(REQUEST_TIMEOUT_MS, Math.max(1000, deadline - Date.now())) }
      );

      const text = result?.response?.text?.();
      if (!text || !text.trim()) throw new Error('Empty AI response — no content returned');
      return text.trim();
    } catch (err) {
      const unavailable = toAIUnavailableError(err);
      if (unavailable) throw unavailable;

      lastError = err;

      const overload = isOverloadError(err);
      const canRetry = isTransientError(err) && attempt < MAX_ATTEMPTS - 1 && !overload;

      if (canRetry) {
        const delay = retryDelayMs(err, attempt);
        logger.warn(`[AI] Gemini ${modelId} transient failure (attempt ${attempt + 1}/${MAX_ATTEMPTS}): ${err.message} — retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }

      if (isTransientError(err)) {
        logger.warn(
          overload
            ? `[AI] Gemini ${modelId} overloaded (${err.message}) — skipping remaining attempts and failing over`
            : `[AI] Gemini ${modelId} still unavailable after ${MAX_ATTEMPTS} attempts: ${err.message}`
        );
        return { transient: true, error: err };
      }

      return { transient: false, error: err };
    }
  }

  return lastError ? { transient: isTransientError(lastError), error: lastError } : { transient: false, error: null };
}

async function runModels(candidates, systemPrompt, userPrompt, temperature, maxTokens, deadline) {
  for (const modelId of candidates) {
    const outcome = await callModel(modelId, systemPrompt, userPrompt, temperature, maxTokens, deadline);
    if (typeof outcome === 'string') {
      exitCooldown();
      return outcome;
    }

    if (!outcome.transient) {
      logger.error(`[AI] Gemini call failed: ${outcome.error?.message}`);
      throw outcome.error;
    }
    if (modelId !== candidates[candidates.length - 1]) {
      logger.warn(`[AI] Gemini ${modelId} unavailable — falling back to next model`);
    }
  }

  logger.warn(`[AI] All Gemini models unavailable: ${AI_UNAVAILABLE_MESSAGE}`);
  throw new AIUnavailableError();
}

/**
 * Entry point for every AI call: applies the budget/cooldown guards and the
 * response cache, then delegates to the first model that answers.
 */
async function generateText(systemPrompt, userPrompt, temperature, maxTokens) {
  if (!initialize()) throw new AIUnavailableError();

  // Quota already exhausted upstream — answer instantly instead of waiting on a
  // doomed HTTP round-trip (this used to add 1–3s to every request).
  if (isAIInCooldown()) {
    logger.debug(
      `[AI] Skipped — in quota cooldown for another ${describeCooldown(getAICooldownRemainingMs())}`
    );
    throw new AIUnavailableError();
  }

  rollUsageWindow();
  if (usage.count >= DAILY_BUDGET) {
    logger.warn(
      `[AI] Daily budget exhausted (${DAILY_BUDGET} calls) — remaining requests today use fallback responses`
    );
    throw new AIUnavailableError();
  }

  const primary = resolveModelId(config.gemini.model || 'gemini-2.5-flash');
  const candidates = [primary, ...FALLBACK_MODELS.filter((m) => resolveModelId(m) !== primary)];
  const key = cacheKey(systemPrompt, userPrompt, primary);

  const cached = readCache(key);
  if (cached !== null) return cached;

  // Collapse concurrent identical prompts (e.g. several polling clients) into a
  // single upstream request.
  const pending = inflight.get(key);
  if (pending) return pending;

  usage.count += 1;
  logger.debug(`[AI] Request ${usage.count}/${DAILY_BUDGET} today → ${primary}`);
  persistGuardState();

  const request = runModels(candidates, systemPrompt, userPrompt, temperature, maxTokens, Date.now() + CALL_DEADLINE_MS)
    .then((text) => {
      writeCache(key, text);
      return text;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

/**
 * Plain-text chat completion (Gemini). Throws AIUnavailableError on quota/unavailable.
 */
export async function chatCompletion(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 1500) {
  return generateText(systemPrompt, userPrompt, temperature, maxTokens);
}

/**
 * Extract and parse the first balanced JSON object/array from a model response.
 * Handles code fences, leading/trailing commentary, and extra text.
 */
const tryParseBalancedJSON = (text) => {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '{' && ch !== '[') continue;
    const open = ch;
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (c === '\\') {
          escaped = true;
        } else if (c === '"') {
          inString = false;
        }
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === open) {
        depth++;
      } else if (c === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(i, j + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
};

/**
 * Attempt to parse the first balanced JSON object/array from a string.
 * Returns the parsed value, or null when nothing valid is found.
 */
export const tryParseJSON = (text) => {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through to balanced scan */
  }
  return tryParseBalancedJSON(trimmed);
};

/**
 * JSON chat completion (Gemini). Parses the model output into an object/array.
 * Throws AIUnavailableError on quota/unavailable.
 */
export async function chatJSON(systemPrompt, userPrompt, temperature = 0.5, maxTokens = 2000) {
  const text = await generateText(systemPrompt, userPrompt, temperature, maxTokens);
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/i, '').trim();

  const parsed = tryParseJSON(cleaned);
  if (parsed !== null || cleaned === 'null') return parsed;
  throw new Error('AI returned invalid JSON');
}