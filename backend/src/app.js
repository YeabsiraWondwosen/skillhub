import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import 'express-async-errors';

import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import jobRoutes from './routes/job.routes.js';
import applicationRoutes from './routes/application.routes.js';
import projectRoutes from './routes/project.routes.js';
import contractRoutes from './routes/contract.routes.js';
import milestoneRoutes from './routes/milestone.routes.js';
import messageRoutes from './routes/message.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import reviewRoutes from './routes/review.routes.js';
import adminRoutes from './routes/admin.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import aiRoutes from './routes/ai.routes.js';
import reportRoutes from './routes/report.routes.js';
import supportRoutes from './routes/support.routes.js';
import contactRoutes from './routes/contact.routes.js';
import badgeRoutes from './routes/badge.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import costEstimatorRoutes from './routes/costEstimator.routes.js';
import projectPlannerRoutes from './routes/projectPlanner.routes.js';
import developerVerificationRoutes from './routes/developerVerification.routes.js';
import githubRoutes from './routes/github.routes.js';
import reputationRoutes from './routes/reputation.routes.js';
import codeReviewRoutes from './routes/codeReview.routes.js';
import resumeRoutes from './routes/resume.routes.js';
import portfolioSiteRoutes from './routes/portfolioSite.routes.js';
import learningHubRoutes from './routes/learningHub.routes.js';
import recruiterRoutes from './routes/recruiter.routes.js';
import interviewAssistantRoutes from './routes/interviewAssistant.routes.js';
import teamHiringRoutes from './routes/teamHiring.routes.js';
import advancedAnalyticsRoutes from './routes/advancedAnalytics.routes.js';
import categoryRoutes from './routes/category.routes.js';
import aiMessagingRoutes from './routes/aiMessaging.routes.js';
import profileRoutes from './routes/profile.routes.js';
import meetingRoutes from './routes/meeting.routes.js';
import availabilityRoutes from './routes/availability.routes.js';
import orderRoutes from './routes/order.routes.js';
import adminFinanceRoutes from './routes/adminFinance.routes.js';
import adminServiceRoutes from './routes/adminService.routes.js';
import clientRoutes from './routes/client.routes.js';

const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: config.isProd ? undefined : false,
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        config.frontendUrl,
        'http://localhost:5173',
        'http://localhost:3000',
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count'],
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
// Raw body for Stripe webhooks — MUST come before json parser
app.use('/api/v1/payments/webhook/stripe', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Sanitize ─────────────────────────────────────────────────────────────────
app.use(mongoSanitize());

// ─── Compression ──────────────────────────────────────────────────────────────
app.use(compression());

// ─── Logging ──────────────────────────────────────────────────────────────────
if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: { write: (message) => logger.http(message.trim()) },
    })
  );
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    platform: config.platform.name,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/jobs`, jobRoutes);
app.use(`${API_PREFIX}/applications`, applicationRoutes);
app.use(`${API_PREFIX}/projects`, projectRoutes);
app.use(`${API_PREFIX}/contracts`, contractRoutes);
app.use(`${API_PREFIX}/milestones`, milestoneRoutes);
app.use(`${API_PREFIX}/messages`, messageRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/reviews`, reviewRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/ai`, aiRoutes);
app.use(`${API_PREFIX}/reports`, reportRoutes);
app.use(`${API_PREFIX}/support`, supportRoutes);
app.use(`${API_PREFIX}/contact`, contactRoutes);
app.use(`${API_PREFIX}/badges`, badgeRoutes);
app.use(`${API_PREFIX}/catalogs`, catalogRoutes);
app.use(`${API_PREFIX}/cost-estimator`, costEstimatorRoutes);
app.use(`${API_PREFIX}/project-planner`, projectPlannerRoutes);
app.use(`${API_PREFIX}/developer-verifications`, developerVerificationRoutes);
app.use(`${API_PREFIX}/github`, githubRoutes);
app.use(`${API_PREFIX}/reputation`, reputationRoutes);
app.use(`${API_PREFIX}/code-reviews`, codeReviewRoutes);
app.use(`${API_PREFIX}/resumes`, resumeRoutes);
app.use(`${API_PREFIX}/portfolio-sites`, portfolioSiteRoutes);
app.use(`${API_PREFIX}/learning-hub`, learningHubRoutes);
app.use(`${API_PREFIX}/recruiter`, recruiterRoutes);
app.use(`${API_PREFIX}/interview-assistant`, interviewAssistantRoutes);
app.use(`${API_PREFIX}/team-hiring`, teamHiringRoutes);
app.use(`${API_PREFIX}/advanced-analytics`, advancedAnalyticsRoutes);
app.use(`${API_PREFIX}/categories`, categoryRoutes);
app.use(`${API_PREFIX}/ai-messaging`, aiMessagingRoutes);
app.use(`${API_PREFIX}/profile`, profileRoutes);
app.use(`${API_PREFIX}/meetings`, meetingRoutes);
app.use(`${API_PREFIX}/availability`, availabilityRoutes);
app.use(`${API_PREFIX}/service-orders`, orderRoutes);
app.use(`${API_PREFIX}/client`, clientRoutes);
app.use(`${API_PREFIX}/admin`, adminFinanceRoutes);
app.use(`${API_PREFIX}/admin`, adminServiceRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;
