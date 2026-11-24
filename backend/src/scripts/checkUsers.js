import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);

const users = await mongoose.connection.db.collection('users').find(
  {
    firstName: { $exists: true, $ne: null, $ne: '' },
    lastName: { $exists: true, $ne: null, $ne: '' }
  },
  { projection: { firstName: 1, lastName: 1, email: 1, role: 1, isActive: 1 } }
).toArray();

console.log(`Users with valid names: ${users.length}`);
users.forEach(u => console.log(` - ${u.firstName} ${u.lastName} | ${u.role} | active: ${u.isActive}`));
await mongoose.disconnect();
