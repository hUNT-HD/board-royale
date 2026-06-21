/**
 * hexGeo.js — "Radiating Star & Wedge" geometry for the 6-player hexagonal board,
 * aligned 1:1 with LudoEngine's hex topology. Coordinate space: 0..1000, centre (500,500).
 *
 * STRUCTURE
 *   • Centre HEXAGON (winning zone) with 6 colour triangles + die hub.
 *   • 6 ARMS radiating from the hexagon faces — each a 3×6 grid of squares. The
 *     middle column is that colour's HOME lane (5 cells + a white tip); the two
 *     side columns are the shared white TRACK.
 *   • 6 big triangular WEDGE BASES filling the gaps BETWEEN the arms, each filled
 *     with a player's colour, a white inner field, and 4 evenly-spaced token slots.
 *
 * The 78-step ring pinwheels along the arm side-columns; engine ring index g is
 * rotated by OFF so each colour spawns by its own arm and turns into its own home.
 *
 * Token `rel` model (matches LudoEngine exactly):
 *   rel < 0        → base slot (wedge)
 *   rel 0..77      → outer ring  (start+rel)%78
 *   rel 78..82     → 5-cell home lane (outer→inner)
 *   rel 83         → centre (finished)
 */
export const ORDER6 = ['blue', 'yellow', 'purple', 'red', 'green', 'orange'];
export const HEXC = {
  red: '#ff3b5c', green: '#19c37d', yellow: '#ffc23b',
  blue: '#3b6bff', purple: '#9b5bff', orange: '#ff8a3b',
};

export const VB = 1000;
const C = 500;
export const CELL = 46;
const R_IN = 132;             // arm inner radius (centre-hexagon face)
export const ROWS = 6;
const HOME_LEN = 5;
export const RING = 78;
const OFF = 19;               // engine index → physical ring slot
const ARM = 13;

// colour ↔ arm (matches engine spawn order): blue1,yellow2,purple3,red4,green5,orange0
export const EDGE_OF = { blue: 1, yellow: 2, purple: 3, red: 4, green: 5, orange: 0 };
export const colorOfArm = []; ORDER6.forEach((c) => { colorOfArm[EDGE_OF[c]] = c; });
const START = ORDER6.reduce((a, c, i) => ((a[c] = i * ARM), a), {}); // blue0,yellow13,...,orange65
const STAR_AHEAD = 8;
export const SAFE = new Set(ORDER6.flatMap((c) => [START[c], (START[c] + STAR_AHEAD) % RING]));

const d2r = (d) => (d * Math.PI) / 180;
const ux = (a) => Math.cos(d2r(a)), uy = (a) => Math.sin(d2r(a));
export const armAng = (a) => 30 + 60 * a;      // arm a radiates from a hexagon face

/** Cell centre (+rotation) for arm a, row r (0 inner..5 outer), col k (-1,0,1). */
export function cell(a, r, k) {
  const A = armAng(a), rad = R_IN + (r + 0.5) * CELL, lat = k * CELL;
  return {
    x: C + rad * ux(A) + lat * ux(A + 90),
    y: C + rad * uy(A) + lat * uy(A + 90),
    rot: A,
  };
}

/* ---- ring path: per arm, left col out (0..5), tip (6), right col in (7..12) ---- */
function ringCell(g) {
  const ph = (g + OFF) % RING, a = Math.floor(ph / ARM), i = ph % ARM;
  if (i < 6) return cell(a, i, -1);
  if (i === 6) return cell(a, 5, 0);
  return cell(a, 12 - i, 1);
}
export const ringPos = (g) => ringCell(g);

/** Ordered ring cells for rendering the track squares (with role flags). */
export const RING_CELLS = Array.from({ length: RING }, (_, g) => {
  const p = ringPos(g);
  return {
    g, ...p,
    startColor: g % ARM === 0 ? ORDER6[g / ARM] : null,
    star: SAFE.has(g) && g % ARM !== 0,
  };
});

/* ---- home lane: middle column of the colour's arm (outer r4 → inner r0) ---- */
export function homePos(color, k) { return cell(EDGE_OF[color], 4 - k, 0); }
export const homeCells = (color) =>
  Array.from({ length: HOME_LEN }, (_, k) => homePos(color, k));

/* ---- wedge base (between arms) + 4 token slots ---- */
const VR_OUT = R_IN + ROWS * CELL + 4, VR_IN = R_IN - 6;
const WHITE_R = 58;
const wedgeAngle = (color) => 60 * ((EDGE_OF[color] + 1) % 6);
const whiteCentre = (color) => {
  const A = wedgeAngle(color), r = R_IN + ROWS * CELL * 0.52;
  return { x: C + r * ux(A), y: C + r * uy(A), A };
};
export function wedgeBase(color) {
  const A = wedgeAngle(color);
  const apex = [C + VR_IN * ux(A), C + VR_IN * uy(A)];
  const c1 = [C + VR_OUT * ux(A - 30), C + VR_OUT * uy(A - 30)];
  const c2 = [C + VR_OUT * ux(A + 30), C + VR_OUT * uy(A + 30)];
  const wc = whiteCentre(color);
  return {
    color,
    points: `${apex[0].toFixed(1)},${apex[1].toFixed(1)} ${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)}`,
    white: { cx: wc.x, cy: wc.y, r: WHITE_R },
  };
}
export function yardSlots(color) {
  const { x, y, A } = whiteCentre(color);
  const out = [];
  for (let t = 0; t < 4; t++) {
    const sx = t % 2 ? 1 : -1, sy = t < 2 ? -1 : 1;
    out.push({ x: x + sx * 26 * ux(A + 90) + sy * 26 * ux(A), y: y + sx * 26 * uy(A + 90) + sy * 26 * uy(A) });
  }
  return out;
}
export const baseSlot = (color, id) => yardSlots(color)[id] || whiteCentre(color);
export const baseRect = (color) => { const w = whiteCentre(color); return { cx: w.x, cy: w.y, size: WHITE_R * 2 }; };

/* ---- centre hexagon: 6 colour triangles spanning each arm's face ---- */
const CHV = R_IN / Math.cos(d2r(30));
export const CENTER_TRIS = colorOfArm.map((color, a) => {
  const A0 = armAng(a) - 30, A1 = armAng(a) + 30;
  return { color, points: `${C},${C} ${(C + CHV * ux(A0)).toFixed(1)},${(C + CHV * uy(A0)).toFixed(1)} ${(C + CHV * ux(A1)).toFixed(1)},${(C + CHV * uy(A1)).toFixed(1)}` };
});

/* ---- premium board plate (outer hexagon) ---- */
const RV = R_IN + ROWS * CELL + 70;
export const PLATE = Array.from({ length: 6 }, (_, k) => {
  const a = 60 * k; return `${(C + RV * ux(a)).toFixed(1)},${(C + RV * uy(a)).toFixed(1)}`;
}).join(' ');

/** Token centre for any (color, rel). */
export function cellOf(color, rel, id) {
  if (rel < 0) return baseSlot(color, id);
  if (rel <= RING - 1) return ringPos((START[color] + rel) % RING);
  if (rel <= RING - 1 + HOME_LEN) return homePos(color, rel - RING);
  return { x: C, y: C };
}
