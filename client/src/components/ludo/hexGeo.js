/**
 * hexGeo.js — exact SVG geometry for the 6-player hexagonal board.
 * Single coordinate space (viewBox 0..100, centre 50,50). Every ring cell,
 * home-stretch cell, base and token centre is computed from the same maths so
 * everything aligns and connects perfectly. Mirrors ludoCore's hex offsets.
 */
export const ORDER6 = ['red', 'green', 'yellow', 'blue', 'purple', 'orange'];
export const HEXC = {
  red: '#ff3b5c', green: '#19c37d', yellow: '#ffc23b',
  blue: '#3b6bff', purple: '#9b5bff', orange: '#ff8a3b',
};
export const ARM = 13;
export const RING = ARM * 6;              // 78
const HOME_LEN = 5;
const ARMI = ORDER6.reduce((a, c, i) => ((a[c] = i), a), {});
const START = ORDER6.reduce((a, c, i) => ((a[c] = i * ARM), a), {});
export const SAFE = new Set(ORDER6.flatMap((c, i) => [i * ARM, (i * ARM + 8) % RING]));

const C = 50;
const R = 42;                 // circumradius (vertex distance)
export const THICK = 4.4;     // track / cell thickness
const APO = R * Math.cos(Math.PI / 6);    // apothem ≈ 36.37
const HUB_APO = 11;           // central hub apothem
const HOME_OUT = APO - THICK / 2;
const HOME_IN = HUB_APO;
const HOME_CELL = (HOME_OUT - HOME_IN) / HOME_LEN;
const EDGE_LEN = R;           // regular hexagon: side = circumradius
const RING_CELL = EDGE_LEN / ARM;
const BASE_DIST = 43, BASE_SIZE = 11;

const d2r = (d) => (d * Math.PI) / 180;
const vert = (k) => ({ x: C + R * Math.cos(d2r(-90 + 60 * k)), y: C + R * Math.sin(d2r(-90 + 60 * k)) });
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const polar = (r, aDeg) => ({ x: C + r * Math.cos(d2r(aDeg)), y: C + r * Math.sin(d2r(aDeg)) });
const edgeMidAngle = (p) => -90 + 60 * p + 30;
const edgeAngle = (k) => {
  const a = vert(k), b = vert((k + 1) % 6);
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
};

export const VERTS = Array.from({ length: 6 }, (_, k) => vert(k));
export const PLATE = (() => {
  // slightly larger hexagon for the board plate
  const RP = R + 5;
  return Array.from({ length: 6 }, (_, k) =>
    `${(C + RP * Math.cos(d2r(-90 + 60 * k))).toFixed(2)},${(C + RP * Math.sin(d2r(-90 + 60 * k))).toFixed(2)}`
  ).join(' ');
})();
export const HUB = Array.from({ length: 6 }, (_, k) => {
  const rc = HUB_APO / Math.cos(Math.PI / 6); // hub circumradius
  return `${(C + rc * Math.cos(d2r(-90 + 60 * k))).toFixed(2)},${(C + rc * Math.sin(d2r(-90 + 60 * k))).toFixed(2)}`;
}).join(' ');

export function ringPos(g) {
  const edge = Math.floor(g / ARM), i = g % ARM;
  return lerp(vert(edge), vert((edge + 1) % 6), (i + 0.5) / ARM);
}
/** Ring cells with exact rect geometry + role flags. */
export const RING_CELLS = Array.from({ length: RING }, (_, g) => {
  const edge = Math.floor(g / ARM);
  const p = ringPos(g);
  return {
    g, cx: p.x, cy: p.y, w: RING_CELL, h: THICK, angle: edgeAngle(edge),
    startColor: g % ARM === 0 ? ORDER6[g / ARM] : null,
    star: SAFE.has(g) && g % ARM !== 0,
  };
});

export function homePos(color, k) {
  const r = HOME_OUT - (k + 0.5) * HOME_CELL;
  return polar(r, edgeMidAngle(ARMI[color]));
}
export const homeCells = (color) =>
  Array.from({ length: HOME_LEN }, (_, k) => {
    const p = homePos(color, k);
    return { cx: p.x, cy: p.y, w: HOME_CELL, h: THICK, angle: edgeMidAngle(ARMI[color]) };
  });

export const basePos = (color) => polar(BASE_DIST, edgeMidAngle(ARMI[color]));
export const baseRect = (color) => {
  const b = basePos(color);
  return { x: b.x - BASE_SIZE / 2, y: b.y - BASE_SIZE / 2, size: BASE_SIZE, cx: b.x, cy: b.y };
};

/* --- triangular home yard (apex toward centre), like a real 6-player board --- */
const YARD_IN = 29, YARD_OUT = R + 3.5, YARD_SPREAD = 25; // degrees
export function yardTriangle(color) {
  const a = edgeMidAngle(ARMI[color]);
  const apex = polar(YARD_IN, a);
  const b1 = polar(YARD_OUT, a - YARD_SPREAD);
  const b2 = polar(YARD_OUT, a + YARD_SPREAD);
  return `${apex.x.toFixed(2)},${apex.y.toFixed(2)} ${b1.x.toFixed(2)},${b1.y.toFixed(2)} ${b2.x.toFixed(2)},${b2.y.toFixed(2)}`;
}
export function yardSlots(color) {
  const a = edgeMidAngle(ARMI[color]);
  const pa = d2r(a + 90);
  const px = Math.cos(pa), py = Math.sin(pa);
  const rows = [{ r: YARD_OUT - 8, s: 5 }, { r: YARD_IN + 10, s: 3 }];
  const out = [];
  for (const row of rows) {
    const b = polar(row.r, a);
    out.push({ x: b.x - px * row.s, y: b.y - py * row.s });
    out.push({ x: b.x + px * row.s, y: b.y + py * row.s });
  }
  return out; // 4 slots
}
export const baseSlot = (color, id) => yardSlots(color)[id] || polar(BASE_DIST, edgeMidAngle(ARMI[color]));

/** Token centre for any (color, rel) — bound to exact cell centres. */
export function cellOf(color, rel, id) {
  if (rel < 0) return baseSlot(color, id);
  if (rel <= RING - 2) return ringPos((START[color] + rel) % RING);
  if (rel <= RING - 2 + HOME_LEN) return homePos(color, rel - (RING - 1));
  return { x: C, y: C };
}
