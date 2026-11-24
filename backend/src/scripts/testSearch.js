import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);

// Simulate what the controller does
const users = await mongoose.connection.db.collection('users').find(
  { firstName: { $exists: true, $ne: null, $ne: '' }, lastName: { $exists: true, $ne: null, $ne: '' } },
  { projection: { firstName: 1, lastName: 1, email: 1, role: 1, isOnline: 1 } }
).limit(30).toArray();

console.log('Raw users:', users.length);
users.forEach(u => console.log(`  ${u.firstName} ${u.lastName} (${u.role})`));

// Check profiles
const userIds = users.map(u => u._id);
const profiles = await mongoose.connection.db.collection('profiles').find(
  { user: { $in: userIds } },
  { projection: { user: 1, skills: 1, hourlyRate: 1 } }
).toArray();
console.log('\nProfiles found:', profiles.length);

// Check what Profile model name is
const collections = await mongoose.connection.db.listCollections().toArray();
console.log('\nCollections:', collections.map(c => c.name).join(', '));

await mongoose.disconnect();
