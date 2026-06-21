/**
 * LudoEngine.js — unified, rule-complete Ludo engine for 2–6 players.
 *
 * ONE engine drives BOTH board geometries; only the track length / spawn offsets
 * differ (injected via CONFIG). 5- and 6-player games share the SAME 6-sided
 * hexagonal topology — a 5-player game is a 6-player board with one "ghost"
 * (inactive) base. The main-track mathematics never change.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  HEX TOPOLOGY (matches the visual reference exactly)
 * ─────────────────────────────────────────────────────────────────────────────
 *  Clockwise player order around the hexagon, with spawn (start) indices on the
 *  78-step outer ring. Each colour enters its private home stretch one index
 *  BEFORE its own start (i.e. after a full lap):
 *
 *    Player 1  Blue    (bottom)        start 0    → home after index 77
 *    Player 2  Yellow  (bottom-left)   start 13   → home after index 12
 *    Player 3  Purple  (top-left)      start 26   → home after index 25
 *    Player 4  Red     (top)           start 39   → home after index 38
 *    Player 5  Green   (top-right)     start 52   → home after index 51
 *    Player 6  Orange  (bottom-right)  start 65   → home after index 64
 *
 *  Safe zones (stars) — every start cell + the cell 8 steps ahead of it:
 *    [0, 8, 13, 21, 26, 34, 39, 47, 52, 60, 65, 73]
 *
 *  SQUARE TOPOLOGY (classic 4-player): 52-step ring, starts 0/13/26/39.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  TOKEN POSITION MODEL  (`rel` — relative to that colour's own start)
 * ─────────────────────────────────────────────────────────────────────────────
 *    rel = -1                              → IN_BASE
 *    rel ∈ [0 .. ringMax]                  → ON_TRACK   (globalIndex valid here)
 *    rel ∈ [ringMax+1 .. ringMax+homeLen]  → HOME_STRETCH (5 private cells)
 *    rel =  finish (= ringMax+homeLen+1)   → HOME (centre, finished)
 *
 *    HEX:    ringMax 77 → ON_TRACK 0..77, HOME 78..82, finish 83
 *    SQUARE: ringMax 50 → ON_TRACK 0..50, HOME 51..55, finish 56
 *
 *    Global outer-track index  =  (starts[colour] + rel) % track     (ON_TRACK only)
 *    This is how collisions / captures between colours are detected.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  RULES
 * ─────────────────────────────────────────────────────────────────────────────
 *   • Unlock from base only on a 6     (IN_BASE → rel 0).
 *   • Exact finish: a move overshooting the centre is illegal.
 *   • Capture: landing on an opponent on a NON-safe outer cell sends it IN_BASE.
 *   • Bonus roll on: a 6, a capture, or sending a token HOME.
 *   • Three consecutive 6s → the 3rd is nullified and the turn is forfeited.
 *   • No legal move → the turn auto-skips to the next ACTIVE player.
 *   • 5-player: nextTurn() iterates ONLY the active colours, so the missing 6th
 *     (ghost) seat is mathematically skipped — its base/home renders frosted but
 *     its outer-track cells stay fully walkable for everyone else.
 */

export const STATE = Object.freeze({
  IN_BASE: 'IN_BASE', ON_TRACK: 'ON_TRACK', HOME_STRETCH: 'HOME_STRETCH', HOME: 'HOME',
});
export const PHASE = Object.freeze({ ROLL: 'ROLL', MOVE: 'MOVE', OVER: 'OVER' });

const HOME_LEN = 5;
const STAR_AHEAD = 8;
const TOKENS = 4;

/* Spawn maps follow the exact clockwise reference topology. */
const CONFIG = {
  square: {
    track: 52,
    ringMax: 50,                       // home entry one lap in (classic 4-player)
    starts: { red: 0, green: 13, yellow: 26, blue: 39 },
  },
  hex: {
    track: 78,
    ringMax: 77,                       // enters home AFTER index 77 (= start - 1)
    starts: { blue: 0, yellow: 13, purple: 26, red: 39, green: 52, orange: 65 },
  },
  pent: {
    // 5-player pentagonal board: 65-step ring (5 arms × 13)
    track: 65,
    ringMax: 64,
    starts: { blue: 0, orange: 13, green: 26, red: 39, yellow: 52 },
  },
};

/** Immutable safe-zone set: every start cell + the star 8 steps ahead. */
function buildSafe({ track, starts }) {
  const safe = new Set();
  for (const s of Object.values(starts)) { safe.add(s); safe.add((s + STAR_AHEAD) % track); }
  return safe; // hex → {0,8,13,21,26,34,39,47,52,60,65,73}
}

/** Create a fresh central game state for `colors` (active players, in turn order). */
export function createGame(mode, colors) {
  const base = CONFIG[mode];
  const cfg = {
    mode,
    track: base.track,
    ringMax: base.ringMax,
    homeLen: HOME_LEN,
    starts: base.starts,
    safe: buildSafe(base),
    finish: base.ringMax + HOME_LEN + 1, // exact rel that means HOME (centre)
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
    ranking: [],          // finish order (1st, 2nd, …) — filled only as players complete
    lastEvent: null,
  };
}

/* ---------- pure helpers ---------- */

export function tokenState(cfg, rel) {
  if (rel < 0) return STATE.IN_BASE;
  if (rel <= cfg.ringMax) return STATE.ON_TRACK;
  if (rel < cfg.finish) return STATE.HOME_STRETCH;
  return STATE.HOME;
}

/** Global outer-track index, or null if the token is not ON_TRACK. */
export function globalIndex(cfg, color, rel) {
  if (rel < 0 || rel > cfg.ringMax) return null;
  return (cfg.starts[color] + rel) % cfg.track;
}

export const isSafeIndex = (cfg, gi) => gi !== null && cfg.safe.has(gi);

/**
 * calculateDestination — pure wrap-around / home-routing math for one move.
 * Returns the resulting `rel`, or null if the move overshoots the centre.
 *   • While ON_TRACK the global index is (start + rel) % track.
 *   • Once rel passes ringMax the token routes into its OWN home stretch — it can
 *     never lap the board twice, because rel > ringMax is defined as home.
 */
export function calculateDestination(cfg, fromRel, steps) {
  if (fromRel < 0) return steps === 6 ? 0 : null; // unlock only on a 6
  const to = fromRel + steps;
  return to > cfg.finish ? null : to;             // must land EXACTLY on centre
}

/**
 * calculateValidMoves — every legal move for the current player & dice value.
 * Returns [{ tokenId, from, to, willCapture, willFinish }].
 */
export function calculateValidMoves(state, dice) {
  const { cfg } = state;
  const player = state.players[state.turn];
  const moves = [];
  for (const t of player.tokens) {
    if (tokenState(cfg, t.rel) === STATE.HOME) continue;
    const to = calculateDestination(cfg, t.rel, dice);
    if (to === null) continue;
    const willFinish = to === cfg.finish;
    const gi = to <= cfg.ringMax ? (cfg.starts[player.color] + to) % cfg.track : null;
    const willCapture = gi !== null && !cfg.safe.has(gi) &&
      state.players.some((op) => op.color !== player.color &&
        op.tokens.some((ot) => globalIndex(cfg, op.color, ot.rel) === gi));
    moves.push({ tokenId: t.id, from: t.rel, to, willFinish, willCapture });
  }
  return moves;
}

/**
 * rollDice — roll for the current player and resolve immediate turn outcomes.
 *   forfeited: third consecutive 6 → roll nullified, turn passed.
 *   autoPass : no legal move → turn passed automatically.
 */
export function rollDice(state) {
  if (state.phase !== PHASE.ROLL || state.winner) return { error: 'Not expecting a roll.' };
  const dice = 1 + Math.floor(Math.random() * 6);
  state.dice = dice;
  state.sixStreak = dice === 6 ? state.sixStreak + 1 : 0;

  if (dice === 6 && state.sixStreak >= 3) {
    state.lastEvent = { forfeited: true };
    state.dice = null;
    nextTurn(state);
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

/** Reset every opponent token sitting on `gi` (if not safe) back to IN_BASE. */
export function checkCapture(state, color, gi) {
  const { cfg } = state;
  const captured = [];
  if (gi === null || cfg.safe.has(gi)) return captured;
  for (const op of state.players) {
    if (op.color === color) continue;
    for (const ot of op.tokens) {
      if (globalIndex(cfg, op.color, ot.rel) === gi) {
        ot.rel = -1;
        captured.push({ color: op.color, tokenId: ot.id });
      }
    }
  }
  return captured;
}

/** Apply the chosen (validated) move; resolve capture/finish; decide bonus roll. */
export function moveToken(state, tokenId) {
  if (state.phase !== PHASE.MOVE) return { error: 'Roll first.' };
  const { cfg } = state;
  const player = state.players[state.turn];
  const mv = state.validMoves.find((m) => m.tokenId === tokenId);
  if (!mv) return { error: 'Illegal move.' };

  const token = player.tokens[tokenId];
  token.rel = mv.to;

  let captured = [];
  let finished = false, podium = false;
  if (token.rel === cfg.finish) {
    finished = true;
    player.finished += 1;
    // a player who just brought ALL tokens home earns the next podium place
    if (player.finished === TOKENS && !state.ranking.includes(player.color)) {
      state.ranking.push(player.color);
      podium = true;
      // GAME OVER only once everyone but the last has finished
      if (state.ranking.length >= state.players.length - 1) {
        for (const pl of state.players) if (!state.ranking.includes(pl.color)) state.ranking.push(pl.color);
        state.winner = state.ranking[0];
      }
    }
  } else {
    captured = checkCapture(state, player.color, globalIndex(cfg, player.color, token.rel));
  }

  // bonus roll on a 6 / capture / finishing a token — but not once a player is fully done
  const fullyDone = player.finished === TOKENS;
  const extra = !fullyDone && (state.dice === 6 || captured.length > 0 || finished);
  state.dice = null;
  state.validMoves = [];
  state.lastEvent = { captured, finished, extra, podium };

  if (state.winner) state.phase = PHASE.OVER;      // full game over (all ranked)
  else if (extra) state.phase = PHASE.ROLL;        // same player rolls again
  else nextTurn(state);                            // resets phase + sixStreak

  return { captured, finished, extra, podium };
}

/** Advance to the next ACTIVE player that still has tokens to move (skips ghosts). */
export function nextTurn(state) {
  const n = state.players.length;                  // only active colours are present
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
 * Smarter bot — weighs every legal move instead of always pushing the lead token:
 *   capture an enemy ▸ unlock a new token (spread out) ▸ finish ▸ escape danger ▸
 *   reach safety ▸ enter home stretch ▸ mild progress. A pinch of randomness keeps
 *   it from looking robotic and repetitive.
 */
export function botChoose(state) {
  const moves = state.validMoves;
  if (!moves.length) return null;
  const { cfg } = state;
  const me = state.players[state.turn];

  // every opponent token currently on the shared track
  const oppGi = [];
  for (const op of state.players) {
    if (op.color === me.color) continue;
    for (const ot of op.tokens) { const gi = globalIndex(cfg, op.color, ot.rel); if (gi !== null) oppGi.push(gi); }
  }
  // a cell is "in danger" if an opponent sits 1–6 steps behind it and it isn't safe
  const danger = (gi) => gi !== null && !cfg.safe.has(gi)
    && oppGi.some((o) => { const d = (gi - o + cfg.track) % cfg.track; return d >= 1 && d <= 6; });

  // how many of my tokens are already out of base (in play)
  const out = me.tokens.filter((t) => t.rel >= 0 && t.rel < cfg.finish).length;

  let best = moves[0], score = -Infinity;
  for (const m of moves) {
    const toGi = m.to <= cfg.ringMax ? (cfg.starts[me.color] + m.to) % cfg.track : null;
    const fromGi = m.from >= 0 ? globalIndex(cfg, me.color, m.from) : null;
    let s = 0;
    if (m.willCapture) s += 1000;                          // send an enemy home
    if (m.from === -1) s += out <= 1 ? 600 : 380;          // get tokens out — don't play just one
    if (m.willFinish) s += 650;                            // bring a token home
    if (danger(fromGi)) s += 220;                          // escape a token under threat
    if (toGi !== null && cfg.safe.has(toGi)) s += 130;     // land on a safe star
    if (danger(toGi)) s -= 230;                            // don't walk into a capture
    if (m.to > cfg.ringMax) s += 90;                       // slip into the home stretch
    s += m.to * 0.4;                                       // gentle forward progress
    s += Math.random() * 12;                               // anti-robotic variety
    if (s > score) { score = s; best = m; }
  }
  return best.tokenId;
}
