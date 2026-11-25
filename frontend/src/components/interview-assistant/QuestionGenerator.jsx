import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  PlusIcon, SparklesIcon, TrashIcon, CheckCircleIcon,
  ChatBubbleLeftEllipsisIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useGenerateQuestions, useEvaluateAnswer } from '@/hooks/useInterviewAssistant';
import { clsx } from 'clsx';

const TYPE_BADGE = {
  behavioral: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  technical: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  situational: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  problem_solving: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  system_design: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  culture_fit: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
};

const DIFF_BADGE = {
  easy: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  hard: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

export default function QuestionGenerator({ questions = [], onQuestionsChange, sessionId }) {
  const [generating, setGenerating] = useState(false);
  const [expandedQ, setExpandedQ] = useState(null);
  const [answerInputs, setAnswerInputs] = useState({});
  const [evaluating, setEvaluating] = useState(null);

  const { mutate: generateQuestions } = useGenerateQuestions();
  const { mutate: evaluateAnswer } = useEvaluateAnswer();

  const [config, setConfig] = useState({
    skills: '',
    interviewType: 'mixed',
    difficulty: 'mid',
    count: 5,
  });

  const handleGenerate = () => {
    setGenerating(true);
    generateQuestions({
      skills: config.skills.split(',').map(s => s.trim()).filter(Boolean),
      interviewType: config.interviewType,
      difficulty: config.difficulty,
      count: config.count,
    }, {
      onSuccess: (res) => {
        onQuestionsChange?.(res.data || []);
        setGenerating(false);
      },
      onError: () => setGenerating(false),
    });
  };

  const handleEvaluate = (q) => {
    setEvaluating(q.id);
    evaluateAnswer({
      question: q.text,
      candidateAnswer: answerInputs[q.id] || '',
      scoringCriteria: q.scoringCriteria,
    }, {
      onSuccess: (res) => {
        const updated = questions.map(qq =>
          qq.id === q.id ? { ...qq, candidateAnswer: answerInputs[q.id], score: res.data.score, scoreReasoning: res.data.reasoning } : qq
        );
        onQuestionsChange?.(updated);
        setEvaluating(null);
      },
      onError: () => setEvaluating(null),
    });
  };

  return (
    <div className="space-y-4">
      {/* Config */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-primary-500" />
          Generate Questions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Skills (comma-separated)</label>
            <input type="text" value={config.skills} onChange={e => setConfig(p => ({ ...p, skills: e.target.value }))}
              placeholder="React, Node.js, TypeScript" className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select value={config.interviewType} onChange={e => setConfig(p => ({ ...p, interviewType: e.target.value }))} className="input-field w-full">
              <option value="mixed">Mixed</option>
              <option value="technical">Technical</option>
              <option value="behavioral">Behavioral</option>
              <option value="system_design">System Design</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Difficulty</label>
            <select value={config.difficulty} onChange={e => setConfig(p => ({ ...p, difficulty: e.target.value }))} className="input-field w-full">
              <option value="junior">Junior</option>
              <option value="mid">Mid-Level</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <label className="text-xs text-gray-500">Count:</label>
          <input type="number" min={1} max={20} value={config.count}
            onChange={e => setConfig(p => ({ ...p, count: Number(e.target.value) }))}
            className="input-field w-20 text-center" />
          <button onClick={handleGenerate} disabled={generating} className="btn-primary flex items-center gap-2 ml-auto">
            <SparklesIcon className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Questions */}
      {questions.length > 0 && (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={clsx('card p-4 transition-all', q.score !== null && q.score !== undefined && 'bg-green-50/20 dark:bg-green-900/5')}>
              <div className="flex items-start gap-3" onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}>
                <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 text-xs font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', TYPE_BADGE[q.type])}>{q.type?.replace('_', ' ')}</span>
                    <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', DIFF_BADGE[q.difficulty])}>{q.difficulty}</span>
                    {q.score !== null && q.score !== undefined && (
                      <span className="text-xs font-bold text-primary-600">{q.score}/10</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">{q.text}</p>
                </div>
              </div>

              {expandedQ === q.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3 ml-9">
                  {q.expectedAnswer && (
                    <div className="text-xs"><span className="font-medium text-gray-500">Expected: </span><span className="text-gray-600 dark:text-gray-400">{q.expectedAnswer}</span></div>
                  )}
                  {q.followUp && (
                    <div className="text-xs"><span className="font-medium text-gray-500">Follow-up: </span><span className="text-gray-600 dark:text-gray-400">{q.followUp}</span></div>
                  )}
                  {q.scoringCriteria?.length > 0 && (
                    <div className="text-xs"><span className="font-medium text-gray-500">Criteria: </span>{q.scoringCriteria.join(' · ')}</div>
                  )}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Candidate Answer</label>
                    <textarea value={answerInputs[q.id] || q.candidateAnswer || ''} rows={3}
                      onChange={e => setAnswerInputs(p => ({ ...p, [q.id]: e.target.value }))}
                      className="input-field w-full resize-none text-sm" placeholder="Enter candidate's answer..." />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEvaluate(q)} disabled={evaluating === q.id || !answerInputs[q.id]}
                      className="btn-primary btn-sm flex items-center gap-1">
                      {evaluating === q.id ? 'Evaluating...' : 'Evaluate'}
                    </button>
                    {q.scoreReasoning && (
                      <p className="text-[11px] text-gray-400 italic flex-1">{q.scoreReasoning}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
