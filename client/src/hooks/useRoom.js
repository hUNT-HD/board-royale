import { useCallback, useEffect, useState } from 'react';
import { ensureConnected, emitAck, socket } from '../socket.js';

/**
 * Shared room lifecycle for both games.
 * Returns helpers to create/join/start a private room and live room state.
 */
export function useRoom(game) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    // pre-connect so the free-tier server starts waking up immediately
    ensureConnected();
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
    setError(null); setBusy(true);
    const res = await emitAck('room:create', { game, name });
    setBusy(false);
    if (res.error) { setError(res.error); return null; }
    setRoom(res.room);
    return res.code;
  }, [game]);

  const join = useCallback(async (code, name) => {
    setError(null); setBusy(true);
    const res = await emitAck('room:join', { code, name });
    setBusy(false);
    if (res.error) { setError(res.error); return false; }
    setRoom(res.room);
    return true;
  }, []);

  const start = useCallback(async () => {
    setBusy(true);
    const res = await emitAck('room:start', { code: room?.code });
    setBusy(false);
    if (res.error) setError(res.error);
  }, [room]);

  const pickColor = useCallback(async (color) => {
    setError(null);
    const res = await emitAck('room:pickColor', { code: room?.code, color });
    if (res.error) setError(res.error);
  }, [room]);

  return { room, error, busy, connected, create, join, start, pickColor, setError };
}
