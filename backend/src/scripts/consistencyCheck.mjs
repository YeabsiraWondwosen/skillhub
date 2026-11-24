import mongoose from 'mongoose';
import { Transaction } from '../models/index.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/SkillHub', { serverSelectionTimeoutMS: 8000 });
  const bad = await Transaction.find({
    type: 'escrow_release', status: 'completed', fee: { $gt: 0 },
    $expr: { $eq: ['$amount', '$netAmount'] },
  });
  console.log('inconsistent freelancer release txs (amount==net && fee>0):', bad.length, bad.map(t => `${t.reference} (user=${t.user})`));
  const noLink = await Transaction.find({
    type: 'escrow_release', status: 'completed',
    $or: [{ projectId: null }, { projectId: { $exists: false } }],
  });
  console.log('release txs missing projectId:', noLink.length, noLink.map(t => `${t.reference} (user=${t.user})`));
  await mongoose.disconnect();
  process.exit(0);
}
main().catch(async (e) => { console.error(e); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
