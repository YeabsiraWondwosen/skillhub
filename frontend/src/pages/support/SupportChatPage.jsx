import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAIChat } from '@/hooks/useSupport';
import { useAuthStore } from '@/store/authStore';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/outline';

const QUICK_QUESTIONS = [
  'How do I post a job on SkillHub?',
  'How does the escrow payment system work?',
  'What are the platform fees?',
  'How do I verify my email?',
  'How do I become a verified freelancer?',
  'What skills are most in demand?',
];

const ROLE_QUESTIONS = {
  freelancer: [
    'How do I find jobs that match my skills?',
    'How do I write a winning proposal?',
    'How do I withdraw my earnings?',
    'How do I improve my reputation score?',
  ],
  client: [
    'How do I post a job on SkillHub?',
    'How does the escrow payment system work?',
    'How do I review proposals?',
    'How do I hire a freelancer?',
  ],
  admin: [
    'How do I manage support tickets?',
    'How do I view platform analytics?',
    'How do I handle fraud reports?',
    'How do I moderate user content?',
  ],
};

export default function SupportChatPage() {
  const { user } = useAuthStore();
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { mutate: sendChat, isPending } = useAIChat();

  const quickQuestions = user?.role && ROLE_QUESTIONS[user.role]
    ? ROLE_QUESTIONS[user.role]
    : QUICK_QUESTIONS;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const sendMessage = (text) => {
    const msg = text || message.trim();
    if (!msg || isPending) return;

    const userMessage = { role: 'user', content: msg };
    setConversation((prev) => [...prev, userMessage]);

    const history = conversation.map((m) => ({
      senderType: m.role === 'user' ? 'user' : 'ai',
      content: m.content,
    }));

    sendChat(
      { message: msg, conversationHistory: history },
      {
        onSuccess: (res) => {
          setConversation((prev) => [...prev, { role: 'assistant', content: res.data.data.response }]);
        },
        onError: () => {
          setConversation((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again or create a support ticket.' }]);
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
        <Link to="/support" className="btn-icon btn-ghost">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
          <SparklesIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-semibold text-gray-900 dark:text-white text-sm">SkillHub AI Assistant</h1>
          <p className="text-xs text-green-500">Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-gray-50 dark:bg-dark-900">
        {conversation.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 flex items-center justify-center mx-auto mb-4">
              <SparklesIcon className="w-10 h-10 text-primary-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {user ? `Hi ${user.firstName}! I'm your AI support assistant` : "Hi! I'm your AI support assistant"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
              Ask me anything about SkillHub — how to use features, payments, account issues, and more.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm text-primary-600 dark:text-primary-400 bg-white dark:bg-dark-800 border border-primary-200 dark:border-primary-800 rounded-xl px-4 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {conversation.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[75%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-primary-500 text-white rounded-br-md'
                : 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-md shadow-sm'
            }`}>
              {msg.content}
            </div>
          </motion.div>
        ))}

        {isPending && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-5 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-dark-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-dark-900 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 max-h-32"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!message.trim() || isPending}
            className="w-11 h-11 rounded-xl bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-2">
          AI responses are for guidance only. For account-specific issues, <Link to="/support" className="text-primary-500 hover:underline">create a support ticket</Link>.
        </p>
      </div>
    </div>
  );
}
