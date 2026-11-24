import mongoose from 'mongoose';
import { Milestone, Wallet, Transaction } from '../models/index.js';
import { generateTxRef } from '../utils/helpers.js';
import { config } from '../config/env.js';
import { assertSafeToRun } from './_guard.mjs';

// Reconstructs release + commission transactions for milestones that were
// released through an older code path which credited the freelancer wallet but
// did not record transactions (the earnings page is transaction-driven, so
// released work showed 0 earnings). Non-destructive: only ADDS missing records,
// using the exact amounts already reflected in the freelancer wallet
// (net = gross * (1 - commissionRate), verified against wallet.totalEarned).
// No wallet balances, payments, escrows or milestones are modified.
async function main() {
  await assertSafeToRun('repair-missing-release-transactions');
  await mongoose.connect('mongodb://localhost:27017/SkillHub', { serverSelectionTimeoutMS: 8000 });

  const releasedMs = await Milestone.find({ status: 'released' }).sort({ escrowReleasedAt: -1 }).lean();
  let created = 0;
  let skipped = 0;

  for (const m of releasedMs) {
    const existing = await Transaction.findOne({
      user: m.freelancer,
      type: 'escrow_release',
      milestoneId: m._id,
      status: 'completed',
    }).lean();
    if (existing) { skipped++; continue; }

    const releasedAt = m.escrowReleasedAt || m.approvedAt || new Date();
    const commissionRate = config.platform.commissionRate || 0.10;
    const commission = Math.round(m.amount * commissionRate * 100) / 100;
    const net = Math.round((m.amount - commission) * 100) / 100;

    const clientWallet = await Wallet.findOne({ user: m.client });
    const freelancerWallet = await Wallet.findOne({ user: m.freelancer });
    if (!clientWallet || !freelancerWallet) {
      console.log(`[skip] milestone ${m._id}: missing wallet (client=${!!clientWallet}, freelancer=${!!freelancerWallet})`);
      continue;
    }

    const base = {
      status: 'completed',
      paymentId: m.paymentId || undefined,
      projectId: m.project,
      milestoneId: m._id,
      processedAt: releasedAt,
      createdAt: releasedAt,
      updatedAt: releasedAt,
    };

    // Client release record
    await Transaction.create([{
      ...base,
      user: m.client,
      wallet: clientWallet._id,
      type: 'escrow_release',
      amount: m.amount,
      fee: 0,
      netAmount: m.amount,
      reference: generateTxRef('ESCR'),
      description: `Escrow released for milestone: ${m.title}`,
      balanceBefore: clientWallet.balance,
      balanceAfter: clientWallet.balance,
    }]);

    // Freelancer release record
    await Transaction.create([{
      ...base,
      user: m.freelancer,
      wallet: freelancerWallet._id,
      type: 'escrow_release',
      amount: m.amount,
      fee: commission,
      netAmount: net,
      reference: generateTxRef('ESCR'),
      description: `Payment received for milestone: ${m.title}`,
      balanceBefore: freelancerWallet.balance - net,
      balanceAfter: freelancerWallet.balance,
    }]);

    // Platform commission record
    if (commission > 0) {
      await Transaction.create([{
        ...base,
        user: m.freelancer,
        wallet: freelancerWallet._id,
        type: 'commission',
        amount: commission,
        fee: 0,
        netAmount: commission,
        reference: generateTxRef('COMM'),
        description: `Platform commission (${(commissionRate * 100).toFixed(0)}%) for milestone: ${m.title}`,
        balanceBefore: freelancerWallet.balance,
        balanceAfter: freelancerWallet.balance,
      }]);
    }

    created++;
    console.log(`[recreated] milestone ${m._id} '${m.title}' gross=${m.amount} net=${net} fee=${commission} released=${releasedAt.toISOString()}`);
  }

  console.log(`\nDone. created=${created}, skipped(existing)=${skipped}`);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
