import { useEffect, useRef, useCallback } from 'react';

/**
 * useStockfish — offline chess AI (UCI) tuned to feel human and scale with level.
 *
 * Difficulty (0–20) controls THREE things so it's neither dumb nor repetitive:
 *   • Strength   — engine Skill Level + thinking time grow with level.
 *   • Variety    — MultiPV gives the top N candidate moves; at lower levels we
 *                  pick (weighted-random) among them, so games don't repeat.
 *   • Mistakes   — lower levels occasionally choose a weaker candidate.
 * At top level it plays the single best move with deep-ish search.
 */
const ENGINE_URL =
  import.meta.env.VITE_STOCKFISH_URL ||
  'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js';

export function useStockfish() {
  const engine = useRef(null);
  const handler = useRef(null); // active line handler for the current search

  useEffect(() => {
    let worker;
    try {
      const src = `importScripts('${ENGINE_URL}');`;
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    } catch { engine.current = null; return undefined; }

    worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : e.data?.data || '';
      handler.current?.(line);
    };
    worker.onerror = () => {};
    worker.postMessage('uci');
    worker.postMessage('isready');
    engine.current = worker;
    return () => { try { worker.terminate(); } catch { /* noop */ } };
  }, []);

  /** Resolve a UCI move chosen for the given difficulty, or null (caller falls back). */
  const bestMove = useCallback((fen, { level = 8, timeout = 6000 } = {}) =>
    new Promise((resolve) => {
      const eng = engine.current;
      if (!eng) return resolve(null);

      const lvl = Math.max(0, Math.min(20, level));
      const skill = Math.round(lvl);                 // engine internal strength 0–20
      const movetime = Math.round(280 + lvl * 75);   // 280ms .. ~1.8s
      const multipv = lvl >= 18 ? 1 : 4;             // candidate moves to consider
      const mistakeChance = Math.max(0, Math.min(0.78, (20 - lvl) / 25));

      const candidates = [];                         // index = multipv rank-1 → move
      let done = false;
      const fallback = () => candidates.find(Boolean) || null;
      const finish = (mv) => {
        if (done) return; done = true;
        handler.current = null; clearTimeout(timer);
        resolve(mv && mv !== '(none)' ? mv : null);
      };
      const timer = setTimeout(() => finish(fallback()), timeout);

      handler.current = (line) => {
        if (line.startsWith('info') && line.includes('multipv')) {
          const mp = line.match(/multipv (\d+)/);
          const pv = line.match(/ pv (\S+)/);
          if (mp && pv) candidates[+mp[1] - 1] = pv[1];     // latest (deepest) wins
        } else if (line.startsWith('bestmove')) {
          const best = line.split(' ')[1];
          const cands = candidates.filter(Boolean);
          if (cands.length <= 1) return finish(cands[0] || best);
          // usually best; sometimes a weaker candidate (more often at low level)
          let chosen = cands[0];
          if (Math.random() < mistakeChance) {
            const weights = cands.map((_, i) => Math.pow(0.5, i)); // favour stronger moves
            const total = weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * total, i = 0;
            for (; i < weights.length; i++) { r -= weights[i]; if (r <= 0) break; }
            chosen = cands[Math.min(i, cands.length - 1)];
          }
          finish(chosen || best);
        }
      };

      eng.postMessage('ucinewgame');
      eng.postMessage(`setoption name Skill Level value ${skill}`);
      eng.postMessage(`setoption name MultiPV value ${multipv}`);
      eng.postMessage(`position fen ${fen}`);
      eng.postMessage(`go movetime ${movetime}`);
    }), []);

  return { bestMove };
}
