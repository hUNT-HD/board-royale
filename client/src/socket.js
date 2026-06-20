import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

// Single shared connection for the whole app. `autoConnect: false` so solo
// (offline) play never opens a socket.
export const socket = io(URL, { autoConnect: false, transports: ['websocket'] });

export const ensureConnected = () => {
  if (!socket.connected) socket.connect();
  return socket;
};

/** Promise wrapper around an ack-based emit. */
export const emitAck = (event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));
