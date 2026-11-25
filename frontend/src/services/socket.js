import { io } from 'socket.io-client';

let socket = null;
let socketToken = null;
const availabilityListeners = new Map();

export const getSocket = () => socket;

export const connectSocket = (token) => {
  if (socket) {
    // Reuse the shared instance whenever it is connected or actively
    // connecting/reconnecting. Never tear down an in-flight connection —
    // doing so closed the WebSocket before establishment whenever multiple
    // components called connectSocket() while the handshake was still in
    // progress.
    if (token === socketToken && (socket.connected || socket.active)) return socket;

    // A permanently closed instance must be disposed before creating a new
    // one, otherwise listeners and connections accumulate across cycles.
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
  socketToken = token;

  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => console.log('[Socket] Connected:', socket.id));
  socket.on('disconnect', (reason) => console.log('[Socket] Disconnected:', reason));
  socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

  return socket;
};

export const disconnectSocket = () => {
  if (!socket) return;
  // Null the shared reference FIRST so that any cleanup that reads the module
  // reference can no longer run against it, and no re-login during teardown
  // clobbers a newer instance. The captured instance is then cleaned up safely.
  const currentSocket = socket;
  socket = null;
  socketToken = null;
  availabilityListeners.clear();
  currentSocket.removeAllListeners();
  currentSocket.disconnect();
};

// ─── Conversation events ───────────────────────────────────────────────────
export const joinConversation = (id) => socket?.emit('conversation:join', id);
export const leaveConversation = (id) => socket?.emit('conversation:leave', id);
export const emitTypingStart = (conversationId) => socket?.emit('typing:start', { conversationId });
export const emitTypingStop = (conversationId) => socket?.emit('typing:stop', { conversationId });
export const emitMessagesRead = (conversationId, messageIds) =>
  socket?.emit('message:read', { conversationId, messageIds });

// ─── Availability events ──────────────────────────────────────────────────
export const emitAvailabilityUpdate = (status, nextAvailableDate) => {
  socket?.emit('availability:update', { status, nextAvailableDate });
};

// ─── Listener registration helpers ─────────────────────────────────────────
// Each helper captures the socket instance at registration time and its
// cleanup uses that SAME instance, so a later disconnect (which nulls the
// module reference) can never turn a cleanup into `.off()` on null, and a
// re-login's new instance is never accidentally torn down by an old cleanup.

export const onUserAvailability = (callback) => {
  const currentSocket = socket;
  if (!currentSocket) return () => {};
  const handler = ({ userId, availability }) => callback(userId, availability);
  currentSocket.on('user:availability', handler);
  return () => {
    if (!currentSocket) return;
    currentSocket.off('user:availability', handler);
  };
};

export const onUserOnline = (callback) => {
  const currentSocket = socket;
  if (!currentSocket) return () => {};
  const handler = ({ userId, availability }) => callback(userId, availability || 'available');
  currentSocket.on('user:online', handler);
  return () => {
    if (!currentSocket) return;
    currentSocket.off('user:online', handler);
  };
};

export const onUserOffline = (callback) => {
  const currentSocket = socket;
  if (!currentSocket) return () => {};
  const handler = ({ userId, lastSeen }) => callback(userId, lastSeen);
  currentSocket.on('user:offline', handler);
  return () => {
    if (!currentSocket) return;
    currentSocket.off('user:offline', handler);
  };
};

// ─── Project events ───────────────────────────────────────────────────────
export const joinProject = (id) => socket?.emit('project:join', id);
export const leaveProject = (id) => socket?.emit('project:leave', id);

// ─── Notification events ──────────────────────────────────────────────────
export const onNewNotification = (callback) => {
  const currentSocket = socket;
  if (!currentSocket) return () => {};
  const handler = (notification) => callback(notification);
  currentSocket.on('notification:new', handler);
  return () => {
    if (!currentSocket) return;
    currentSocket.off('notification:new', handler);
  };
};
