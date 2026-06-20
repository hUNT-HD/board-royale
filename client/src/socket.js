import { io } from 'socket.io-client';

// Live multiplayer server (Render). Override with VITE_SERVER_URL for local dev.
const URL = import.meta.env.VITE_SERVER_URL || 'https://board-royale-server.onrender.com';

// Single shared connection. autoConnect:false so solo play never opens a socket.
// Default transport order (polling → upgrade to websocket) is the most reliable
// way to WAKE a sleeping free-tier server and then connect.
export const socket = io(URL, {
  autoConnect: false,
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionAttempts: 8,
  reconnectionDelay: 1500,
  timeout: 20000,
});

export const ensureConnected = () => { if (!socket.connected) socket.connect(); return socket; };

/** Resolve once connected, or false after `ms` (free server can take ~30–50s to wake). */
function waitConnected(ms) {
  return new Promise((resolve) => {
    if (socket.connected) return resolve(true);
    ensureConnected();
    const done = (ok) => { clearTimeout(t); socket.off('connect', onOk); resolve(ok); };
    const onOk = () => done(true);
    const t = setTimeout(() => done(false), ms);
    socket.on('connect', onOk);
  });
}

/**
 * Emit with an ack, but never hang: wait for the connection (cold start), then
 * apply an ack timeout. Always resolves — with the server's reply or { error }.
 */
export async function emitAck(event, payload, { connectMs = 60000, ackMs = 15000 } = {}) {
  const ok = await waitConnected(connectMs);
  if (!ok) return { error: 'Server is waking up (free tier). Wait ~30s and try again.' };
  return new Promise((resolve) => {
    socket.timeout(ackMs).emit(event, payload, (err, res) =>
      resolve(err ? { error: 'Server timed out — please try again.' } : res));
  });
}
