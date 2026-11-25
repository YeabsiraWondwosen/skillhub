import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrashIcon, StarIcon, ChatBubbleLeftEllipsisIcon,
  XMarkIcon, EnvelopeIcon,
} from '@heroicons/react/24/outline';
import {
  usePipeline, useMoveCandidate, useRateCandidate,
  useAddCandidateNote, useRemoveCandidate, useSendInvitation,
} from '@/hooks/useRecruiter';
import { clsx } from 'clsx';

const STAGES = [
  { key: 'sourcing', label: 'Sourcing', color: 'bg-gray-400' },
  { key: 'screening', label: 'Screening', color: 'bg-blue-500' },
  { key: 'interview', label: 'Interview', color: 'bg-purple-500' },
  { key: 'offer', label: 'Offer', color: 'bg-orange-500' },
  { key: 'hired', label: 'Hired', color: 'bg-green-500' },
];

const STAGE_COLORS = {
  sourcing: 'border-gray-400 bg-gray-50 dark:bg-gray-900/30',
  screening: 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10',
  interview: 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10',
  offer: 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10',
  hired: 'border-green-500 bg-green-50/50 dark:bg-green-900/10',
  rejected: 'border-red-400 bg-red-50/50 dark:bg-red-900/10',
  withdrawn: 'border-gray-300 bg-gray-50/50 dark:bg-gray-900/20',
};

export default function HiringPipeline({ pipelineId, onClose }) {
  const { data: pipeline, isLoading } = usePipeline(pipelineId);
  const { mutate: moveCandidate } = useMoveCandidate();
  const { mutate: rateCandidate } = useRateCandidate();
  const { mutate: addNote } = useAddCandidateNote();
  const { mutate: removeCandidate } = useRemoveCandidate();
  const { mutate: sendInvitation } = useSendInvitation();

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [noteInput, setNoteInput] = useState('');
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteId, setInviteId] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');

  if (isLoading) return <div className="card p-8 text-center animate-pulse text-gray-400">Loading pipeline...</div>;
  if (!pipeline) return <div className="card p-8 text-center text-gray-500">Pipeline not found.</div>;

  const candidates = pipeline.candidates || [];
  const invitations = pipeline.invitations || [];

  const byStage = {};
  STAGES.forEach(s => { byStage[s.key] = []; });
  byStage.rejected = [];
  candidates.forEach(c => { if (byStage[c.stage]) byStage[c.stage].push(c); });

  const handleMove = (cid, stage) => { moveCandidate({ pipelineId, candidateId: cid, stage }); setSelectedCandidate(null); };
  const handleNote = (cid) => { if (noteInput.trim()) { addNote({ pipelineId, candidateId: cid, content: noteInput }); setNoteInput(''); } };
  const handleInvite = () => { if (inviteId) { sendInvitation({ pipelineId, data: { freelancerId: inviteId, message: inviteMsg } }); setInviteModal(false); setInviteId(''); setInviteMsg(''); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{pipeline.name}</h3>
          {pipeline.description && <p className="text-xs text-gray-500">{pipeline.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setInviteModal(true)} className="btn-secondary btn-sm flex items-center gap-1">
            <EnvelopeIcon className="w-3 h-3" /> Invite
          </button>
          <button onClick={onClose} className="btn-icon btn-ghost text-gray-400"><XMarkIcon className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STAGES.map(s => (
          <span key={s.key} className="px-2 py-1 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {s.label}: {byStage[s.key]?.length || 0}
          </span>
        ))}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map(stage => (
          <div key={stage.key} className="min-w-[240px] flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={clsx('w-2.5 h-2.5 rounded-full', stage.color)} />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{stage.label}</span>
              <span className="text-[10px] text-gray-400">({byStage[stage.key]?.length || 0})</span>
            </div>
            <div className="space-y-2 min-h-[100px]">
              <AnimatePresence>
                {byStage[stage.key]?.map(c => (
                  <motion.div
                    key={c._id} layout
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className={clsx('card p-3 border-l-4 cursor-pointer transition-all', STAGE_COLORS[stage.key], selectedCandidate === c._id && 'ring-2 ring-primary-500')}
                    onClick={() => setSelectedCandidate(selectedCandidate === c._id ? null : c._id)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 text-[10px] font-bold flex-shrink-0">
                        {c.freelancer?.firstName?.[0]}{c.freelancer?.lastName?.[0]}
                      </div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate flex-1">
                        {c.freelancer?.firstName} {c.freelancer?.lastName}
                      </p>
                    </div>
                    {c.matchScore > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1">
                        <span>Match: {c.matchScore}%</span>
                        {c.rating && <span className="flex items-center gap-0.5 ml-auto"><StarIcon className="w-3 h-3 text-yellow-500" />{c.rating}</span>}
                      </div>
                    )}
                    {selectedCandidate === c._id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {STAGES.filter(s => s.key !== stage.key).map(s => (
                            <button key={s.key} onClick={(e) => { e.stopPropagation(); handleMove(c._id, s.key); }}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-primary-100 hover:text-primary-600 transition-colors">
                              {s.label}
                            </button>
                          ))}
                          <button onClick={(e) => { e.stopPropagation(); handleMove(c._id, 'rejected'); }}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition-colors">Reject</button>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(star => (
                            <button key={star} onClick={(e) => { e.stopPropagation(); rateCandidate({ pipelineId, candidateId: c._id, rating: star }); }}
                              className={clsx('transition-colors', (c.rating || 0) >= star ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600')}>
                              <StarIcon className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <input type="text" value={noteInput} onChange={e => setNoteInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleNote(c._id); }}
                            placeholder="Add note..." className="input-field flex-1 text-[10px] py-1 px-2" onClick={e => e.stopPropagation()} />
                          <button onClick={(e) => { e.stopPropagation(); handleNote(c._id); }} className="btn-icon btn-ghost text-primary-600">
                            <ChatBubbleLeftEllipsisIcon className="w-3 h-3" />
                          </button>
                        </div>
                        {c.notes?.slice(-2).map(n => <p key={n._id} className="text-[10px] text-gray-400 italic">{n.content}</p>)}
                        <button onClick={(e) => { e.stopPropagation(); removeCandidate({ pipelineId, candidateId: c._id }); }}
                          className="text-[9px] text-red-400 hover:text-red-600 flex items-center gap-1"><TrashIcon className="w-3 h-3" /> Remove</button>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {(!byStage[stage.key] || byStage[stage.key].length === 0) && (
                <div className="text-[10px] text-gray-400 text-center py-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">No candidates</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {invitations.length > 0 && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Invitations ({invitations.length})</h4>
          <div className="space-y-1">
            {invitations.map(inv => (
              <div key={inv._id} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-gray-300">{inv.freelancer?.firstName} {inv.freelancer?.lastName}</span>
                <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium',
                  inv.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                  inv.status === 'accepted' && 'bg-green-100 text-green-700',
                  inv.status === 'declined' && 'bg-red-100 text-red-700',
                  inv.status === 'expired' && 'bg-gray-100 text-gray-500')}>{inv.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {inviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setInviteModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Invite Freelancer</h3>
            <input type="text" value={inviteId} onChange={e => setInviteId(e.target.value)} placeholder="Freelancer ID" className="input-field w-full mb-3" />
            <textarea value={inviteMsg} onChange={e => setInviteMsg(e.target.value)} placeholder="Personal message (optional)" rows={3} className="input-field w-full mb-4 resize-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setInviteModal(false)} className="btn-secondary btn-sm">Cancel</button>
              <button onClick={handleInvite} className="btn-primary btn-sm">Send Invitation</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
