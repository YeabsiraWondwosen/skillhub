import mongoose from 'mongoose';
import { Wallet, Transaction } from '../models/index.js';
import { assertSafeToRun } from './_guard.mjs';

// Repairs wallets that were created before the escrow accounting fixes:
//   1. balance was never debited when escrow was released to a freelancer —
//      the freelancer got paid but the client kept the full balance, so money
//      was effectively created (double-spend). Balance is corrected by the
//      amount of client escrow_release transactions that were NOT debited.
//   2. totalEarned was inflated by deposits (creditWallet bumped totalEarned
//      on every deposit). totalEarned is recomputed from genuine earnings only
//      (freelancer escrow releases + bonuses).
//   3. totalSpent was never incremented when a client paid out escrow.
//      totalSpent is recomputed from client escrow_release transactions.
//   4. refunds wrongly credited the client balance (refundEscrow added balance
//      even though it was never debited). Those credits are reversed.
//
// Uses transaction balance snapshots to stay idempotent: only records that
// were NOT debited (release) or WERE wrongly credited (refund) are adjusted.
// Safe to re-run.

async function main() {
  await assertSafeToRun('wallet-accounting-repair');
  await mongoose.connect('mongodb://localhost:27017/SkillHub', { serverSelectionTimeoutMS: 8000 });

  const wallets = await Wallet.find().lean();
  let fixed = 0;

  for (const w of wallets) {
    const txs = await Transaction.find({ user: w.user, status: 'completed' }).lean();

    let earned = 0;   // freelancer receipts + bonuses
    let spent = 0;    // client escrow payouts
    let balanceDelta = 0; // negative = money that left but was never debited / was wrongly credited

    for (const tx of txs) {
      const after = tx.balanceAfter;
      const before = tx.balanceBefore;
      const hasSnapshots = after != null && before != null;

      const isFreelancerReceipt =
        tx.type === 'escrow_release' &&
        (tx.netAmount < tx.amount || (hasSnapshots && after > before));

      if (tx.type === 'bonus') {
        earned += tx.netAmount || 0;
      } else if (isFreelancerReceipt) {
        earned += tx.netAmount || 0;
      } else if (tx.type === 'escrow_release') {
        // Client paid the freelancer
        spent += tx.amount || 0;
        if (!hasSnapshots || after >= before) {
          // Was never debited from the client balance — correct it
          balanceDelta -= tx.amount || 0;
        }
      } else if (tx.type === 'escrow_refund') {
        if (hasSnapshots && after > before) {
          // Old buggy refund credited the client balance that was never debited
          balanceDelta -= tx.amount || 0;
        }
      }
    }

    const earnedR = Math.round(earned * 100) / 100;
    const spentR = Math.round(spent * 100) / 100;
    const correctedBalance = Math.round((w.balance + balanceDelta) * 100) / 100;

    const balanceChanged = correctedBalance !== Math.round(w.balance * 100) / 100;
    const earnedChanged = earnedR !== Math.round(w.totalEarned * 100) / 100;
    const spentChanged = spentR !== Math.round(w.totalSpent * 100) / 100;

    if (balanceChanged || earnedChanged || spentChanged) {
      const $set = {};
      if (balanceChanged) $set.balance = correctedBalance;
      if (earnedChanged) $set.totalEarned = earnedR;
      if (spentChanged) $set.totalSpent = spentR;

      await Wallet.updateOne({ _id: w._id }, { $set });
      fixed++;
      console.log(
        `[fixed] wallet ${w._id} user=${w.user}` +
        `${balanceChanged ? ` balance ${w.balance} -> ${correctedBalance}` : ''}` +
        `${earnedChanged ? ` earned ${w.totalEarned} -> ${earnedR}` : ''}` +
        `${spentChanged ? ` spent ${w.totalSpent} -> ${spentR}` : ''}`
      );
    }
  }

  console.log(`\nDone. fixed=${fixed}, checked=${wallets.length}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
