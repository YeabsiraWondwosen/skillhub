import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { profileService } from '@/services/profile.service';
import { onNewNotification } from '@/services/socket';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/Modal';
import {
  CalendarDaysIcon, ClockIcon, VideoCameraIcon, XMarkIcon, MapPinIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const MEETING_STATUS = {
  pending: { label: 'Pending', cls: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  accepted: { label: 'Accepted', cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  declined: { label: 'Declined', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  completed: { label: 'Completed', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400' },
};

const fmtDate = (iso) => format(new Date(iso), 'MMM d, yyyy');
const fmtClock = (iso) => format(new Date(iso), 'h:mm a');

const meetingTypeLabel = (type) =>
  ({ video_call: 'Video call', phone: 'Phone', in_person: 'In person', other: 'Other' })[type] || type;

export default function ClientMeetingsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [scope, setScope] = useState('upcoming');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancelMeeting, setCancelMeeting] = useState(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const offNotif = onNewNotification((n) => {
      if (n?.type && String(n.type).startsWith('meeting_')) {
        qc.invalidateQueries({ queryKey: ['meetings'] });
        qc.invalidateQueries({ queryKey: ['notifications'] });
      }
    });
    return offNotif;
  }, [qc]);

  const { data: meetingsData, isLoading } = useQuery({
    queryKey: ['meetings', 'client', scope],
    queryFn: () => profileService.getMeetings(scope ? { limit: 100, scope } : { limit: 100 }).then((r) => r.data?.data),
    staleTime: 15000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ meetingId, status, cancellationReason }) =>
      profileService.updateMeetingStatus(meetingId, { status, cancellationReason }),
    onSuccess: () => {
      toast.success('Meeting updated');
      qc.invalidateQueries({ queryKey: ['meetings'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update meeting'),
  });

  const meetings = useMemo(() => meetingsData || [], [meetingsData]);
  const filtered = statusFilter === 'all' ? meetings : meetings.filter((m) => m.status === statusFilter);

  const confirmCancel = () => {
    if (!cancelMeeting) return;
    updateStatus.mutate({ meetingId: cancelMeeting._id, status: 'cancelled', cancellationReason: reason });
    setCancelMeeting(null);
    setReason('');
  };

  const MeetingCard = ({ m }) => {
    const freelancer = m.freelancer;
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={freelancer?.avatar?.url} alt={freelancer?.firstName} size="md" />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">{m.title}</p>
              <p className="text-sm text-gray-500">
                with {[freelancer?.firstName, freelancer?.lastName].filter(Boolean).join(' ') || 'freelancer'}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                <span className="flex items-center gap-1"><CalendarDaysIcon className="w-3.5 h-3.5" />{fmtDate(m.startTime)}</span>
                <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5" />{fmtClock(m.startTime)}–{fmtClock(m.endTime)}</span>
                <span className="flex items-center gap-1"><VideoCameraIcon className="w-3.5 h-3.5" />{meetingTypeLabel(m.meetingType)}</span>
              </div>
              {m.location && <p className="text-xs text-gray-400 mt-1"><MapPinIcon className="w-3.5 h-3.5 inline" /> {m.location}</p>}
              {m.declinedReason && <p className="text-xs text-red-500 mt-1">Freelancer reason: {m.declinedReason}</p>}
              {m.cancellationReason && <p className="text-xs text-gray-500 mt-1">Reason: {m.cancellationReason}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', MEETING_STATUS[m.status]?.cls)}>
              {MEETING_STATUS[m.status]?.label || m.status}
            </span>
            {m.status === 'pending' && (
              <Button size="sm" variant="secondary" onClick={() => { setCancelMeeting(m); setReason(''); }}>
                <XMarkIcon className="w-4 h-4" /> Cancel
              </Button>
            )}
            {m.status === 'accepted' && (
              <>
                <Button size="sm" onClick={() => updateStatus.mutate({ meetingId: m._id, status: 'completed' })}>
                  Mark completed
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setCancelMeeting(m); setReason(''); }}>
                  <XMarkIcon className="w-4 h-4" /> Cancel
                </Button>
              </>
            )}
            {m.meetingUrl && <a href={m.meetingUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">Join</a>}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="page-container space-y-6">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <CalendarDaysIcon className="w-7 h-7 text-primary-600" />
          My Meetings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Meetings you have booked with freelancers through their public profiles.
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {[{ label: 'Upcoming', value: 'upcoming' }, { label: 'Past', value: 'past' }, { label: 'All', value: '' }].map((s) => (
            <button key={s.value || 'all'} type="button" onClick={() => setScope(s.value)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                scope === s.value ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700')}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {[{ label: 'All', value: 'all' }, ...Object.entries(MEETING_STATUS).map(([k, v]) => ({ label: v.label, value: k }))].map((f) => (
            <button key={f.value} type="button" onClick={() => setStatusFilter(f.value)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                statusFilter === f.value ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-6">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDaysIcon}
            title={scope ? `No ${scope} meetings` : 'No meetings'}
            description="When you book a call with a freelancer, it will show up here. Open a freelancer profile and use Book a Meeting to schedule one."
          />
        ) : (
          <div className="space-y-3">{filtered.map((m) => <MeetingCard key={m._id} m={m} />)}</div>
        )}
      </div>

      <ConfirmModal
        open={!!cancelMeeting}
        onClose={() => { setCancelMeeting(null); setReason(''); }}
        onConfirm={confirmCancel}
        loading={updateStatus.isPending}
        title="Cancel meeting"
        message={`Cancel "${cancelMeeting?.title}"? If the meeting has not started yet, the slot will be released so the freelancer can be booked again.`}
        confirmLabel="Cancel"
        danger
      >
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Cancellation reason (optional — shared with the freelancer)"
          className="input text-sm w-full min-h-20 resize-y"
        />
      </ConfirmModal>
    </div>
  );
}