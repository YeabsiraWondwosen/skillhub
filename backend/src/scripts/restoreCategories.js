import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import { assertSafeToRun } from './_guard.mjs';

const BACKUP = process.env.RESTORE_BACKUP || 'C:/Users/DEll/AppData/Local/Temp/opencode/backup.json';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/SkillHub';

const ID_FIELDS = new Set([
  '_id', 'parent', 'category', 'categories', 'user', 'userId', 'job', 'jobId',
  'freelancer', 'employer', 'author', 'creator', 'createdBy', 'primaryCategory',
  'profileId', 'testId', 'skillId', 'applicationId', 'creatorId', 'receiver',
]);

const isObjectIdHex = (v) => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v);

function convertIds(node) {
  if (Array.isArray(node)) {
    return node.map((item) => convertIds(item));
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (ID_FIELDS.has(k)) {
        if (Array.isArray(v)) {
          out[k] = v.map((x) => (isObjectIdHex(x) ? new mongoose.Types.ObjectId(x) : x));
        } else if (isObjectIdHex(v)) {
          out[k] = new mongoose.Types.ObjectId(v);
        } else {
          out[k] = v;
        }
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return node;
}

async function main() {
  await assertSafeToRun('restore-categories');
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  let raw = fs.readFileSync(BACKUP);
  if (raw[0] === 0xff && raw[1] === 0xfe) raw = raw.subarray(2);
  const text = raw.toString('utf16le');
  const lines = text.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    const { collection, docs } = JSON.parse(line);
    if (!collection || !Array.isArray(docs)) continue;
    const coll = db.collection(collection);
    await coll.deleteMany({});
    if (docs.length) {
      const converted = docs.map((d) => convertIds(d));
      await coll.insertMany(converted, { ordered: false });
    }
    console.log(`Restored ${collection}: ${docs.length} docs`);
  }
  console.log('Restore complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Restore failed:', err.message);
  process.exit(1);
});
