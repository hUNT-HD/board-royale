/**
 * ludoPath.js — CLIENT-SIDE GEOMETRY for the 6-player hexagonal Ludo board.
 *
 * The server (ludoLogic.js) owns game truth as abstract step indices. This file
 * is purely about turning those indices into x/y screen coordinates (percent of
 * the stage) so tokens and cells can be positioned with CSS.
 *
 * Layout model: a hexagonal arena. The 78 shared ring cells are distributed
 * evenly around a ring; the 6 player yards sit at the hex vertices; each home
 * column runs inward from a player's entry cell toward the center.
 *
 * Keep RING_SIZE / ARM / HOME_COLUMN in sync with server/ludoLogic.js.
 */
export const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
export const ARM = 13;
export const RING_SIZE = ARM * 6;     // 78
export const HOME_COLUMN = 6;
export const PATH_LEN = (RING_SIZE - 1) + HOME_COLUMN;

const CENTER = 50;          // stage center, %
const RING_R = 38;          // radius of the shared ring, %
const HOME_INNER = 12;      // innermost home-column radius, %
const YARD_R = 44;          // radius of the player yards, %

// Player p's entry cell is the global ring index p*ARM; that cell defines the
// angle of the player's "arm". Angles start at top (-90deg) and go clockwise.
const armAngle = (p) => (-90 + (360 / 6) * p) * (Math.PI / 180);

const pol = (r, ang) => ({
  x: +(CENTER + r * Math.cos(ang)).toFixed(2),
  y: +(CENTER + r * Math.sin(ang)).toFixed(2),
});

/** Position of a shared-ring cell (global index 0..RING_SIZE-1). */
export function ringCellPos(globalIndex) {
  const ang = (-90 + (360 / RING_SIZE) * globalIndex) * (Math.PI / 180);
  return pol(RING_R, ang);
}

/** Position of a player's home-column cell (homeStep 0..HOME_COLUMN-1). */
export function homeCellPos(player, homeStep) {
  const ang = armAngle(player);
  const r = RING_R - 4 - (homeStep + 1) * ((RING_R - HOME_INNER) / (HOME_COLUMN + 1));
  return pol(r, ang);
}

/** Center / finishing position for a player's arrived tokens (slight fan-out). */
export function centerPos(player, tokenId) {
  const ang = armAngle(player);
  return pol(6, ang + tokenId * 0.25);
}

/** The four yard slots for a player (where un-deployed tokens rest). */
export function yardSlotPos(player, tokenId) {
  const ang = armAngle(player);
  const base = pol(YARD_R, ang);
  const dx = (tokenId % 2 ? 1 : -1) * 3.5;
  const dy = (tokenId < 2 ? -1 : 1) * 3.5;
  return { x: +(base.x + dx).toFixed(2), y: +(base.y + dy).toFixed(2) };
}

/**
 * Translate a server token { step, ring } + its player index into a stage
 * coordinate. `ring` is the precomputed global ring cell (or null).
 */
export function tokenPos(player, token) {
  if (token.step < 0) return yardSlotPos(player, token.id);     // in yard
  if (token.step === PATH_LEN) return centerPos(player, token.id); // finished
  if (token.ring !== null && token.ring !== undefined) return ringCellPos(token.ring);
  // home column: steps RING_SIZE-1 .. PATH_LEN-1
  return homeCellPos(player, token.step - (RING_SIZE - 1));
}

/** All ring-cell positions for static board rendering. */
export const ALL_RING_CELLS = Array.from({ length: RING_SIZE }, (_, i) => ({
  index: i, ...ringCellPos(i),
}));
