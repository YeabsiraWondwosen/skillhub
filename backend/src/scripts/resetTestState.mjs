import mongoose from 'mongoose';
import { assertSafeToRun } from './_guard.mjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/SkillHub';

const userSchema = new mongoose.Schema(
  {
    email: String,
    role: String,
    followersCount: Number,
    followingCount: Number,
  },
  { strict: false }
);
const User = mongoose.model('User', userSchema);

const notifSchema = new mongoose.Schema({}, { strict: false });
const Notification = mongoose.model('Notification', notifSchema);

const followSchema = new mongoose.Schema({}, { strict: false });
const Follow = mongoose.model('Follow', followSchema);

await assertSafeToRun('reset-test-state');
await mongoose.connect(MONGODB_URI);

const fatima = await User.findOne({ email: 'fatima@skillhub.com' });
if (!fatima) throw new Error('fatima not found');
const fatimaId = fatima._id;

const delNotifs = await Notification.deleteMany({ recipient: fatimaId });
const delFollows = await Follow.deleteMany({ following: fatimaId });
console.log(`deleted notifications for fatima: ${delNotifs.deletedCount}`);
console.log(`deleted follows -> fatima: ${delFollows.deletedCount}`);

const affectedEmails = ['fatima@skillhub.com', 'hana@skillhub.com', 'sara@skillhub.com', 'daniel@skillhub.com', 'yonas@skillhub.com'];
for (const email of affectedEmails) {
  const u = await User.findOne({ email });
  if (!u) continue;
  const followingCount = await Follow.countDocuments({ follower: u._id });
  await User.updateOne({ _id: u._id }, { followingCount });
}
const followersCount = await Follow.countDocuments({ following: fatimaId });
await User.updateOne({ _id: fatimaId }, { followersCount });
console.log(`fatima followersCount reset to ${followersCount}`);

const notifRemaining = await Notification.countDocuments({ recipient: fatimaId });
const followRemaining = await Follow.countDocuments({ following: fatimaId });
console.log(`after cleanup: notifications=${notifRemaining} follows->fatima=${followRemaining}`);

await mongoose.disconnect();
