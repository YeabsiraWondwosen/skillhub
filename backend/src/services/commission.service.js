import { Transaction } from '../models/index.js';
import { resolveCommissionSnapshot } from '../utils/helpers.js';

export { resolveCommissionSnapshot };

/**
 * Efficient, idempotent commission ledger writer.
 *
 * The commission rate is snapshotted per source (escrow / milestone / job) at
 * funding time. When a release is replayed (retry, duplicate webhook, admin
 * action after a partial failure) we must not create a second commission row,
 * so the reference is deterministic for the source and the write is an upsert.
 */
export const commissionReference = (scopeKey) => `COMM-${scopeKey}`;

export const recordCommissionTransaction = async ({ scopeKey, fields }, opts = {}) => {
  const reference = `COMM-${scopeKey}`;
  return Transaction.findOneAndUpdate(
    { reference },
    { $setOnInsert: { ...fields, reference } },
    { upsert: true, new: true, ...opts }
  );
};
