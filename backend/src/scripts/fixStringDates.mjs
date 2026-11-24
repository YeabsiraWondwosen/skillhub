import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertSafeToRun } from './_guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

await assertSafeToRun('fix-string-dates');
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const collections = await db.listCollections().toArray();

let totalFixed = 0;

for (const c of collections) {
  const col = db.collection(c.name);
  const stringDocs = await col
    .find({ $or: [{ createdAt: { $type: 'string' } }, { updatedAt: { $type: 'string' } }] })
    .toArray();

  if (stringDocs.length === 0) continue;

  let fixed = 0;
  for (const doc of stringDocs) {
    const update = {};
    if (typeof doc.createdAt === 'string') {
      const d = new Date(doc.createdAt);
      if (!isNaN(d.getTime())) {
        update.createdAt = d;
      } else {
        console.warn(`  invalid createdAt "${doc.createdAt}" in ${c.name}/${doc._id}`);
      }
    }
    if (typeof doc.updatedAt === 'string') {
      const d = new Date(doc.updatedAt);
      if (!isNaN(d.getTime())) {
        update.updatedAt = d;
      } else {
        console.warn(`  invalid updatedAt "${doc.updatedAt}" in ${c.name}/${doc._id}`);
      }
    }
    if (Object.keys(update).length > 0) {
      await col.updateOne({ _id: doc._id }, { $set: update });
      fixed++;
    }
  }
  if (fixed > 0) {
    totalFixed += fixed;
    console.log(`${c.name}: fixed ${fixed} doc(s)`);
  }
}

console.log(`\nDone. Total docs fixed: ${totalFixed}`);
await mongoose.disconnect();
