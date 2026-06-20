import { useCallback, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { sound } from '../../sound.js';

const playMoveSound = (game, m) => {
  if (!m) return;
  if (game.isGameOver()) return;            // win/lose handled by the page
  if (m.captured || m.flags.includes('e')) sound.capture(); else sound.move();
  if (game.inCheck()) sound.check();
};

// captured material from the current board (for the side panel)
function computeCaptured(board) {
  const START = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const cur = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  board.forEach((row) => row.forEach((sq) => { if (sq && sq.type !== 'k') cur[sq.color][sq.type]++; }));
  const lost = (col) => { const out = []; for (const t of ['q', 'r', 'b', 'n', 'p']) for (let i = 0; i < START[t] - cur[col][t]; i++) out.push(t); return out; };
  return { w: lost('w'), b: lost('b') }; // w = white pieces captured (by black), b = black pieces captured
}

/**
 * useChess — wraps chess.js as the single source of truth for the board.
 * Exposes board matrix, legal-move targets, and a guarded `move()` that returns
 * the SAN/verbose move (or null if illegal) so callers can sync over Socket.io.
 */
export function useChess(initialFen) {
  const game = useRef(new Chess(initialFen)).current;
  const [fen, setFen] = useState(game.fen());
  const [selected, setSelected] = useState(null); // e.g. 'e2'

  const sync = useCallback(() => setFen(game.fen()), [game]);

  // 8x8 matrix of { type, color } | null, rank 8 (top) -> rank 1 (bottom).
  const board = useMemo(() => game.board(), [fen]); // eslint-disable-line

  const turn = game.turn();                 // 'w' | 'b'
  const inCheck = game.inCheck();
  const isOver = game.isGameOver();
  const result = isOver
    ? game.isCheckmate() ? `${turn === 'w' ? 'Black' : 'White'} wins by checkmate`
    : game.isDraw() ? 'Draw' : 'Game over'
    : null;

  const history = useMemo(() => game.history(), [fen]); // eslint-disable-line
  const lastMove = useMemo(() => {
    const h = game.history({ verbose: true });
    return h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null;
  }, [fen]); // eslint-disable-line
  const checkSquare = useMemo(() => {
    if (!game.inCheck()) return null;
    const t = game.turn(); const b = game.board();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const sq = b[r][c]; if (sq && sq.type === 'k' && sq.color === t) return `${'abcdefgh'[c]}${8 - r}`;
    }
    return null;
  }, [fen]); // eslint-disable-line
  const captured = useMemo(() => computeCaptured(game.board()), [fen]); // eslint-disable-line

  /** Legal destination squares for the currently selected piece. */
  const legalTargets = useMemo(() => {
    if (!selected) return [];
    return game.moves({ square: selected, verbose: true }).map((m) => ({
      to: m.to, capture: m.flags.includes('c') || m.flags.includes('e'),
    }));
  }, [selected, fen]); // eslint-disable-line

  const select = useCallback((square) => {
    const piece = game.get(square);
    if (piece && piece.color === turn) setSelected(square);
    else setSelected(null);
  }, [game, turn]);

  /** Attempt a move; auto-queens promotions. Returns verbose move or null. */
  const move = useCallback((from, to) => {
    try {
      const m = game.move({ from, to, promotion: 'q' });
      if (m) { playMoveSound(game, m); setSelected(null); sync(); }
      return m;
    } catch { return null; }
  }, [game, sync]);

  /** Apply an opponent's move received over the wire. */
  const applyRemote = useCallback((mv) => {
    try { const m = game.move(mv); playMoveSound(game, m); sync(); } catch { /* ignore desync */ }
  }, [game, sync]);

  const reset = useCallback(() => { game.reset(); setSelected(null); sync(); }, [game, sync]);
  const undo = useCallback((n = 1) => { for (let i = 0; i < n; i++) game.undo(); setSelected(null); sync(); }, [game, sync]);

  return {
    game, fen, board, turn, inCheck, isOver, result,
    selected, legalTargets, select, move, applyRemote, reset, undo,
    history, lastMove, checkSquare, captured,
  };
}
