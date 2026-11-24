/**
 * In-memory TTL cache with single-flight de-duplication.
 *
 * Read-heavy reference endpoints (category tree, public stats, freelancer
 * directory) are requested repeatedly by every public page and were re-running
 * the same multi-query Mongo work each time. This keeps the result in process
 * for a short window and collapses concurrent identical requests into one query.
 *
 * Entries are deliberately per-process and short-lived; Redis is only configured
 * for future horizontal use (config.redis.url).
 */
import { logger } from './logger.js';

const DEFAULT_TTL_MS = 60 * 1000;
const MAX_ENTRIES_PER_NAMESPACE = 100;

const store = new Map(); // namespace -> Map<key, { value, expiresAt }>
const inflight = new Map(); // fullKey -> Promise

let hits = 0;
let misses = 0;

const namespaceStore = (namespace) => {
  let ns = store.get(namespace);
  if (!ns) {
    ns = new Map();
    store.set(namespace, ns);
  }
  return ns;
};

const evictIfNeeded = (ns) => {
  while (ns.size >= MAX_ENTRIES_PER_NAMESPACE) {
    const oldest = ns.keys().next().value;
    if (oldest === undefined) break;
    ns.delete(oldest);
  }
};

/**
 * Read through the cache. `loader` runs at most once per TTL window (and once
 * per concurrent group) and its resolved value is reused until it expires.
 */
export const cacheThrough = async (namespace, key, ttlMs, loader) => {
  const ns = namespaceStore(namespace);
  const hit = ns.get(key);

  if (hit) {
    if (hit.expiresAt > Date.now()) {
      hits += 1;
      // refresh LRU position
      ns.delete(key);
      ns.set(key, hit);
      return hit.value;
    }
    ns.delete(key);
  }

  misses += 1;
  const fullKey = `${namespace}:${key}`;
  const pending = inflight.get(fullKey);
  if (pending) return pending;

  const request = Promise.resolve()
    .then(loader)
    .then((value) => {
      evictIfNeeded(ns);
      ns.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inflight.delete(fullKey);
    });

  inflight.set(fullKey, request);
  return request;
};

/** Drop one entry, a whole namespace, or namespaces matching a prefix. */
export const invalidateCache = (namespace, key) => {
  if (!namespace) {
    store.clear();
    inflight.clear();
    return;
  }
  if (key === undefined) {
    store.delete(namespace);
    return;
  }
  store.get(namespace)?.delete(key);
};

/**
 * Build a stable cache key from a query object (sorted keys, arrays preserved)
 * so param order never produces a different entry.
 */
export const stableKey = (value) => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.keys(value)
      .filter((k) => value[k] !== undefined && value[k] !== '' && value[k] !== null)
      .sort()
      .map((k) => `${k}=${stableKey(value[k])}`);
    return `{${entries.join('&')}}`;
  }
  return String(value);
};

export const cacheStats = () => {
  const namespaces = {};
  let entries = 0;
  for (const [namespace, ns] of store.entries()) {
    namespaces[namespace] = ns.size;
    entries += ns.size;
  }
  return { hits, misses, entries, namespaces, inflight: inflight.size };
};

export const cacheDefaults = { DEFAULT_TTL_MS, MAX_ENTRIES_PER_NAMESPACE };

export const logCacheStats = () => logger.debug(`[cache] ${JSON.stringify(cacheStats())}`);