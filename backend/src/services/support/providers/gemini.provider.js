import { config } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import { chatCompletion, isAIAvailable, resolveModelId } from '../../aiClient.js';

/**
 * Support-chat Gemini provider.
 *
 * The actual model call goes through the shared AI client (aiClient.js) so the
 * support bot shares the same quota guards as every other AI feature: daily
 * budget, fail-fast cooldown after a 429, and prompt caching. This provider used
 * to build its own SDK client, which bypassed those guards — during a quota
 * outage every chat burned a 6s failing round-trip and dumped a full stack.
 */
class GeminiProvider {
  constructor() {
    this.name = 'gemini';
  }

  isAvailable() {
    return isAIAvailable();
  }

  initialize() {
    if (!this.isAvailable()) return false;
    this.modelId = resolveModelId(config.gemini?.model || 'gemini-2.5-flash');
    logger.info(`[AI] Gemini provider ready with model: ${this.modelId}`);
    return true;
  }

  async chat(message, { systemPrompt, history = [], temperature = 0.7, maxTokens = 1024 }) {
    const conversation = [
      ...history.map((msg) => `${msg.role === 'assistant' ? 'Assistant' : 'User'}: ${msg.content}`),
      `User: ${message}`,
    ].join('\n\n');

    return chatCompletion(systemPrompt, conversation, temperature, maxTokens);
  }
}

export default GeminiProvider;