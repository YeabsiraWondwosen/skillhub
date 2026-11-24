import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { Message } from '../models/index.js';
import { chatCompletion, chatJSON, tryParseJSON, isAIAvailable, AIUnavailableError } from './aiClient.js';

const AI_AVAILABLE = isAIAvailable();

// Run an AI-backed task. Unavailability (no key, quota/rate limit, all models
// down) is propagated as an AIUnavailableError so the API can answer with an
// honest 503 instead of silently returning the untransformed input as if the
// model had produced it. Only genuine per-call failures (e.g. malformed JSON
// from the model) fall back to the deterministic result.
const safeAICall = async (fn, fallback) => {
  if (!AI_AVAILABLE) throw new AIUnavailableError();
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AIUnavailableError || err?.name === 'AIUnavailableError') {
      logger.warn(`AI messaging unavailable: ${err.message}`);
      throw err;
    }
    logger.error(`AI messaging error: ${err.message}`);
    return typeof fallback === 'function' ? fallback() : fallback;
  }
};

/**
 * AI reply assistant — generate a suggested reply based on conversation context
 */
export const generateSmartReply = async (messageText, conversationHistory = [], tone = 'professional') => {
  const historyContext = conversationHistory.length
    ? conversationHistory.map(m => `${m.senderName}: ${m.content}`).join('\n')
    : '';

  const fallback = {
    formal: `Thank you for your message. I will review and get back to you shortly.`,
    casual: `Got it, thanks! I'll take a look and follow up.`,
    professional: `Thank you for the update. I'll review this and respond with more details soon.`,
  };

  return safeAICall(async () => {
    const prompt = `Generate 3 smart reply suggestions for a messaging conversation.

Context:
${historyContext ? `Previous messages:\n${historyContext}\n\n` : ''}Latest message: "${messageText}"

Tone: ${tone}

Return JSON array of 3 replies:
[{"text": "suggested reply", "confidence": 0.9, "style": "formal/casual/professional"}]

Only return valid JSON.`;

    const result = await chatCompletion(
      'You are a smart messaging assistant that generates natural, context-aware reply suggestions. Return only valid JSON.',
      prompt,
      0.8,
      500
    );

    const parsed = tryParseJSON(result);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && parsed.text) return [parsed];
    if (typeof result === 'string' && result.trim()) return [{ text: result, confidence: 0.7, style: tone }];
    return [{ text: fallback[tone] || fallback.professional, confidence: 0.5, style: tone }];
  }, [{ text: fallback[tone] || fallback.professional, confidence: 0.5, style: tone }]);
};

/**
 * AI grammar correction — fix grammar and spelling in a message
 */
export const correctGrammar = async (text) => {
  return safeAICall(async () => {
    const result = await chatCompletion(
      `You are a grammar and spelling correction assistant. Fix the following text. Keep the meaning and tone intact. Return the corrected text ONLY, no explanations.

Original text: "${text}"

Corrected text:`,
      'Fix the grammar and spelling.',
      0.3,
      500
    );

    return {
      corrected: result,
      original: text,
      changes: result !== text,
    };
  }, { corrected: text, original: text, changes: false });
};

/**
 * AI message rewriter — rewrite message in different style/tone
 */
export const rewriteMessage = async (text, targetStyle = 'professional') => {
  const styleMap = {
    professional: 'Rewrite in a professional, clear, and concise business tone',
    friendly: 'Rewrite in a warm, friendly, and approachable tone',
    formal: 'Rewrite in a formal, respectful, and structured tone',
    casual: 'Rewrite in a casual, relaxed, and conversational tone',
    concise: 'Rewrite to be as brief and direct as possible while keeping the meaning',
    detailed: 'Rewrite with more detail and elaboration',
    empathetic: 'Rewrite with empathy and emotional understanding',
    persuasive: 'Rewrite to be more compelling and persuasive',
  };

  const instruction = styleMap[targetStyle] || styleMap.professional;

  return safeAICall(async () => {
    const result = await chatCompletion(
      `You are a message rewriting assistant. ${instruction}. Return ONLY the rewritten text, nothing else.

Original: "${text}"`,
      'Rewrite this message.',
      0.7,
      800
    );

    return {
      rewritten: result,
      original: text,
      style: targetStyle,
    };
  }, { rewritten: text, original: text, style: targetStyle });
};

/**
 * AI translator — translate message to another language
 */
export const translateMessage = async (text, targetLanguage = 'Amharic') => {
  const languageMap = {
    amharic: 'Amharic (አማርኛ)',
    english: 'English',
    french: 'French',
    arabic: 'Arabic',
    spanish: 'Spanish',
    swahili: 'Swahili',
    chinese: 'Chinese (Mandarin)',
    japanese: 'Japanese',
  };

  return safeAICall(async () => {
    const langName = languageMap[targetLanguage.toLowerCase()] || targetLanguage;

    const result = await chatCompletion(
      `You are a professional translator. Translate the following text to ${langName}. Return ONLY the translation, nothing else.

Text: "${text}"`,
      'Translate.',
      0.3,
      800
    );

    return {
      translated: result,
      original: text,
      targetLanguage: langName,
    };
  }, { translated: text, original: text, targetLanguage });
};

/**
 * AI conversation summary — summarize a conversation thread
 */
export const summarizeConversation = async (messages) => {
  if (!messages.length) {
    return { summary: 'No messages to summarize.', keyPoints: [], actionItems: [] };
  }

  const messageText = messages.map(m => `${m.senderName || 'User'}: ${m.content}`).join('\n');

  return safeAICall(async () => {
    const prompt = `You are a conversation summarizer. Summarize the following conversation.

Messages:
${messageText}

Return JSON:
{
  "summary": "2-3 sentence summary",
  "keyPoints": ["key point 1", "key point 2"],
  "actionItems": ["action item 1", "action item 2"],
  "sentiment": "positive/neutral/negative",
  "topics": ["topic 1", "topic 2"]
}

Only return valid JSON.`;

    const parsed = await chatJSON(
      'Summarize this conversation.',
      prompt,
      0.5,
      800
    );

    return {
      summary: parsed.summary || 'Summary unavailable.',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      sentiment: parsed.sentiment || 'neutral',
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      messageCount: messages.length,
      dateRange: {
        from: messages[0]?.createdAt,
        to: messages[messages.length - 1]?.createdAt,
      },
    };
  }, { summary: 'Summary unavailable.', keyPoints: [], actionItems: [], sentiment: 'neutral', topics: [] });
};

/**
 * AI sentiment analysis — analyze the sentiment of a message
 */
export const analyzeSentiment = async (text) => {
  return safeAICall(async () => {
    const prompt = `Analyze the sentiment of the following text. Return JSON:
{"label": "positive/neutral/negative", "score": 0.0-1.0, "reason": "brief explanation"}

Text: "${text}"

Only return valid JSON.`;

    const result = await chatCompletion(
      'You are a sentiment analysis assistant. Return only valid JSON.',
      prompt,
      0.3,
      200
    );

    const parsed = tryParseJSON(result);
    if (parsed && typeof parsed === 'object' && parsed.label) {
      return {
        label: parsed.label || 'neutral',
        score: Math.min(Math.max(parsed.score || 0.5, 0), 1),
        reason: parsed.reason || '',
      };
    }

    const normalized = result.trim().toLowerCase();
    if (['positive', 'neutral', 'negative'].includes(normalized)) {
      return {
        label: normalized,
        score: normalized === 'positive' ? 0.8 : normalized === 'negative' ? 0.2 : 0.5,
        reason: 'Direct sentiment response from AI',
      };
    }

    return { label: 'neutral', score: 0.5, reason: 'Analysis unavailable' };
  }, { label: 'neutral', score: 0.5, reason: 'Analysis unavailable' });
};

/**
 * AI smart search — search messages with natural language queries
 */
export const smartSearchMessages = async (query, messages) => {
  if (!messages.length) return [];

  const messageText = messages.map(m => `[${m._id}] (${m.senderName || 'User'}) ${m.content}`).join('\n');

  return safeAICall(async () => {
    const prompt = `You are a message search assistant. Find messages that match the user's search query.

Search query: "${query}"

Messages:
${messageText}

Return JSON array of matching message IDs with relevance scores:
[{"messageId": "...", "score": 0.9, "reason": "why this matches"}]

Return max 10 results. Only return valid JSON.`;

    const parsed = await chatJSON(
      'You are a message search assistant. Return only valid JSON.',
      prompt,
      0.3,
      500
    );

    if (Array.isArray(parsed)) return parsed.slice(0, 10);

    // Fallback: simple text match
    const lowerQuery = query.toLowerCase();
    return messages
      .filter(m => m.content?.toLowerCase().includes(lowerQuery))
      .map(m => ({ messageId: m._id, score: 0.5, reason: 'Text match' }));
  }, messages.filter(m => m.content?.toLowerCase().includes(query.toLowerCase())).map(m => ({ messageId: m._id, score: 0.5, reason: 'Text match' })));
};

/**
 * AI quick replies — generate contextual quick reply buttons
 */
export const generateQuickReplies = async (messageText, conversationType = 'direct') => {
  return safeAICall(async () => {
    const prompt = `Based on this message in a ${conversationType} conversation, generate 3-4 quick reply suggestions.

Message: "${messageText}"

Return JSON array:
[{"text": "quick reply text", "icon": "emoji representation like 👍 or ✅ or 📅"}]

Only return valid JSON.`;

    const parsed = await chatJSON(
      'You are a messaging assistant that generates quick replies. Return only valid JSON.',
      prompt,
      0.8,
      300
    );

    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  }, [
    { text: 'Thanks!', icon: '👍' },
    { text: 'Got it, will do.', icon: '✅' },
    { text: 'Let me check and get back to you.', icon: '🔍' },
  ]);
};
