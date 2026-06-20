import { useEffect, useRef, useCallback } from 'react';

/**
 * useStockfish — offline chess AI via a Web Worker speaking UCI.
 *
 * Uses the small, single-file Stockfish build (no huge NNUE network) so it
 * downloads in ~1s and replies fast. `bestMove(fen, opts)` resolves with a move
 * like "e2e4"/"e7e8q", or null if the engine isn't ready / times out — callers
 * then fall back to a random legal move so the game never hangs.
 */
const ENGINE_URL =
  import.meta.env.VITE_STOCKFISH_URL ||
  'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js'; // ~ light, fast to load

export function useStockfish() {
  const engine = useRef(null);
  const resolver = useRef(null);
  const ready = useRef(false);

  useEffect(() => {
    let worker;
    try {
      const src = `importScripts('${ENGINE_URL}');`;
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    } catch {
      engine.current = null;
      return;
    }

    worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : e.data?.data || '';
      if (line === 'uciok' || line === 'readyok') ready.current = true;
      if (line.startsWith('bestmove')) {
        const move = line.split(' ')[1];
        resolver.current?.(move && move !== '(none)' ? move : null);
        resolver.current = null;
      }
    };
    worker.onerror = () => { resolver.current?.(null); resolver.current = null; };
    worker.postMessage('uci');
    worker.postMessage('isready');
    engine.current = worker;

    return () => { try { worker.terminate(); } catch { /* noop */ } };
  }, []);

  /**
   * Resolve a best move. `timeout` guarantees we never wait forever (engine still
   * downloading, blocked, etc.) — on timeout we resolve null and the caller plays
   * a fallback move.
   */
  const bestMove = useCallback((fen, { skillLevel = 8, movetime = 500, timeout = 4000 } = {}) =>
    new Promise((resolve) => {
      const eng = engine.current;
      if (!eng) return resolve(null);
      let settled = false;
      const done = (mv) => { if (!settled) { settled = true; resolve(mv); } };
      resolver.current = done;
      const t = setTimeout(() => done(null), timeout);
      const wrapped = resolver.current;
      resolver.current = (mv) => { clearTimeout(t); wrapped(mv); };
      eng.postMessage(`setoption name Skill Level value ${skillLevel}`);
      eng.postMessage(`position fen ${fen}`);
      eng.postMessage(`go movetime ${movetime}`);
    }), []);

  return { bestMove };
}
