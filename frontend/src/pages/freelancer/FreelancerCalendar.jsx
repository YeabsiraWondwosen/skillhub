import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { profileService } from '@/services/profile.service';
import { onNewNotification, onUserAvailability } from '@/services/socket';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/Modal';
import {
  CalendarDaysIcon, ClockIcon, VideoCameraIcon,
  CheckIcon, XMarkIcon, TrashIcon, PlusIcon, MapPinIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { getMinDateValue } from '@/utils/dateValidation';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MEETING_STATUS = {
  pending: { label: 'Pending', cls: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  accepted: { label: 'Accepted', cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  declined: { label: 'Declined', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  completed: { label: 'Completed', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400' },
};

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available', desc: 'Open to new work', color: 'text-green-600 border-green-500 bg-green-50 dark:bg-green-900/20' },
  { value: 'busy', label: 'Busy', desc: 'Working on projects', color: 'text-yellow-600 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' },
  { value: 'vacation', label: 'Vacation', desc: 'Back on a set date', color: 'text-gray-600 border-gray-400 bg-gray-50 dark:bg-gray-800/40' },
  { value: 'offline', label: 'Offline', desc: 'Not accepting bookings', color: 'text-red-500 border-red-400 bg-red-50 dark:bg-red-900/20' },
];

const toMinutes = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const minutesToInput = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const fmtDate = (iso) => format(new Date(iso), 'MMM d, yyyy');
const fmtClock = (iso) => format(new Date(iso), 'h:mm a');

const meetingTypeLabel = (type) =>
  ({ video_call: 'Video call', phone: 'Phone', in_person: 'In person', other: 'Other' })[type] || type;

// Confirmation dialog copy + payload for each meeting action. The API is only
// called from confirmAction(), i.e. after the user clicks the confirm button —
// never from the trigger buttons themselves.
const MEETING_ACTION = {
  accept: {
    status: 'accepted',
    title: 'Accept Meeting?',
    confirmLabel: 'Confirm Accept',
    danger: false,
    withReason: false,
    message: () => 'Are you sure you want to accept this meeting?',
  },
  complete: {
    status: 'completed',
    title: 'Complete Meeting?',
    confirmLabel: 'Confirm Complete',
    danger: false,
    withReason: false,
    message: () => 'Are you sure you want to mark this meeting as completed?',
  },
  decline: {
    status: 'declined',
    title: 'Decline Meeting?',
    confirmLabel: 'Confirm Decline',
    danger: true,
    withReason: true,
    message: (m) => `Decline "${m?.title}"? ${
      ['Phone', 'In person'].includes(meetingTypeLabel(m?.meetingType))
        ? 'The meeting slot will be released and can be booked again.'
        : 'The meeting request will be returned to the client.'
    }`,
  },
  cancel: {
    status: 'cancelled',
    title: 'Cancel Meeting?',
    confirmLabel: 'Confirm Cancel',
    danger: true,
    withReason: true,
    message: (m) => `Cancel "${m?.title}"? The slot will be released if it has not started yet.`,
  },
};

const STATUS_SUCCESS_LABEL = {
  accepted: 'Meeting accepted',
  completed: 'Meeting completed',
  declined: 'Meeting declined',
  cancelled: 'Meeting cancelled',
};

export default function FreelancerCalendar() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [nextDate, setNextDate] = useState('');
  const [actionMeeting, setActionMeeting] = useState(null);
  const [actionType, setActionType] = useState('decline');
  const [reason, setReason] = useState('');
  const [editingDay, setEditingDay] = useState(1);
  const [startInput, setStartInput] = useState('09:00');
  const [endInput, setEndInput] = useState('17:00');
  const [draft, setDraft] = useState([]);
  const [draftSeeded, setDraftSeeded] = useState(false);

  const currentUserId = user?._id;

  const { data: availabilityData, isLoading: isAvailLoading } = useQuery({
    queryKey: ['availability', 'me'],
    queryFn: () => profileService.getMyAvailability().then((r) => r.data?.data),
    staleTime: 30000,
  });

  const { data: meetingsData, isLoading: isMeetingsLoading } = useQuery({
    queryKey: ['meetings', 'freelancer'],
    queryFn: () => profileService.getMeetings({ limit: 100 }).then((r) => r.data?.data),
    staleTime: 15000,
  });

  useEffect(() => {
    if (availabilityData?.schedule && !draftSeeded) {
      setDraft(
        availabilityData.schedule
          .filter((s) => Number.isInteger(s.dayOfWeek))
          .map((s, i) => ({ key: s._id || `s-${i}`, dayOfWeek: s.dayOfWeek, startMinute: s.startMinute, endMinute: s.endMinute }))
      );
      setDraftSeeded(true);
    }
  }, [availabilityData, draftSeeded]);

  useEffect(() => {
    const offNotif = onNewNotification((n) => {
      if (n?.type && String(n.type).startsWith('meeting_')) {
        qc.invalidateQueries({ queryKey: ['meetings'] });
        qc.invalidateQueries({ queryKey: ['notifications'] });
      }
    });
    const offAvail = onUserAvailability((userId, availability) => {
      if (userId === currentUserId) {
        useAuthStore.getState().updateUser({ availabilityStatus: availability });
        qc.invalidateQueries({ queryKey: ['availability', 'me'] });
      }
    });
    return () => { offNotif(); offAvail(); };
  }, [qc, currentUserId]);

  const updateAvailability = useMutation({
    mutationFn: (payload) => profileService.updateAvailability(payload),
    onSuccess: (res) => {
      const d = res.data?.data;
      if (d) useAuthStore.getState().updateUser({ availabilityStatus: d.availabilityStatus, nextAvailableDate: d.nextAvailableDate || null });
      qc.invalidateQueries({ queryKey: ['availability', 'me'] });
      toast.success('Availability updated');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update availability'),
  });

  const saveSlots = useMutation({
    mutationFn: (slots) => profileService.saveMySlots(slots),
    onSuccess: (res) => {
      const saved = res.data?.data || [];
      setDraft(saved.map((s, i) => ({ key: s._id || `s-${i}`, dayOfWeek: s.dayOfWeek, startMinute: s.startMinute, endMinute: s.endMinute })));
      qc.invalidateQueries({ queryKey: ['availability', 'me'] });
      toast.success('Weekly schedule saved');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save schedule'),
  });

  const closeAction = () => { setActionMeeting(null); setReason(''); };

  const updateStatus = useMutation({
    mutationFn: ({ meetingId, status, declinedReason, cancellationReason }) =>
      profileService.updateMeetingStatus(meetingId, { status, declinedReason, cancellationReason }),
    onSuccess: (_data, variables) => {
      toast.success(STATUS_SUCCESS_LABEL[variables?.status] || 'Meeting updated');
      qc.invalidateQueries({ queryKey: ['meetings'] });
      closeAction();
    },
    onError: (e) => {
      toast.error(e.response?.data?.message || 'Failed to update meeting');
      closeAction();
    },
  });

  const meetings = useMemo(() => meetingsData || [], [meetingsData]);
  const availabilityStatus = availabilityData?.availabilityStatus || user?.availabilityStatus || 'available';
  const timezone = availabilityData?.timezone || user?.timezone || 'UTC';
  const returnDate = availabilityData?.nextAvailableDate || user?.nextAvailableDate;

  const filtered = statusFilter === 'all' ? meetings : meetings.filter((m) => m.status === statusFilter);
  const nowMs = Date.now();
  const upcoming = filtered
    .filter((m) => new Date(m.endTime).getTime() >= nowMs)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const past = filtered
    .filter((m) => new Date(m.endTime).getTime() < nowMs)
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  const handleSetStatus = (value) => {
    const payload = { availabilityStatus: value };
    if (value === 'vacation' && nextDate) payload.nextAvailableDate = nextDate;
    updateAvailability.mutate(payload);
  };

  const addToDraft = () => {
    const startMinute = toMinutes(startInput);
    const endMinute = toMinutes(endInput);
    if (startMinute == null || endMinute == null) return toast.error('Enter a valid start and end time');
    if (endMinute <= startMinute) return toast.error('End time must be after start time');
    const sameDay = draft.filter((s) => s.dayOfWeek === editingDay);
    const overlaps = sameDay.some((s) => startMinute < s.endMinute && endMinute > s.startMinute);
    if (overlaps) return toast.error('This window overlaps another window on that day');
    setDraft((prev) => [...prev, { key: `d-${Date.now()}`, dayOfWeek: editingDay, startMinute, endMinute }]);
  };

  const removeFromDraft = (key) => setDraft((prev) => prev.filter((s) => s.key !== key));

  // Opening a dialog NEVER mutates — it only stages the action. The API call
  // happens exclusively in confirmAction() when the user confirms.
  const openAction = (type, m) => { setActionType(type); setReason(''); setActionMeeting(m); };
  const openAccept = (m) => openAction('accept', m);
  const openComplete = (m) => openAction('complete', m);
  const openDecline = (m) => { setActionType('decline'); setReason(m.declinedReason || ''); setActionMeeting(m); };
  const openCancel = (m) => openAction('cancel', m);

  const confirmAction = () => {
    if (!actionMeeting || !MEETING_ACTION[actionType]) return;
    const action = MEETING_ACTION[actionType];
    updateStatus.mutate({
      meetingId: actionMeeting._id,
      status: action.status,
      declinedReason: actionType === 'decline' ? reason : undefined,
      cancellationReason: actionType === 'cancel' ? reason : undefined,
    });
    // The dialog stays open (showing "Processing…" with its confirm button
    // disabled) until the mutation settles; onSuccess/onError close it.
  };

  const activeAction = MEETING_ACTION[actionType] || null;

  const MeetingCard = ({ m }) => {
    const other = m.freelancer?._id === currentUserId ? m.client : m.freelancer;
    const isFreelancerActor = m.freelancer?._id === currentUserId;
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={other?.avatar?.url} alt={other?.firstName} size="md" />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">{m.title}</p>
              <p className="text-sm text-gray-500">
                {other?._id === currentUserId ? 'You' : `with ${[other?.firstName, other?.lastName].filter(Boolean).join(' ')}`}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                <span className="flex items-center gap-1"><CalendarDaysIcon className="w-3.5 h-3.5" />{fmtDate(m.startTime)}</span>
                <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5" />{fmtClock(m.startTime)}–{fmtClock(m.endTime)}</span>
                <span className="flex items-center gap-1"><VideoCameraIcon className="w-3.5 h-3.5" />{meetingTypeLabel(m.meetingType)}</span>
              </div>
              {m.location && (
                <p className="text-xs text-gray-400 mt-1"><MapPinIcon className="w-3.5 h-3.5 inline" /> {m.location}</p>
              )}
              {m.declinedReason && (
                <p className="text-xs text-red-500 mt-1">Reason: {m.declinedReason}</p>
              )}
              {m.cancellationReason && (
                <p className="text-xs text-gray-500 mt-1">Reason: {m.cancellationReason}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', MEETING_STATUS[m.status]?.cls)}>
              {MEETING_STATUS[m.status]?.label || m.status}
            </span>
            {isFreelancerActor && m.status === 'pending' && (
              <>
                <Button size="sm" disabled={updateStatus.isPending} onClick={() => openAccept(m)}>
                  <CheckIcon className="w-4 h-4" /> Accept
                </Button>
                <Button size="sm" variant="secondary" disabled={updateStatus.isPending} onClick={() => openDecline(m)}>
                  <XMarkIcon className="w-4 h-4" /> Decline
                </Button>
              </>
            )}
            {isFreelancerActor && m.status === 'accepted' && (
              <>
                <Button size="sm" disabled={updateStatus.isPending} onClick={() => openComplete(m)}>
                  <CheckIcon className="w-4 h-4" /> Complete
                </Button>
                <Button size="sm" variant="secondary" disabled={updateStatus.isPending} onClick={() => openCancel(m)}>
                  <XMarkIcon className="w-4 h-4" /> Cancel
                </Button>
              </>
            )}
            {isFreelancerActor && m.status === 'pending' && (
              <Button size="sm" variant="ghost" onClick={() => openCancel(m)}>
                <XMarkIcon className="w-4 h-4" /> Cancel
              </Button>
            )}
            {m.meetingUrl && <a href={m.meetingUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">Join</a>}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderMeetingList = (list, emptyLabel) =>
    list.length === 0 ? (
      <EmptyState icon={CalendarDaysIcon} title={emptyLabel}
        description="Meetings booked with clients will appear here. Clients can book your open time through your public profile." />
    ) : (
      <div className="space-y-3">{list.map((m) => <MeetingCard key={m._id} m={m} />)}</div>
    );

  return (
    <div className="page-container space-y-6">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <CalendarDaysIcon className="w-7 h-7 text-primary-600" />
          Calendar & Availability
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Availability timezone: <span className="font-medium">{timezone}</span>
          {returnDate && availabilityStatus === 'vacation' ? ` · Back ${fmtDate(returnDate)}` : ''}
        </p>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Availability Status</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Your real availability — clients can only book when you are bookable.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {AVAILABILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSetStatus(opt.value)}
              disabled={updateAvailability.isPending}
              className={clsx(
                'rounded-xl border-2 p-4 text-left transition-all disabled:opacity-60',
                availabilityStatus === opt.value
                  ? `${opt.color} border-current`
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
              )}
            >
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
        {availabilityStatus === 'vacation' && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-600 dark:text-gray-300">
              Return date
              <input
                type="date"
                value={nextDate || (returnDate ? String(returnDate).slice(0, 10) : '')}
                onChange={(e) => setNextDate(e.target.value)}
                disabled={updateAvailability.isPending}
                min={getMinDateValue()}
                className="input text-sm py-1.5 ml-2"
              />
            </label>
            <Button size="sm" disabled={!nextDate || updateAvailability.isPending}
              onClick={() => updateAvailability.mutate({ availabilityStatus: 'vacation', nextAvailableDate: nextDate })}>
              Save return date
            </Button>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Weekly Availability</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Windows a client can book inside, shown in your timezone ({timezone}).
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {DAY_SHORT.map((day, i) => (
            <button key={day} type="button" onClick={() => setEditingDay(i)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                editingDay === i
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
              )}>
              {day}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap mb-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            From
            <input type="time" value={startInput} onChange={(e) => setStartInput(e.target.value)} className="input text-sm py-1.5" />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            To
            <input type="time" value={endInput} onChange={(e) => setEndInput(e.target.value)} className="input text-sm py-1.5" />
          </label>
          <Button size="sm" onClick={addToDraft}>
            <PlusIcon className="w-4 h-4" /> Add window
          </Button>
        </div>

        <div className="space-y-1.5 mb-4">
          {DAY_SHORT.map((day, i) => {
            const daySlots = draft.filter((s) => s.dayOfWeek === i);
            if (daySlots.length === 0) return null;
            return (
              <div key={day} className="flex items-center gap-2 text-sm">
                <span className="w-10 text-xs font-semibold text-gray-500">{day}</span>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((s) => (
                    <span key={s.key} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2.5 py-1 text-xs font-medium">
                      {minutesToInput(s.startMinute)} – {minutesToInput(s.endMinute)}
                      <button type="button" onClick={() => removeFromDraft(s.key)} className="text-gray-400 hover:text-red-500">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {draft.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No time windows defined yet. Add one above so clients can book you.
            </p>
          )}
        </div>

        <Button variant="secondary" size="sm" disabled={draft.length === 0 || saveSlots.isPending}
          onClick={() => saveSlots.mutate(draft.map((s) => ({ dayOfWeek: s.dayOfWeek, startMinute: s.startMinute, endMinute: s.endMinute })))}>
          Save weekly schedule
        </Button>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Meetings</h2>
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

        {isMeetingsLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : upcoming.length === 0 && past.length === 0 ? (
          <EmptyState icon={CalendarDaysIcon} title="No meetings"
            description="Meetings scheduled with clients will appear here. Until they do, your availability above is what clients see." />
        ) : (
          <div className="space-y-6">
            {upcoming.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Upcoming ({upcoming.length})</p>
                {renderMeetingList(upcoming, '')}
              </div>
            )}
            {past.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Past ({past.length})</p>
                {renderMeetingList(past, '')}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!actionMeeting && !!activeAction}
        onClose={() => { if (!updateStatus.isPending) closeAction(); }}
        onConfirm={confirmAction}
        loading={updateStatus.isPending}
        title={activeAction?.title}
        message={activeAction?.message(actionMeeting)}
        confirmLabel={activeAction?.confirmLabel}
        danger={!!activeAction?.danger}
      >
        {activeAction?.withReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={actionType === 'decline' ? 'Reason (optional — shared with the client)' : 'Cancellation reason (optional)'}
            className="input text-sm w-full min-h-20 resize-y"
          />
        )}
      </ConfirmModal>
    </div>
  );
}