import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CodeBracketIcon, SparklesIcon, CheckCircleIcon, XCircleIcon,
  LightBulbIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useGenerateChallenge, useEvaluateCode } from '@/hooks/useInterviewAssistant';
import { clsx } from 'clsx';

const DIFF_BADGE = {
  easy: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  hard: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

const TYPE_BADGE = {
  algorithm: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700',
  data_structure: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700',
  debugging: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700',
  code_review: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700',
  system_design: 'bg-red-100 dark:bg-red-900/30 text-red-700',
  api_design: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700',
  refactoring: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700',
};

export default function CodingChallenge({ challenges = [], onChallengesChange, sessionId }) {
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [solutionInputs, setSolutionInputs] = useState({});
  const [evaluating, setEvaluating] = useState(null);
  const [showHints, setShowHints] = useState({});

  const { mutate: generateChallenge } = useGenerateChallenge();
  const { mutate: evaluateCode } = useEvaluateCode();

  const [config, setConfig] = useState({
    skills: '',
    difficulty: 'medium',
    type: 'algorithm',
    language: 'javascript',
  });

  const handleGenerate = () => {
    setGenerating(true);
    generateChallenge({
      skills: config.skills.split(',').map(s => s.trim()).filter(Boolean),
      difficulty: config.difficulty,
      type: config.type,
      language: config.language,
    }, {
      onSuccess: (res) => {
        onChallengesChange?.([...challenges, res.data]);
        setGenerating(false);
      },
      onError: () => setGenerating(false),
    });
  };

  const handleEvaluate = (c) => {
    setEvaluating(c.id);
    evaluateCode({
      challenge: c,
      candidateSolution: solutionInputs[c.id] || '',
    }, {
      onSuccess: (res) => {
        const updated = challenges.map(cc =>
          cc.id === c.id ? { ...cc, candidateSolution: solutionInputs[c.id], ...res.data } : cc
        );
        onChallengesChange?.(updated);
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
          <CodeBracketIcon className="w-4 h-4 text-primary-500" />
          Generate Coding Challenge
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Skills</label>
            <input type="text" value={config.skills} onChange={e => setConfig(p => ({ ...p, skills: e.target.value }))}
              placeholder="JavaScript, Algorithms" className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select value={config.type} onChange={e => setConfig(p => ({ ...p, type: e.target.value }))} className="input-field w-full">
              <option value="algorithm">Algorithm</option>
              <option value="data_structure">Data Structure</option>
              <option value="debugging">Debugging</option>
              <option value="code_review">Code Review</option>
              <option value="system_design">System Design</option>
              <option value="refactoring">Refactoring</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Difficulty</label>
            <select value={config.difficulty} onChange={e => setConfig(p => ({ ...p, difficulty: e.target.value }))} className="input-field w-full">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <label className="text-xs text-gray-500">Language:</label>
          <select value={config.language} onChange={e => setConfig(p => ({ ...p, language: e.target.value }))} className="input-field">
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="go">Go</option>
          </select>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary flex items-center gap-2 ml-auto">
            <SparklesIcon className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate Challenge'}
          </button>
        </div>
      </div>

      {/* Challenges */}
      {challenges.map((c, i) => (
        <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className={clsx('card p-4', c.score !== null && c.score !== undefined && 'bg-green-50/20 dark:bg-green-900/5')}>
          <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
            <CodeBracketIcon className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{c.title}</h4>
                <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', TYPE_BADGE[c.type])}>{c.type?.replace('_', ' ')}</span>
                <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', DIFF_BADGE[c.difficulty])}>{c.difficulty}</span>
                {c.score !== null && c.score !== undefined && (
                  <span className="text-xs font-bold text-primary-600">{c.score}/10</span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{c.description}</p>
            </div>
          </div>

          {expanded === c.id && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3 ml-8">
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.description}</div>

              {c.starterCode && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Starter Code:</p>
                  <pre className="bg-gray-900 text-gray-100 text-xs p-3 rounded-lg overflow-x-auto">{c.starterCode}</pre>
                </div>
              )}

              {c.testCases?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Test Cases:</p>
                  <div className="space-y-1">
                    {c.testCases.filter(t => !t.isHidden).map((t, j) => (
                      <div key={j} className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-2 font-mono">
                        <span className="text-gray-400">Input:</span> {t.input} → <span className="text-gray-400">Expected:</span> {t.expectedOutput}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {c.hints?.length > 0 && (
                <div>
                  <button onClick={() => setShowHints(p => ({ ...p, [c.id]: !p[c.id] }))}
                    className="text-xs text-primary-600 flex items-center gap-1 mb-1">
                    <LightBulbIcon className="w-3 h-3" />
                    {showHints[c.id] ? 'Hide Hints' : 'Show Hints'}
                  </button>
                  {showHints[c.id] && (
                    <ul className="text-xs text-gray-500 space-y-1 ml-4 list-disc">
                      {c.hints.map((h, j) => <li key={j}>{h}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-1">Candidate Solution:</label>
                <textarea value={solutionInputs[c.id] || c.candidateSolution || ''} rows={8}
                  onChange={e => setSolutionInputs(p => ({ ...p, [c.id]: e.target.value }))}
                  className="input-field w-full font-mono text-sm resize-y bg-gray-900 text-gray-100"
                  placeholder="Paste candidate's code solution here..." />
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => handleEvaluate(c)} disabled={evaluating === c.id || !solutionInputs[c.id]}
                  className="btn-primary btn-sm flex items-center gap-1">
                  {evaluating === c.id ? 'Evaluating...' : 'Evaluate Code'}
                </button>
                {c.passedTests !== undefined && c.totalTests > 0 && (
                  <span className="text-xs text-gray-500">
                    Tests: {c.passedTests}/{c.totalTests}
                    {c.codeQualityScore && ` · Quality: ${c.codeQualityScore}/10`}
                    {c.efficiencyScore && ` · Efficiency: ${c.efficiencyScore}/10`}
                  </span>
                )}
              </div>

              {c.feedback && (
                <div className="bg-primary-50/30 dark:bg-primary-900/10 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400">
                  {c.feedback}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
