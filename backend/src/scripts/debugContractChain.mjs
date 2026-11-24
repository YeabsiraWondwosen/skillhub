import mongoose from 'mongoose';
import {
  Project, Job, Application, Milestone, Payment, Escrow, Transaction,
  Review, ServiceOrder, User, Profile, Wallet, Conversation,
} from '../models/index.js';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/SkillHub';

const safeUser = (u) => {
  if (!u) return null;
  return {
    _id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email ? String(u.email).replace(/^(.).*(.@.*)$/, '$1***$2') : null,
    role: u.role,
    avatar: u.avatar?.url || u.avatar || null,
  };
};

async function findOwner(id) {
  const oid = mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
  const checks = [
    ['Project', Project, '_id'],
    ['Job', Job, '_id'],
    ['Application', Application, '_id'],
    ['Milestone', Milestone, '_id'],
    ['Payment', Payment, '_id'],
    ['Escrow', Escrow, '_id'],
    ['Transaction', Transaction, '_id'],
    ['Review', Review, '_id'],
    ['ServiceOrder', ServiceOrder, '_id'],
    ['User', User, '_id'],
    ['Profile', Profile, '_id'],
    ['Wallet', Wallet, '_id'],
    ['Conversation', Conversation, '_id'],
  ];
  if (!oid) {
    console.log(`  invalid ObjectId format for "${id}" (24 hex chars required)`);
    return null;
  }
  for (const [name, Model, field] of checks) {
    const doc = await Model.findById(oid).lean().catch(() => null);
    if (doc) {
      console.log(`  OWNER: ${name}  (field "${field}" = ${id})`);
      return { name, doc };
    }
  }
  console.log(`  NO OWNER FOUND in any checked collection for ${id}`);
  return null;
}

async function inspectChain(id, { alsoFindBy } = {}) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`CHAIN FOR ID: ${id}`);
  console.log('='.repeat(70));

  const owner = await findOwner(id);
  if (!owner) {
    // Some records store a contract/project reference under a different field.
    const refs = [
      ['Project.job', Project, { job: id }],
      ['Project.application', Project, { application: id }],
      ['Project.client', Project, { client: id }],
      ['Project.freelancer', Project, { freelancer: id }],
      ['Project.escrowPaymentId', Project, { escrowPaymentId: id }],
      ['Milestone.project', Milestone, { project: id }],
      ['Milestone.paymentId', Milestone, { paymentId: id }],
      ['Payment.project', Payment, { project: id }],
      ['Payment.milestone', Payment, { milestone: id }],
      ['Escrow.project', Escrow, { project: id }],
      ['Escrow.milestone', Escrow, { milestone: id }],
      ['Job.paymentId', Job, { paymentId: id }],
      ['Job.milestoneId', Job, { milestoneId: id }],
      ['Job.escrowId', Job, { escrowId: id }],
    ];
    for (const [label, Model, q] of refs) {
      const docs = await Model.find(q).lean().limit(3).catch(() => []);
      if (docs.length) {
        console.log(`  referenced by ${label}: ${docs.map((d) => d._id).join(', ')}`);
      }
    }
    return;
  }

  const { name, doc } = owner;
  const printRefs = (label, value) => {
    value = Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
    if (!value.length) console.log(`  ${label}: (none)`);
    else console.log(`  ${label}: ${value.map((v) => (typeof v === 'object' ? String(v._id || v) : String(v))).join(', ')}`);
  };

  if (name === 'Project') {
    console.log(`\nPROJECT (contract record)`);
    printRefs('job', doc.job);
    printRefs('application', doc.application);
    printRefs('serviceOrder', doc.serviceOrder);
    printRefs('client', doc.client);
    printRefs('freelancer', doc.freelancer);
    printRefs('escrowPaymentId', doc.escrowPaymentId);
    console.log(`  title: ${doc.title}`);
    console.log(`  status: ${doc.status}`);
    console.log(`  budget.agreedAmount: ${doc.budget?.agreedAmount}`);
    console.log(`  budget.paidAmount: ${doc.budget?.paidAmount}`);
    console.log(`  budget.currency: ${doc.budget?.currency}`);
    console.log(`  timeline.startDate: ${doc.timeline?.startDate}`);
    console.log(`  timeline.deadline: ${doc.timeline?.deadline}`);
    console.log(`  timeline.completedAt: ${doc.timeline?.completedAt}`);
    console.log(`  progress: ${doc.progress}`);
    console.log(`  revisionsAllowed: ${doc.revisionsAllowed}`);
    console.log(`  revisionsUsed: ${doc.revisionsUsed}`);
    console.log(`  conversationId: ${doc.conversationId}`);
    console.log(`  createdAt: ${doc.createdAt}`);
    console.log(`  updatedAt: ${doc.updatedAt}`);
    printRefs('dispute.raisedBy', doc.dispute?.raisedBy);

    const milestones = await Milestone.find({ project: doc._id }).lean().sort({ order: 1, createdAt: 1 });
    console.log(`\nMILESTONES (by project=${doc._id}): ${milestones.length}`);
    for (const m of milestones) {
      console.log(`  [${m._id}] status=${m.status} amount=${m.amount} ${m.currency} due=${m.dueDate} paymentId=${m.paymentId} transactionId=${m.transactionId} createdAt=${m.createdAt}`);
    }

    const escrowDocs = await Escrow.find({ $or: [{ project: doc._id }, { milestone: { $in: milestones.map((m) => m._id) } }] }).lean();
    console.log(`\nESCROW: ${escrowDocs.length}`);
    for (const e of escrowDocs) {
      console.log(`  [${e._id}] status=${e.status} amount=${e.amount} ${e.currency} heldAmount=${e.heldAmount} paymentId=${e.paymentId} milestone=${e.milestone} releasedAt=${e.releasedAt} fundedAt=${e.fundedAt}`);
    }

    const payments = await Payment.find({ $or: [{ project: doc._id }, { _id: doc.escrowPaymentId }, { milestone: { $in: milestones.map((m) => m._id) } }] }).lean();
    console.log(`\nPAYMENTS: ${payments.length}`);
    for (const p of payments) {
      console.log(`  [${p._id}] type=${p.type} status=${p.status} amount=${p.amount} ${p.currency} isEscrow=${p.isEscrow} escrowReleasedAt=${p.escrowReleasedAt} milestone=${p.milestone} createdAt=${p.createdAt}`);
    }

    const transactions = await Transaction.find({ projectId: doc._id }).lean();
    console.log(`\nTRANSACTIONS (by projectId): ${transactions.length}`);
    for (const t of transactions) {
      console.log(`  [${t._id}] user=${t.user} type=${t.type} amount=${t.amount} fee=${t.fee} netAmount=${t.netAmount} status=${t.status} ref=${t.reference} paymentId=${t.paymentId} milestoneId=${t.milestoneId}`);
    }

    const reviews = await Review.find({ project: doc._id }).lean();
    console.log(`\nREVIEWS (by project): ${reviews.length}`);
    for (const r of reviews) {
      console.log(`  [${r._id}] reviewer=${r.reviewer} reviewee=${r.reviewee} rating=${r.rating?.overall}`);
    }

    const conv = doc.conversationId ? await Conversation.findById(doc.conversationId).lean() : null;
    console.log(`\nCONVERSATION: ${conv ? `${conv._id} (type=${conv.type})` : '(none)'}`);

    if (doc.client) {
      const u = await User.findById(doc.client).lean();
      console.log(`\nCLIENT: ${safeUser(u) ? JSON.stringify(safeUser(u)) : 'MISSING USER DOC'}`);
    }
    if (doc.freelancer) {
      const u = await User.findById(doc.freelancer).lean();
      console.log(`\nFREELANCER: ${safeUser(u) ? JSON.stringify(safeUser(u)) : 'MISSING USER DOC'}`);
    }
    if (doc.job) {
      const j = await Job.findById(doc.job).lean();
      console.log(`\nJOB [${doc.job}]: title=${j?.title} status=${j?.status} paymentStatus=${j?.paymentStatus} budget=${j?.budget} paymentId=${j?.paymentId} milestoneId=${j?.milestoneId} escrowId=${j?.escrowId}`);
    } else {
      console.log(`\nJOB: (none linked)`);
    }
  } else {
    console.log(`\n${name} RAW (summary):`);
    console.log(JSON.stringify(doc, null, 2).slice(0, 2000));
    const p = doc.project || doc.contract;
    if (p) {
      console.log(`\nLinked project found: ${p}`);
      await inspectChain(String(p));
    }
  }
}

async function main() {
  const ids = process.argv.slice(2);
  if (!ids.length) {
    console.log('Usage: node backend/src/scripts/debugContractChain.mjs <id> [id2 ...]');
    process.exit(1);
  }
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  for (const id of ids) {
    await inspectChain(id);
  }
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('ERROR:', e && e.stack ? e.stack : e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});