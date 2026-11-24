import { createServer } from "http";
import app from "./app.js";
import { config } from "./config/env.js";
import { connectDB } from "./config/database.js";
import { logger } from "./utils/logger.js";
import { initializeSocket } from "./services/socket.service.js";
const PORT = config.port;
const startServer = async () => {
  try {
    await connectDB();
    const httpServer = createServer(app);
    initializeSocket(httpServer);
    httpServer.listen(PORT, () => {
      logger.info(`
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551       SkillHub API Server Started        \u2551
\u2551  Environment: ${config.env.padEnd(26)}\u2551
\u2551  Port:        ${String(PORT).padEnd(26)}\u2551
\u2551  API:         /api/v1                    \u2551
\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D
      `);
    });
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      httpServer.close(async () => {
        logger.info("HTTP server closed.");
        const { disconnectDB } = await import("./config/database.js");
        await disconnectDB();
        process.exit(0);
      });
      setTimeout(() => {
        logger.error("Could not close connections in time. Forcefully shutting down.");
        process.exit(1);
      }, 1e4);
    };
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    });
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      gracefulShutdown("uncaughtException");
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};
startServer();
