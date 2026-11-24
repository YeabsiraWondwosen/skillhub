import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

const warnIfMissing = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const paymentMode = process.env.PAYMENT_MODE || 'demo';

// Known weak / placeholder JWT secrets that must never be used in production.
// Detection is pattern-based (never echoed back to the caller). The real secret
// values are never logged or included in error messages.
const WEAK_SECRET_HINTS = [
  'change_this_in_production',
  'your_super_secret',
  'example',
  'placeholder',
  'changeme',
];

const JWT_MIN_SECRET_LENGTH = 48;

const hasWeakSecretHint = (secret) => {
  const lower = String(secret).toLowerCase();
  return WEAK_SECRET_HINTS.some((hint) => lower.includes(hint));
};

const validateJwtSecrets = () => {
  const access = process.env.JWT_ACCESS_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET;
  if (!access || !refresh) return;

  const problems = [];

  if (String(access).length < JWT_MIN_SECRET_LENGTH) {
    problems.push(`JWT_ACCESS_SECRET must be at least ${JWT_MIN_SECRET_LENGTH} characters`);
  }
  if (String(refresh).length < JWT_MIN_SECRET_LENGTH) {
    problems.push(`JWT_REFRESH_SECRET must be at least ${JWT_MIN_SECRET_LENGTH} characters`);
  }
  if (hasWeakSecretHint(access)) {
    problems.push('JWT_ACCESS_SECRET looks like a placeholder/default value');
  }
  if (hasWeakSecretHint(refresh)) {
    problems.push('JWT_REFRESH_SECRET looks like a placeholder/default value');
  }
  if (access === refresh) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
  }

  if (process.env.NODE_ENV === 'production') {
    if (problems.length > 0) {
      // Fail fast — never list the values themselves, only the rules that failed.
      throw new Error(`Invalid JWT secret configuration. ${problems.join('; ')}.`);
    }
  } else if (problems.length > 0) {
    console.warn(
      `[WARN] JWT secrets are weak for ${process.env.NODE_ENV || 'development'} environment: ${problems.join('; ')}.` +
      ` This will block startup in production. Generate strong unique secrets before deploying.`
    );
  }
};

const validateEnv = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  const warnings = warnIfMissing.filter((key) => !process.env[key]);
  if (warnings.length > 0) {
    console.warn(`[WARN] Missing optional environment variables: ${warnings.join(', ')} — some features may be unavailable`);
  }

  // JWT secrets: fail fast in production, warn elsewhere.
  validateJwtSecrets();

  // Email (SMTP) configuration is mandatory in production — the platform must
  // always deliver real emails. Fail fast so misconfiguration is caught at boot.
  if (process.env.NODE_ENV === 'production') {
    const missingEmail = [];
    if (!process.env.EMAIL_USER) missingEmail.push('EMAIL_USER');
    if (!process.env.EMAIL_PASSWORD && !process.env.EMAIL_PASS) missingEmail.push('EMAIL_PASSWORD');
    if (missingEmail.length > 0) {
      throw new Error(
        `Missing required email configuration: ${missingEmail.join(', ')}. ` +
        `SkillHub must send real emails in production. Configure an SMTP provider in .env.`
      );
    }
  }

  // Only validate keys for the ACTIVE payment mode
  if (paymentMode === 'demo') {
    console.log('[INFO] Payment mode: DEMO — All payment gateways simulated. No real money will be charged.');
  } else if (paymentMode === 'stripe') {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[ERROR] PAYMENT_MODE=stripe but STRIPE_SECRET_KEY is not set. Stripe payments will fail.');
    }
  } else if (paymentMode === 'chapa') {
    if (!process.env.CHAPA_SECRET_KEY) {
      console.error('[ERROR] PAYMENT_MODE=chapa but CHAPA_SECRET_KEY is not set. Chapa payments will fail.');
    }
  } else if (paymentMode === 'telebirr') {
    const missing = ['TELEBIRR_MERCHANT_ID', 'TELEBIRR_APP_KEY', 'TELEBIRR_APP_SECRET'].filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.error(`[ERROR] PAYMENT_MODE=telebirr but missing: ${missing.join(', ')}. Telebirr payments will fail.`);
    }
  } else if (paymentMode === 'cbe') {
    const missing = ['CBE_BIRR_MERCHANT_CODE', 'CBE_BIRR_API_KEY'].filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.error(`[ERROR] PAYMENT_MODE=cbe but missing: ${missing.join(', ')}. CBE Birr payments will fail.`);
    }
  } else {
    console.warn(`[WARN] Unknown PAYMENT_MODE="${paymentMode}". Valid modes: demo, stripe, chapa, telebirr, cbe. Defaulting to demo.`);
  }
};

validateEnv();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  db: {
    uri: process.env.MONGODB_URI,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS,
    fromName: process.env.EMAIL_FROM_NAME || 'SkillHub',
    from: process.env.EMAIL_FROM || 'SkillHub <noreply@skillhub.dev>',
    // Socket/connection timeouts (ms). Kept explicit so a slow or unreachable
    // SMTP host fails fast instead of hanging requests for minutes.
    connectionTimeout: parseInt(process.env.EMAIL_CONNECTION_TIMEOUT, 10) || 15000,
    greetingTimeout: parseInt(process.env.EMAIL_GREETING_TIMEOUT, 10) || 15000,
    socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT, 10) || 30000,
    dnsTimeout: parseInt(process.env.EMAIL_DNS_TIMEOUT, 10) || 10000,
  },
  emailVerification: {
    otpSecret: process.env.OTP_SECRET || process.env.JWT_ACCESS_SECRET || 'skillhub-otp-dev-secret',
    otpTtlMs: Number(process.env.OTP_TTL_MS) || 10 * 60 * 1000,
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
    resendCooldownMs: Number(process.env.OTP_RESEND_COOLDOWN_MS) || 60 * 1000,
    maxResends: Number(process.env.OTP_MAX_RESENDS) || 5,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  },

  paymentMode,

  chapa: {
    secretKey: process.env.CHAPA_SECRET_KEY,
    publicKey: process.env.CHAPA_PUBLIC_KEY,
    baseUrl: process.env.CHAPA_BASE_URL || 'https://api.chapa.co/v1',
  },

  telebirr: {
    merchantId: process.env.TELEBIRR_MERCHANT_ID,
    appKey: process.env.TELEBIRR_APP_KEY,
    appSecret: process.env.TELEBIRR_APP_SECRET,
    shortCode: process.env.TELEBIRR_SHORT_CODE,
    publicKey: process.env.TELEBIRR_PUBLIC_KEY,
    baseUrl: process.env.TELEBIRR_BASE_URL || 'https://app.ethiomobilemoney.et:18444/H5MBR/api',
  },

  cbeBirr: {
    merchantCode: process.env.CBE_BIRR_MERCHANT_CODE,
    apiKey: process.env.CBE_BIRR_API_KEY,
    baseUrl: process.env.CBE_BIRR_BASE_URL || 'https://apigw.cbebirr.et:19443',
    merchantName: process.env.CBE_BIRR_MERCHANT_NAME || 'SkillHub',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  ai: {
    provider: process.env.AI_PROVIDER || 'gemini',
    // Gemini free tier allows ~20 generateContent requests/day. Keep a local
    // budget below that so features share it instead of the first poller
    // burning it all (see services/aiClient.js quota guards).
    maxRequestsPerDay: process.env.AI_MAX_REQUESTS_PER_DAY
      ? parseInt(process.env.AI_MAX_REQUESTS_PER_DAY, 10)
      : 15,
    // Identical prompts reuse one upstream response for this long.
    responseCacheTtlMs: process.env.AI_RESPONSE_CACHE_TTL_MS
      ? parseInt(process.env.AI_RESPONSE_CACHE_TTL_MS, 10)
      : 300000,
    // Fallback cooldown after a 429 when the provider gives no retry hint.
    quotaCooldownMs: process.env.AI_QUOTA_COOLDOWN_MS
      ? parseInt(process.env.AI_QUOTA_COOLDOWN_MS, 10)
      : 60000,
    // Ceiling for a single AI call across all candidate models, so a Gemini
    // overload can't leave the HTTP request hanging for minutes.
    callDeadlineMs: process.env.AI_CALL_DEADLINE_MS
      ? parseInt(process.env.AI_CALL_DEADLINE_MS, 10)
      : 30000,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  platform: {
    commissionRate: parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 0.10,
    name: process.env.PLATFORM_NAME || 'SkillHub',
    minWithdrawal: parseFloat(process.env.MIN_WITHDRAWAL) || 10,
    withdrawalFee: parseFloat(process.env.WITHDRAWAL_FEE) || 0,
  },

  messaging: {
    // How long after a message is sent can the sender edit it (minutes)
    editWindowMinutes: parseFloat(process.env.MESSAGE_EDIT_WINDOW_MINUTES) || 15,
    // How long after a message is sent can the sender delete it for everyone (minutes)
    deleteWindowMinutes: parseFloat(process.env.MESSAGE_DELETE_WINDOW_MINUTES) || 30,
  },

  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
};
