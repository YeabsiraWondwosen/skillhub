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

const adminEmail = process.env.ADMIN_EMAIL || 'admin@skillhub.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
const adminFirstName = process.env.ADMIN_FIRST_NAME || 'Admin';
const adminLastName = process.env.ADMIN_LAST_NAME || 'User';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['freelancer', 'client', 'admin'], required: true, default: 'client' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    avatar: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
    isEmailVerified: { type: Boolean, default: false },
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

async function seedAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save({ validateBeforeSave: false });
        console.log(`Updated existing user "${adminEmail}" to admin role.`);
      } else {
        console.log(`Admin user "${adminEmail}" already exists. Skipping.`);
      }
    } else {
      await User.create({
        firstName: adminFirstName,
        lastName: adminLastName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        isEmailVerified: true,
        isActive: true,
      });
      console.log(`Admin user created successfully!`);
    }

    // Enforce a single admin: demote any other admin accounts (e.g. stale dev/test admins)
    const demoted = await User.updateMany(
      { role: 'admin', email: { $ne: adminEmail } },
      { $set: { role: 'client' } }
    );
    if (demoted.modifiedCount > 0) {
      console.log(`Demoted ${demoted.modifiedCount} other admin account(s) to client role.`);
    }

    console.log(`\nLogin credentials:\n  Email: ${adminEmail}\n  Password: ${adminPassword}\n`);

    await mongoose.disconnect();
    console.log('Done.');
  } catch (error) {
    console.error('Seed failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedAdmin();
