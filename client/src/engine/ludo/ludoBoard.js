/**
 * ludoBoard.js — PURE board mathematics (no rendering, no pixels).
 *
 * Everything here is logical/abstract so that a 2D SVG renderer and a 3D WebGL
 * renderer can each map these indices to their own coordinate systems.
 *
 *  4-player board: outer track = 52 cells.
 *      Starts  Red 0 · Green 13 · Yellow 26 · Blue 39   (spacing 52/4 = 13)
 *  6-player board: outer track = 78 cells.
 *      Starts  Red 0 · Green 13 · Yellow 26 · Blue 39 · Purple 52 · Orange 65
 *      (spacing 78/6 = 13)
 *
 *  Each colour then has a private HOME STRETCH of 5 cells and one final HOME.
 *  Safe zones (stars, immutable): every colour's start cell + the cell 8 ahead.
 */
export const ARM = 13;                 // spacing between consecutive player starts
export const HOME_STRETCH = 5;
export const TOKENS_PER_PLAYER = 4;
export const STAR_AHEAD = 8;

const buildStarts = (colors) =>
  colors.reduce((acc, c, i) => ((acc[c] = i * ARM), acc), {});

const buildSafe = (track, starts) => {
  const safe = new Set();
  for (const s of Object.values(starts)) { safe.add(s % track); safe.add((s + STAR_AHEAD) % track); }
  return safe;
};

function makeConfig(colors) {
  const track = colors.length * ARM;
  const starts = buildStarts(colors);
  return {
    colors,
    track,                              // 52 or 78
    homeStretch: HOME_STRETCH,
    starts,                             // { color: startIndex }
    safe: buildSafe(track, starts),     // Set<globalIndex>
    finishRel: track - 1 + HOME_STRETCH, // exact rel value meaning HOME
  };
}

// The two canonical boards. A game with N active players uses the 4-board for
// N<=4 (others rendered as inactive) and the 6-board for N in {5,6}.
export const BOARD_4 = makeConfig(['red', 'green', 'yellow', 'blue']);
export const BOARD_6 = makeConfig(['red', 'green', 'yellow', 'blue', 'purple', 'orange']);

export const boardFor = (playerCount) => (playerCount > 4 ? BOARD_6 : BOARD_4);

/** Global outer-track index of a token, or null when it is not on the track. */
export function globalIndex(config, color, rel) {
  if (rel < 0 || rel > config.track - 2) return null;
  return (config.starts[color] + rel) % config.track;
}

export const isSafe = (config, gi) => gi !== null && config.safe.has(gi);
