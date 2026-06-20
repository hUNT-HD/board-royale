/**
 * ChessEngine — implements IGameEngine by delegating ALL chess rules to
 * chess.js. There are deliberately ZERO custom chess rules here: legal moves,
 * captures, castling, en-passant, promotion, check and checkmate detection all
 * come from chess.js. Solo AI is delegated to StockfishAdapter.
 *
 * The snapshot exposes pieces by logical square ("e4"), never pixels — so the
 * 2D SVG board and the 3D WebGL board consume the exact same data.
 */
import { Chess } from 'chess.js';
import IGameEngine, { GAME_TYPE } from '../IGameEngine.js';
import StockfishAdapter from './StockfishAdapter.js';

export default class ChessEngine extends IGameEngine {
  constructor(config = {}) { super(GAME_TYPE.CHESS); this._cfg = config; }

  init(config = this._cfg) {
    this.chess = new Chess(config.fen || undefined);
    this.mode = config.mode || 'solo';
    this.localColor = config.localActor || 'w';   // human side in solo
    this.aiColor = config.aiColor || 'b';
    this.aiSkill = config.aiSkill ?? 10;
    this._ai = null;                              // lazily created (needs a Worker env)
    return this;
  }

  /* ----------------------- rules: delegate to chess.js ------------------ */
  getCurrentActor() { return this.chess.turn(); }      // 'w' | 'b'
  isGameOver() { return this.chess.isGameOver(); }

  /** Legal actions for the side to move (optionally filtered by a square). */
  getLegalActions(square = null) {
    const opts = { verbose: true, ...(square ? { square } : {}) };
    return this.chess.moves(opts).map((m) => ({
      type: 'MOVE', from: m.from, to: m.to,
      promotion: m.promotion || null,
      flags: m.flags, san: m.san, capture: m.flags.includes('c') || m.flags.includes('e'),
    }));
  }

  applyAction(action) {
    if (action.type !== 'MOVE') return { error: `Unknown action ${action.type}` };
    try {
      const m = this.chess.move({ from: action.from, to: action.to, promotion: action.promotion || 'q' });
      if (!m) return { error: 'Illegal move.' };
      return { events: [{ type: 'MOVE', san: m.san, capture: !!m.captured, check: this.chess.inCheck() }] };
    } catch { return { error: 'Illegal move.' }; }
  }

  /* ------------------------------ Solo AI ------------------------------- */
  async requestAIMove() {
    if (this.chess.isGameOver()) return null;
    if (!this._ai) this._ai = new StockfishAdapter();
    const uci = await this._ai.bestMove(this.chess.fen(), { skill: this.aiSkill });
    if (!uci) return null;
    return { type: 'MOVE', from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || null };
  }

  /* ------------------------- snapshot / sync ---------------------------- */
  getSnapshot() {
    const board = this.chess.board(); // 8x8 of {type,color}|null, rank 8 → 1
    const pieces = [];
    board.forEach((row, r) => row.forEach((sq, c) => {
      if (sq) pieces.push({
        kind: 'piece', id: `${sq.color}${sq.type}-${'abcdefgh'[c]}${8 - r}`,
        type: sq.type, color: sq.color,
        logical: { square: `${'abcdefgh'[c]}${8 - r}` }, // → renderer maps to 2D/3D
      });
    }));
    return {
      type: GAME_TYPE.CHESS,
      status: this.chess.isCheckmate() ? 'CHECKMATE' : this.chess.isDraw() ? 'DRAW'
        : this.chess.isGameOver() ? 'OVER' : 'PLAYING',
      currentActor: this.chess.turn(),
      winner: this.chess.isCheckmate() ? (this.chess.turn() === 'w' ? 'b' : 'w') : null,
      meta: { fen: this.chess.fen(), inCheck: this.chess.inCheck(), turn: this.chess.turn() },
      highlights: [],                  // renderer requests per-square via getLegalActions(square)
      entities: pieces,
    };
  }

  serialize() { return { fen: this.chess.fen() }; }
  loadSnapshot(state) { if (state?.fen) this.chess.load(state.fen); }
}
