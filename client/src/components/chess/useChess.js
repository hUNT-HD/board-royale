import { useCallback, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';

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
      if (m) { setSelected(null); sync(); }
      return m;
    } catch { return null; }
  }, [game, sync]);

  /** Apply an opponent's move received over the wire. */
  const applyRemote = useCallback((mv) => {
    try { game.move(mv); sync(); } catch { /* ignore desync */ }
  }, [game, sync]);

  const reset = useCallback(() => { game.reset(); setSelected(null); sync(); }, [game, sync]);

  return {
    game, fen, board, turn, inCheck, isOver, result,
    selected, legalTargets, select, move, applyRemote, reset,
  };
}
