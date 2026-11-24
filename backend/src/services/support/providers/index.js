import GeminiProvider from './gemini.provider.js';
import OpenAIProvider from './openai.provider.js';
import { config } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

// OpenAI code is KEPT for future use but is NOT part of the active execution path.
// To re-enable OpenAI later, set AI_OPENAI_ENABLED=true and AI_PROVIDER=openai in backend/.env.
const OPENAI_ENABLED = process.env.AI_OPENAI_ENABLED === 'true';

const PROVIDERS = {
  gemini: GeminiProvider,
  openai: OpenAIProvider,
};

let activeProvider = null;
let fallbackProvider = null;

function resolveProviderOrder() {
  const preferred = (config.ai?.provider || 'gemini').toLowerCase();
  const order = [preferred];
  if (OPENAI_ENABLED) {
    const fallback = preferred === 'gemini' ? 'openai' : 'gemini';
    order.push(fallback);
  }
  return order;
}

export function initializeProviders() {
  const order = resolveProviderOrder();
  const instances = order
    .filter((name) => PROVIDERS[name])
    .map((name) => {
      const instance = new PROVIDERS[name]();
      return instance.isAvailable() && instance.initialize() ? instance : null;
    })
    .filter(Boolean);

  activeProvider = instances[0] || null;
  fallbackProvider = instances[1] || null;

  if (!activeProvider) {
    logger.warn('[AI] No AI providers available — all AI features will use fallback responses');
  } else {
    logger.info(`[AI] Primary provider: ${activeProvider.name}`);
    if (fallbackProvider) {
      logger.info(`[AI] Fallback provider: ${fallbackProvider.name}`);
    }
  }
}

export function getProvider() {
  return activeProvider;
}

export function getFallbackProvider() {
  return fallbackProvider;
}

export function isAnyProviderAvailable() {
  return Boolean(activeProvider || fallbackProvider);
}

export { GeminiProvider, OpenAIProvider };
