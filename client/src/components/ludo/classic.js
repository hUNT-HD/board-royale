/**
 * classic.js — Self-contained CLASSIC 4-player Ludo (15×15 cross board).
 * Recognizable Ludo: 4 corner homes, plus-shaped track, colored home columns,
 * center triangle. Used for Solo vs bots. Engine + geometry in one file.
 *
 * Token position model (`rel`, relative to that player's own start):
 *   -1        -> in its home base (yard)
 *   0..50     -> on the shared 52-cell main track
 *   51..55    -> in its private 5-cell colored home column
 *   56        -> reached center (finished)
 */

// Turn order (clockwise). Starts are 13 apart on the 52-cell ring.
export const ORDER = ['red', 'green', 'yellow', 'blue'];
export const START = { red: 0, green: 13, yellow: 26, blue: 39 };
export const HEX = { red: '#ff3b5c', green: '#19c37d', yellow: '#ffc23b', blue: '#3b6bff' };

// The 52 main-track cells as [row, col] on a 15×15 grid, clockwise from red's start.
export const MAIN = [
  [6,1],[6,2],[6,3],[6,4],[6,5],          // 0-4   red arm
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],    // 5-10  up to green
  [0,7],                                  // 11
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],    // 12-17 green start(13) down
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14], // 18-23
  [7,14],                                 // 24
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9], // 25-30 yellow start(26)
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8], // 31-36
  [14,7],                                 // 37
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6], // 38-43 blue start(39)
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],    // 44-49
  [7,0],                                  // 50
  [6,0],                                  // 51
];

// Colored home-column cells (from track toward center), 5 each.
export const HOME = {
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5]],
  green:  [[1,7],[2,7],[3,7],[4,7],[5,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9]],
  blue:   [[13,7],[12,7],[11,7],[10,7],[9,7]],
};
export const CENTER = [7, 7];

// Token resting slots inside each 6×6 home base.
export const BASE_SLOTS = {
  red:    [[1,1],[1,4],[4,1],[4,4]],
  green:  [[1,10],[1,13],[4,10],[4,13]],
  blue:   [[10,1],[10,4],[13,1],[13,4]],
  yellow: [[10,10],[10,13],[13,10],[13,13]],
};

// Safe cells (global main index): the 4 starts + 4 stars (8 ahead of each start).
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const globalIndex = (color, rel) =>
  rel >= 0 && rel <= 50 ? (START[color] + rel) % 52 : null;

/** Board coordinate [row,col] for a token. */
export function cellOf(color, rel, tokenId) {
  if (rel < 0) return BASE_SLOTS[color][tokenId];
  if (rel <= 50) return MAIN[(START[color] + rel) % 52];
  if (rel <= 55) return HOME[color][rel - 51];
  return CENTER;
}

/** Interpolated {x,y} for a fractional rel — cell-by-cell movement animation. */
export function lerpCell(color, relF, id) {
  const pt = (rel) => { const rc = cellOf(color, rel, id); return { x: rc[1] + 0.5, y: rc[0] + 0.5 }; };
  if (relF <= -1) return pt(-1);
  const a = Math.floor(relF), f = relF - a;
  if (f < 0.001) return pt(a);
  const pa = pt(a), pb = pt(a + 1);
  return { x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f };
}

export function createGame(colors = ORDER) {
  return {
    players: colors.map((color, seat) => ({
      color, seat,
      tokens: Array.from({ length: 4 }, (_, id) => ({ id, rel: -1 })),
      finished: 0,
    })),
    turn: 0, dice: null, awaitingMove: false, winner: null,
  };
}

export function legalMoves(g, dice) {
  const p = g.players[g.turn];
  const out = [];
  for (const t of p.tokens) {
    if (t.rel === 56) continue;
    if (t.rel === -1) { if (dice === 6) out.push({ id: t.id, to: 0 }); continue; }
    if (t.rel + dice <= 56) out.push({ id: t.id, to: t.rel + dice });
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

export function move(g, id) {
  const dice = g.dice;
  const chosen = legalMoves(g, dice).find((m) => m.id === id);
  if (!chosen) return { error: 'illegal' };
  const p = g.players[g.turn];
  const t = p.tokens[id];
  t.rel = chosen.to;

  let captured = [], finished = false;
  if (t.rel === 56) { finished = true; p.finished++; if (p.finished === 4) g.winner = p.color; }
  else {
    const gi = globalIndex(p.color, t.rel);
    if (gi !== null && !SAFE.has(gi)) {
      for (const opp of g.players) {
        if (opp.color === p.color) continue;
        for (const ot of opp.tokens) {
          if (globalIndex(opp.color, ot.rel) === gi) { ot.rel = -1; captured.push(opp.color); }
        }
      }
    }
  }
  const extra = dice === 6 || captured.length > 0 || finished;
  g.awaitingMove = false; g.dice = null;
  if (!extra && !g.winner) nextTurn(g);
  return { captured, finished, extra };
}

export function nextTurn(g) {
  let n = g.turn;
  for (let i = 0; i < g.players.length; i++) {
    n = (n + 1) % g.players.length;
    if (g.players[n].finished < 4) break;
  }
  g.turn = n; g.awaitingMove = false; g.dice = null;
}

export function botPick(g, dice) {
  const moves = legalMoves(g, dice);
  if (!moves.length) return null;
  const me = g.players[g.turn];
  let best = moves[0], score = -1e9;
  for (const m of moves) {
    let s = m.to;
    if (m.to === 56) s += 1000;
    if (m.to === 0) s += 60;
    const gi = globalIndex(me.color, m.to);
    if (gi !== null && !SAFE.has(gi)) {
      for (const opp of g.players) if (opp.color !== me.color)
        for (const ot of opp.tokens) if (globalIndex(opp.color, ot.rel) === gi) s += 500;
    } else if (gi !== null) s += 25;
    if (s > score) { score = s; best = m; }
  }
  return best.id;
}
