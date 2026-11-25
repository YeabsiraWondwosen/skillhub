import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { messageService } from '@/services/message.service';
import {
  SparklesIcon, LanguageIcon, PencilSquareIcon, CheckCircleIcon,
  ChatBubbleLeftRightIcon, ArrowPathIcon, XMarkIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const AI_TOOLS = [
  { id: 'smartReply', label: 'Smart Reply', icon: SparklesIcon, color: 'text-purple-500' },
  { id: 'grammar', label: 'Grammar Fix', icon: CheckCircleIcon, color: 'text-green-500' },
  { id: 'rewrite', label: 'Rewrite', icon: PencilSquareIcon, color: 'text-blue-500' },
  { id: 'translate', label: 'Translate', icon: LanguageIcon, color: 'text-orange-500' },
  { id: 'summarize', label: 'Summarize', icon: ChatBubbleLeftRightIcon, color: 'text-cyan-500' },
  { id: 'search', label: 'Smart Search', icon: MagnifyingGlassIcon, color: 'text-pink-500' },
];

const REWRITE_STYLES = [
  { id: 'professional', label: 'Professional' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'formal', label: 'Formal' },
  { id: 'casual', label: 'Casual' },
  { id: 'concise', label: 'Concise' },
  { id: 'empathetic', label: 'Empathetic' },
  { id: 'persuasive', label: 'Persuasive' },
];

const LANGUAGES = ['Amharic', 'English', 'French', 'Arabic', 'Spanish', 'Swahili'];

export default function AIToolsPanel({ conversationId, activeMessage, onInsertText, onClose }) {
  const [activeTool, setActiveTool] = useState(null);
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState(null);
  const [resultTool, setResultTool] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState('professional');
  const [selectedLang, setSelectedLang] = useState('Amharic');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedText = (inputText || activeMessage?.content || '').trim();
  const hasText = Boolean(selectedText);

  // API responses are wrapped as { success, statusCode, message, data }; the
  // payload lives at `r.data.data`. Surface the server's real error message
  // (e.g. a 503 when the AI provider is not configured) instead of a generic one.
  const handleError = (fallback) => (err) => {
    toast.error(err?.response?.data?.message || fallback);
  };

  const smartReplyMut = useMutation({
    mutationFn: () => messageService.getSmartReplies({
      messageText: inputText || activeMessage?.content,
      conversationId,
      tone: 'professional',
    }),
    onSuccess: (r) => { setResult(r.data?.data ?? null); setResultTool('smartReply'); },
    onError: handleError('Failed to generate reply'),
  });

  const grammarMut = useMutation({
    mutationFn: () => messageService.correctGrammar(inputText || activeMessage?.content),
    onSuccess: (r) => { setResult(r.data?.data ?? null); setResultTool('grammar'); },
    onError: handleError('Failed to check grammar'),
  });

  const rewriteMut = useMutation({
    mutationFn: () => messageService.rewriteMessage(inputText || activeMessage?.content, selectedStyle),
    onSuccess: (r) => { setResult(r.data?.data ?? null); setResultTool('rewrite'); },
    onError: handleError('Failed to rewrite'),
  });

  const translateMut = useMutation({
    mutationFn: () => messageService.translateMessage(inputText || activeMessage?.content, selectedLang),
    onSuccess: (r) => { setResult(r.data?.data ?? null); setResultTool('translate'); },
    onError: handleError('Failed to translate'),
  });

  const summaryMut = useMutation({
    mutationFn: () => messageService.getConversationSummary(conversationId),
    onSuccess: (r) => { setResult(r.data?.data ?? null); setResultTool('summarize'); },
    onError: handleError('Failed to summarize'),
  });

  const searchMut = useMutation({
    mutationFn: () => messageService.searchMessages({ conversationId, query: searchQuery }),
    onSuccess: (r) => { setResult(r.data?.data ?? null); setResultTool('search'); },
    onError: handleError('Failed to search'),
  });

  const handleRun = useCallback(() => {
    setResult(null);
    setResultTool(null);

    if (activeTool !== 'summarize' && activeTool !== 'search' && !hasText) {
      return toast.error('Enter some text or select a message first');
    }

    switch (activeTool) {
      case 'smartReply': smartReplyMut.mutate(); break;
      case 'grammar': grammarMut.mutate(); break;
      case 'rewrite': rewriteMut.mutate(); break;
      case 'translate': translateMut.mutate(); break;
      case 'summarize':
        if (!conversationId) return toast.error('Open a conversation to summarize');
        summaryMut.mutate();
        break;
      case 'search':
        if (!searchQuery.trim()) return toast.error('Enter a search query');
        searchMut.mutate();
        break;
    }
  }, [activeTool, hasText, inputText, activeMessage, selectedStyle, selectedLang, searchQuery, conversationId]);

  const isPending = smartReplyMut.isPending || grammarMut.isPending || rewriteMut.isPending ||
    translateMut.isPending || summaryMut.isPending || searchMut.isPending;

  const canRun = !!activeTool && !isPending && (
    activeTool === 'search' ? searchQuery.trim().length > 0
      : activeTool === 'summarize' ? Boolean(conversationId)
        : hasText
  );

  const renderResult = () => {
    if (!result || !resultTool) return null;

    // Smart replies
    if (resultTool === 'smartReply') {
      const replies = Array.isArray(result) ? result : [];
      if (replies.length === 0) {
        return <p className="text-sm text-gray-400 text-center py-3">No suggestions available</p>;
      }
      return (
        <div className="space-y-2">
          {replies.map((reply, i) => (
            <button key={i} onClick={() => onInsertText?.(reply.text)}
              className="w-full text-left p-3 rounded-xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700 hover:border-primary-300 transition-all group">
              <p className="text-sm text-gray-900 dark:text-white">{reply.text}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-400">{reply.style}</span>
                <span className="text-[10px] text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to insert
                </span>
              </div>
            </button>
          ))}
        </div>
      );
    }

    // Smart search results
    if (resultTool === 'search') {
      const matches = Array.isArray(result) ? result : [];
      if (matches.length === 0) {
        return <p className="text-sm text-gray-400 text-center py-3">No results found</p>;
      }
      return (
        <div className="space-y-2">
          {matches.map((r, i) => (
            <div key={r.messageId || i} className="p-3 rounded-xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Score: {Math.round((r.score || 0) * 100)}%</p>
              <p className="text-sm text-gray-900 dark:text-white">{r.reason || 'Match'}</p>
            </div>
          ))}
        </div>
      );
    }

    // Grammar correction
    if (resultTool === 'grammar' && result?.corrected !== undefined) {
      return (
        <div className="space-y-3">
          {result.changes ? (
            <>
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Original</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-through">{result.original}</p>
              </div>
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30">
                <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Corrected</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{result.corrected}</p>
              </div>
              <button onClick={() => onInsertText?.(result.corrected)}
                className="btn-primary btn-sm w-full">
                Use Corrected Version
              </button>
            </>
          ) : (
            <p className="text-sm text-green-600 dark:text-green-400 text-center py-3">No grammar issues found!</p>
          )}
        </div>
      );
    }

    // Rewrite / Translate
    if ((resultTool === 'rewrite' || resultTool === 'translate') &&
      (result?.rewritten !== undefined || result?.translated !== undefined)) {
      const text = result.rewritten || result.translated;
      return (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800/30">
            <p className="text-xs text-primary-600 dark:text-primary-400 font-medium mb-1">
              {result.rewritten ? `Rewritten (${result.style})` : `Translated to ${result.targetLanguage}`}
            </p>
            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{text}</p>
          </div>
          <button onClick={() => onInsertText?.(text)}
            className="btn-primary btn-sm w-full">
            Insert Text
          </button>
        </div>
      );
    }

    // Summary
    if (resultTool === 'summarize' && result?.summary) {
      return (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-800/30">
            <p className="text-xs text-cyan-600 dark:text-cyan-400 font-medium mb-1">Summary</p>
            <p className="text-sm text-gray-900 dark:text-white">{result.summary}</p>
          </div>
          {result.keyPoints?.length > 0 && (
            <div className="p-3 rounded-xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Key Points</p>
              <ul className="space-y-1">
                {result.keyPoints.map((point, i) => (
                  <li key={i} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
                    <span className="text-primary-500 mt-0.5">•</span>{point}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.actionItems?.length > 0 && (
            <div className="p-3 rounded-xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Action Items</p>
              <ul className="space-y-1">
                {result.actionItems.map((item, i) => (
                  <li key={i} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
                    <span className="text-orange-500 mt-0.5">▸</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-80 border-l border-gray-100 dark:border-gray-700 bg-white dark:bg-dark-800 flex flex-col h-full"
    >
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">AI Tools</span>
        </div>
        <button onClick={onClose} className="btn-icon btn-ghost text-gray-400">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Tool selection */}
      <div className="p-3 border-b border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-1.5">
          {AI_TOOLS.map(tool => {
            const Icon = tool.icon;
            return (
              <button key={tool.id} onClick={() => { setActiveTool(tool.id); setResult(null); setResultTool(null); }}
                className={clsx(
                  'flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-medium transition-all',
                  activeTool === tool.id
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 ring-1 ring-primary-200 dark:ring-primary-800'
                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-700'
                )}>
                <Icon className={clsx('w-4 h-4', activeTool === tool.id ? tool.color : '')} />
                {tool.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tool content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!activeTool ? (
          <p className="text-xs text-gray-400 text-center py-8">Select an AI tool above to get started</p>
        ) : (
          <>
            {/* Input area */}
            {activeTool !== 'summarize' && (
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  {activeTool === 'search' ? 'Search query' : 'Text to process'}
                </label>
                {activeTool === 'search' ? (
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search messages..."
                    className="input text-sm py-2"
                  />
                ) : (
                  <textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={activeMessage?.content || 'Enter text or select a message...'}
                    rows={3}
                    className="input text-sm py-2 resize-none"
                  />
                )}
                {!inputText && activeMessage?.content && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Using selected message: "{activeMessage.content.substring(0, 50)}..."
                  </p>
                )}
              </div>
            )}

            {/* Tool-specific options */}
            {activeTool === 'rewrite' && (
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Style</label>
                <div className="flex flex-wrap gap-1.5">
                  {REWRITE_STYLES.map(s => (
                    <button key={s.id} onClick={() => setSelectedStyle(s.id)}
                      className={clsx(
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                        selectedStyle === s.id
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                          : 'bg-gray-100 dark:bg-dark-700 text-gray-500 hover:bg-gray-200'
                      )}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTool === 'translate' && (
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Target Language</label>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map(lang => (
                    <button key={lang} onClick={() => setSelectedLang(lang)}
                      className={clsx(
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                        selectedLang === lang
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                          : 'bg-gray-100 dark:bg-dark-700 text-gray-500 hover:bg-gray-200'
                      )}>
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Run button */}
            <button onClick={handleRun} disabled={!canRun}
              className="btn-primary btn-sm w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {isPending ? (
                <>
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-3.5 h-3.5" />
                  Run {AI_TOOLS.find(t => t.id === activeTool)?.label}
                </>
              )}
            </button>

            {/* Results */}
            {renderResult()}
          </>
        )}
      </div>
    </motion.div>
  );
}
