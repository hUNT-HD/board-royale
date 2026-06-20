/**
 * StockfishAdapter — thin UCI wrapper around the Stockfish WASM worker for the
 * Solo AI bot. Pure logic: it speaks UCI and resolves a best move string; it
 * never touches the DOM. The worker is injected or lazily created so this stays
 * testable and renderer-independent.
 */
const DEFAULT_ENGINE =
  'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js';

export default class StockfishAdapter {
  /** @param {{ worker?: Worker, engineUrl?: string }} opts */
  constructor({ worker = null, engineUrl = DEFAULT_ENGINE } = {}) {
    this._engineUrl = engineUrl;
    this._worker = worker || this._spawn();
    this._resolver = null;
    this._worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : e.data?.data || '';
      if (line.startsWith('bestmove')) {
        const mv = line.split(' ')[1];
        this._resolver?.(mv && mv !== '(none)' ? mv : null);
        this._resolver = null;
      }
    };
    this._send('uci'); this._send('isready');
  }

  _spawn() {
    const src = `importScripts('${this._engineUrl}');`;
    return new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  }
  _send(cmd) { this._worker.postMessage(cmd); }

  /** Resolve to a UCI move ("e2e4" / "e7e8q") or null. */
  bestMove(fen, { skill = 10, movetime = 800 } = {}) {
    return new Promise((resolve) => {
      this._resolver = resolve;
      this._send(`setoption name Skill Level value ${skill}`);
      this._send(`position fen ${fen}`);
      this._send(`go movetime ${movetime}`);
    });
  }

  dispose() { this._worker?.terminate(); }
}
