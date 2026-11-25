import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AcademicCapIcon, CodeBracketIcon, ClipboardDocumentCheckIcon,
  DocumentTextIcon, PlusIcon, TrashIcon, SparklesIcon,
  ArrowPathIcon, CalendarDaysIcon, ChartBarIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  useInterviewSessions, useCreateInterviewSession, useDeleteInterviewSession,
  useInterviewSession, useInterviewAnalytics,
} from '@/hooks/useInterviewAssistant';
import QuestionGenerator from '@/components/interview-assistant/QuestionGenerator';
import CodingChallenge from '@/components/interview-assistant/CodingChallenge';
import EvaluationScorecard from '@/components/interview-assistant/EvaluationScorecard';
import InterviewSummaryComponent from '@/components/interview-assistant/InterviewSummary';
import { clsx } from 'clsx';
import { format } from 'date-fns';

const TABS = [
  { key: 'generate', label: 'Generate', icon: SparklesIcon },
  { key: 'challenge', label: 'Coding', icon: CodeBracketIcon },
  { key: 'scorecard', label: 'Scorecard', icon: ClipboardDocumentCheckIcon },
  { key: 'summary', label: 'Summary', icon: DocumentTextIcon },
  { key: 'sessions', label: 'Sessions', icon: CalendarDaysIcon },
  { key: 'analytics', label: 'Analytics', icon: ChartBarIcon },
];

export default function InterviewAssistantPage() {
  const [activeTab, setActiveTab] = useState('generate');
  const [selectedSession, setSelectedSession] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSession, setNewSession] = useState({ title: '', role: '', skills: '', difficulty: 'mid' });

  const { data: sessionsRes, isLoading: sessionsLoading } = useInterviewSessions({});
  const { data: activeSession } = useInterviewSession(selectedSession);
  const { data: analytics } = useInterviewAnalytics();
  const { mutate: createSession, isPending: creating } = useCreateInterviewSession();
  const { mutate: deleteSession } = useDeleteInterviewSession();

  const sessions = Array.isArray(sessionsRes) ? sessionsRes : (sessionsRes?.sessions || []);
  const currentSession = activeSession?.session || activeSession;

  const handleCreateSession = () => {
    if (!newSession.title.trim()) return;
    createSession({
      title: newSession.title,
      role: newSession.role,
      skills: newSession.skills.split(',').map(s => s.trim()).filter(Boolean),
      difficulty: newSession.difficulty,
    }, {
      onSuccess: (res) => {
        const id = res?.data?._id || res?._id;
        if (id) setSelectedSession(id);
        setShowCreateModal(false);
        setNewSession({ title: '', role: '', skills: '', difficulty: 'mid' });
      },
    });
  };

  const handleSelectSession = (id) => {
    setSelectedSession(id);
    setActiveTab('generate');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <AcademicCapIcon className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">AI Interview Assistant</h1>
                <p className="text-xs text-gray-500">Generate questions, challenges, and evaluate candidates with AI</p>
              </div>
            </div>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary btn-sm flex items-center gap-2">
              <PlusIcon className="w-4 h-4" /> New Session
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar - Sessions */}
          <div className="col-span-12 lg:col-span-3">
            <div className="card p-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">Sessions</h3>
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {sessions.map(s => (
                  <button key={s._id} onClick={() => handleSelectSession(s._id)}
                    className={clsx(
                      'w-full text-left px-3 py-2 rounded-lg text-xs transition-all',
                      selectedSession === s._id
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                    )}>
                    <p className="font-medium truncate">{s.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {s.role || 'General'} · {s.questions?.length || 0} Q
                    </p>
                  </button>
                ))}
                {sessions.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No sessions yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-12 lg:col-span-9">
            {/* Tabs */}
            <div className="flex items-center gap-1 mb-4 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-200 dark:border-gray-700 overflow-x-auto">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                    activeTab === t.key
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                  )}>
                  <t.icon className="w-3.5 h-3.5" />{t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'generate' && (
                <motion.div key="gen" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <QuestionGenerator
                    questions={currentSession?.questions || []}
                    onQuestionsChange={(q) => {/* handled via mutations */}}
                    sessionId={selectedSession}
                  />
                </motion.div>
              )}

              {activeTab === 'challenge' && (
                <motion.div key="code" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <CodingChallenge
                    challenges={currentSession?.codingChallenges || []}
                    onChallengesChange={(c) => {/* handled via mutations */}}
                    sessionId={selectedSession}
                  />
                </motion.div>
              )}

              {activeTab === 'scorecard' && (
                <motion.div key="score" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <EvaluationScorecard session={currentSession} />
                </motion.div>
              )}

              {activeTab === 'summary' && (
                <motion.div key="sum" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <InterviewSummaryComponent session={currentSession} />
                </motion.div>
              )}

              {activeTab === 'sessions' && (
                <motion.div key="list" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div className="space-y-3">
                    {sessions.map(s => (
                      <div key={s._id} className="card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleSelectSession(s._id)}>
                        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                          <AcademicCapIcon className="w-5 h-5 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.title}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {s.role || 'General'} · {s.difficulty || 'mid'} · {s.questions?.length || 0} questions · {s.codingChallenges?.length || 0} challenges
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Created {s.createdAt ? format(new Date(s.createdAt), 'MMM d, yyyy') : '—'}
                            {s.duration && ` · ${s.duration} min`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.scorecard && (
                            <span className="text-[10px] font-medium text-green-600 bg-green-100 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                              Scored
                            </span>
                          )}
                          {s.summary && (
                            <span className="text-[10px] font-medium text-primary-600 bg-primary-100 dark:bg-primary-900/20 px-1.5 py-0.5 rounded">
                              Summarized
                            </span>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); deleteSession(s._id); }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {sessions.length === 0 && (
                      <div className="card p-8 text-center">
                        <AcademicCapIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No interview sessions yet. Create one to get started.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'analytics' && (
                <motion.div key="stats" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Total Sessions', value: analytics?.totalSessions || 0 },
                      { label: 'Total Questions', value: analytics?.totalQuestions || 0 },
                      { label: 'Total Challenges', value: analytics?.totalChallenges || 0 },
                      { label: 'Avg Score', value: analytics?.averageScore ? `${analytics.averageScore.toFixed(1)}/10` : '—' },
                    ].map((stat, i) => (
                      <div key={i} className="card p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                        <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  {analytics?.byRole?.length > 0 && (
                    <div className="card p-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Sessions by Role</h4>
                      <div className="space-y-2">
                        {analytics.byRole.map(r => (
                          <div key={r._id || 'other'} className="flex items-center gap-3">
                            <span className="text-xs text-gray-600 w-24 truncate">{r._id || 'Other'}</span>
                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }}
                                animate={{ width: `${(r.count / (analytics.totalSessions || 1)) * 100}%` }}
                                className="h-full bg-primary-500 rounded-full" />
                            </div>
                            <span className="text-xs font-medium text-gray-900 dark:text-white">{r.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Create Session Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">New Interview Session</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Session Title *</label>
                  <input type="text" value={newSession.title} onChange={e => setNewSession(p => ({ ...p, title: e.target.value }))}
                    className="input-field w-full" placeholder="Senior React Developer Interview" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Role</label>
                  <input type="text" value={newSession.role} onChange={e => setNewSession(p => ({ ...p, role: e.target.value }))}
                    className="input-field w-full" placeholder="Senior Frontend Engineer" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Skills (comma-separated)</label>
                  <input type="text" value={newSession.skills} onChange={e => setNewSession(p => ({ ...p, skills: e.target.value }))}
                    className="input-field w-full" placeholder="React, TypeScript, Node.js" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Difficulty</label>
                  <select value={newSession.difficulty} onChange={e => setNewSession(p => ({ ...p, difficulty: e.target.value }))}
                    className="input-field w-full">
                    <option value="junior">Junior</option>
                    <option value="mid">Mid-Level</option>
                    <option value="senior">Senior</option>
                    <option value="lead">Lead</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowCreateModal(false)} className="btn-outline btn-sm">Cancel</button>
                <button onClick={handleCreateSession} disabled={creating || !newSession.title.trim()} className="btn-primary btn-sm">
                  {creating ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
