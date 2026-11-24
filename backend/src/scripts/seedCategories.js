import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

console.log('Connecting to MongoDB...');
await mongoose.connect(MONGODB_URI);
console.log('Connected.\n');

const { seedDefaultCategories } = await import('../services/category.service.js');

const result = await seedDefaultCategories(true);

console.log('\n=== SEED RESULT ===');
console.log('Mains created/updated:', result.created.mains, '/', result.updated.mains);
console.log('Subs  created/updated:', result.created.subs, '/', result.updated.subs);
console.log('Skills created/preserved:', result.skills.created, '/', result.skills.preserved);
console.log('Migration jobs/profiles updated:', result.migration.jobsUpdated, '/', result.migration.profilesUpdated);
console.log('Obsolete archived/removed:', result.archive.archived, '/', result.archive.removed);
console.log('Canonical structure: 5 mains × 10 subs =', result.mainCount, '×', result.subCount);

await mongoose.disconnect();
console.log('\nDone.');
