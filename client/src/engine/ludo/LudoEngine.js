/**
 * LudoEngine — strict, rule-complete Ludo (2–6 players). Pure logic, no UI.
 * Implements the IGameEngine contract.
 *
 * Token progress is a single integer `rel` (relative to the token's own start):
 *   rel = -1                          → IN_BASE
 *   rel ∈ [0 .. track-2]              → ON_TRACK (outer ring)
 *   rel ∈ [track-1 .. finishRel-1]    → ON_TRACK (private home stretch)
 *   rel = finishRel                   → FINISHED (home centre)
 *
 * Public state machine: rollDice() → (auto-skip | forfeit | await move) →
 * moveToken() → (extra turn | next turn). Renderers only read getSnapshot().
 */
import IGameEngine, { GAME_TYPE } from '../IGameEngine.js';
import {
  boardFor, globalIndex, isSafe, TOKENS_PER_PLAYER,
} from './ludoBoard.js';

export const TOKEN_STATE = Object.freeze({ IN_BASE: 'IN_BASE', ON_TRACK: 'ON_TRACK', FINISHED: 'FINISHED' });
export const PHASE = Object.freeze({ ROLL: 'ROLL', MOVE: 'MOVE', OVER: 'OVER' });

export default class LudoEngine extends IGameEngine {
  constructor(config = {}) { super(GAME_TYPE.LUDO); this._cfgInput = config; }

  /* ------------------------------- setup -------------------------------- */
  init(config = this._cfgInput) {
    const colors = config.colors || ['red', 'green', 'yellow', 'blue'];
    this.board = boardFor(colors.length);          // 52- or 78-cell config
    this.colors = colors;                          // active colours (subset)
    this.botColors = new Set(config.botColors || []);
    this.players = colors.map((color, seat) => ({
      color, seat,
      tokens: Array.from({ length: TOKENS_PER_PLAYER }, (_, id) => ({ id, rel: -1 })),
      finished: 0,
    }));
    this.turn = 0;
    this.dice = null;
    this.sixStreak = 0;
    this.phase = PHASE.ROLL;
    this.validMoves = [];
    this.winner = null;
    this.lastEvents = [];
    return this;
  }

  /* --------------------------- pure helpers ----------------------------- */
  tokenState(rel) {
    if (rel < 0) return TOKEN_STATE.IN_BASE;
    if (rel >= this.board.finishRel) return TOKEN_STATE.FINISHED;
    return TOKEN_STATE.ON_TRACK;
  }
  _gi(color, rel) { return globalIndex(this.board, color, rel); }
  getCurrentActor() { return this.players[this.turn]?.color ?? null; }
  isGameOver() { return this.winner !== null; }

  /* ============================ CORE RULES ============================== */

  /** rollDice — roll for the current player and resolve immediate outcomes. */
  rollDice() {
    if (this.phase !== PHASE.ROLL || this.winner) return { error: 'Not expecting a roll.' };
    const dice = 1 + Math.floor(Math.random() * 6);
    this.dice = dice;
    this.sixStreak = dice === 6 ? this.sixStreak + 1 : 0;

    // Rule: three consecutive 6s → 3rd roll moves nothing, turn forfeited.
    if (dice === 6 && this.sixStreak >= 3) {
      this.dice = null;
      this.lastEvents = [{ type: 'FORFEIT_THREE_SIXES', color: this.getCurrentActor() }];
      this._nextTurn();
      return { dice, forfeited: true, moves: [] };
    }

    const moves = this.calculateValidMoves(dice);

    // Rule: no legal move → auto-skip to the next player immediately.
    if (moves.length === 0) {
      this.dice = null;
      this.lastEvents = [{ type: 'AUTO_SKIP', color: this.getCurrentActor(), dice }];
      this._nextTurn();
      return { dice, autoSkip: true, moves: [] };
    }

    this.validMoves = moves;
    this.phase = PHASE.MOVE;
    return { dice, moves };
  }

  /** calculateValidMoves — every legal move for current player & dice. */
  calculateValidMoves(dice = this.dice) {
    const player = this.players[this.turn];
    const out = [];
    for (const t of player.tokens) {
      const st = this.tokenState(t.rel);
      if (st === TOKEN_STATE.FINISHED) continue;
      let to;
      if (st === TOKEN_STATE.IN_BASE) {
        if (dice !== 6) continue;                       // unlock requires exactly a 6
        to = 0;
      } else {
        to = t.rel + dice;
        if (to > this.board.finishRel) continue;        // must land EXACTLY on home
      }
      const gi = to <= this.board.track - 2 ? this._gi(player.color, to) : null;
      out.push({
        type: 'MOVE', tokenId: t.id, from: t.rel, to,
        willFinish: to === this.board.finishRel,
        willCapture: gi !== null && !isSafe(this.board, gi) &&
          this.players.some((op) => op.color !== player.color &&
            op.tokens.some((ot) => this._gi(op.color, ot.rel) === gi)),
      });
    }
    return out;
  }

  /** checkCapture — reset every opponent token on `gi` (if not safe) to IN_BASE. */
  checkCapture(color, gi) {
    const captured = [];
    if (gi === null || isSafe(this.board, gi)) return captured;
    for (const op of this.players) {
      if (op.color === color) continue;
      for (const ot of op.tokens) {
        if (this._gi(op.color, ot.rel) === gi) { ot.rel = -1; captured.push({ color: op.color, tokenId: ot.id }); }
      }
    }
    return captured;
  }

  /** moveToken — apply a validated move and decide on an extra turn. */
  moveToken(tokenId) {
    if (this.phase !== PHASE.MOVE) return { error: 'Roll first.' };
    const player = this.players[this.turn];
    const mv = this.validMoves.find((m) => m.tokenId === tokenId);
    if (!mv) return { error: 'Illegal move.' };

    const token = player.tokens[tokenId];
    token.rel = mv.to;

    const events = [];
    let captured = [], finished = false;
    if (token.rel === this.board.finishRel) {
      finished = true;
      player.finished += 1;
      events.push({ type: 'FINISH', color: player.color, tokenId });
      if (player.finished === TOKENS_PER_PLAYER) { this.winner = player.color; events.push({ type: 'WIN', color: player.color }); }
    } else {
      captured = this.checkCapture(player.color, this._gi(player.color, token.rel));
      if (captured.length) events.push({ type: 'CAPTURE', by: player.color, captured });
    }

    // Extra turn on: a 6, a capture, or sending a token home.
    const extra = this.dice === 6 || captured.length > 0 || finished;
    this.dice = null; this.validMoves = [];

    if (this.winner) this.phase = PHASE.OVER;
    else if (extra) { this.phase = PHASE.ROLL; events.push({ type: 'EXTRA_TURN', color: player.color }); }
    else this._nextTurn();

    this.lastEvents = events;
    return { captured, finished, extra, events };
  }

  _nextTurn() {
    const n = this.players.length;
    let next = this.turn;
    for (let i = 0; i < n; i++) { next = (next + 1) % n; if (this.players[next].finished < TOKENS_PER_PLAYER) break; }
    this.turn = next; this.dice = null; this.sixStreak = 0; this.validMoves = []; this.phase = PHASE.ROLL;
  }

  /** Priority bot: capture > finish > unlock > advance furthest. */
  chooseBotMove() {
    if (!this.validMoves.length) return null;
    let best = this.validMoves[0], score = -Infinity;
    for (const m of this.validMoves) {
      let s = m.to;
      if (m.willCapture) s += 600;
      if (m.willFinish) s += 1000;
      if (m.from === -1) s += 60;
      if (s > score) { score = s; best = m; }
    }
    return best.tokenId;
  }

  /* ---------------------- IGameEngine interface ------------------------- */
  getLegalActions() {
    if (this.phase === PHASE.ROLL) return [{ type: 'ROLL' }];
    return this.validMoves;
  }

  applyAction(action) {
    if (action.type === 'ROLL') return this.rollDice();
    if (action.type === 'MOVE') return this.moveToken(action.tokenId);
    return { error: `Unknown action ${action.type}` };
  }

  async requestAIMove() {
    // Solo bot driver: caller loops this while the current actor is a bot.
    if (this.phase === PHASE.ROLL) return { type: 'ROLL' };
    if (this.phase === PHASE.MOVE) {
      const id = this.chooseBotMove();
      return id == null ? null : { type: 'MOVE', tokenId: id };
    }
    return null;
  }

  /** Renderer-agnostic snapshot. `logical` is for the renderer to position. */
  getSnapshot() {
    return {
      type: GAME_TYPE.LUDO,
      status: this.winner ? 'OVER' : this.phase,
      currentActor: this.getCurrentActor(),
      winner: this.winner,
      meta: {
        dice: this.dice,
        phase: this.phase,
        sixStreak: this.sixStreak,
        track: this.board.track,
        safe: [...this.board.safe],
        starts: this.board.starts,
      },
      highlights: this.phase === PHASE.MOVE ? this.validMoves.map((m) => ({ color: this.getCurrentActor(), tokenId: m.tokenId })) : [],
      entities: this.players.flatMap((p) =>
        p.tokens.map((t) => ({
          kind: 'token',
          id: `${p.color}-${t.id}`,
          color: p.color,
          tokenId: t.id,
          state: this.tokenState(t.rel),
          logical: { rel: t.rel, global: this._gi(p.color, t.rel) }, // → renderer maps to 2D/3D
        }))
      ),
      players: this.players.map((p) => ({ color: p.color, finished: p.finished, isBot: this.botColors.has(p.color) })),
      lastEvents: this.lastEvents,
    };
  }

  serialize() {
    return {
      colors: this.colors,
      players: this.players.map((p) => ({ color: p.color, finished: p.finished, tokens: p.tokens.map((t) => ({ id: t.id, rel: t.rel })) })),
      turn: this.turn, dice: this.dice, sixStreak: this.sixStreak, phase: this.phase,
      validMoves: this.validMoves, winner: this.winner,
    };
  }

  loadSnapshot(s) {
    if (!this.board) this.init({ colors: s.colors });
    this.players = s.players.map((p) => ({ color: p.color, seat: this.colors.indexOf(p.color), finished: p.finished, tokens: p.tokens }));
    this.turn = s.turn; this.dice = s.dice; this.sixStreak = s.sixStreak;
    this.phase = s.phase; this.validMoves = s.validMoves || []; this.winner = s.winner;
  }
}
