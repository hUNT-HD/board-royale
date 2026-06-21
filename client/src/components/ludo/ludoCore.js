/**
 * ludoCore.js — Authoritative, rule-complete Ludo engine (4- and 6-player).
 *
 * One central state object drives everything; all mutations go through the
 * exported functions. The same engine powers both board geometries — only the
 * track length / start offsets differ (injected via config).
 *
 * ── Board mathematics ──────────────────────────────────────────────────────
 *  4-player: outer track = 52 cells. Starts Red 0, Green 13, Yellow 26, Blue 39.
 *  6-player: outer track = 78 cells. Starts Red 0, Green 13, Yellow 26, Blue 39,
 *            Purple 52, Orange 65.
 *  Each colour then has a private 5-cell HOME STRETCH and one final HOME cell.
 *
 *  A token's progress is stored as `rel` (relative to its own start):
 *     rel = -1                         → IN_BASE
 *     rel ∈ [0 .. track-2]             → ON_TRACK   (track-1 outer cells)
 *     rel ∈ [track-1 .. track-1+4]     → HOME_STRETCH (5 cells)
 *     rel = track-1+5 (= FINISH)       → HOME (finished)
 *
 *  Global outer-track index of a token = (start[colour] + rel) % track, valid
 *  only while ON_TRACK. This is how collisions between colours are detected.
 *
 * ── Rules enforced ─────────────────────────────────────────────────────────
 *  • Unlock from base only on a 6.
 *  • Exact finish: a move overshooting HOME is illegal.
 *  • Capture: landing on an opponent on a non-safe outer cell sends it IN_BASE.
 *  • Safe zones (immutable): every colour's start cell + the star 8 ahead.
 *  • Bonus roll on: rolling a 6, capturing, or sending a token HOME.
 *  • Three 6s in a row → the 3rd roll is nullified and the turn is forfeited.
 *  • No legal move → turn auto-skips to the next active player.
 */

export const STATE = Object.freeze({
  IN_BASE: 'IN_BASE', ON_TRACK: 'ON_TRACK', HOME_STRETCH: 'HOME_STRETCH', HOME: 'HOME',
});
export const PHASE = Object.freeze({ ROLL: 'ROLL', MOVE: 'MOVE', OVER: 'OVER' });

const HOME_LEN = 5;
const STAR_AHEAD = 8;
const TOKENS = 4;

const CONFIG = {
  square: {
    track: 52,
    starts: { red: 0, green: 13, yellow: 26, blue: 39 },
  },
  hex: {
    // start sits at each colour's own edge-mid (+7), so a token unlocks directly
    // in front of its house and, after a full loop, turns into its own home lane.
    track: 78,
    starts: { red: 7, green: 20, yellow: 33, blue: 46, purple: 59, orange: 72 },
  },
};

/** Build the immutable safe-zone set for a config (starts + stars, all colours). */
function buildSafe({ track, starts }) {
  const safe = new Set();
  for (const s of Object.values(starts)) { safe.add(s); safe.add((s + STAR_AHEAD) % track); }
  return safe;
}

/** Create a fresh central game state. */
export function createGame(mode, colors) {
  const base = CONFIG[mode];
  const cfg = {
    mode,
    track: base.track,
    homeLen: HOME_LEN,
    starts: base.starts,
    safe: buildSafe(base),
    finish: base.track - 1 + HOME_LEN, // exact rel that means HOME
  };
  return {
    cfg,
    players: colors.map((color, seat) => ({
      color, seat,
      tokens: Array.from({ length: TOKENS }, (_, id) => ({ id, rel: -1 })),
      finished: 0,
    })),
    turn: 0,
    dice: null,
    sixStreak: 0,
    phase: PHASE.ROLL,
    validMoves: [],
    winner: null,
    lastEvent: null, // { captured, finished, forfeited, autoPass, extra }
  };
}

/* ---------- pure helpers ---------- */

export function tokenState(cfg, rel) {
  if (rel < 0) return STATE.IN_BASE;
  if (rel <= cfg.track - 2) return STATE.ON_TRACK;
  if (rel < cfg.finish) return STATE.HOME_STRETCH;
  return STATE.HOME;
}

/** Global outer-track index, or null if the token is not ON_TRACK. */
export function globalIndex(cfg, color, rel) {
  if (rel < 0 || rel > cfg.track - 2) return null;
  return (cfg.starts[color] + rel) % cfg.track;
}

export const isSafeIndex = (cfg, gi) => gi !== null && cfg.safe.has(gi);

/**
 * calculateValidMoves — every legal move for the current player & dice value.
 * Returns [{ tokenId, from, to, willCapture, willFinish }]. Computed BEFORE the
 * player clicks, so the UI can highlight or auto-skip.
 */
export function calculateValidMoves(state, dice) {
  const { cfg } = state;
  const player = state.players[state.turn];
  const moves = [];
  for (const t of player.tokens) {
    const st = tokenState(cfg, t.rel);
    if (st === STATE.HOME) continue;
    let to;
    if (st === STATE.IN_BASE) {
      if (dice !== 6) continue;     // unlock only on a 6
      to = 0;
    } else {
      to = t.rel + dice;
      if (to > cfg.finish) continue; // must land EXACTLY on HOME
    }
    const willFinish = to === cfg.finish;
    const gi = to <= cfg.track - 2 ? (cfg.starts[player.color] + to) % cfg.track : null;
    const willCapture = gi !== null && !cfg.safe.has(gi) &&
      state.players.some((op) => op.color !== player.color &&
        op.tokens.some((ot) => globalIndex(cfg, op.color, ot.rel) === gi));
    moves.push({ tokenId: t.id, from: t.rel, to, willFinish, willCapture });
  }
  return moves;
}

/**
 * rollDice — roll for the current player and resolve immediate turn outcomes.
 * Returns { dice, moves, forfeited?, autoPass? }.
 *   forfeited: third consecutive 6 → roll nullified, turn passed.
 *   autoPass : no legal move → turn passed automatically.
 * On a normal roll with moves, phase becomes MOVE and state.validMoves is set.
 */
export function rollDice(state) {
  if (state.phase !== PHASE.ROLL || state.winner) return { error: 'Not expecting a roll.' };
  const dice = 1 + Math.floor(Math.random() * 6);
  state.dice = dice;
  state.sixStreak = dice === 6 ? state.sixStreak + 1 : 0;

  // Three 6s in a row → nullify the third and forfeit the turn.
  if (dice === 6 && state.sixStreak >= 3) {
    state.lastEvent = { forfeited: true };
    state.dice = null;
    nextTurn(state); // also resets sixStreak
    return { dice, forfeited: true, moves: [] };
  }

  const moves = calculateValidMoves(state, dice);
  if (moves.length === 0) {
    state.lastEvent = { autoPass: true };
    state.dice = null;
    nextTurn(state);
    return { dice, autoPass: true, moves: [] };
  }

  state.validMoves = moves;
  state.phase = PHASE.MOVE;
  return { dice, moves };
}

/**
 * checkCapture — reset every opponent token sitting on `gi` (if not safe) back
 * to IN_BASE. Returns the list of captured { color, tokenId }. Pure w.r.t. dice.
 */
export function checkCapture(state, color, gi) {
  const { cfg } = state;
  const captured = [];
  if (gi === null || cfg.safe.has(gi)) return captured;
  for (const op of state.players) {
    if (op.color === color) continue;
    for (const ot of op.tokens) {
      if (globalIndex(cfg, op.color, ot.rel) === gi) {
        ot.rel = -1; // send home
        captured.push({ color: op.color, tokenId: ot.id });
      }
    }
  }
  return captured;
}

/**
 * moveToken — apply the chosen (validated) move, resolve capture/finish, and
 * decide whether the same player rolls again. Returns { captured, finished, extra }.
 */
export function moveToken(state, tokenId) {
  if (state.phase !== PHASE.MOVE) return { error: 'Roll first.' };
  const { cfg } = state;
  const player = state.players[state.turn];
  const mv = state.validMoves.find((m) => m.tokenId === tokenId);
  if (!mv) return { error: 'Illegal move.' };

  const token = player.tokens[tokenId];
  token.rel = mv.to;

  let captured = [];
  let finished = false;
  if (token.rel === cfg.finish) {
    finished = true;
    player.finished += 1;
    if (player.finished === TOKENS) state.winner = player.color;
  } else {
    const gi = globalIndex(cfg, player.color, token.rel);
    captured = checkCapture(state, player.color, gi);
  }

  // Bonus roll on a 6, on a capture, or on sending a token HOME.
  const extra = state.dice === 6 || captured.length > 0 || finished;
  state.dice = null;
  state.validMoves = [];
  state.lastEvent = { captured, finished, extra };

  if (state.winner) { state.phase = PHASE.OVER; }
  else if (extra) { state.phase = PHASE.ROLL; }       // same player rolls again
  else { nextTurn(state); }                           // resets phase + sixStreak

  return { captured, finished, extra };
}

/** Advance to the next player that still has tokens to move. */
export function nextTurn(state) {
  const n = state.players.length;
  let next = state.turn;
  for (let i = 0; i < n; i++) {
    next = (next + 1) % n;
    if (state.players[next].finished < TOKENS) break;
  }
  state.turn = next;
  state.dice = null;
  state.sixStreak = 0;
  state.validMoves = [];
  state.phase = PHASE.ROLL;
}

/**
 * Priority bot: capture > finish a token > unlock on a 6 > advance furthest.
 * Returns the tokenId to move (call after rollDice set validMoves), or null.
 */
export function botChoose(state) {
  const moves = state.validMoves;
  if (!moves.length) return null;
  let best = moves[0], score = -Infinity;
  for (const m of moves) {
    let s = m.to;
    if (m.willCapture) s += 600;
    if (m.willFinish) s += 1000;
    if (m.from === -1) s += 60;            // unlock
    if (s > score) { score = s; best = m; }
  }
  return best.tokenId;
}
