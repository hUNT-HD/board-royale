/**
 * ludoLogic.js — Authoritative 6-player Ludo engine.
 *
 * BOARD MODEL (hexagonal / 6-arm star)
 * ------------------------------------
 * The shared "ring" that all tokens travel is a single loop of RING_SIZE cells.
 * For 6 players we use 6 arms × ARM cells = 78 ring cells (classic 4-player is 52).
 *
 * Each player owns a PERSONAL PATH expressed as a step index 0..PATH_LEN:
 *   step  -1                  -> token is in its YARD (base, not on board)
 *   step  0 .. RING_SIZE-2    -> token is on the shared ring
 *   step  RING_SIZE-1 .. PATH_LEN-1 -> token is in its private HOME COLUMN
 *   step  PATH_LEN            -> token has reached CENTER (finished)
 *
 * A player's step 0 maps to the GLOBAL ring cell `entry[player]`. Converting a
 * personal step to a global ring cell is how we detect collisions between
 * players who share the same physical cell.
 *
 *   globalRingCell(player, step) = (entry[player] + step) % RING_SIZE
 *
 * Home-column steps are private, so tokens there can never be captured.
 */

export const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
export const COLOR_HEX = {
  red: '#ff3b5c',
  blue: '#3b6bff',     // Royal Blue
  green: '#19c37d',    // Emerald
  yellow: '#ffc23b',   // Amber
  purple: '#9b5bff',   // Royal Purple
  orange: '#ff8a3b',   // Bright Orange
};

export const ARM = 13;                 // ring cells per player arm
export const RING_SIZE = ARM * 6;      // 78 shared ring cells
export const HOME_COLUMN = 6;          // private colored run-in cells
export const PATH_LEN = (RING_SIZE - 1) + HOME_COLUMN; // exact step to reach center
export const TOKENS_PER_PLAYER = 4;
export const STAR_OFFSET = 8;          // a safe "star" cell, classic offset from start

// Global ring cell where each player's path begins (their start cell).
export const ENTRY = COLORS.reduce((acc, c, i) => ((acc[c] = i * ARM), acc), {});

// Safe ring cells: every player's start cell + every star cell. No captures here.
export const SAFE_RING_CELLS = new Set(
  COLORS.flatMap((c) => [ENTRY[c], (ENTRY[c] + STAR_OFFSET) % RING_SIZE])
);

/** Map a player's personal step to a global ring cell, or null if not on ring. */
export function globalRingCell(color, step) {
  if (step < 0 || step > RING_SIZE - 2) return null; // yard or home column
  return (ENTRY[color] + step) % RING_SIZE;
}

export function isSafeStep(color, step) {
  const cell = globalRingCell(color, step);
  return cell !== null && SAFE_RING_CELLS.has(cell);
}

/** Build a fresh game state for the given ordered list of player colors. */
export function createGame(playerColors) {
  const players = playerColors.map((color, seat) => ({
    color,
    seat,
    isBot: false,
    connected: true,
    // each token starts at step -1 (in the yard)
    tokens: Array.from({ length: TOKENS_PER_PLAYER }, (_, i) => ({ id: i, step: -1 })),
    finished: 0,
  }));

  return {
    players,
    turn: 0,              // seat index whose turn it is
    dice: null,           // last rolled value (null until rolled)
    rolledThisTurn: false,
    awaitingMove: false,  // dice rolled & a legal move exists
    rollsLeft: 1,         // a 6 grants another roll-after-move
    winnerOrder: [],      // seats in order they finished all 4 tokens
    log: [],
  };
}

const rollDie = () => 1 + Math.floor(Math.random() * 6);

/** Which tokens of the current player can legally move with this dice value? */
export function legalMoves(game, dice) {
  const p = game.players[game.turn];
  const moves = [];
  for (const t of p.tokens) {
    if (t.step === PATH_LEN) continue;             // already home/center
    if (t.step === -1) {
      if (dice === 6) moves.push({ tokenId: t.id, to: 0 }); // leave yard on a 6
      continue;
    }
    const to = t.step + dice;
    if (to <= PATH_LEN) moves.push({ tokenId: t.id, to }); // must land exactly on center
  }
  return moves;
}

/**
 * Roll for the current player. Returns { dice, moves }.
 * If no legal move exists, the turn auto-passes (unless a 6 lets them re-roll).
 */
export function roll(game) {
  if (game.awaitingMove) return { error: 'Move your token before rolling again.' };
  const dice = rollDie();
  game.dice = dice;
  game.rolledThisTurn = true;
  const moves = legalMoves(game, dice);

  if (moves.length === 0) {
    // No move. A 6 still wastes here (no token outside, all blocked) -> pass turn,
    // but three consecutive 6s rule is omitted for brevity.
    game.awaitingMove = false;
    if (dice !== 6) nextTurn(game);
    else nextTurn(game); // even on a 6 with no moves we pass to keep it simple
    return { dice, moves: [] };
  }

  game.awaitingMove = true;
  return { dice, moves };
}

/**
 * Apply a token move chosen by the player. Returns a result describing captures.
 * Throws on illegal input so the caller can reject it.
 */
export function moveToken(game, tokenId) {
  if (!game.awaitingMove) throw new Error('Roll first.');
  const dice = game.dice;
  const moves = legalMoves(game, dice);
  const chosen = moves.find((m) => m.tokenId === tokenId);
  if (!chosen) throw new Error('Illegal move for that token.');

  const player = game.players[game.turn];
  const token = player.tokens[tokenId];
  token.step = chosen.to;

  let captured = [];
  let reachedCenter = false;

  if (token.step === PATH_LEN) {
    reachedCenter = true;
    player.finished += 1;
    if (player.finished === TOKENS_PER_PLAYER) game.winnerOrder.push(player.seat);
  } else {
    // Capture check — only on the shared ring & non-safe cells.
    const landingCell = globalRingCell(player.color, token.step);
    if (landingCell !== null && !SAFE_RING_CELLS.has(landingCell)) {
      for (const opp of game.players) {
        if (opp.seat === player.seat) continue;
        for (const ot of opp.tokens) {
          if (globalRingCell(opp.color, ot.step) === landingCell) {
            ot.step = -1; // send the captured token back to its yard
            captured.push({ seat: opp.seat, color: opp.color, tokenId: ot.id });
          }
        }
      }
    }
  }

  // Extra turn on a 6, on a capture, or on landing a token in the center.
  const extraTurn = dice === 6 || captured.length > 0 || reachedCenter;
  game.awaitingMove = false;
  game.dice = null;
  if (!extraTurn) nextTurn(game);

  return { captured, reachedCenter, extraTurn };
}

/** Advance to the next still-playing seat. */
export function nextTurn(game) {
  const n = game.players.length;
  let next = game.turn;
  for (let i = 0; i < n; i++) {
    next = (next + 1) % n;
    if (game.players[next].finished < TOKENS_PER_PLAYER) break;
  }
  game.turn = next;
  game.rolledThisTurn = false;
  game.awaitingMove = false;
  game.dice = null;
}

/**
 * Simple priority-based bot decision (used for Solo vs AI and to fill empty seats).
 * Priority: (1) capture an opponent, (2) bring a token home/center,
 * (3) leave the yard on a 6, (4) advance the most-progressed token.
 */
export function botChooseToken(game, dice) {
  const moves = legalMoves(game, dice);
  if (moves.length === 0) return null;
  const me = game.players[game.turn];

  const scored = moves.map((m) => {
    let score = 0;
    if (m.to === PATH_LEN) score += 1000;                       // finish a token
    if (m.to === 0) score += 50;                                // leave the yard
    const cell = globalRingCell(me.color, m.to);
    if (cell !== null && !SAFE_RING_CELLS.has(cell)) {
      for (const opp of game.players) {
        if (opp.seat === me.seat) continue;
        for (const ot of opp.tokens) {
          if (globalRingCell(opp.color, ot.step) === cell) score += 500; // capture!
        }
      }
    }
    if (cell !== null && SAFE_RING_CELLS.has(cell)) score += 20; // reach a safe cell
    score += m.to;                                              // progress tiebreak
    return { tokenId: m.tokenId, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].tokenId;
}

/** Compact, render-friendly snapshot for clients. */
export function serialize(game) {
  return {
    players: game.players.map((p) => ({
      color: p.color,
      seat: p.seat,
      isBot: p.isBot,
      connected: p.connected,
      finished: p.finished,
      tokens: p.tokens.map((t) => ({
        id: t.id,
        step: t.step,
        ring: globalRingCell(p.color, t.step), // null if in yard/home column
      })),
    })),
    turn: game.turn,
    dice: game.dice,
    awaitingMove: game.awaitingMove,
    winnerOrder: game.winnerOrder,
    safeCells: [...SAFE_RING_CELLS],
    meta: { RING_SIZE, ARM, HOME_COLUMN, PATH_LEN },
  };
}
