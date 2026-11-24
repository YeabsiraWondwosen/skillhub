import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

/**
 * Request/Response logger for debugging
 */
export const requestLogger = (req, res, next) => {
  if (!config.isDev) return next();

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const color =
      res.statusCode >= 500
        ? '\x1b[31m' // red
        : res.statusCode >= 400
        ? '\x1b[33m' // yellow
        : res.statusCode >= 300
        ? '\x1b[36m' // cyan
        : '\x1b[32m'; // green

    logger.debug(
      `${color}${req.method}\x1b[0m ${req.originalUrl} ${color}${res.statusCode}\x1b[0m ${duration}ms`
    );
  });

  next();
};
