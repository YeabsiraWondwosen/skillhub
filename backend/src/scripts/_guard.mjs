/**
 * Safe environment guard for destructive database scripts.
 *
 * Every script that may mutate or delete records MUST call assertSafeToRun()
 * before touching any collection. Without this guard the script refuses to run.
 *
 * Usage:
 *   import { assertSafeToRun } from './_guard.mjs';
 *   await assertSafeToRun('wallet-repair');
 *   // ... safe to proceed
 */
import mongoose from 'mongoose';

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * @param {string} taskName human-readable name of the operation (for logs)
 */
export const assertSafeToRun = async (taskName) => {
  if (isProduction()) {
    console.error(
      `[BLOCKED] ${taskName}: Refusing to run in production (NODE_ENV=${process.env.NODE_ENV}). ` +
      `This script mutates database records and must only run in development or test environments. ` +
      `To override in development, set ALLOW_DB_MUTATION=true.`
    );
    process.exit(1);
  }

  if (process.env.ALLOW_DB_MUTATION !== 'true') {
    console.error(
      `[BLOCKED] ${taskName}: ALLOW_DB_MUTATION is not set to 'true'. ` +
      `Set ALLOW_DB_MUTATION=true to explicitly acknowledge that this script may modify database records.`
    );
    process.exit(1);
  }

  console.log(`[GUARD] ${taskName}: Environment and mutation guard passed.`);
};

/**
 * Connect to the database for diagnostic scripts. Defaults to SkillHub
 * (the same database as the running backend).
 */
export const connectToDatabase = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/SkillHub';
  await mongoose.connect(uri);
  console.log(`[DB] Connected to ${uri}`);
};

export const disconnect = async () => {
  await mongoose.disconnect();
  console.log('[DB] Disconnected');
};
