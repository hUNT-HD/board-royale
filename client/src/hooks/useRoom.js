import { useCallback, useEffect, useState } from 'react';
import { ensureConnected, emitAck, socket } from '../socket.js';

/**
 * Shared room lifecycle for both games.
 * Returns helpers to create/join/start a private room and live room state.
 */
export function useRoom(game) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onUpdate = (r) => setRoom(r);
    const onStarted = (r) => setRoom({ ...r, started: true });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:update', onUpdate);
    socket.on('game:started', onStarted);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:update', onUpdate);
      socket.off('game:started', onStarted);
    };
  }, []);

  const create = useCallback(async (name) => {
    ensureConnected();
    setError(null);
    const res = await emitAck('room:create', { game, name });
    if (res.error) return setError(res.error);
    setRoom(res.room);
    return res.code;
  }, [game]);

  const join = useCallback(async (code, name) => {
    ensureConnected();
    setError(null);
    const res = await emitAck('room:join', { code, name });
    if (res.error) { setError(res.error); return false; }
    setRoom(res.room);
    return true;
  }, []);

  const start = useCallback(async () => {
    const res = await emitAck('room:start', { code: room?.code });
    if (res.error) setError(res.error);
  }, [room]);

  return { room, error, connected, create, join, start, setError };
}
