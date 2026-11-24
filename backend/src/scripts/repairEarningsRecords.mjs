import mongoose from 'mongoose';
import { Transaction, Job, Milestone } from '../models/index.js';
import { assertSafeToRun } from './_guard.mjs';

// Non-destructive repair of legacy earnings records.
// 1) Freelancer escrow_release txs with fee > 0 that stored the NET amount in
//    `amount` (so amount === netAmount) are corrected to gross: amount = netAmount + fee.
//    `netAmount` and `fee` are never changed. This only ever RAISES `amount` to the
//    true gross value already implied by the record, so it cannot destroy data.
// 2) Job-flow txs (metadata.jobId) that are missing projectId/milestoneId/paymentId
//    get them back-filled from the real Job document. No records are deleted or created.
async function main() {
  await assertSafeToRun('repair-earnings-records');
  await mongoose.connect('mongodb://localhost:27017/SkillHub', { serverSelectionTimeoutMS: 8000 });

  // ── Step 1: correct gross amounts ───────────────────────────────────────────
  const netStoredAsAmount = await Transaction.find({
    type: 'escrow_release',
    status: 'completed',
    fee: { $gt: 0 },
    $expr: { $eq: ['$amount', '$netAmount'] },
  });

  let amountFixed = 0;
  for (const tx of netStoredAsAmount) {
    const gross = tx.netAmount + tx.fee;
    if (gross === tx.amount) continue;
    console.log(
      `[amount] tx=${tx.reference} user=${tx.user} amount ${tx.amount} -> ${gross} (fee=${tx.fee}, net=${tx.netAmount})`
    );
    await Transaction.updateOne({ _id: tx._id }, { $set: { amount: gross } });
    amountFixed++;
  }

  // ── Step 2: back-fill job-flow linkage fields ───────────────────────────────
  const unlinkedJobTxs = await Transaction.find({
    'metadata.jobId': { $exists: true },
    $or: [{ projectId: { $exists: false } }, { projectId: null }],
  });

  const seenJobs = {};
  const seenMilestones = {};
  let linkFixed = 0;
  for (const tx of unlinkedJobTxs) {
    const jobId = tx.metadata.jobId;
    if (!seenJobs[jobId]) seenJobs[jobId] = await Job.findById(jobId).lean();
    const job = seenJobs[jobId];
    if (!job) {
      console.log(`[link] job ${jobId} not found for tx ${tx.reference} — skipped`);
      continue;
    }
    const set = {};
    if (job.project) set.projectId = job.project;
    else if (job.milestoneId) {
      if (!seenMilestones[job.milestoneId]) {
        seenMilestones[job.milestoneId] = await Milestone.findById(job.milestoneId).lean();
      }
      if (seenMilestones[job.milestoneId]?.project) set.projectId = seenMilestones[job.milestoneId].project;
    }
    if (job.milestoneId) set.milestoneId = job.milestoneId;
    if (job.paymentId) set.paymentId = job.paymentId;
    if (!Object.keys(set).length) continue;
    await Transaction.updateOne({ _id: tx._id }, { $set: set });
    console.log(
      `[link] tx=${tx.reference} type=${tx.type} -> projectId=${set.projectId}, milestoneId=${set.milestoneId}, paymentId=${set.paymentId}`
    );
    linkFixed++;
  }

  console.log(`\nRepair complete. amount fixed: ${amountFixed}, linkage fixed: ${linkFixed}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
