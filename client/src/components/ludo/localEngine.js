/**
 * localEngine.js — compact client-side Ludo engine for SOLO vs AI (offline).
 * Mirrors server/ludoLogic.js rules so behavior matches online play. Online mode
 * does NOT use this — the server is authoritative there.
 */
import { COLORS, ARM, RING_SIZE, HOME_COLUMN, PATH_LEN } from './ludoPath.js';
import { SAFE_SET } from './ludoMeta.js';

const ENTRY = COLORS.reduce((a, c, i) => ((a[c] = i * ARM), a), {});
const ringCell = (color, step) =>
  step < 0 || step > RING_SIZE - 2 ? null : (ENTRY[color] + step) % RING_SIZE;

export function createLocal(colors) {
  return {
    players: colors.map((color, seat) => ({
      color, seat,
      tokens: Array.from({ length: 4 }, (_, id) => ({ id, step: -1, ring: null })),
      finished: 0,
    })),
    turn: 0, dice: null, awaitingMove: false, winnerOrder: [],
  };
}

export function legalMoves(g, dice) {
  const p = g.players[g.turn];
  const out = [];
  for (const t of p.tokens) {
    if (t.step === PATH_LEN) continue;
    if (t.step === -1) { if (dice === 6) out.push({ tokenId: t.id, to: 0 }); continue; }
    if (t.step + dice <= PATH_LEN) out.push({ tokenId: t.id, to: t.step + dice });
  }
  return out;
}

export function roll(g) {
  const dice = 1 + Math.floor(Math.random() * 6);
  g.dice = dice;
  const moves = legalMoves(g, dice);
  if (moves.length === 0) { g.awaitingMove = false; nextTurn(g); return { dice, moves: [] }; }
  g.awaitingMove = true;
  return { dice, moves };
}

export function moveToken(g, tokenId) {
  const dice = g.dice;
  const chosen = legalMoves(g, dice).find((m) => m.tokenId === tokenId);
  if (!chosen) return { error: 'illegal' };
  const p = g.players[g.turn];
  const t = p.tokens[tokenId];
  t.step = chosen.to;
  t.ring = ringCell(p.color, t.step);

  let captured = [], reachedCenter = false;
  if (t.step === PATH_LEN) {
    reachedCenter = true; p.finished++;
    if (p.finished === 4) g.winnerOrder.push(p.seat);
  } else if (t.ring !== null && !SAFE_SET.has(t.ring)) {
    for (const opp of g.players) {
      if (opp.seat === p.seat) continue;
      for (const ot of opp.tokens) {
        if (ringCell(opp.color, ot.step) === t.ring) {
          ot.step = -1; ot.ring = null; captured.push({ color: opp.color, tokenId: ot.id });
        }
      }
    }
  }
  const extra = dice === 6 || captured.length || reachedCenter;
  g.awaitingMove = false; g.dice = null;
  if (!extra) nextTurn(g);
  return { captured, reachedCenter, extraTurn: !!extra };
}

export function nextTurn(g) {
  const n = g.players.length;
  let next = g.turn;
  for (let i = 0; i < n; i++) { next = (next + 1) % n; if (g.players[next].finished < 4) break; }
  g.turn = next; g.awaitingMove = false; g.dice = null;
}

export function botChoose(g, dice) {
  const moves = legalMoves(g, dice);
  if (!moves.length) return null;
  const me = g.players[g.turn];
  let best = moves[0], bestScore = -1;
  for (const m of moves) {
    let s = m.to;
    if (m.to === PATH_LEN) s += 1000;
    if (m.to === 0) s += 50;
    const cell = ringCell(me.color, m.to);
    if (cell !== null && !SAFE_SET.has(cell)) {
      for (const opp of g.players) if (opp.seat !== me.seat)
        for (const ot of opp.tokens) if (ringCell(opp.color, ot.step) === cell) s += 500;
    } else if (cell !== null) s += 20;
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best.tokenId;
}

// recompute ring field for rendering after external mutations
export function withRings(g) {
  g.players.forEach((p) => p.tokens.forEach((t) => { t.ring = ringCell(p.color, t.step); }));
  return g;
}
