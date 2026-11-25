import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatBubbleLeftRightIcon, XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useAIChat } from '@/hooks/useSupport';
import { useAuthStore } from '@/store/authStore';

// The site-wide chat launcher is now the official TalkSilo embed loaded once from
// frontend/index.html. It renders its own fixed launcher in the same bottom-right
// corner, so this legacy SkillHub launcher is disabled to avoid two overlapping
// chat buttons. The component (and its /support/chat + ticket backend) is kept
// intact so it can be restored by flipping this flag.
const LEGACY_AI_CHAT_ENABLED = false;

export default function AIChatWidget() {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { mutate: sendChat, isPending } = useAIChat();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = () => {
    if (!message.trim() || isPending) return;

    const userMessage = { role: 'user', content: message.trim() };
    setConversation((prev) => [...prev, userMessage]);

    const history = conversation.map((msg) => ({
      senderType: msg.role === 'user' ? 'user' : 'ai',
      content: msg.content,
    }));

    sendChat(
      { message: message.trim(), conversationHistory: history },
      {
        onSuccess: (res) => {
          const aiMessage = { role: 'assistant', content: res.data.data.response };
          setConversation((prev) => [...prev, aiMessage]);
        },
        onError: () => {
          setConversation((prev) => [
            ...prev,
            { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
          ]);
        },
      }
    );
    setMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // No legacy floating launcher / panel. Returned after every hook has run so the
  // rules of hooks still hold if this component is ever re-enabled.
  if (!LEGACY_AI_CHAT_ENABLED) return null;

  return (
    <>
      {/* Floating button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-shadow"
      >
        {isOpen ? <XMarkIcon className="w-6 h-6" /> : <ChatBubbleLeftRightIcon className="w-6 h-6" />}
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] bg-white dark:bg-dark-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
            style={{ height: '500px' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">SkillHub Support</h3>
                  <p className="text-xs text-white/80">AI-powered assistant</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversation.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-4">
                    <ChatBubbleLeftRightIcon className="w-8 h-8 text-primary-500" />
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {user ? `Hi ${user.firstName}! How can I help?` : 'How can I help you?'}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Ask me anything about SkillHub — jobs, payments, accounts, and more.
                  </p>
                  <div className="mt-4 space-y-2">
                    {['How do I post a job?', 'How does escrow work?', 'How do I withdraw funds?'].map((q) => (
                      <button
                        key={q}
                        onClick={() => { setMessage(q); }}
                        className="block w-full text-left text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg px-3 py-2 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {conversation.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary-500 text-white rounded-br-md'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-white rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isPending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-dark-700 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-dark-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 max-h-24"
                />
                <button
                  onClick={sendMessage}
                  disabled={!message.trim() || isPending}
                  className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                </button>
              </div>
              {!user && (
                <p className="text-[10px] text-gray-400 mt-2 text-center">
                  <a href="/auth/login" className="text-primary-500 hover:underline">Sign in</a> for personalized support
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
