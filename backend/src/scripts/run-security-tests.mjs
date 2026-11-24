#!/usr/bin/env node
/**
 * SkillHub Security & Financial Integrity Test Suite.
 *
 * Runs targeted tests against an ISOLATED database
 * (`skillhub_security_test` on localhost:27017). Never connects to the real
 * SkillHub database and never touches real records.
 *
 * Run:
 *   node src/scripts/run-security-tests.mjs
 *
 * Cover(36 targeted checks):
 *   Security  (1-10, 26-30) webhook fail-closed + amount parity + replay,
 *                     JWT prod guard (weak/identical/strong/missing),
 *                     refresh limiter, code-review privacy incl. owner matrix
 *   Workflow (11-16)  project state machine, terminal-state refund protection
 *   Financial(17-20, 31-34)  atomic wallet debit/hold, concurrent race safety,
 *                     escrow release atomicity (success/failure/replay)
 *   DB       (21-23) destructive-script guards, read-only diagnostic (dry-run +
 *                     guarded --repair)
 *   AI       (35-36) getSmartReplies IDOR guard (404 / 403)
 *   Frontend (24-25) silent error handling / misleading toasts (static)
 */
import crypto from 'crypto';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ─── Environment must be set BEFORE any app module is imported ────────────────
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PAYMENT_MODE = 'telebirr'; // so webhook controllers execute verification
process.env.TELEBIRR_WEBHOOK_SECRET = process.env.TELEBIRR_WEBHOOK_SECRET || crypto.randomBytes(32).toString('hex');
process.env.CBE_BIRR_WEBHOOK_SECRET = process.env.CBE_BIRR_WEBHOOK_SECRET || crypto.randomBytes(32).toString('hex');

const TEST_DB_URI = 'mongodb://localhost:27017/skillhub_security_test';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FRONTEND = path.resolve(ROOT, '../frontend');

let pass = 0;
let fail = 0;
const failures = [];

const check = (name, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    fail++;
    failures.push(`${name} ${extra}`);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}  ${extra}`);
  }
};

const assertRejects = async (fn, code, ctx = {}) => {
  try {
    await fn();
  } catch (err) {
    if (code !== undefined && err?.statusCode !== code) {
      throw new Error(`expected status ${code}, got ${err?.statusCode}: ${err?.message}`);
    }
    return err;
  }
  throw new Error(`expected rejection (code=${code}) ${JSON.stringify(ctx)}`);
};

const runChild = (taskName, script, env) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, script, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => resolve({ code, out, err }));
  });

// Helper: flush microtask queue so catchAsync-wrapped handlers (which don't
// return their promise) have time to call next/res.json before we inspect.
const flush = () => new Promise((r) => setTimeout(r, 50));

const makeRes = () => {
  const res = { statusCode: 0, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

console.log(`\nRunning SkillHub security & integrity suite (DB: ${TEST_DB_URI})\n`);

// Dynamic imports after env setup so payment.controller → config.paymentMode picks up 'telebirr'.
const { default: mongoose } = await import('mongoose');
const { default: express } = await import('express');
const { User, Wallet, Payment, Transaction, Project, Job, CodeReview, Escrow, ServiceOrder, Milestone, Conversation } = await import('../models/index.js');
const { verifyTelebirrWebhook, verifyCbeBirrWebhook, canonicalize } = await import('../services/paymentWebhook.verify.service.js');
const { debitWallet, holdEscrow, creditWallet, propagateFunding, propagateRelease, propagateRefund, releaseEscrowFunds, refundEscrowFunds } = await import('../services/payment.service.js');
const { completeServiceOrder } = await import('../services/order.service.js');
const { assertProjectTransition, TERMINAL_PROJECT_STATUSES } = await import('../utils/projectStateMachine.js');
const { refreshLimiter } = await import('../middleware/rateLimiter.js');
const { telebirrWebhook, cbeBirrWebhook } = await import('../controllers/payment.controller.js');
const { getPublicReview } = await import('../controllers/codeReview.controller.js');
const { getSmartReplies } = await import('../controllers/aiMessaging.controller.js');

const db = await mongoose
  .connect(TEST_DB_URI, { serverSelectionTimeoutMS: 5000 })
  .catch((e) => {
    console.error(`[FATAL] Cannot connect to test DB at ${TEST_DB_URI}: ${e.message}`);
    process.exit(1);
  });
await mongoose.connection.dropDatabase();

const futureDate = () => new Date(Date.now() + 7 * 24 * 3600 * 1000);

const makeUser = async (role = 'client', emailSuffix) => {
  const suffix = emailSuffix || crypto.randomBytes(4).toString('hex');
  return User.create({
    email: `test-${suffix}@skillhub.test`,
    password: 'TestP@ss123',
    role,
    firstName: 'Test',
    lastName: role === 'client' ? 'Client' : 'Free',
    isEmailVerified: true,
    isActive: true,
  });
};

const makeProject = async (client, freelancer, status = 'pending_payment', extra = {}) =>
  Project.create({
    title: 'Test Project',
    client: client._id,
    freelancer: freelancer._id,
    status,
    budget: { agreedAmount: 100, currency: 'ETB' },
    timeline: { deadline: futureDate() },
    ...extra,
  });

const computeHmacPayload = (payload, secret) =>
  crypto.createHmac('sha256', secret)
    .update(canonicalize(payload))
    .digest('hex');

const makeEscrow = async (client, freelancer, project, milestone, { amount = 100, rate = 0.10, status = 'funded' } = {}) => {
  const commission = Math.round(amount * rate * 100) / 100;
  return Escrow.create({
    client: client._id,
    freelancer: freelancer._id,
    project: project?._id,
    milestone: milestone?._id || undefined,
    amount,
    currency: 'ETB',
    commissionRate: rate,
    commissionAmount: commission,
    freelancerAmount: amount - commission,
    status,
  });
};

// ════════════════════════════════════════════════════════════════════════════
console.log('\n[Security 1-10]');
// ─── 1. Telebirr rejects invalid signature ───────────────────────────────────
{
  const body = { outTradeNo: 'R1', status: 'success', amount: 100 };
  const bad = { ...body, sign: crypto.randomBytes(16).toString('hex') };
  const err = await assertRejects(() => verifyTelebirrWebhook(bad, {}), 401, 'invalid telebirr sign');
  check('Test 1: Telebirr webhook rejects invalid signature (fail-closed)', err?.statusCode === 401);
}

// ─── 2. Telebirr accepts valid signature (via x-signature header) ────────────
{
  // The verifier hashes the FULL received body (which contains no `sign` key
  // when the signature travels in a header). Compute the expected HMAC over the
  // body exactly as the provider would sign it, then send it in `x-signature`.
  const body1 = { outTradeNo: 'R2', status: 'success', amount: 100 };
  const sig = computeHmacPayload(body1, process.env.TELEBIRR_WEBHOOK_SECRET);
  const okay = await verifyTelebirrWebhook(body1, { 'x-signature': sig });
  check('Test 2: Telebirr webhook accepts valid signature', okay === true);
}

// ─── 3. CBE Birr rejects missing/bad signature ───────────────────────────────
{
  const missing = { referenceId: 'R3', status: 'success', amount: 100 };
  const err1 = await assertRejects(() => verifyCbeBirrWebhook(missing, {}), 401, 'missing cbe sign');
  const bad = { ...missing, signature: crypto.randomBytes(16).toString('hex') };
  const err2 = await assertRejects(() => verifyCbeBirrWebhook(bad, {}), 401, 'bad cbe sign');
  check('Test 3: CBE Birr webhook rejects missing/bad signature', err1?.statusCode === 401 && err2?.statusCode === 401);
}

// ─── 4. Valid webhook credits payment exactly once ─────────────────────────────
{
  const user = await makeUser('client', 'wh4');
  const ref = 'REF_GOOD';
  await Payment.create({
    payer: user._id,
    type: 'deposit',
    amount: 100,
    currency: 'ETB',
    netAmount: 100,
    status: 'pending',
    provider: 'telebirr',
    providerTransactionRef: ref,
    reference: ref,
    description: 'Wallet deposit via Telebirr',
  });

  const payload = { outTradeNo: ref, status: 'success', amount: 100 };
  const sig = computeHmacPayload(payload, process.env.TELEBIRR_WEBHOOK_SECRET);

  const res = makeRes();
  let nextErr = null;
  await telebirrWebhook({ body: payload, headers: { 'x-signature': sig } }, res, (e) => { nextErr = e; });
  await flush();

  const payment = await Payment.findOne({ providerTransactionRef: ref });
  const wallet = await Wallet.findOne({ user: user._id });
  const txns = await Transaction.find({ user: user._id, type: 'deposit' });

  if (!payment || payment.status !== 'completed' || nextErr) {
    console.log('  [DEBUG Test 4] payment:', JSON.stringify(payment?.toObject?.() || payment));
    console.log('  [DEBUG Test 4] wallet:', JSON.stringify(wallet?.toObject?.() || wallet));
    console.log('  [DEBUG Test 4] nextErr:', nextErr?.message, nextErr?.statusCode);
    console.log('  [DEBUG Test 4] res.body:', JSON.stringify(res.body));
    const { config: cfg } = await import('../config/env.js');
    console.log('  [DEBUG Test 4] config.paymentMode:', cfg.paymentMode);
  }

  check('Test 4: valid webhook marks payment completed', payment?.status === 'completed' && !nextErr);
  check('Test 4: valid webhook credits wallet + records one transaction', wallet?.balance === 100 && txns.length === 1);
}

// ─── 5. Amount-parity mismatch rejected; payment NOT completed ────────────────
{
  const user = await makeUser('client', 'wh5');
  const ref = 'REF_MISMATCH';
  await Payment.create({
    payer: user._id,
    type: 'deposit',
    amount: 100,
    currency: 'ETB',
    netAmount: 100,
    status: 'pending',
    provider: 'telebirr',
    providerTransactionRef: ref,
    reference: ref,
    description: 'Wallet deposit via Telebirr',
  });

  const payload = { outTradeNo: ref, status: 'success', amount: 999 }; // wrong amount
  const sig = computeHmacPayload(payload, process.env.TELEBIRR_WEBHOOK_SECRET);

  const res = makeRes();
  let nextErr = null;
  await telebirrWebhook({ body: payload, headers: { 'x-signature': sig } }, res, (e) => { nextErr = e; });
  await flush();

  const payment = await Payment.findOne({ providerTransactionRef: ref });
  const wallet = await Wallet.findOne({ user: user._id });
  const txns = await Transaction.find({ user: user._id, type: 'deposit' });

  check('Test 5: mismatch webhook rejected with 409', nextErr?.statusCode === 409);
  check('Test 5: mismatched webhook does NOT complete or credit the payment',
    payment?.status === 'pending' && (wallet?.balance || 0) === 0 && txns.length === 0);
}

// ─── 6-8. JWT production guard (child processes) ──────────────────────────────
{
  const weak = 'your_super_secret_access_token_key_min_64_chars';
  const bland = 'A'.repeat(64);

  const prodEnv = (access, refresh) => ({
    NODE_ENV: 'production',
    MONGODB_URI: TEST_DB_URI,
    JWT_ACCESS_SECRET: access,
    JWT_REFRESH_SECRET: refresh,
    EMAIL_USER: 'test@skillhub.test',
    EMAIL_PASSWORD: 'test-password',
  });

  const weakRun = await runChild('jwt-weak', ['-e', "import('./src/config/env.js')"], prodEnv(weak, 'B'.repeat(64)));
  const identicalRun = await runChild('jwt-identical', ['-e', "import('./src/config/env.js')"], prodEnv(bland, bland));
  const strongRun = await runChild('jwt-strong', ['-e', "console.log('BOOT_OK');import('./src/config/env.js')"], prodEnv(crypto.randomBytes(64).toString('hex'), crypto.randomBytes(64).toString('hex')));

  check('Test 6: JWT prod guard rejects placeholder/weak secret', weakRun.code !== 0);
  check('Test 7: JWT prod guard rejects identical access/refresh secrets', identicalRun.code !== 0);
  check('Test 8: JWT prod guard accepts strong unique secrets', strongRun.code === 0 && strongRun.out.includes('BOOT_OK'));
}

// ─── 9. Refresh refresh token rate limit ──────────────────────────────────────
{
  const app = express();
  app.get('/refresh', refreshLimiter, (req, res) => res.json({ ok: true }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const port = server.address().port;

  let ok = 0;
  let blocked = null;
  for (let i = 0; i < 16; i++) {
    const res = await fetch(`http://localhost:${port}/refresh`);
    if (res.status === 200) ok++;
    else if (res.status === 429 && blocked === null) blocked = i + 1;
  }
  server.close();
  check('Test 9: refresh limiter allows 15 then blocks (429 on request 16)', ok === 15 && blocked === 16);
}

// ─── 10. Code-review privacy: 404 unless public + sensitive fields stripped ────
{
  const owner = await makeUser('freelancer', 'cr10');
  const reviewer = await makeUser('client', 'cr10b');

  const createReview = async (isPublic) =>
    CodeReview.create({
      user: owner._id,
      inputType: 'code_paste',
      status: 'completed',
      isPublic,
      pastedCode: 'const x = 1; // SECRET SOURCE',
      githubUrl: 'https://github.com/priv',
      sourceFiles: [{ fileName: 'a.js', url: 'https://res.cloudinary.com/secret', publicId: 'pv' }],
      overallScore: 80,
      fileAnalyses: [{
        fileName: 'a.js',
        language: 'javascript',
        fileSize: 10,
        lineCount: 1,
        issues: [{ category: 'security', severity: 'high', line: 1, message: 'unsafe', suggestion: 'fix it', codeSnippet: 'const x = 1;', fixSnippet: 'const y = 2;' }],
      }],
    });

  const privReview = await createReview(false);
  const res1 = makeRes();
  let nextErr1 = null;
  await getPublicReview({ params: { reviewId: privReview._id.toString() }, user: null }, res1, (e) => { nextErr1 = e; });
  await flush();

  const pubReview = await createReview(true);
  const res2 = makeRes();
  let nextErr2 = null;
  await getPublicReview({ params: { reviewId: pubReview._id.toString() }, user: null }, res2, (e) => { nextErr2 = e; });
  const data = res2.body?.data || {};

  const issue = data.fileAnalyses?.[0]?.issues?.[0] || {};
  const leaked = data.pastedCode !== undefined || data.sourceFiles !== undefined ||
    data.githubUrl !== undefined || issue.suggestion !== undefined ||
    issue.codeSnippet !== undefined || issue.fixSnippet !== undefined;

  check('Test 10: private (non-public) review returns 404 to anonymous', nextErr1?.statusCode === 404);
  check('Test 10: public review strips source code, snippets and fix suggestions', !nextErr2 && !leaked);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\n[Workflow 11-16]');
// ─── 11-13. State machine ─────────────────────────────────────────────────────
{
  let valid = false;
  try { assertProjectTransition('active', 'pending_delivery'); valid = true; } catch {}
  check('Test 11: state machine allows valid transition (active → pending_delivery)', valid);

  let invalid = false;
  let msg = '';
  try { assertProjectTransition('cancelled', 'active'); } catch (e) { invalid = e?.statusCode === 400; msg = e?.message; }
  check('Test 12: state machine rejects illegal transition (cancelled → active)', invalid);

  const terminal = ['completed', 'cancelled'].every((s) => {
    try { assertProjectTransition(s, 'pending_payment'); return false; } catch { return true; }
  });
  check('Test 13: terminal states cannot be exited', terminal);
}

// ─── 14. Refund leaves terminal project untouched ─────────────────────────────
{
  const client = await makeUser('client', 'wf14c');
  const freelancer = await makeUser('freelancer', 'wf14f');
  const job = await Job.create({
    client: client._id,
    title: 'Build a test app',
    description: 'Test job',
    requiredSkills: ['nodejs'],
    budget: { type: 'fixed', maxAmount: 100, currency: 'ETB' },
    deadline: futureDate(),
    experienceLevel: 'expert',
    category: new mongoose.Types.ObjectId(),
  });
  const project = await makeProject(client, freelancer, 'completed', { job: job._id });

  await propagateRefund({
    projectId: project._id,
    paymentId: project.escrowPaymentId,
    amount: 100,
    currency: 'ETB',
    clientId: client._id,
    reason: 'test',
  });

  const after = await Project.findById(project._id);
  const afterJob = await Job.findById(job._id);
  check('Test 14: refund does NOT rewind a completed project', after?.status === 'completed');
  check('Test 14: refund does NOT touch a completed job', afterJob?.status === 'open');
}

// ─── 15. Funding refuses terminal project ─────────────────────────────────────
{
  const client = await makeUser('client', 'wf15c');
  const freelancer = await makeUser('freelancer', 'wf15f');
  const cancelled = await makeProject(client, freelancer, 'cancelled');

  await propagateFunding({ projectId: cancelled._id, paymentId: new mongoose.Types.ObjectId() });

  const after = await Project.findById(cancelled._id);
  check('Test 15: funding cannot re-activate a cancelled project', after?.status === 'cancelled');
}

// ─── 16. Release completes only from valid (non-terminal) state ───────────────
{
  const client = await makeUser('client', 'wf16c');
  const freelancer = await makeUser('freelancer', 'wf16f');
  const project = await makeProject(client, freelancer, 'pending_delivery');
  const project2 = await makeProject(client, freelancer, 'completed');

  await propagateRelease({ projectId: project._id, amount: 100 });
  const completed = await Project.findById(project._id);
  const stillTerminal = await Project.findById(project2._id);

  check('Test 16: release completes a valid pending_delivery project', completed?.status === 'completed');
  check('Test 16: release leaves an already-terminal project untouched (status + totals)',
    stillTerminal?.status === 'completed' && (stillTerminal.budget.paidAmount || 0) === 0);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\n[Financial 17-20]');
// ─── 17. Insufficient funds → error, no mutation ──────────────────────────────
{
  const user = await makeUser('client', 'fi17');
  await Wallet.create({ user: user._id, balance: 50, escrowBalance: 0 });
  const err = await assertRejects(() => debitWallet(user._id, 100), 400, 'insufficient');
  const w = await Wallet.findOne({ user: user._id });
  check('Test 17: debitWallet rejects when balance insufficient and mutates nothing', err?.statusCode === 400 && w.balance === 50);
}

// ─── 18. Sufficient funds → atomic debit ──────────────────────────────────────
{
  const user = await makeUser('client', 'fi18');
  await Wallet.create({ user: user._id, balance: 200, escrowBalance: 0 });
  await debitWallet(user._id, 150);
  const w = await Wallet.findOne({ user: user._id });
  check('Test 18: debitWallet decrements balance + totalSpent atomically', w.balance === 50 && w.totalSpent === 150);
}

// ─── 19. Escrow hold locks funds, honoring available balance ──────────────────
{
  const user = await makeUser('client', 'fi19');
  await Wallet.create({ user: user._id, balance: 100, escrowBalance: 30 });
  await holdEscrow(user._id, 40); // available = 70 ≥ 40
  const w = await Wallet.findOne({ user: user._id });
  let overHold = null;
  try { await holdEscrow(user._id, 41); } catch (e) { overHold = e?.statusCode; } // available now 30 < 41
  const w2 = await Wallet.findOne({ user: user._id });
  check('Test 19: holdEscrow respects available balance (balance - escrow)',
    w.escrowBalance === 70 && overHold === 400 && w2.escrowBalance === 70);
}

// ─── 20. Concurrent debits never drive balance negative ───────────────────────
{
  const user = await makeUser('client', 'fi20');
  await Wallet.create({ user: user._id, balance: 100, escrowBalance: 0 });

  const attempts = Array.from({ length: 50 }, () => debitWallet(user._id, 25).catch(() => null));
  const results = await Promise.all(attempts);
  const successes = results.filter((r) => r !== null).length;

  const w = await Wallet.findOne({ user: user._id });
  check('Test 20: concurrent debits cap at available balance (4 ok, rest fail, never negative)',
    successes === 4 && w.balance === 0 && w.balance >= 0);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\n[DB Safety 21-23]');
// ─── 21-22. Destructive script guard ──────────────────────────────────────────
{
  const prodRun = await runChild('guard-prod', ['-e', "import('./src/scripts/_guard.mjs').then(m => m.assertSafeToRun('x'))"], { NODE_ENV: 'production' });
  const flagRun = await runChild('guard-noflag', ['-e', "import('./src/scripts/_guard.mjs').then(m => m.assertSafeToRun('x'))"], { NODE_ENV: 'test' });
  check('Test 21: destructive scripts refuse to run in production', prodRun.code === 1);
  check('Test 22: destructive scripts require ALLOW_DB_MUTATION=true', flagRun.code === 1);
}

// ─── 23. walletDiagnostic is read-only (exit 0 on consistent, no mutation) ───
// Runs against a DEDICATED diagnostic DB so wallets from other tests (which
// legitimately lack a matching transaction ledger) don't trigger drift.
{
  const DIAG_DB_URI = 'mongodb://localhost:27017/skillhub_diag_test';
  const diagConn = await mongoose.createConnection(DIAG_DB_URI).asPromise();
  await diagConn.dropDatabase();

  const db = diagConn.db;
  const userObjectId = new mongoose.Types.ObjectId();
  const walletId = new mongoose.Types.ObjectId();

  await db.collection('wallets').insertOne({
    _id: walletId,
    user: userObjectId,
    balance: 100,
    escrowBalance: 60,
    totalSpent: 0,
    totalEarned: 0,
  });
  const txnBase = {
    user: userObjectId,
    wallet: walletId,
    status: 'completed',
    currency: 'ETB',
    fee: 0,
    description: 'diag test',
    externalReference: '',
    metadata: {},
    failureReason: '',
  };
  await db.collection('transactions').insertOne({
    ...txnBase,
    type: 'deposit',
    amount: 100,
    netAmount: 100,
    reference: 'DT1',
    balanceBefore: 0,
    balanceAfter: 100,
    createdAt: new Date(1),
    updatedAt: new Date(1),
  });
  await db.collection('transactions').insertOne({
    ...txnBase,
    type: 'escrow_hold',
    amount: 60,
    netAmount: 60,
    reference: 'DT2',
    balanceBefore: 100,
    balanceAfter: 100,
    createdAt: new Date(2),
    updatedAt: new Date(2),
  });

  const before = await db.collection('wallets').find({}).toArray();
  const diagRun = await runChild('wallet-diag', ['walletDiagnostic.mjs'], { NODE_ENV: 'test', MONGODB_URI: DIAG_DB_URI });
  const after = await db.collection('wallets').find({}).toArray();

  if (diagRun.code !== 0) {
    console.log('  [DEBUG Test 23] exit:', diagRun.code);
    console.log('  [DEBUG Test 23] stdout:', diagRun.out);
    console.log('  [DEBUG Test 23] stderr:', diagRun.err);
  }
  const snapshot = (rows) => rows.map((r) => `${r._id}:${r.balance}:${r.escrowBalance}:${r.totalSpent}`).sort().join('|');
  check('Test 23: walletDiagnostic exits 0 on consistent ledger', diagRun.code === 0);
  check('Test 23: walletDiagnostic does not mutate any wallet', snapshot(before) === snapshot(after));
  await diagConn.dropDatabase();
  await diagConn.close();
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\n[Frontend 24-25]');
// ─── 24. OrderCard has no silent error catch ──────────────────────────────────
{
  const file = path.join(FRONTEND, 'src/components/orders/OrderCard.jsx');
  const src = fs.readFileSync(file, 'utf8');
  const hasToastHandling = src.includes('toast.error') && !/\bcatch\s*\(\s*_\s*\)\s*\{\s*\}/.test(src);
  check('Test 24: OrderCard message-start failure surfaces a toast (no silent catch)', hasToastHandling);
}

// ─── 25. Catalog share handlers do not show misleading load errors ────────────
{
  const p1 = fs.readFileSync(path.join(FRONTEND, 'src/pages/catalogs/MyCatalogsPage.jsx'), 'utf8');
  const p2 = fs.readFileSync(path.join(FRONTEND, 'src/pages/catalogs/CatalogDetailPage.jsx'), 'utf8');
  const noMisleading = !p1.includes("toast.error('Failed to load catalogs')") &&
    !p2.includes("toast.error('Failed to load catalog')");
  const shareHandled = p1.includes('Unable to share or copy the service link') &&
    p2.includes('Unable to share or copy the service link');
  check('Test 25: catalog share failures show correct error (no misleading load toast)', noMisleading && shareHandled);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\n[Security 26-30]');
// ─── 26. Telebirr replay never double-credits ────────────────────────────────
{
  const user = await makeUser('client', 'rp26');
  const ref = 'REF_REPLAY';
  await Payment.create({
    payer: user._id, type: 'deposit', amount: 100, currency: 'ETB', netAmount: 100,
    status: 'pending', provider: 'telebirr', providerTransactionRef: ref, reference: ref,
    description: 'Wallet deposit via Telebirr',
  });
  const payload = { outTradeNo: ref, status: 'success', amount: 100 };
  const sig = computeHmacPayload(payload, process.env.TELEBIRR_WEBHOOK_SECRET);
  const hit = async () => {
    const res = makeRes(); let e = null;
    await telebirrWebhook({ body: payload, headers: { 'x-signature': sig } }, res, (err) => { e = err; });
    await flush();
    return e;
  };
  const e1 = await hit();
  const e2 = await hit();
  const payment = await Payment.findOne({ providerTransactionRef: ref });
  const wallet = await Wallet.findOne({ user: user._id });
  const txns = await Transaction.find({ user: user._id, type: 'deposit' });
  check('Test 26: replayed Telebirr webhook never double-credits',
    !e1 && !e2 && payment?.status === 'completed' && wallet?.balance === 100 && txns.length === 1);
}

// ─── 27. CBE Birr valid webhook credits exactly once ─────────────────────────
{
  const user = await makeUser('client', 'rp27');
  const ref = 'REF_CBE_GOOD';
  await Payment.create({
    payer: user._id, type: 'deposit', amount: 100, currency: 'ETB', netAmount: 100,
    status: 'pending', provider: 'cbe_birr', providerTransactionRef: ref, reference: ref,
    description: 'Wallet deposit via CBE Birr',
  });
  const payload = { referenceId: ref, status: 'success', amount: 100 };
  const sig = computeHmacPayload(payload, process.env.CBE_BIRR_WEBHOOK_SECRET);
  const res = makeRes();
  let nextErr = null;
  await cbeBirrWebhook({ body: payload, headers: { 'x-signature': sig } }, res, (e) => { nextErr = e; });
  await flush();
  const payment = await Payment.findOne({ providerTransactionRef: ref });
  const wallet = await Wallet.findOne({ user: user._id });
  const txns = await Transaction.find({ user: user._id, type: 'deposit' });
  check('Test 27: CBE Birr valid webhook completes + credits once',
    payment?.status === 'completed' && !nextErr && wallet?.balance === 100 && txns.length === 1);
}

// ─── 28. CBE Birr replay never double-credits ────────────────────────────────
{
  const user = await makeUser('client', 'rp28');
  const ref = 'REF_CBE_REPLAY';
  await Payment.create({
    payer: user._id, type: 'deposit', amount: 100, currency: 'ETB', netAmount: 100,
    status: 'pending', provider: 'cbe_birr', providerTransactionRef: ref, reference: ref,
    description: 'Wallet deposit via CBE Birr',
  });
  const payload = { referenceId: ref, status: 'success', amount: 100 };
  const sig = computeHmacPayload(payload, process.env.CBE_BIRR_WEBHOOK_SECRET);
  const hit = async () => {
    const r = makeRes(); let e = null;
    await cbeBirrWebhook({ body: payload, headers: { 'x-signature': sig } }, r, (err) => { e = err; });
    await flush();
    return e;
  };
  const e1 = await hit();
  const e2 = await hit();
  const payment = await Payment.findOne({ providerTransactionRef: ref });
  const wallet = await Wallet.findOne({ user: user._id });
  const txns = await Transaction.find({ user: user._id, type: 'deposit' });
  check('Test 28: replayed CBE Birr webhook never double-credits',
    !e1 && !e2 && payment?.status === 'completed' && wallet?.balance === 100 && txns.length === 1);
}

// ─── 29. JWT missing secrets block production startup ────────────────────────
{
  const missingRun = await runChild('jwt-missing', ['-e', "import('./src/config/env.js')"], {
    NODE_ENV: 'production',
    MONGODB_URI: TEST_DB_URI,
    EMAIL_USER: 'test@skillhub.test',
    EMAIL_PASSWORD: 'test-password',
  });
  check('Test 29: JWT prod guard fails startup when secrets are missing', missingRun.code !== 0);
}

// ─── 30. Code-review access matrix (non-owner 404, owner 200) ────────────────
{
  const owner = await makeUser('freelancer', 'cr30o');
  const intruder = await makeUser('client', 'cr30x');
  const review = await CodeReview.create({
    user: owner._id,
    inputType: 'code_paste',
    status: 'completed',
    isPublic: false,
    pastedCode: 'const secret = 1; // SECRET SOURCE',
    githubUrl: 'https://github.com/priv',
    sourceFiles: [{ fileName: 'a.js', url: 'https://res.cloudinary.com/secret', publicId: 'pv' }],
    overallScore: 90,
    fileAnalyses: [{
      fileName: 'a.js', language: 'javascript', fileSize: 10, lineCount: 1,
      issues: [{ category: 'security', severity: 'high', line: 1, message: 'unsafe', suggestion: 'fix', codeSnippet: 'x', fixSnippet: 'y' }],
    }],
  });
  const id = review._id.toString();
  const resBad = makeRes();
  let errBad = null;
  await getPublicReview({ params: { reviewId: id }, user: { _id: intruder._id, role: 'client' } }, resBad, (e) => { errBad = e; });
  await flush();
  const resOwner = makeRes();
  let errOwner = null;
  await getPublicReview({ params: { reviewId: id }, user: { _id: owner._id, role: 'freelancer' } }, resOwner, (e) => { errOwner = e; });
  await flush();
  check('Test 30: non-owner user cannot read a private review (404)', errBad?.statusCode === 404);
  check('Test 30: owner can read their own private review (200)', !errOwner && resOwner.statusCode === 200);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\n[Escrow Atomicity 31-34]');
// ─── 31. Release success → escrow released, freelancer credited, project done ─
{
  const client = await makeUser('client', 'esc31c');
  const freelancer = await makeUser('freelancer', 'esc31f');
  await Wallet.create({ user: client._id, balance: 200, escrowBalance: 100, totalSpent: 0 });
  await Wallet.create({ user: freelancer._id, balance: 0, escrowBalance: 0, totalEarned: 0 });
  const project = await makeProject(client, freelancer, 'pending_delivery');
  const escrow = await makeEscrow(client, freelancer, project, null);

  await releaseEscrowFunds(escrow._id.toString(), client._id);
  const e = await Escrow.findById(escrow._id);
  const fw = await Wallet.findOne({ user: freelancer._id });
  const cw = await Wallet.findOne({ user: client._id });
  const proj = await Project.findById(project._id);
  check('Test 31: release success → escrow released + freelancer credited + project completed',
    e.status === 'released' && fw.balance === 90 && fw.totalEarned === 90 &&
    cw.escrowBalance === 0 && cw.balance === 100 && cw.totalSpent === 100 &&
    proj.status === 'completed');
}

// ─── 32. Release failure (insufficient escrow) → nothing moves ───────────────
{
  const client = await makeUser('client', 'esc32c');
  const freelancer = await makeUser('freelancer', 'esc32f');
  await Wallet.create({ user: client._id, balance: 200, escrowBalance: 0, totalSpent: 0 });
  await Wallet.create({ user: freelancer._id, balance: 0, escrowBalance: 0, totalEarned: 0 });
  const project = await makeProject(client, freelancer, 'pending_delivery');
  const escrow = await makeEscrow(client, freelancer, project, null);

  const err = await assertRejects(() => releaseEscrowFunds(escrow._id.toString(), client._id), 400, 'insufficient escrow');
  const e = await Escrow.findById(escrow._id);
  const fw = await Wallet.findOne({ user: freelancer._id });
  const cw = await Wallet.findOne({ user: client._id });
  const proj = await Project.findById(project._id);
  check('Test 32: release failure leaves escrow funded, project pending_delivery, nobody credited',
    err?.statusCode === 400 && e.status === 'funded' && fw.balance === 0 && cw.balance === 200 &&
    cw.escrowBalance === 0 && proj.status === 'pending_delivery');
}

// ─── 33. Already-released escrow rejects a second release ────────────────────
{
  const client = await makeUser('client', 'esc33c');
  const freelancer = await makeUser('freelancer', 'esc33f');
  await Wallet.create({ user: client._id, balance: 200, escrowBalance: 100, totalSpent: 0 });
  await Wallet.create({ user: freelancer._id, balance: 0, escrowBalance: 0, totalEarned: 0 });
  const project = await makeProject(client, freelancer, 'pending_delivery');
  const escrow = await makeEscrow(client, freelancer, project, null);

  await releaseEscrowFunds(escrow._id.toString(), client._id);
  const err = await assertRejects(() => releaseEscrowFunds(escrow._id.toString(), client._id), 400, 'double release');
  const fw = await Wallet.findOne({ user: freelancer._id });
  const clientTxns = await Transaction.find({ user: client._id, type: 'escrow_release' });
  check('Test 33: already-released escrow rejects second release with no extra credit',
    err?.statusCode === 400 && fw.balance === 90 && clientTxns.length === 1);
}

// ─── 34. Order completion never regresses a terminal project / double-credits ─
{
  const client = await makeUser('client', 'esc34c');
  const freelancer = await makeUser('freelancer', 'esc34f');
  await Wallet.create({ user: client._id, balance: 200, escrowBalance: 100, totalSpent: 0 });
  await Wallet.create({ user: freelancer._id, balance: 0, escrowBalance: 0, totalEarned: 0 });
  const project = await makeProject(client, freelancer, 'completed');
  const escrow = await makeEscrow(client, freelancer, project, null);
  const order = await ServiceOrder.create({
    service: new mongoose.Types.ObjectId(),
    client: client._id,
    freelancer: freelancer._id,
    tier: { name: 'basic', title: 'Basic', price: 100 },
    budget: { amount: 100, currency: 'ETB' },
    title: 'Test order',
    status: 'delivered',
    escrow: escrow._id,
    project: project._id,
  });

  await completeServiceOrder({ orderId: order._id.toString(), clientId: client._id });
  const o = await ServiceOrder.findById(order._id);
  const proj = await Project.findById(project._id);
  const fw = await Wallet.findOne({ user: freelancer._id });
  check('Test 34: order completes even when project is already completed (no terminal regression)',
    o.status === 'completed' && proj.status === 'completed' && fw.balance === 90);

  const err2 = await assertRejects(() => completeServiceOrder({ orderId: order._id.toString(), clientId: client._id }), 400, 'already completed');
  const fw2 = await Wallet.findOne({ user: freelancer._id });
  check('Test 34: repeated completion is rejected and never double-credits', err2?.statusCode === 400 && fw2.balance === 90);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\n[AI Access 35-36]');
// ─── 35-36. getSmartReplies IDOR guard ───────────────────────────────────────
{
  const a = await makeUser('client', 'ai35a');
  const b = await makeUser('freelancer', 'ai35b');
  const outsider = await makeUser('client', 'ai35x');
  const conv = await Conversation.create({
    participants: [a._id, b._id],
    type: 'project',
    unreadCounts: [{ user: a._id, count: 0 }, { user: b._id, count: 0 }],
  });

  const res1 = makeRes();
  let notFound = null;
  await getSmartReplies(
    { body: { messageText: 'hi', conversationId: new mongoose.Types.ObjectId().toString() }, user: { _id: a._id } },
    res1, (e) => { notFound = e; }
  );
  await flush();
  check('Test 35: getSmartReplies returns 404 for nonexistent conversation', notFound?.statusCode === 404);

  const res2 = makeRes();
  let forbidden = null;
  await getSmartReplies(
    { body: { messageText: 'hi', conversationId: conv._id.toString() }, user: { _id: outsider._id } },
    res2, (e) => { forbidden = e; }
  );
  await flush();
  check('Test 36: getSmartReplies rejects non-participant with 403', forbidden?.statusCode === 403);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\n[DB Diagnostic Repair 37-38]');
// ─── 37-38. walletDiagnostic dry-run + guarded repair ───────────────────────
{
  const DIAG_DB_URI = 'mongodb://localhost:27017/skillhub_diag_repair_test';
  const diagConn = await mongoose.createConnection(DIAG_DB_URI).asPromise();
  await diagConn.dropDatabase();
  const db = diagConn.db;
  const userObjectId = new mongoose.Types.ObjectId();
  const walletId = new mongoose.Types.ObjectId();
  await db.collection('wallets').insertOne({
    _id: walletId, user: userObjectId, balance: 100, escrowBalance: 0, totalSpent: 0, totalEarned: 0,
  });
  await db.collection('transactions').insertOne({
    user: userObjectId, wallet: walletId, status: 'completed', currency: 'ETB', fee: 0,
    description: 'diag repair', metadata: {}, externalReference: '', failureReason: '',
    type: 'deposit', amount: 150, netAmount: 150, reference: 'DR1',
    balanceBefore: 0, balanceAfter: 150, createdAt: new Date(1), updatedAt: new Date(1),
  });

  const dryRun = await runChild('wallet-diag-dry', ['walletDiagnostic.mjs'], { NODE_ENV: 'test', MONGODB_URI: DIAG_DB_URI });
  const afterDry = await db.collection('wallets').findOne({ _id: walletId });
  check('Test 37: walletDiagnostic dry-run reports drift (exit 1) without mutating',
    dryRun.code === 1 && dryRun.out.includes('[DRIFT]') && afterDry.balance === 100);

  const blocked = await runChild('wallet-diag-repair-blocked', ['walletDiagnostic.mjs', '--repair'], { NODE_ENV: 'test', MONGODB_URI: DIAG_DB_URI });
  const afterBlocked = await db.collection('wallets').findOne({ _id: walletId });
  const blockedOut = blocked.out + blocked.err;
  check('Test 37: walletDiagnostic --repair refuses without ALLOW_DB_MUTATION',
    blocked.code === 1 && blockedOut.includes('ALLOW_DB_MUTATION') && afterBlocked.balance === 100);

  const repaired = await runChild('wallet-diag-repair', ['walletDiagnostic.mjs', '--repair'], { NODE_ENV: 'test', MONGODB_URI: DIAG_DB_URI, ALLOW_DB_MUTATION: 'true' });
  const afterRepair = await db.collection('wallets').findOne({ _id: walletId });
  const txCount = await db.collection('transactions').countDocuments({});
  check('Test 38: walletDiagnostic --repair heals drift only with explicit flag',
    repaired.code === 0 && afterRepair.balance === 150);
  check('Test 38: repair never deletes transaction history', txCount === 1);

  await diagConn.dropDatabase();
  await diagConn.close();
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
await mongoose.connection.dropDatabase();
await mongoose.disconnect();

console.log(`\n${'-'.repeat(60)}`);
console.log(`Result: ${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('All tests passed.');