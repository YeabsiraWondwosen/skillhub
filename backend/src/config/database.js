import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

const RECONNECT_INTERVAL = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

let reconnectAttempts = 0;

const connectionOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
};

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.db.uri, connectionOptions);

    logger.info(`MongoDB connected: ${conn.connection.host}`);
    reconnectAttempts = 0;

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
      scheduleReconnect();
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err && err.stack ? err.stack : err);
    });

    return conn;
  } catch (error) {
    logger.error('MongoDB connection failed:', error && error.stack ? error.stack : error);
    scheduleReconnect();
    throw error;
  }
};

const scheduleReconnect = () => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error('Max MongoDB reconnection attempts reached. Exiting...');
    process.exit(1);
  }

  reconnectAttempts++;
  logger.info(`Reconnecting to MongoDB (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  setTimeout(async () => {
    try {
      await connectDB();
    } catch {
      // scheduleReconnect is called inside connectDB on failure
    }
  }, RECONNECT_INTERVAL);
};

export const disconnectDB = async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed.');
};
