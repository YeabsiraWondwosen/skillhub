import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { profileService } from '@/services/profile.service';
import { useAuthStore } from '@/store/authStore';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  CalendarDaysIcon, ClockIcon, VideoCameraIcon, UserGroupIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const DURATIONS = [15, 30, 60, 90, 120];

const dayFmt = (tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
const timeFmt = (tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });

export default function MeetingBookingModal({ open, onClose, freelancer }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [title, setTitle] = useState('Project discussion');
  const [meetingType, setMeetingType] = useState('video_call');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState(30);
  const [selected, setSelected] = useState(null);
  const [serverError, setServerError] = useState('');

  const freelancerId = freelancer?._id;

  const { data: availData, isLoading: isAvailLoading } = useQuery({
    queryKey: ['availability', 'public', freelancerId],
    queryFn: () => profileService.getPublicAvailability(freelancerId).then((r) => r.data?.data),
    enabled: open && !!freelancerId,
    staleTime: 30000,
  });

  const { data: slotsData, isLoading: isSlotsLoading } = useQuery({
    queryKey: ['availability', 'public', freelancerId, 'slots', duration],
    queryFn: () =>
      profileService.getPublicSlots(freelancerId, {
        from: new Date().toISOString(),
        to: new Date(Date.now() + 30 * 86400000).toISOString(),
        durationMinutes: duration,
      }).then((r) => r.data?.data),
    enabled: open && !!freelancerId,
    staleTime: 30000,
  });

  const book = useMutation({
    mutationFn: (payload) => profileService.createMeeting(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      qc.invalidateQueries({ queryKey: ['availability', 'public', freelancerId] });
      toast.success('Meeting request sent to the freelancer');
      setSelected(null);
      setTitle('Project discussion');
      setNotes('');
      setServerError('');
      onClose();
    },
    onError: (e) => {
      setServerError(e.response?.data?.message || 'Could not book this meeting. Please try another time.');
      qc.invalidateQueries({ queryKey: ['availability', 'public', freelancerId, 'slots'] });
    },
  });

  const bookable = !!availData?.bookable;
  const tz = availData?.timezone || slotsData?.timezone || 'UTC';

  const grouped = useMemo(() => {
    const map = new Map();
    for (const slot of slotsData?.slots || []) {
      const day = dayFmt(tz).format(new Date(slot.startTime));
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(slot);
    }
    return Array.from(map.entries());
  }, [slotsData, tz]);

  const requireClient = () => {
    if (!user) {
      toast.error('Please sign in as a client to book a meeting');
      navigate('/auth/login');
      return false;
    }
    if (user.role !== 'client') {
      toast.error('Only client accounts can book meetings with freelancers');
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!selected || !title.trim()) return;
    if (!requireClient()) return;
    setServerError('');
    book.mutate({
      freelancerId,
      title: title.trim(),
      startTime: selected.startTime,
      endTime: selected.endTime,
      timezone: tz,
      meetingType,
      notes: notes.trim(),
    });
  };

  const name = [freelancer?.firstName, freelancer?.lastName].filter(Boolean).join(' ') || 'the freelancer';

  return (
    <Modal open={open} onClose={onClose} title={`Book a meeting with ${name}`} size="lg">
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Meeting title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input w-full"
            placeholder="What is the meeting about?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Duration</label>
            <select value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setSelected(null); }} className="input w-full">
              {DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Type</label>
            <select value={meetingType} onChange={(e) => setMeetingType(e.target.value)} className="input w-full">
              <option value="video_call">Video call</option>
              <option value="phone">Phone</option>
              <option value="in_person">In person</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
            <ClockIcon className="w-4 h-4" />
            Times shown in {name}&apos;s timezone ({tz})
          </div>

          {isAvailLoading || isSlotsLoading ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : !bookable ? (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-300">
              <UserGroupIcon className="w-5 h-5 inline mr-1" />
              {availData?.blockedReason || 'This freelancer is not currently accepting bookings.'}
            </div>
          ) : grouped.length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-500">
              No open slots in the next 30 days for this length. Try a different duration or check back later.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
              {grouped.map(([day, slots]) => (
                <div key={day}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <CalendarDaysIcon className="w-3.5 h-3.5" /> {day}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot, i) => {
                      const key = `${slot.startTime}-${i}`;
                      const active = selected?.startTime === slot.startTime;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelected(slot)}
                          className={clsx(
                            'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                            active
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-primary-400'
                          )}
                        >
                          {timeFmt(tz).format(new Date(slot.startTime))}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes for the freelancer (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="input w-full resize-y" placeholder="Anything they should know before the call?" />
        </div>

        {serverError && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {serverError}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!selected || !title.trim() || book.isPending || !bookable}
          >
            <VideoCameraIcon className="w-4 h-4" />
            {book.isPending ? 'Sending request…' : 'Request booking'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}