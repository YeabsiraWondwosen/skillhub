import { motion } from 'framer-motion';
import {
  ClipboardDocumentCheckIcon, StarIcon, CheckCircleIcon,
  ExclamationTriangleIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import { useGenerateScorecard } from '@/hooks/useInterviewAssistant';
import { clsx } from 'clsx';

const SKILL_LABELS = {
  technical_skills: 'Technical Skills',
  problem_solving: 'Problem Solving',
  communication: 'Communication',
  cultural_fit: 'Cultural Fit',
  experience: 'Experience',
  leadership: 'Leadership',
  teamwork: 'Teamwork',
  adaptability: 'Adaptability',
  creativity: 'Creativity',
  time_management: 'Time Management',
};

function ScoreRing({ score, maxScore = 10, size = 80 }) {
  const pct = (score / maxScore) * 100;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = score >= 7 ? '#22c55e' : score >= 5 ? '#eab308' : '#ef4444';

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        className="text-gray-200 dark:text-gray-700" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={6} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dy=".1em" dominantBaseline="central"
        className="fill-gray-900 dark:fill-white text-lg font-bold">{score}</text>
      <text x="50%" y="68%" textAnchor="middle" dominantBaseline="central"
        className="fill-gray-400 text-[9px]">/{maxScore}</text>
    </svg>
  );
}

function SkillBar({ label, score, maxScore = 10 }) {
  const pct = (score / maxScore) * 100;
  const color = score >= 7 ? 'bg-green-500' : score >= 5 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
        <span className="text-xs font-medium text-gray-900 dark:text-white">{score}/{maxScore}</span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={clsx('h-full rounded-full', color)} />
      </div>
    </div>
  );
}

export default function EvaluationScorecard({ session, onScorecardGenerated }) {
  const { mutate: generateScorecard, isLoading } = useGenerateScorecard();
  const scorecard = session?.scorecard;

  const handleGenerate = () => {
    generateScorecard(session._id, {
      onSuccess: (res) => onScorecardGenerated?.(res.data),
    });
  };

  if (!scorecard) {
    return (
      <div className="card p-8 text-center">
        <ClipboardDocumentCheckIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No scorecard generated yet.</p>
        <button onClick={handleGenerate} disabled={isLoading} className="btn-primary inline-flex items-center gap-2">
          <SparklesIcon className="w-4 h-4" />
          {isLoading ? 'Generating...' : 'Generate AI Scorecard'}
        </button>
      </div>
    );
  }

  const avgScore = Object.values(scorecard.skillScores || {}).reduce((a, b) => a + b, 0)
    / (Object.keys(scorecard.skillScores || {}).length || 1);

  return (
    <div className="space-y-4">
      {/* Overall */}
      <div className="card p-5">
        <div className="flex items-center gap-5">
          <ScoreRing score={scorecard.overallScore} />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Overall Score</h3>
            <p className="text-xs text-gray-500 mt-1">{scorecard.feedback}</p>
            <div className="flex gap-3 mt-2">
              <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                scorecard.recommendation === 'strong_yes' && 'bg-green-100 text-green-700',
                scorecard.recommendation === 'yes' && 'bg-green-50 text-green-600',
                scorecard.recommendation === 'maybe' && 'bg-yellow-100 text-yellow-700',
                scorecard.recommendation === 'no' && 'bg-red-100 text-red-700',
                scorecard.recommendation === 'strong_no' && 'bg-red-100 text-red-700',
              )}>
                {scorecard.recommendation?.replace('_', ' ')}
              </span>
              {scorecard.confidence > 0 && (
                <span className="text-[10px] text-gray-400">AI confidence: {Math.round(scorecard.confidence * 100)}%</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Skill Scores */}
      {Object.keys(scorecard.skillScores || {}).length > 0 && (
        <div className="card p-5">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Skill Breakdown</h4>
          <div className="space-y-2.5">
            {Object.entries(scorecard.skillScores).map(([key, val]) => (
              <SkillBar key={key} label={SKILL_LABELS[key] || key.replace(/_/g, ' ')} score={val} />
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            <span className="text-xs text-gray-500">Average</span>
            <span className="text-xs font-bold text-primary-600">{avgScore.toFixed(1)}/10</span>
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scorecard.strengths?.length > 0 && (
          <div className="card p-4">
            <h4 className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1">
              <CheckCircleIcon className="w-3.5 h-3.5" /> Strengths
            </h4>
            <ul className="space-y-1.5">
              {scorecard.strengths.map((s, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {scorecard.weaknesses?.length > 0 && (
          <div className="card p-4">
            <h4 className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
              <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Areas for Improvement
            </h4>
            <ul className="space-y-1.5">
              {scorecard.weaknesses.map((w, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Interview Notes */}
      {scorecard.interviewNotes && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Interview Notes</h4>
          <p className="text-xs text-gray-500 whitespace-pre-wrap">{scorecard.interviewNotes}</p>
        </div>
      )}
    </div>
  );
}
