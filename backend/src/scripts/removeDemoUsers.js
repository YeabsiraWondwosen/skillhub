import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertSafeToRun } from './_guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

async function removeDemoUsers() {
  try {
    await assertSafeToRun('remove-demo-users');
    await mongoose.connect(process.env.MONGODB_URI);
    const result = await User.deleteMany({ email: { $regex: /@skillhub\.test$/ } });
    console.log(`Removed ${result.deletedCount} demo users`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Failed:', err.message);
    await mongoose.disconnect();
  }
}

removeDemoUsers();
