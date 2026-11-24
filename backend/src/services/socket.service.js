import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { User } from '../models/index.js';

let io;

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map();

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [config.frontendUrl, 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── Auth middleware ─────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, config.jwt.accessSecret);
      const user = await User.findById(decoded.userId).select('_id firstName lastName avatar role isActive isBanned');

      if (!user || !user.isActive || user.isBanned) {
        return next(new Error('User not authorized'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection handler ──────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const userId = socket.userId;
    logger.info(`Socket connected: ${userId} (${socket.id})`);

    // Track online status
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    const userSockets = onlineUsers.get(userId);
    if (userSockets) userSockets.add(socket.id);

    // Update DB online status with availability
    const userDoc = await User.findById(userId).select('availabilityStatus');
    const availability = userDoc?.availabilityStatus || 'available';
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

    // Broadcast online status with availability to relevant users
    socket.broadcast.emit('user:online', { userId, availability });

    // Join personal room for targeted notifications
    socket.join(`user:${userId}`);

    // ─── Conversation rooms ────────────────────────────────────────────
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // ─── Typing indicators ─────────────────────────────────────────────
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        userId,
        conversationId,
        user: {
          _id: socket.user._id,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
          avatar: socket.user.avatar,
        },
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        userId,
        conversationId,
      });
    });

    // ─── Mark messages as read ─────────────────────────────────────────
    socket.on('message:read', ({ conversationId, messageIds }) => {
      socket.to(`conversation:${conversationId}`).emit('message:read', {
        conversationId,
        messageIds,
        readBy: userId,
        readAt: new Date(),
      });
    });

    // ─── Availability status ──────────────────────────────────────────
    socket.on('availability:update', async ({ status, nextAvailableDate }) => {
      const validStatuses = ['available', 'busy', 'vacation', 'offline'];
      if (!validStatuses.includes(status)) return;

      await User.findByIdAndUpdate(userId, {
        availabilityStatus: status,
        nextAvailableDate: nextAvailableDate || null,
      });

      // Broadcast availability change to all connected clients
      socket.broadcast.emit('user:availability', { userId, availability: status });
      logger.info(`Availability updated: ${userId} -> ${status}`);
    });

    // ─── Project room ──────────────────────────────────────────────────
    socket.on('project:join', (projectId) => {
      socket.join(`project:${projectId}`);
    });

    socket.on('project:leave', (projectId) => {
      socket.leave(`project:${projectId}`);
    });

    // ─── Disconnect ────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          // Presence only. Never touch `availabilityStatus` here: a freelancer
          // going offline (closing the tab / losing connection) must NOT be
          // turned into "not accepting bookings". Their explicit availability
          // setting is preserved so clients can still book their future slots.
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });
          socket.broadcast.emit('user:offline', { userId, lastSeen: new Date() });
        }
      }
      logger.info(`Socket disconnected: ${userId} (${socket.id})`);
    });
  });

  logger.info('Socket.io initialized');
  return io;
};

// ─── Emit helpers (called from controllers/services) ─────────────────────────

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

export const emitToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToConversation = (conversationId, event, data) => {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, data);
};

export const emitToProject = (projectId, event, data) => {
  if (!io) return;
  io.to(`project:${projectId}`).emit(event, data);
};

export const isUserOnline = (userId) => onlineUsers.has(userId.toString());

export const getOnlineUsers = () => Array.from(onlineUsers.keys());

export const emitAvailabilityChange = (userId, availability) => {
  if (!io) return;
  io.emit('user:availability', { userId, availability });
};
