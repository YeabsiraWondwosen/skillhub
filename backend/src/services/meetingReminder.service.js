import { Meeting } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { notifyMeetingReminder } from './notification.service.js';

// Reminder windows (checks run every 15 minutes; each window is ~1 hour wide so
// a meeting is reminded exactly once per window).
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
const WINDOW_1H_MS = 60 * 60 * 1000;
const RUN_INTERVAL_MS = 15 * 60 * 1000;

const sendRemindersForWindow = async (windowLabel, windowMs, field) => {
  const now = Date.now();

  const targets = await Meeting.find({
    status: 'accepted',
    [`reminders.${field}`]: { $ne: true },
    startTime: {
      $lte: new Date(now + windowMs + RUN_INTERVAL_MS),
      $gte: new Date(now + windowMs - RUN_INTERVAL_MS),
    },
  }).lean();

  for (const meeting of targets) {
    // Atomic guard prevents duplicate reminders even if two runs race.
    const claimed = await Meeting.findOneAndUpdate(
      { _id: meeting._id, [`reminders.${field}`]: { $ne: true } },
      { $set: { [`reminders.${field}`]: true } }
    );
    if (!claimed) continue;

    const recipients = [meeting.client, meeting.freelancer];
    for (const userId of recipients) {
      await notifyMeetingReminder(userId, meeting, windowLabel).catch(() => null);
    }
  }

  return targets.length;
};

export const runMeetingReminders = async ({ log = false } = {}) => {
  try {
    const sent24h = await sendRemindersForWindow('24 hours', WINDOW_24H_MS, '24h');
    const sent1h = await sendRemindersForWindow('1 hour', WINDOW_1H_MS, '1h');
    if (log && (sent24h > 0 || sent1h > 0)) {
      logger.info(`Meeting reminders sent: 24h=${sent24h}, 1h=${sent1h}`);
    }
    return { sent24h, sent1h };
  } catch (error) {
    logger.error(`Meeting reminder job error: ${error.message}`);
    return { sent24h: 0, sent1h: 0 };
  }
};

const timers = new Set();

export const startMeetingReminderJob = (intervalMs = RUN_INTERVAL_MS) => {
  const first = setTimeout(() => runMeetingReminders({ log: true }), 10 * 1000);
  timers.add(first);

  const interval = setInterval(() => runMeetingReminders({ log: true }), intervalMs);
  timers.add(interval);

  process.on('SIGINT', () => {
    timers.forEach((t) => clearInterval(t));
    timers.forEach((t) => clearTimeout(t));
  });
  process.on('SIGTERM', () => {
    timers.forEach((t) => clearInterval(t));
    timers.forEach((t) => clearTimeout(t));
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.info('Meeting reminder job scheduled');
  }
};