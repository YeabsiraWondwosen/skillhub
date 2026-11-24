/**
 * One-time cleanup for the presence/availability conflation bug.
 *
 * The socket disconnect handler used to persist `availabilityStatus: 'offline'`
 * every time a freelancer's last socket closed. That silently converted a
 * freelancer's real booking setting into "offline", making them permanently
 * unbookable ("This freelancer is currently offline and not accepting
 * bookings.") even though they had a configured schedule.
 *
 * The code fix stops writing `availabilityStatus` on disconnect. This script
 * heals rows that were already corrupted. It restores `'available'` ONLY for
 * freelancers who:
 *   - currently have `availabilityStatus === 'offline'`, AND
 *   - have at least one configured weekly AvailabilitySlot.
 *
 * A configured schedule is the strongest available signal that the freelancer
 * intends to accept bookings, so the stale `'offline'` is almost certainly
 * from the bug. Freelancers with no schedule are left untouched (they are
 * already gated by the "no availability configured" rule). Freelancers who
 * intentionally want to stay unbookable can simply set Offline again.
 *
 * Idempotent: safe to re-run. Requires the destructive-script guard.
 *
 * Usage (development only):
 *   set ALLOW_DB_MUTATION=true
 *   node src/scripts/repairAvailabilityStatus.mjs
 */
import mongoose from 'mongoose';
import { User, AvailabilitySlot } from '../models/index.js';
import { assertSafeToRun } from './_guard.mjs';

async function main() {
  await assertSafeToRun('availability-status-repair');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/SkillHub', {
    serverSelectionTimeoutMS: 8000,
  });

  const candidates = await User.find({ role: 'freelancer', availabilityStatus: 'offline' })
    .select('_id firstName lastName')
    .lean();

  if (candidates.length === 0) {
    console.log('[repair] No freelancers are currently marked offline. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  const scheduleOwnerIds = new Set(
    (await AvailabilitySlot.distinct('freelancer', { freelancer: { $in: candidates.map((c) => c._id) } })).map(String)
  );

  const targets = candidates.filter((c) => scheduleOwnerIds.has(String(c._id)));

  let fixed = 0;
  for (const t of targets) {
    const res = await User.updateOne(
      { _id: t._id, availabilityStatus: 'offline' },
      { $set: { availabilityStatus: 'available' } }
    );
    if (res.modifiedCount > 0) fixed += 1;
  }

  console.log(`[repair] Restored ${fixed} freelancer(s) from offline -> available (they have a configured schedule).`);
  console.log(`[repair] Left ${candidates.length - targets.length} offline freelancer(s) without a schedule unchanged.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[repair] Failed:', err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
