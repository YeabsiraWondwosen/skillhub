import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
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

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['freelancer', 'client', 'admin'], required: true, default: 'client' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    avatar: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
    isEmailVerified: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    isVerifiedFreelancer: { type: Boolean, default: false },
    refreshTokens: [{ token: String, createdAt: Date, expiresAt: Date, userAgent: String, ip: String }],
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    stats: {
      totalEarnings: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      completedProjects: { type: Number, default: 0 },
      activeProjects: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 },
      responseTime: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('User', userSchema);

const DEMO_USERS = [
  { firstName: 'Abebe', lastName: 'Kebede', email: 'abebe@skillhub.com', role: 'freelancer' },
  { firstName: 'Fatima', lastName: 'Ahmed', email: 'fatima@skillhub.com', role: 'freelancer' },
  { firstName: 'Daniel', lastName: 'Tesfaye', email: 'daniel@skillhub.com', role: 'client' },
  { firstName: 'Hana', lastName: 'Mulugeta', email: 'hana@skillhub.com', role: 'freelancer' },
  { firstName: 'Yonas', lastName: 'Bekele', email: 'yonas@skillhub.com', role: 'client' },
  { firstName: 'Sara', lastName: 'Haile', email: 'sara@skillhub.com', role: 'freelancer' },
];

const DEFAULT_PASSWORD = 'Demo@12345';

async function seedDemoUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    let created = 0;
    let skipped = 0;

    for (const userData of DEMO_USERS) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        skipped++;
        continue;
      }

      await User.create({
        ...userData,
        password: DEFAULT_PASSWORD,
        isEmailVerified: true,
        isActive: true,
      });
      created++;
      console.log(`Created: ${userData.firstName} ${userData.lastName} (${userData.email}) [${userData.role}]`);
    }

    console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
    console.log(`All demo users share password: ${DEFAULT_PASSWORD}`);
    console.log('\nDemo accounts:');
    DEMO_USERS.forEach(u => {
      console.log(`  ${u.firstName} ${u.lastName} - ${u.email} (${u.role})`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Seed failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedDemoUsers();
