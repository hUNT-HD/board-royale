import { io } from 'socket.io-client';

// Live multiplayer server (Render). Override with VITE_SERVER_URL for local dev.
const URL = import.meta.env.VITE_SERVER_URL || 'https://board-royale-server.onrender.com';

// Single shared connection for the whole app. `autoConnect: false` so solo
// (offline) play never opens a socket. websocket + polling fallback so the
// first connection still works while Render's free instance wakes up.
export const socket = io(URL, { autoConnect: false, transports: ['websocket', 'polling'] });

export const ensureConnected = () => {
  if (!socket.connected) socket.connect();
  return socket;
};

/** Promise wrapper around an ack-based emit. */
export const emitAck = (event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));
