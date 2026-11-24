import OpenAI from 'openai';
import { config } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

class OpenAIProvider {
  constructor() {
    this.name = 'openai';
    this.client = null;
    this.modelId = null;
  }

  isAvailable() {
    return Boolean(config.openai?.apiKey);
  }

  initialize() {
    if (!this.isAvailable()) return false;

    try {
      this.client = new OpenAI({ apiKey: config.openai.apiKey });
      this.modelId = config.openai.model || 'gpt-4o-mini';
      logger.info(`[AI] OpenAI provider initialized with model: ${this.modelId}`);
      return true;
    } catch (error) {
      logger.error(`[AI] OpenAI initialization failed: ${error.message}`);
      this.client = null;
      return false;
    }
  }

  async chat(message, { systemPrompt, history = [], temperature = 0.7, maxTokens = 1024 }) {
    if (!this.client) throw new Error('OpenAI provider not initialized');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    const response = await this.client.chat.completions.create({
      model: this.modelId,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    if (!response.choices?.[0]?.message?.content) {
      throw new Error('OpenAI returned empty response');
    }

    return response.choices[0].message.content.trim();
  }
}

export default OpenAIProvider;
