import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon, XMarkIcon, EnvelopeIcon, UserPlusIcon,
  CheckCircleIcon, ClockIcon, TrashIcon, LinkIcon,
} from '@heroicons/react/24/outline';
import { useSendInvitation, useInvitations, useCancelInvitation } from '@/hooks/useTeamHiring';
import { useConfirm } from '@/components/ui/DialogProvider';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

export default function TeamInvitation({ team, onSelectMember }) {
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [message, setMessage] = useState('');
  const [copiedToken, setCopiedToken] = useState(null);

  const { mutate: sendInvitation, isPending } = useSendInvitation();
  const { mutate: cancelInvitation } = useCancelInvitation();
  const { data: invitations } = useInvitations(team?._id);

  const invitedMembers = invitations || [];
  const availableMembers = team?.members?.filter(m =>
    ['pending', 'declined'].includes(m.status),
  ) || [];

  const handleInvite = () => {
    if (!selectedMemberId) return;
    sendInvitation({
      teamId: team._id,
      memberId: selectedMemberId,
      message,
    }, {
      onSuccess: (res) => {
        setShowForm(false);
        setSelectedMemberId('');
        setMessage('');
        if (res?.data?.token) {
          setCopiedToken(res.data.token);
          setTimeout(() => setCopiedToken(null), 5000);
        }
      },
    });
  };

  const handleCancelInvitation = async (memberId) => {
    const ok = await confirm({
      title: 'Cancel invitation',
      message: 'Cancel this invitation? The member will no longer be able to join using the invite link.',
      confirmLabel: 'Cancel invitation',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (ok) cancelInvitation({ teamId: team._id, memberId });
  };

  const copyInviteLink = async (token) => {
    const url = `${window.location.origin}/team-invite?token=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      toast.success('Invite link copied');
      setTimeout(() => setCopiedToken(null), 3000);
    } catch (err) {
      toast.error('Unable to copy invite link');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <EnvelopeIcon className="w-4 h-4 text-primary-500" />
          Invitations ({invitedMembers.length})
        </h3>
        <button onClick={() => setShowForm(true)} className="btn-primary btn-sm flex items-center gap-1 text-xs"
          disabled={availableMembers.length === 0}>
          <PaperAirplaneIcon className="w-3.5 h-3.5" /> Send Invite
        </button>
      </div>

      {/* Invite Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white">Send Invitation</h4>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Select Member</label>
                <select value={selectedMemberId} onChange={e => setSelectedMemberId(e.target.value)}
                  className="input-field w-full text-sm">
                  <option value="">Choose a member...</option>
                  {availableMembers.map(m => (
                    <option key={m._id} value={m._id}>
                      {m.freelancer?.name || m.freelancer?.email || 'Unknown'} — {m.role}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Personal Message (optional)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  className="input-field w-full text-xs resize-none" rows={3}
                  placeholder="We'd love to have you join our team..." />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="btn-outline btn-sm text-xs">Cancel</button>
                <button onClick={handleInvite} disabled={isPending || !selectedMemberId}
                  className="btn-primary btn-sm flex items-center gap-1 text-xs">
                  <PaperAirplaneIcon className="w-3.5 h-3.5" />
                  {isPending ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copied Token Toast */}
      <AnimatePresence>
        {copiedToken && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4" />
            Invitation link copied to clipboard
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invitations List */}
      <div className="space-y-2">
        {invitedMembers.map(inv => (
          <motion.div key={inv._id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              {inv.freelancer?.avatar ? (
                <img src={inv.freelancer.avatar} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                <UserPlusIcon className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                {inv.freelancer?.name || inv.freelancer?.email || 'Unknown'}
              </p>
              <p className="text-[10px] text-gray-500">
                {inv.role} · Invited {inv.invitation?.invitedAt
                  ? new Date(inv.invitation.invitedAt).toLocaleDateString() : 'recently'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {inv.invitation?.token && (
                <button onClick={() => copyInviteLink(inv.invitation.token)}
                  className="p-1 text-gray-400 hover:text-primary-600" title="Copy invite link">
                  <LinkIcon className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => handleCancelInvitation(inv._id)}
                className="p-1 text-gray-400 hover:text-red-500" title="Cancel invitation">
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
        {invitedMembers.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No pending invitations</p>
        )}
      </div>
    </div>
  );
}
