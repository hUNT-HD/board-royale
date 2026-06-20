/**
 * hex.js — 6-player HEXAGONAL Ludo (engine + geometry).
 * Used when 5 or 6 players are active. Structured square-cell track laid along
 * the six straight edges of a hexagon (NOT a circle), six colored home bases at
 * the corners, six colored home-stretch columns running into a central hub.
 *
 * Token `rel` model (per player, ring = 78 = 6 arms × 13):
 *   -1            in home base (yard)
 *   0 .. 76       on the shared 78-cell hexagonal ring
 *   77 .. 81      private 5-cell colored home column
 *   82            center (finished)
 */
export const ORDER6 = ['red', 'green', 'yellow', 'blue', 'purple', 'orange'];
export const HEXC = {
  red: '#ff3b5c', green: '#19c37d', yellow: '#ffc23b',
  blue: '#3b6bff', purple: '#9b5bff', orange: '#ff8a3b',
};
const ARM = 13;
export const RING = ARM * 6;          // 78
const HOME_LEN = 5;
export const CENTER_REL = RING - 1 + HOME_LEN; // 82
const ARMI = ORDER6.reduce((a, c, i) => ((a[c] = i), a), {});
const START = ORDER6.reduce((a, c, i) => ((a[c] = i * ARM), a), {});
export const SAFE = new Set(ORDER6.flatMap((c, i) => [i * ARM, (i * ARM + 8) % RING]));

const gIndex = (color, rel) => (rel >= 0 && rel <= RING - 2 ? (START[color] + rel) % RING : null);

/* ----------------------------- geometry -----------------------------
 * Connected hexagonal board. The 78-cell ring is six straight EDGE BARS
 * (13 cells each) tiled corner-to-corner. Six colored HOME BARS run from each
 * edge's midpoint straight into the central hub. Everything is continuous —
 * no floating dots.
 */
const C = 50;                  // board center %
const RV = 44;                 // hexagon vertex (circum) radius
const deg = (d) => (d * Math.PI) / 180;
const APO = RV * Math.cos(deg(30)); // apothem (edge-midpoint radius) ≈ 38.1
const HUB = 9;                 // central hub radius
const HOME_OUT = APO - 1.5, HOME_IN = HUB + 1.5;
const RBASE = 45.5;            // home-base distance (just outside each edge)

const vert = (k) => ({ x: C + RV * Math.cos(deg(-90 + 60 * k)), y: C + RV * Math.sin(deg(-90 + 60 * k)) });
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const polar = (r, aDeg) => ({ x: C + r * Math.cos(deg(aDeg)), y: C + r * Math.sin(deg(aDeg)) });
const edgeMidAngle = (p) => -90 + 60 * p + 30; // outward radial of player p's edge
const edgeAngleDeg = (k) => {
  const a = vert(k), b = vert((k + 1) % 6);
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Ring cell global index -> {x,y} % (cell centre on its edge bar). */
export function ringPos(g) {
  const edge = Math.floor(g / ARM), i = g % ARM;
  return lerp(vert(edge), vert((edge + 1) % 6), (i + 0.5) / ARM);
}
/** Home-stretch cell (0 outer .. 4 inner) centre. */
export function homePos(color, k) {
  const r = HOME_OUT - (k + 0.5) * ((HOME_OUT - HOME_IN) / HOME_LEN);
  return polar(r, edgeMidAngle(ARMI[color]));
}
export const basePos = (color) => polar(RBASE, edgeMidAngle(ARMI[color]));
export const baseSlot = (color, id) => {
  const b = basePos(color);
  return { x: b.x + (id % 2 ? 1 : -1) * 3.2, y: b.y + (id < 2 ? -1 : 1) * 3.2 };
};
export function cellOf(color, rel, id) {
  if (rel < 0) return baseSlot(color, id);
  if (rel <= RING - 2) return ringPos((START[color] + rel) % RING);
  if (rel <= RING - 2 + HOME_LEN) return homePos(color, rel - (RING - 1));
  return { x: C, y: C };
}
export const entryColorOf = (g) => (g % ARM === 0 ? ORDER6[g / ARM] : null);

/** Six continuous track bars (one per hexagon edge). */
export const EDGE_BARS = Array.from({ length: 6 }, (_, k) => {
  const a = vert(k), b = vert((k + 1) % 6), m = lerp(a, b, 0.5);
  return { k, x: m.x, y: m.y, len: dist(a, b), rot: edgeAngleDeg(k) };
});
/** A coloured home bar from an edge midpoint to the hub, per player. */
export const homeBar = (color) => {
  const a = ARMI[color], mid = (HOME_OUT + HOME_IN) / 2;
  const c = polar(mid, edgeMidAngle(a));
  return { x: c.x, y: c.y, len: HOME_OUT - HOME_IN, rot: edgeMidAngle(a), color };
};
/** Small rotated overlay rect for a single ring cell (start / star markers). */
export const ringCellRect = (g) => {
  const p = ringPos(g);
  return { x: p.x, y: p.y, rot: edgeAngleDeg(Math.floor(g / ARM)), len: EDGE_BARS[0].len / ARM };
};
export const HUB_R = HUB;

/* ------------------------------ engine ------------------------------ */
export function createGame(colors) {
  return {
    players: colors.map((color, seat) => ({
      color, seat, tokens: Array.from({ length: 4 }, (_, id) => ({ id, rel: -1 })), finished: 0,
    })),
    turn: 0, dice: null, awaitingMove: false, winner: null,
  };
}
export function legalMoves(g, dice) {
  const p = g.players[g.turn]; const out = [];
  for (const t of p.tokens) {
    if (t.rel === CENTER_REL) continue;
    if (t.rel === -1) { if (dice === 6) out.push({ id: t.id, to: 0 }); continue; }
    if (t.rel + dice <= CENTER_REL) out.push({ id: t.id, to: t.rel + dice });
  }
  return out;
}
export function roll(g) {
  const dice = 1 + Math.floor(Math.random() * 6);
  g.dice = dice; const moves = legalMoves(g, dice);
  if (!moves.length) { g.awaitingMove = false; nextTurn(g); return { dice, moves: [] }; }
  g.awaitingMove = true; return { dice, moves };
}
export function move(g, id) {
  const dice = g.dice;
  const chosen = legalMoves(g, dice).find((m) => m.id === id);
  if (!chosen) return { error: 'illegal' };
  const p = g.players[g.turn]; const t = p.tokens[id]; t.rel = chosen.to;
  let captured = [], finished = false;
  if (t.rel === CENTER_REL) { finished = true; p.finished++; if (p.finished === 4) g.winner = p.color; }
  else {
    const gi = gIndex(p.color, t.rel);
    if (gi !== null && !SAFE.has(gi)) {
      for (const opp of g.players) {
        if (opp.color === p.color) continue;
        for (const ot of opp.tokens) if (gIndex(opp.color, ot.rel) === gi) { ot.rel = -1; captured.push(opp.color); }
      }
    }
  }
  const extra = dice === 6 || captured.length || finished;
  g.awaitingMove = false; g.dice = null;
  if (!extra && !g.winner) nextTurn(g);
  return { captured, finished, extra };
}
export function nextTurn(g) {
  let n = g.turn;
  for (let i = 0; i < g.players.length; i++) { n = (n + 1) % g.players.length; if (g.players[n].finished < 4) break; }
  g.turn = n; g.awaitingMove = false; g.dice = null;
}
export function botPick(g, dice) {
  const moves = legalMoves(g, dice); if (!moves.length) return null;
  const me = g.players[g.turn]; let best = moves[0], score = -1e9;
  for (const m of moves) {
    let s = m.to;
    if (m.to === CENTER_REL) s += 1000;
    if (m.to === 0) s += 60;
    const gi = gIndex(me.color, m.to);
    if (gi !== null && !SAFE.has(gi)) {
      for (const opp of g.players) if (opp.color !== me.color)
        for (const ot of opp.tokens) if (gIndex(opp.color, ot.rel) === gi) s += 500;
    } else if (gi !== null) s += 25;
    if (s > score) { score = s; best = m; }
  }
  return best.id;
}
