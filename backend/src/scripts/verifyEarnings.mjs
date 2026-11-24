import mongoose from 'mongoose';

const TEST_DB = 'mongodb://localhost:27017/SkillHub_Verify';

import {
  User, Project, Milestone, Wallet, Transaction, Job, Category, Payment,
} from '../models/index.js';
import {
  fundMilestone, submitMilestone, approveMilestone,
} from '../controllers/milestone.controller.js';
import {
  fundJobPayment, startJobWork, submitJobDelivery, approveJobDelivery,
} from '../controllers/job.controller.js';
import { getEarnings, getEarningsChart, releaseEscrowCtrl } from '../controllers/payment.controller.js';
import {
  createEscrow, fundEscrow, startEscrowWork, submitEscrowWork,
} from '../services/payment.service.js';

const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${extra ? ` | ${extra}` : ''}`);
};

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

async function callController(handler, req) {
  const res = makeRes();
  let nextErr = null;
  let resolveSettled;
  const settled = new Promise((resolve) => { resolveSettled = resolve; });
  const next = (err) => { nextErr = err; resolveSettled(); };
  const origStatus = res.status;
  res.status = (code) => { res.statusCode = code; resolveSettled(); return res; };
  setTimeout(resolveSettled, 5000);
  await handler(req, res, next);
  await settled;
  if (nextErr) throw nextErr;
  return res;
}

async function main() {
  await mongoose.connect(TEST_DB, { serverSelectionTimeoutMS: 8000 });
  await mongoose.connection.dropDatabase();

  const client = await User.create({
    email: `verify-client-${Date.now()}@test.local`,
    password: 'VerifyPass123!',
    role: 'client',
    firstName: 'Verify',
    lastName: 'Client',
  });
  const freelancer = await User.create({
    email: `verify-freelancer-${Date.now()}@test.local`,
    password: 'VerifyPass123!',
    role: 'freelancer',
    firstName: 'Verify',
    lastName: 'Freelancer',
  });

  await Wallet.create({ user: client._id, balance: 5000 });
  const freelancerWallet = await Wallet.create({ user: freelancer._id, balance: 0 });

  const project = await Project.create({
    job: new mongoose.Types.ObjectId(),
    application: new mongoose.Types.ObjectId(),
    client: client._id,
    freelancer: freelancer._id,
    title: 'Verify Earnings Flow',
    status: 'active',
    budget: { agreedAmount: 1000 },
    timeline: { deadline: new Date(Date.now() + 30 * 86400000) },
  });

  const milestone = await Milestone.create({
    project: project._id,
    client: client._id,
    freelancer: freelancer._id,
    title: 'Phase 1',
    amount: 1000,
    dueDate: new Date(Date.now() + 7 * 86400000),
    status: 'pending',
  });

  // 1. Fund
  let res = await callController(fundMilestone, {
    params: { milestoneId: milestone._id },
    user: { _id: client._id },
  });
  check('fundMilestone returns 200', res.statusCode === 200, `status=${res.statusCode}`);
  check('fundMilestone escrow_hold tx recorded', await Transaction.exists({ user: client._id, type: 'escrow_hold', status: 'completed' }), '');

  // 2. Submit
  res = await callController(submitMilestone, {
    params: { milestoneId: milestone._id },
    user: { _id: freelancer._id },
    body: { note: 'delivered' },
    files: [],
  });
  check('submitMilestone returns 200', res.statusCode === 200, `status=${res.statusCode}`);

  // 3. Approve (release)
  res = await callController(approveMilestone, {
    params: { milestoneId: milestone._id },
    user: { _id: client._id },
  });
  check('approveMilestone returns 200', res.statusCode === 200, `status=${res.statusCode}`);
  const released = await Milestone.findById(milestone._id);
  check('milestone status = released', released?.status === 'released', released?.status);

  // 4. Transactions created
  const releaseTxs = await Transaction.find({ user: freelancer._id, type: 'escrow_release', status: 'completed' });
  check('freelancer escrow_release tx exists', releaseTxs.length === 1, `count=${releaseTxs.length}`);
  check('freelancer tx amount = gross (1000)', releaseTxs[0]?.amount === 1000, `amount=${releaseTxs[0]?.amount}`);
  check('freelancer tx net = 900', releaseTxs[0]?.netAmount === 900, `net=${releaseTxs[0]?.netAmount}`);
  check('freelancer tx fee = 100', releaseTxs[0]?.fee === 100, `fee=${releaseTxs[0]?.fee}`);
  const clientReleaseTxs = await Transaction.find({ user: client._id, type: 'escrow_release', status: 'completed' });
  check('client escrow_release tx exists', clientReleaseTxs.length === 1, `count=${clientReleaseTxs.length}`);
  const commTxs = await Transaction.find({ user: freelancer._id, type: 'commission', status: 'completed' });
  check('commission tx exists', commTxs.length === 1, `count=${commTxs.length}, amount=${commTxs[0]?.amount}`);

  // 5. Wallet credited
  const fw = await Wallet.findById(freelancerWallet._id);
  check('freelancer wallet totalEarned = 900', fw?.totalEarned === 900, `totalEarned=${fw?.totalEarned}`);
  check('freelancer wallet balance = 900', fw?.balance === 900, `balance=${fw?.balance}`);

  // 6. Earnings endpoint
  res = await callController(getEarnings, { user: { _id: freelancer._id } });
  const e = res.body?.data;
  check('earnings: grossEarnings = 1000', e?.grossEarnings === 1000, `gross=${e?.grossEarnings}`);
  check('earnings: netEarnings = 900', e?.netEarnings === 900, `net=${e?.netEarnings}`);
  check('earnings: totalFees = 100', e?.totalFees === 100, `fees=${e?.totalFees}`);
  check('earnings: today > 0', e?.today > 0, `today=${e?.today}`);
  check('earnings: thisMonth > 0', e?.thisMonth > 0, `month=${e?.thisMonth}`);
  check('earnings: completedProjects = 1', e?.completedProjects === 1, `projects=${e?.completedProjects}`);
  check('earnings: byProject populated', Array.isArray(e?.byProject) && e.byProject.length === 1, `len=${e?.byProject?.length}`);
  check('earnings: byClient populated', Array.isArray(e?.byClient) && e.byClient.length === 1, `len=${e?.byClient?.length}`);

  // 7. Earnings chart
  res = await callController(getEarningsChart, { user: { _id: freelancer._id }, query: {} });
  const chart = res.body?.data;
  const point = chart?.[0];
  check('chart has a point', Array.isArray(chart) && chart.length === 1, `len=${chart?.length}`);
  check('chart point gross = 1000', point?.gross === 1000, `gross=${point?.gross}`);
  check('chart point net = 900', point?.net === 900, `net=${point?.net}`);
  check('chart point earnings (net) = 900', point?.earnings === 900, `earnings=${point?.earnings}`);

  // 8. Double approve must be rejected (idempotency via status guard)
  let blocked = false;
  try {
    await callController(approveMilestone, {
      params: { milestoneId: milestone._id },
      user: { _id: client._id },
    });
  } catch (err) {
    blocked = true;
  }
  check('double approve blocked', blocked, '');
  const releaseCountAfter = await Transaction.countDocuments({ user: freelancer._id, type: 'escrow_release' });
  check('no duplicate release tx after double approve', releaseCountAfter === 1, `count=${releaseCountAfter}`);

  // ═══ JOB FLOW (fund job → start → deliver → approve) ═══════════════════════
  const jClient = await User.create({
    email: `verify-job-client-${Date.now()}@test.local`,
    password: 'VerifyPass123!',
    role: 'client',
    firstName: 'Job',
    lastName: 'Client',
  });
  const jFreelancer = await User.create({
    email: `verify-job-freelancer-${Date.now()}@test.local`,
    password: 'VerifyPass123!',
    role: 'freelancer',
    firstName: 'Job',
    lastName: 'Freelancer',
  });
  await Wallet.create({ user: jClient._id, balance: 5000 });
  const jFreelancerWallet = await Wallet.create({ user: jFreelancer._id, balance: 0 });

  const category = await Category.create({ name: `Verify Category ${Date.now()}` });

  const jProject = await Project.create({
    job: new mongoose.Types.ObjectId(),
    application: new mongoose.Types.ObjectId(),
    client: jClient._id,
    freelancer: jFreelancer._id,
    title: 'Verify Job Earnings Flow',
    status: 'active',
    budget: { agreedAmount: 1000 },
    timeline: { deadline: new Date(Date.now() + 30 * 86400000) },
  });

  const jMilestone = await Milestone.create({
    project: jProject._id,
    client: jClient._id,
    freelancer: jFreelancer._id,
    title: 'Job Phase',
    amount: 1000,
    dueDate: new Date(Date.now() + 7 * 86400000),
    status: 'pending',
  });

  const job = await Job.create({
    client: jClient._id,
    title: `Verify Job Flow ${Date.now()}`,
    description: 'End-to-end job flow verification.',
    requiredSkills: ['node'],
    budget: { type: 'fixed', minAmount: 1000, maxAmount: 1000, currency: 'ETB' },
    deadline: new Date(Date.now() + 30 * 86400000),
    experienceLevel: 'intermediate',
    category: category._id,
    status: 'payment_pending',
    paymentStatus: 'pending',
    hiredFreelancer: jFreelancer._id,
    milestoneId: jMilestone._id,
    project: jProject._id,
  });

  // J1. Fund job
  res = await callController(fundJobPayment, {
    params: { jobId: job._id },
    user: { _id: jClient._id },
  });
  check('fundJobPayment returns 200', res.statusCode === 200, `status=${res.statusCode}`);
  const fundedJob = await Job.findById(job._id);
  check('job status = funded', fundedJob?.status === 'funded', fundedJob?.status);
  check('job paymentStatus = funded', fundedJob?.paymentStatus === 'funded', fundedJob?.paymentStatus);
  check('job.paymentId set', !!fundedJob?.paymentId, `paymentId=${fundedJob?.paymentId}`);
  const jobPayment = await Payment.findById(fundedJob?.paymentId);
  check('Payment doc created for job', !!jobPayment, `amount=${jobPayment?.amount}`);
  check('job escrow_hold tx has projectId/milestoneId/paymentId', !!await Transaction.exists({
    user: jClient._id, type: 'escrow_hold', projectId: jProject._id, milestoneId: jMilestone._id, paymentId: fundedJob?.paymentId,
  }), '');

  // J2. Start work
  res = await callController(startJobWork, {
    params: { jobId: job._id },
    user: { _id: jFreelancer._id },
  });
  check('startJobWork returns 200', res.statusCode === 200, `status=${res.statusCode}`);

  // J3. Submit delivery
  res = await callController(submitJobDelivery, {
    params: { jobId: job._id },
    user: { _id: jFreelancer._id },
    body: { note: 'delivered' },
    files: [],
  });
  check('submitJobDelivery returns 200', res.statusCode === 200, `status=${res.statusCode}`);

  // J4. Approve delivery (release payment)
  res = await callController(approveJobDelivery, {
    params: { jobId: job._id },
    user: { _id: jClient._id },
  });
  check('approveJobDelivery returns 200', res.statusCode === 200, `status=${res.statusCode}`);
  const completedJob = await Job.findById(job._id);
  check('job status = completed', completedJob?.status === 'completed', completedJob?.status);
  check('job paymentStatus = released', completedJob?.paymentStatus === 'released', completedJob?.paymentStatus);

  // J5. Freelancer release transaction has GROSS amount + full linkage
  const jReleaseTxs = await Transaction.find({ user: jFreelancer._id, type: 'escrow_release', status: 'completed' });
  check('job freelancer escrow_release tx exists', jReleaseTxs.length === 1, `count=${jReleaseTxs.length}`);
  check('job freelancer tx amount = gross (1000)', jReleaseTxs[0]?.amount === 1000, `amount=${jReleaseTxs[0]?.amount}`);
  check('job freelancer tx net = 900', jReleaseTxs[0]?.netAmount === 900, `net=${jReleaseTxs[0]?.netAmount}`);
  check('job freelancer tx fee = 100', jReleaseTxs[0]?.fee === 100, `fee=${jReleaseTxs[0]?.fee}`);
  check('job freelancer tx projectId set', jReleaseTxs[0]?.projectId?.toString() === jProject._id.toString(), `projectId=${jReleaseTxs[0]?.projectId}`);
  check('job freelancer tx milestoneId set', jReleaseTxs[0]?.milestoneId?.toString() === jMilestone._id.toString(), `milestoneId=${jReleaseTxs[0]?.milestoneId}`);
  check('job freelancer tx paymentId set', !!jReleaseTxs[0]?.paymentId, `paymentId=${jReleaseTxs[0]?.paymentId}`);

  const jClientReleaseTxs = await Transaction.find({ user: jClient._id, type: 'escrow_release', status: 'completed' });
  check('job client escrow_release tx exists', jClientReleaseTxs.length === 1, `count=${jClientReleaseTxs.length}`);
  check('job client tx amount = gross (1000)', jClientReleaseTxs[0]?.amount === 1000, `amount=${jClientReleaseTxs[0]?.amount}`);
  check('job client tx projectId set', jClientReleaseTxs[0]?.projectId?.toString() === jProject._id.toString(), `projectId=${jClientReleaseTxs[0]?.projectId}`);

  const jCommTxs = await Transaction.find({ user: jFreelancer._id, type: 'commission', status: 'completed' });
  check('job commission tx exists', jCommTxs.length === 1, `count=${jCommTxs.length}, amount=${jCommTxs[0]?.amount}`);
  check('job commission tx projectId set', jCommTxs[0]?.projectId?.toString() === jProject._id.toString(), `projectId=${jCommTxs[0]?.projectId}`);

  // J6. Wallet credited net
  const jfw = await Wallet.findById(jFreelancerWallet._id);
  check('job freelancer wallet totalEarned = 900', jfw?.totalEarned === 900, `totalEarned=${jfw?.totalEarned}`);
  check('job freelancer wallet balance = 900', jfw?.balance === 900, `balance=${jfw?.balance}`);

  // J7. Earnings from job flow
  res = await callController(getEarnings, { user: { _id: jFreelancer._id } });
  const je = res.body?.data;
  check('job earnings: grossEarnings = 1000', je?.grossEarnings === 1000, `gross=${je?.grossEarnings}`);
  check('job earnings: netEarnings = 900', je?.netEarnings === 900, `net=${je?.netEarnings}`);
  check('job earnings: totalFees = 100', je?.totalFees === 100, `fees=${je?.totalFees}`);
  check('job earnings: completedProjects = 1', je?.completedProjects === 1, `projects=${je?.completedProjects}`);
  check('job earnings: byProject has title', Array.isArray(je?.byProject) && je.byProject[0]?.title === 'Verify Job Earnings Flow', `byProject=${JSON.stringify(je?.byProject)}`);
  check('job earnings: byClient has name', Array.isArray(je?.byClient) && /Job Client/.test(je.byClient[0]?.name || ''), `byClient=${JSON.stringify(je?.byClient)}`);

  // J8. Earnings chart from job flow
  res = await callController(getEarningsChart, { user: { _id: jFreelancer._id }, query: {} });
  const jchart = res.body?.data;
  check('job chart has a point', Array.isArray(jchart) && jchart.length === 1, `len=${jchart?.length}`);
  check('job chart point gross = 1000', jchart?.[0]?.gross === 1000, `gross=${jchart?.[0]?.gross}`);
  check('job chart point net = 900', jchart?.[0]?.net === 900, `net=${jchart?.[0]?.net}`);

  // J9. Double approve must be rejected (job no longer in delivery_submitted)
  let jBlocked = false;
  try {
    await callController(approveJobDelivery, {
      params: { jobId: job._id },
      user: { _id: jClient._id },
    });
  } catch (err) {
    jBlocked = true;
  }
  check('job double approve blocked', jBlocked, '');
  const jReleaseCountAfter = await Transaction.countDocuments({ user: jFreelancer._id, type: 'escrow_release' });
  check('job no duplicate release tx after double approve', jReleaseCountAfter === 1, `count=${jReleaseCountAfter}`);

  // ═══ ESCROW FLOW (create escrow → fund → start → submit → release) ═══════════
  const eClient = await User.create({
    email: `verify-escrow-client-${Date.now()}@test.local`,
    password: 'VerifyPass123!',
    role: 'client',
    firstName: 'Escrow',
    lastName: 'Client',
  });
  const eFreelancer = await User.create({
    email: `verify-escrow-freelancer-${Date.now()}@test.local`,
    password: 'VerifyPass123!',
    role: 'freelancer',
    firstName: 'Escrow',
    lastName: 'Freelancer',
  });
  await Wallet.create({ user: eClient._id, balance: 5000 });
  const eFreelancerWallet = await Wallet.create({ user: eFreelancer._id, balance: 0 });

  const eProject = await Project.create({
    job: new mongoose.Types.ObjectId(),
    application: new mongoose.Types.ObjectId(),
    client: eClient._id,
    freelancer: eFreelancer._id,
    title: 'Verify Escrow Earnings Flow',
    status: 'active',
    budget: { agreedAmount: 1000 },
    timeline: { deadline: new Date(Date.now() + 30 * 86400000) },
  });

  const escrow = await createEscrow({
    clientId: eClient._id,
    freelancerId: eFreelancer._id,
    projectId: eProject._id,
    amount: 1000,
  });
  await fundEscrow(escrow._id, eClient._id);
  await startEscrowWork(escrow._id, eFreelancer._id);
  await submitEscrowWork(escrow._id, eFreelancer._id);

  res = await callController(releaseEscrowCtrl, {
    params: { escrowId: escrow._id },
    user: { _id: eClient._id },
    body: {},
  });
  check('releaseEscrowCtrl returns 200', res.statusCode === 200, `status=${res.statusCode}`);
  const releasedEscrow = res.body?.data?.escrow;
  check('escrow status = released', releasedEscrow?.status === 'released', releasedEscrow?.status);

  const eReleaseTxs = await Transaction.find({ user: eFreelancer._id, type: 'escrow_release', status: 'completed' });
  check('escrow freelancer release tx exists', eReleaseTxs.length === 1, `count=${eReleaseTxs.length}`);
  check('escrow freelancer tx amount = gross (1000)', eReleaseTxs[0]?.amount === 1000, `amount=${eReleaseTxs[0]?.amount}`);
  check('escrow freelancer tx net = 900', eReleaseTxs[0]?.netAmount === 900, `net=${eReleaseTxs[0]?.netAmount}`);
  check('escrow freelancer tx fee = 100', eReleaseTxs[0]?.fee === 100, `fee=${eReleaseTxs[0]?.fee}`);
  check('escrow freelancer tx projectId set', eReleaseTxs[0]?.projectId?.toString() === eProject._id.toString(), `projectId=${eReleaseTxs[0]?.projectId}`);

  const efw = await Wallet.findById(eFreelancerWallet._id);
  check('escrow freelancer wallet totalEarned = 900', efw?.totalEarned === 900, `totalEarned=${efw?.totalEarned}`);

  res = await callController(getEarnings, { user: { _id: eFreelancer._id } });
  const ee = res.body?.data;
  check('escrow earnings: grossEarnings = 1000', ee?.grossEarnings === 1000, `gross=${ee?.grossEarnings}`);
  check('escrow earnings: netEarnings = 900', ee?.netEarnings === 900, `net=${ee?.netEarnings}`);
  check('escrow earnings: totalFees = 100', ee?.totalFees === 100, `fees=${ee?.totalFees}`);
  check('escrow earnings: byProject has title', Array.isArray(ee?.byProject) && ee.byProject[0]?.title === 'Verify Escrow Earnings Flow', `byProject=${JSON.stringify(ee?.byProject)}`);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('SCRIPT ERROR:', err);
  try { await mongoose.connection.dropDatabase(); } catch (_) {}
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
