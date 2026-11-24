import { createServer } from 'http';
import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/database.js';
import { logger } from './utils/logger.js';
import { initializeSocket } from './services/socket.service.js';
import { initializeProviders } from './services/support/providers/index.js';
import { startMeetingReminderJob } from './services/meetingReminder.service.js';
import { loadCommissionRate } from './services/settings.service.js';

const PORT = config.port;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Load the persisted platform commission rate into the in-memory cache used
    // by the payment/escrow hot paths (falls back to the env value on failure).
    await loadCommissionRate();

    // Initialize AI providers
    initializeProviders();

    // Seed default categories if none exist
    try {
      const { seedDefaultCategories } = await import('./services/category.service.js');
      const result = await seedDefaultCategories();
      if (result.created > 0) {
        logger.info(`Seeded ${result.created} default categories`);
      }
    } catch (err) {
      logger.error(`Failed to seed default categories: ${err.message}`);
    }

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.io
    initializeSocket(httpServer);

    // Meeting reminder automation (accepted meetings, 24h + 1h windows)
    startMeetingReminderJob();

    // Better HTTP server error handling (e.g. EADDRINUSE)
    httpServer.on('error', (err) => {
      logger.error('HTTP server error:', err && err.stack ? err.stack : err);
      // For address-in-use or permission errors, shutdown with non-zero exit
      if (err && err.code === 'EADDRINUSE') {
        logger.error('Port is already in use.');
        process.exit(1);
      }
    });

    // Start listening
    httpServer.listen(PORT, () => {
      logger.info(`
╔══════════════════════════════════════════╗
║       SkillHub API Server Started        ║
║  Environment: ${config.env.padEnd(26)}║
║  Port:        ${String(PORT).padEnd(26)}║
║  Payment:     ${(config.paymentMode || 'chapa').padEnd(26)}║
║  API:         /api/v1                    ║
╚══════════════════════════════════════════╝
      `);
    });

    // ─── Graceful Shutdown ──────────────────────────────────────────────────
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      httpServer.close(async () => {
        logger.info('HTTP server closed.');
        const { disconnectDB } = await import('./config/database.js');
        await disconnectDB();
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time. Forcefully shutting down.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      // Log stack if available
      logger.error('Unhandled Rejection:', reason && reason.stack ? reason.stack : reason);
    });

    process.on('uncaughtException', (error) => {
      // Ensure we log the full stack for easier debugging
      logger.error('Uncaught Exception:', error && error.stack ? error.stack : error);
      // Attempt graceful shutdown
      try {
        gracefulShutdown('uncaughtException');
      } catch (e) {
        logger.error('Error while performing graceful shutdown:', e && e.stack ? e.stack : e);
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
