import mongoose from 'mongoose';
await mongoose.connect('mongodb://localhost:27017/SkillHub');
const { Job, Milestone, Project, Payment, Escrow, Transaction, Wallet, User } = await import('../models/index.js');
const jobCtrl = await import('../controllers/job.controller.js');

const CLIENT = '6aa68b44b9fbee385f64d8a4';
const FREELANCER = '6aa6d15f6b6793b8579918bf';
const AMOUNT = 100;

function snapshotWallet(w) {
  return { balance: w.balance, escrowBalance: w.escrowBalance, totalSpent: w.totalSpent, totalEarned: w.totalEarned };
}

const assert = (name, cond, extra) => results.push([name, cond ? 'PASS' : 'FAIL', extra || '']);

async function callHandler(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      status(c) { this._code = c; return this; },
      json(p) { resolve({ code: this._code, body: p }); },
    };
    try {
      handler(req, res, (err) => (err ? reject(err) : resolve({ code: res._code, body: null })));
    } catch (e) { reject(e); }
  });
}

let created = [];
const cleanup = async () => {
  await Transaction.deleteMany({ _id: { $in: created.filter((x) => x.kind === 'transaction').map((x) => x.id) } });
  await Payment.deleteMany({ _id: { $in: created.filter((x) => x.kind === 'payment').map((x) => x.id) } });
  await Escrow.deleteMany({ _id: { $in: created.filter((x) => x.kind === 'escrow').map((x) => x.id) } });
  await Milestone.deleteMany({ _id: { $in: created.filter((x) => x.kind === 'milestone').map((x) => x.id) } });
  await Project.deleteMany({ _id: { $in: created.filter((x) => x.kind === 'project').map((x) => x.id) } });
  await Job.deleteMany({ _id: { $in: created.filter((x) => x.kind === 'job').map((x) => x.id) } });
};

const results = [];
try {
  const [clientWallet0, freelancerWallet0, clientUser0, freelancerUser0] = await Promise.all([
    Wallet.findOne({ user: CLIENT }), Wallet.findOne({ user: FREELANCER }),
    User.findOne({ _id: CLIENT }), User.findOne({ _id: FREELANCER }),
  ]);
  const cw0 = snapshotWallet(clientWallet0);
  const fw0 = snapshotWallet(freelancerWallet0);
  const cs0 = { ...(clientUser0.stats || {}) };
  const fs0 = { ...(freelancerUser0.stats || {}) };

  const job = await Job.create({
    client: CLIENT, title: '[TEST] e2e flow', description: 'automated verification',
    budget: { type: 'fixed', minAmount: AMOUNT, maxAmount: AMOUNT, currency: 'ETB' },
    category: new mongoose.Types.ObjectId(), requiredSkills: ['test'],
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'payment_pending', paymentStatus: 'none',
  });
  created.push({ kind: 'job', id: job._id });
  const project = await Project.create({
    client: CLIENT, freelancer: FREELANCER, job: job._id, status: 'pending_payment',
    title: '[TEST] e2e project', budget: { agreedAmount: AMOUNT, currency: 'ETB', paidAmount: 0 },
    timeline: { deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  created.push({ kind: 'project', id: project._id });
  const milestone = await Milestone.create({
    project: project._id, client: CLIENT, freelancer: FREELANCER, job: job._id,
    title: '[TEST] milestone', amount: AMOUNT, currency: 'ETB', status: 'pending',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  created.push({ kind: 'milestone', id: milestone._id });
  job.project = project._id;
  job.milestoneId = milestone._id;
  job.hiredFreelancer = FREELANCER;
  await job.save();

  const oid = (s) => new mongoose.Types.ObjectId(s);
  let r;

  r = await callHandler(jobCtrl.fundJobPayment, { user: { _id: oid(CLIENT) }, params: { jobId: job._id } });
  results.push(['fundJobPayment', r.code]);
  const escrow = await Escrow.findOne({ milestone: milestone._id });
  const payment = await Payment.findOne({ milestone: milestone._id });
  if (escrow) created.push({ kind: 'escrow', id: escrow._id });
  if (payment) created.push({ kind: 'payment', id: payment._id });
  const cwFunded = await Wallet.findOne({ user: CLIENT });
  assert('after fund: escrowBalance +100 (money held)', cwFunded.escrowBalance === cw0.escrowBalance + AMOUNT, `${cw0.escrowBalance} -> ${cwFunded.escrowBalance}`);

  r = await callHandler(jobCtrl.startJobWork, { user: { _id: oid(FREELANCER) }, params: { jobId: job._id } });
  results.push(['startJobWork', r.code]);

  r = await callHandler(jobCtrl.submitJobDelivery, { user: { _id: oid(FREELANCER) }, params: { jobId: job._id }, files: undefined, body: {} });
  results.push(['submitJobDelivery', r.code]);

  r = await callHandler(jobCtrl.approveJobDelivery, { user: { _id: oid(CLIENT) }, params: { jobId: job._id } });
  results.push(['approveJobDelivery', r.code]);

  const done = await Job.findById(job._id).lean();
  const doneProject = await Project.findById(project._id).lean();
  const doneMilestone = await Milestone.findById(milestone._id).lean();
  const doneEscrow = await Escrow.findOne({ milestone: milestone._id }).lean();
  const donePayment = await Payment.findOne({ milestone: milestone._id }).lean();

  await Transaction.updateMany({ paymentId: payment?._id }, { $set: { _e2eTest: true } });
  const txs = await Transaction.find({ paymentId: payment?._id }).lean();

  const [cw, fw] = await Promise.all([Wallet.findOne({ user: CLIENT }), Wallet.findOne({ user: FREELANCER })]);
  const cwNow = snapshotWallet(cw);
  const fwNow = snapshotWallet(fw);

  results.push(['CLEANUP', 'starting']);
  assert('job completed', done.status === 'completed' && done.paymentStatus === 'released');
  assert('project completed + paidAmount', doneProject.status === 'completed' && doneProject.budget.paidAmount === AMOUNT);
  assert('milestone released', doneMilestone.status === 'released');
  assert('escrow released', doneEscrow.status === 'released' && doneEscrow.amount === AMOUNT);
  assert('payment released', donePayment.escrowReleasedAt && donePayment.isEscrow === true && donePayment.status === 'completed');
  assert('tx count = 4', txs.length === 4);
  assert('tx types', ['escrow_hold', 'escrow_release', 'escrow_release', 'commission'].every((t) => txs.map((x) => x.type).includes(t)));
  assert('client escrowBalance returned to baseline after full release', cwNow.escrowBalance === cw0.escrowBalance, `${cw0.escrowBalance} -> ${cwNow.escrowBalance}`);
  assert('client balance -100', cwNow.balance === cw0.balance - AMOUNT, `${cw0.balance} -> ${cwNow.balance}`);
  assert('client totalSpent +100', cwNow.totalSpent === cw0.totalSpent + AMOUNT, `${cw0.totalSpent} -> ${cwNow.totalSpent}`);
  assert('freelancer balance +90 (net after 10%)', fwNow.balance === fw0.balance + AMOUNT * 0.9, `${fw0.balance} -> ${fwNow.balance}`);
  assert('freelancer totalEarned +90', fwNow.totalEarned === fw0.totalEarned + AMOUNT * 0.9, `${fw0.totalEarned} -> ${fwNow.totalEarned}`);

  results.push(['CLEANUP', 'starting']);
  // revert wallets + user stats exactly
  await Wallet.updateOne({ user: CLIENT }, { $set: cw0 });
  await Wallet.updateOne({ user: FREELANCER }, { $set: fw0 });
  await User.updateOne({ _id: CLIENT }, { $set: { stats: cs0 } });
  await User.updateOne({ _id: FREELANCER }, { $set: { stats: fs0 } });
  await cleanup();

  const verifyClean = async () => {
    const e = await Escrow.exists({ milestone: milestone._id });
    const p = await Payment.exists({ milestone: milestone._id });
    const t = await Transaction.findOne({ _e2eTest: true });
    const j = await Job.exists({ _id: job._id });
    const rw = await Promise.all([Wallet.findOne({ user: CLIENT }), Wallet.findOne({ user: FREELANCER })]);
    return { e, p, t, j, walletRestored: snapshotWallet(rw[0]).balance === cw0.balance && snapshotWallet(rw[1]).balance === fw0.balance };
  };
  const clean = await verifyClean();
  results.push(['cleanup verify', !clean.e && !clean.p && !clean.t && !clean.j && clean.walletRestored ? 'PASS' : 'FAIL', JSON.stringify(clean)]);
} finally {
  await cleanup();
  await mongoose.disconnect();
}

for (const row of results) console.log(row.join(' | '));