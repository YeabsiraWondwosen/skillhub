import nodemailer from 'nodemailer';
import dns from 'dns';
import net from 'net';
import { promisify } from 'util';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const lookup = promisify(dns.lookup);

// ─── Host resolution ──────────────────────────────────────────────────────────
/**
 * Resolve the SMTP host to a usable address.
 *
 * Nodemailer resolves the hostname itself via `dns.resolve4`/`dns.resolve6`.
 * On some networks that resolver path points at an unreachable or filtering
 * local DNS server (e.g. a VPN's 127.0.0.1) and fails with
 * `queryA ETIMEOUT <host>` while the OS resolver (`dns.lookup`) works fine.
 * To avoid that, resolve via the OS resolver up front and connect to the IP,
 * keeping the real hostname as the TLS servername so certificate validation
 * still succeeds. Falls back to the configured hostname if resolution fails.
 *
 * @param {string} host
 * @returns {Promise<{host: string, servername: string|null}>}
 */
const resolveSmtpHost = async (host) => {
  if (!host || net.isIP(host)) return { host, servername: null };
  try {
    const { address } = await lookup(host, { family: 4 });
    if (address) return { host: address, servername: host };
  } catch {
    // Resolution failed — let nodemailer try its own path so a clear
    // error surfaces to the caller.
  }
  return { host, servername: null };
};

// ─── Transporter ─────────────────────────────────────────────────────────────
/**
 * Detect placeholder/example SMTP credentials (e.g. values copied from
 * .env.example) so we never try to authenticate against a real provider with
 * throwaway credentials.
 */
const isPlaceholder = (value = '') =>
  /(your[-_.]|change.?me|example|placeholder|xxxx|^your$)/i.test(String(value || ''));

const realEmailConfigured = () =>
  Boolean(config.email.user && config.email.host && config.email.pass) &&
  !isPlaceholder(config.email.user);

/**
 * True only when a REAL SMTP provider is configured (never the Ethereal
 * dev/test transport). Callers that must deliver to a user's actual mailbox
 * (e.g. Contact Us admin replies) use this instead of assuming delivery.
 */
export const isRealEmailConfigured = () => realEmailConfigured();

/** Escape user-controlled content before embedding it in an HTML email. */
const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Strip CR/LF so a value can never inject extra headers (To/Subject/From). */
const sanitizeHeaderValue = (value = '') => String(value).replace(/[\r\n]+/g, ' ').trim();

const createTransporter = async () => {
  if (realEmailConfigured()) {
    const { host, servername } = await resolveSmtpHost(config.email.host);
    return {
      ethereal: false,
      transporter: nodemailer.createTransport({
        host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
        tls: {
          rejectUnauthorized: config.isProd,
          ...(servername ? { servername } : {}),
        },
        connectionTimeout: config.email.connectionTimeout,
        greetingTimeout: config.email.greetingTimeout,
        socketTimeout: config.email.socketTimeout,
        dnsTimeout: config.email.dnsTimeout,
      }),
    };
  }

  if (config.isProd) {
    throw new Error(
      'Email service is not configured. Set EMAIL_HOST, EMAIL_USER and EMAIL_PASSWORD in .env.'
    );
  }

  // Dev fallback: auto-create an Ethereal test account so signup, email
  // verification and password-reset flows work without real SMTP credentials.
  // Message previews are available at the logged URL (https://ethereal.email).
  const testAccount = await nodemailer.createTestAccount();
  const { host, servername } = await resolveSmtpHost('smtp.ethereal.email');
  logger.info(
    `[email] Using Ethereal test account (${testAccount.user}) — message previews at https://ethereal.email`
  );
  return {
    ethereal: true,
    transporter: nodemailer.createTransport({
      host,
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
      tls: { rejectUnauthorized: false, ...(servername ? { servername } : {}) },
    }),
  };
};

let transporterPromise;

const getTransporter = async () => {
  if (!transporterPromise) {
    transporterPromise = createTransporter().catch((err) => {
      // Do not cache a failed creation — allow a retry on the next send.
      transporterPromise = null;
      throw err;
    });
  }
  return transporterPromise;
};

// ─── Base send function ───────────────────────────────────────────────────────
/**
 * Send a real email via the configured SMTP provider.
 *
 * - Throws if the provider is not configured or the recipient is rejected —
 *   callers must never treat this as success.
 * - Logs delivery status (type, recipient, success/failure, provider response,
 *   timestamp). Never logs credentials or verification/reset tokens.
 *
 * @param {object} options
 * @param {boolean} [options.requireReal=false] When true, refuse the dev
 *   Ethereal test transport and throw unless a real SMTP provider is
 *   configured. Use for emails that MUST reach a user's actual mailbox.
 */
const sendEmail = async ({ to, subject, html, text, type = 'general', requireReal = false }) => {
  if (requireReal && !realEmailConfigured()) {
    throw new Error(
      'SMTP is not configured for real email delivery. Set EMAIL_HOST, EMAIL_PORT, ' +
        'EMAIL_USER, EMAIL_PASSWORD and EMAIL_FROM in backend/.env (see .env.example).'
    );
  }

  // Header-injection guard: never allow CR/LF in envelope/header values.
  const safeTo = sanitizeHeaderValue(to);
  const safeSubject = sanitizeHeaderValue(subject);
  if (!safeTo || /[\r\n]/.test(String(to)) || !safeSubject) {
    throw new Error('Invalid recipient or subject (header injection blocked).');
  }

  const { transporter, ethereal } = await getTransporter();

  try {
    const info = await transporter.sendMail({
      from: {
        name: config.email.fromName,
        address: config.email.from.replace(/^.*<([^>]+)>.*$/, '$1'),
      },
      to: safeTo,
      subject: safeSubject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    const accepted = (Array.isArray(info.accepted) ? info.accepted : [])
      .map((a) => String(a).toLowerCase());
    if (!accepted.includes(String(safeTo).toLowerCase())) {
      throw new Error(`SMTP server did not accept the recipient (${safeTo})`);
    }

    logger.info(
      `[email:${type}] sent — To: ${safeTo}, MessageID: ${info.messageId}, ` +
      `Response: ${info.response || 'accepted'}, Time: ${new Date().toISOString()}`
    );
    if (ethereal) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(`[email:${type}] Ethereal preview: ${previewUrl}`);
      }
    }
    return info;
  } catch (error) {
    logger.error(
      `[email:${type}] failed — To: ${safeTo}, Error: ${error.message}, Time: ${new Date().toISOString()}`
    );
    throw error;
  }
};

// ─── Branded base template ────────────────────────────────────────────────────
// SkillHub branding: dark navy, purple/lavender, cyan accent.
const baseTemplate = (content, preheader = '', title = 'SkillHub', footerNote = 'You received this email because you have an account on SkillHub.') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <style>
    @media (max-width: 640px) {
      .container { width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
      .inner { padding: 24px !important; }
      .header { padding: 24px !important; }
      .footer { padding: 20px 24px !important; }
      .btn { display: block !important; text-align: center !important; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #eef1f7; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(11, 16, 38, 0.12); }
    .header { background: linear-gradient(135deg, #0b1026 0%, #151b3d 55%, #1b1440 100%); padding: 36px 40px 32px; text-align: center; position: relative; }
    .header::after { content: ''; position: absolute; right: -40px; top: -40px; width: 160px; height: 160px; border-radius: 50%; background: radial-gradient(circle, rgba(124, 108, 246, 0.35) 0%, rgba(124, 108, 246, 0) 70%); }
    .header::before { content: ''; position: absolute; left: -32px; bottom: -48px; width: 140px; height: 140px; border-radius: 50%; background: radial-gradient(circle, rgba(34, 211, 238, 0.22) 0%, rgba(34, 211, 238, 0) 70%); }
    .brand { display: inline-block; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: 1.2px; text-decoration: none; position: relative; z-index: 1; }
    .brand span { color: #22d3ee; }
    .tagline { color: rgba(255, 255, 255, 0.6); font-size: 13px; margin: 6px 0 0; letter-spacing: 0.4px; position: relative; z-index: 1; }
    .inner { padding: 36px 40px; color: #374151; line-height: 1.7; font-size: 15px; }
    .inner h2 { color: #0b1026; font-size: 22px; margin: 0 0 16px; font-weight: 700; letter-spacing: -0.3px; }
    .inner p { margin: 0 0 14px; }
    .inner strong { color: #0b1026; }
    .btn { display: inline-block; background: linear-gradient(135deg, #7c6cf6, #8b5cf6); color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 10px 0 6px; box-shadow: 0 6px 18px rgba(124, 108, 246, 0.35); }
    .btn:hover { background: linear-gradient(135deg, #6c5df0, #7c4cf0); }
    .muted { color: #9ca3af; font-size: 13px; }
    .highlight { background: #f3f1ff; border: 1px solid #e4defc; border-left: 4px solid #7c6cf6; padding: 12px 16px; border-radius: 8px; margin: 16px 0; color: #374151; }
    .link-url { font-size: 12px; color: #9ca3af; word-break: break-all; margin-top: 4px; }
    .footer { background: #0b1026; padding: 24px 40px; text-align: center; }
    .footer p { color: rgba(255, 255, 255, 0.55); font-size: 12px; margin: 4px 0; line-height: 1.6; }
    .footer .brand-sm { color: #ffffff; font-weight: 700; letter-spacing: 0.8px; font-size: 14px; }
    .footer .brand-sm span { color: #22d3ee; }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ''}
  <div class="container">
    <div class="header">
      <span class="brand">SKILL<span>HUB</span></span>
      <p class="tagline">Hire talent. Get work done.</p>
    </div>
    <div class="inner">${content}</div>
    <div class="footer">
      <p class="brand-sm">SKILL<span>HUB</span></p>
      <p>© ${new Date().getFullYear()} SkillHub. All rights reserved.</p>
      <p>${footerNote}</p>
    </div>
  </div>
</body>
</html>`;

// ─── Public email functions ───────────────────────────────────────────────────

export const sendPasswordResetEmail = async (user, resetUrl) => {
  const html = baseTemplate(
    `
    <h2>Reset your password</h2>
    <p>Hello <strong>${user.firstName}</strong>,</p>
    <p>We received a request to reset your SkillHub password. Click the button below to set a new one.</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </div>
    <p class="link-url">Or copy this link into your browser: ${resetUrl}</p>
    <div class="highlight">
      <strong>Note:</strong> This link expires in <strong>30 minutes</strong>.
    </div>
    <p class="muted">If you did not request this password reset, you can safely ignore this email. Your password will not change.</p>
    `,
    'Reset your SkillHub password',
    'Reset your password | SkillHub'
  );

  return sendEmail({
    to: user.email,
    subject: 'Reset your SkillHub password',
    html,
    type: 'password_reset',
  });
};

export const sendWelcomeEmail = async (user) => {
  const roleSpecific = user.role === 'freelancer'
    ? 'Complete your profile, showcase your skills, and start landing high-quality projects.'
    : 'Post your first job and connect with skilled professionals ready to bring your vision to life.';

  const html = baseTemplate(
    `
    <h2>Welcome to SkillHub, ${user.firstName}</h2>
    <p>Your account has been verified and you're all set to get started.</p>
    <div class="highlight">
      <strong>Your role:</strong> ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}<br/>
      ${roleSpecific}
    </div>
    <div style="text-align: center;">
      <a href="${config.frontendUrl}/dashboard" class="btn">Go to Dashboard</a>
    </div>
    `,
    `Welcome to SkillHub, ${user.firstName}!`,
    'Welcome to SkillHub'
  );

  return sendEmail({
    to: user.email,
    subject: `Welcome to SkillHub, ${user.firstName}!`,
    html,
    type: 'welcome',
  });
};

export const sendPasswordChangedEmail = async (user) => {
  const html = baseTemplate(
    `
    <h2>Password changed</h2>
    <p>Hello <strong>${user.firstName}</strong>,</p>
    <p>Your SkillHub password was successfully changed on <strong>${new Date().toLocaleString()}</strong>.</p>
    <div class="highlight">
      <strong>Wasn't you?</strong> If you did not make this change, please <a href="${config.frontendUrl}/auth/forgot-password" style="color:#7c6cf6;">reset your password immediately</a>.
    </div>
    `,
    'Your SkillHub password has been changed',
    'Password changed | SkillHub'
  );

  return sendEmail({
    to: user.email,
    subject: 'Your SkillHub password was changed',
    html,
    type: 'password_changed',
  });
};

export const sendEmailChangeEmail = async (user, confirmUrl) => {
  const html = baseTemplate(
    `
    <h2>Confirm your new email address</h2>
    <p>Hello <strong>${user.firstName}</strong>,</p>
    <p>You requested to change your SkillHub email address to <strong>${user.pendingEmail}</strong>. Click the button below to confirm this change.</p>
    <div style="text-align: center;">
      <a href="${confirmUrl}" class="btn">Confirm New Email</a>
    </div>
    <p class="link-url">Or copy this link into your browser: ${confirmUrl}</p>
    <div class="highlight">
      <strong>Note:</strong> This link expires in <strong>24 hours</strong>.
    </div>
    <p class="muted">If you did not request this change, please secure your account and ignore this email.</p>
    `,
    'Confirm your new SkillHub email address',
    'Confirm new email | SkillHub'
  );

  return sendEmail({
    to: user.pendingEmail,
    subject: 'Confirm your new SkillHub email address',
    html,
    type: 'email_change',
  });
};

export const sendApplicationReceivedEmail = async (client, job, freelancerName) => {
  const html = baseTemplate(
    `
    <h2>New application received</h2>
    <p>Hello <strong>${client.firstName}</strong>,</p>
    <p><strong>${freelancerName}</strong> has applied for your job:</p>
    <div class="highlight"><strong>${job.title}</strong></div>
    <div style="text-align: center;">
      <a href="${config.frontendUrl}/client/jobs/${job._id}/applicants" class="btn">View Application</a>
    </div>
    `,
    'New application for your job',
    'New application | SkillHub'
  );

  return sendEmail({
    to: client.email,
    subject: `New application for "${job.title}"`,
    html,
    type: 'application_received',
  });
};

export const sendApplicationStatusEmail = async (freelancer, job, status, reason = '') => {
  const isAccepted = status === 'accepted';
  const html = baseTemplate(
    `
    <h2>Application ${isAccepted ? 'Accepted' : 'Update'}</h2>
    <p>Hello <strong>${freelancer.firstName}</strong>,</p>
    <p>Your application for <strong>"${job.title}"</strong> has been <strong>${status}</strong>.</p>
    ${reason ? `<div class="highlight"><strong>Note:</strong> ${reason}</div>` : ''}
    <div style="text-align: center;">
      <a href="${config.frontendUrl}/freelancer/proposals" class="btn">View My Proposals</a>
    </div>
    `,
    `Your application has been ${status}`,
    'Application update | SkillHub'
  );

  return sendEmail({
    to: freelancer.email,
    subject: `Application ${status} — "${job.title}"`,
    html,
    type: 'application_status',
  });
};

export const sendPaymentReceivedEmail = async (user, amount, currency, description) => {
  const html = baseTemplate(
    `
    <h2>Payment received</h2>
    <p>Hello <strong>${user.firstName}</strong>,</p>
    <p>You've received a payment of <strong>${currency} ${amount.toFixed(2)}</strong>.</p>
    <div class="highlight"><strong>Description:</strong> ${description}</div>
    <div style="text-align: center;">
      <a href="${config.frontendUrl}/payments/wallet" class="btn">View Wallet</a>
    </div>
    `,
    'You received a payment on SkillHub',
    'Payment received | SkillHub'
  );

  return sendEmail({
    to: user.email,
    subject: `Payment received: ${currency} ${amount.toFixed(2)}`,
    html,
    type: 'payment_received',
  });
};

export const sendProjectCompletedEmail = async (user, projectTitle) => {
  const html = baseTemplate(
    `
    <h2>Project completed</h2>
    <p>Hello <strong>${user.firstName}</strong>,</p>
    <p>The project <strong>"${projectTitle}"</strong> has been marked as completed.</p>
    <div style="text-align: center;">
      <a href="${config.frontendUrl}/dashboard" class="btn">View Dashboard</a>
    </div>
    `,
    'Your SkillHub project has been completed',
    'Project completed | SkillHub'
  );

  return sendEmail({
    to: user.email,
    subject: `Project completed: "${projectTitle}"`,
    html,
    type: 'project_completed',
  });
};

/**
 * Email verification (OTP) code.
 *
 * Delivered through the configured SMTP provider only (`requireReal: true`),
 * so it can never silently fall back to the Ethereal dev/test transport where
 * the recipient has no real mailbox and the code would never reach them.
 * Throws on any failure — callers must not report success when no email was sent.
 */
export const sendEmailVerificationOtpEmail = async (user, otp) => {
  const sanitizedOtp = String(otp || '').trim();
  const html = baseTemplate(
    `
    <h2>Verify your email</h2>
    <p>Hello <strong>${escapeHtml(user.firstName)}</strong>,</p>
    <p>To complete your SkillHub registration, please enter this 6-digit verification code:</p>
    <div style="text-align: center; font-size: 28px; letter-spacing: 8px; font-weight: 800; color: #0b1026; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 16px 0;">${escapeHtml(sanitizedOtp)}</div>
    <p>This code expires in <strong>10 minutes</strong>.</p>
    <div class="highlight">
      <strong>Do not share this code with anyone.</strong> If you didn't create this account, you can safely ignore this email.
    </div>
    `,
    `Your SkillHub verification code: ${sanitizedOtp}`,
    'Verify your email | SkillHub'
  );

  return sendEmail({
    to: user.email,
    subject: 'Your SkillHub verification code',
    html,
    type: 'email_verification_otp',
    requireReal: true,
  });
};

/**
 * Contact Us — admin reply to the user's REAL email address.
 *
 * Delivered through the configured SMTP provider only (`requireReal: true`),
 * so this can never silently fall back to the Ethereal dev/test transport.
 * Throws on any failure — callers must persist the failure instead of
 * reporting success.
 */
export const sendContactReplyEmail = async ({ to, userName, originalSubject, originalMessage, reply }) => {
  const subject = `Re: ${sanitizeHeaderValue(originalSubject)} - SkillHub Support`;
  const supportEmail = config.email.from.replace(/^.*<([^>]+)>.*$/, '$1');
  const contactUrl = `${config.frontendUrl}/contact`;
  const sentAt = new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'long', timeStyle: 'short' }) + ' UTC';

  const quotedMessage = String(originalMessage || '').slice(0, 2000);

  const html = baseTemplate(
    `
    <h2>Your request has been answered</h2>
    <p>Hello <strong>${escapeHtml(userName || 'there')}</strong>,</p>
    <p>Thank you for contacting SkillHub. Regarding your message
      <strong>&ldquo;${escapeHtml(originalSubject)}&rdquo;</strong>, here is our reply:</p>
    <div style="background: #f3f1ff; border: 1px solid #e4defc; border-left: 4px solid #7c6cf6; padding: 16px 20px; border-radius: 8px; margin: 16px 0; white-space: pre-wrap;">${escapeHtml(reply)}</div>
    <p style="margin-top: 20px;"><strong>Your original message:</strong></p>
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px 16px; border-radius: 8px; color: #6b7280; font-size: 13px; white-space: pre-wrap;">${escapeHtml(quotedMessage)}</div>
    <p style="margin-top: 20px;">Best regards,<br/><strong>SkillHub Support Team</strong></p>
    <div class="highlight">
      <strong>Need more help?</strong> Reply to this email or reach us at
      <a href="mailto:${supportEmail}" style="color:#7c6cf6;">${supportEmail}</a>
      &middot; <a href="${contactUrl}" style="color:#7c6cf6;">${contactUrl}</a>
    </div>
    <p class="muted">Sent on ${sentAt}</p>
    `,
    `SkillHub Support replied to "${originalSubject}"`,
    `Re: ${originalSubject} | SkillHub Support`,
    'You received this email because you contacted SkillHub support.'
  );

  const text = [
    `Hello ${userName || 'there'},`,
    '',
    `Thank you for contacting SkillHub. Regarding your message "${originalSubject}", here is our reply:`,
    '',
    reply,
    '',
    'Your original message:',
    quotedMessage,
    '',
    'Best regards,',
    'SkillHub Support Team',
    '',
    `Need more help? Reply to this email or reach us at ${supportEmail} — ${contactUrl}`,
  ].join('\n');

  return sendEmail({ to, subject, html, text, type: 'contact_reply', requireReal: true });
};

export { sendEmail };
