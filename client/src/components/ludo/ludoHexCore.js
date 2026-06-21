/**
 * ludoHexCore.js — Canvas geometry + drawing for the 6-player hexagonal board
 * (the "radiating arms + triangular bases + map-pin pawns" layout), wired to
 * LudoEngine's hex topology.
 *
 * Engine hex starts: blue 0, yellow 13, purple 26, red 39, green 52, orange 65.
 * Each arm is a 3-row × 6-col grid (middle row = colour's home straight). The
 * 78-step ring is ordered per arm: [row0 col0..5, row1 col5, row2 col5..0]; a
 * RENDER OFFSET rotates engine index → physical cell so each colour spawns on its
 * own start square (row2 col4) and turns into its own home straight.
 */
export const ORDER = ['blue', 'yellow', 'purple', 'red', 'green', 'orange'];
export const HEXC = {
  orange: 'rgb(255,127,39)', blue: 'rgb(0,162,232)', yellow: 'rgb(255,242,0)',
  purple: 'rgb(163,73,164)', red: 'rgb(237,28,36)', green: 'rgb(34,177,76)',
};
const ARM_OF = { orange: 0, blue: 1, yellow: 2, purple: 3, red: 4, green: 5 };
const START = { blue: 0, yellow: 13, purple: 26, red: 39, green: 52, orange: 65 };
const RING = 78, OFF = 21, HOME_LEN = 5, ARM = 13;
const STAR_AHEAD = 8;
// safe = each arm's start square (local 8) + the star cell (local 1)
export const SAFE = new Set(Array.from({ length: 6 }, (_, a) => [a * ARM + 8, a * ARM + 1]).flat());

const d2r = (d) => (d * Math.PI) / 180;
const sqrt3 = Math.sqrt(3);

export function buildGeometry(size) {
  const cx = size / 2, cy = size / 2, S = size / 23;
  const xBase = 3 * S * sqrt3 / 2, xOuter = 3 * S + 6 * S * sqrt3 / 2, yOuter = 3 * S;
  const rot = (lx, ly, deg) => { const a = d2r(deg); return { x: cx + lx * Math.cos(a) - ly * Math.sin(a), y: cy + lx * Math.sin(a) + ly * Math.cos(a) }; };

  // a cell's local (row,col) from its arm-local ring index 0..12
  const rcOf = (local) => local < 6 ? [0, local] : local === 6 ? [1, 5] : [2, 12 - local];
  const cellCenter = (arm, row, col) => rot(xBase + (col + 0.5) * S, (row - 1) * S, arm * 60);

  // physical ring 0..77 → pixel
  const track = Array.from({ length: RING }, (_, ph) => {
    const a = Math.floor(ph / ARM), [row, col] = rcOf(ph % ARM);
    return cellCenter(a, row, col);
  });
  // home straight per colour: row1, col 4..0 (outer→inner)
  const homes = {}; ORDER.forEach((c) => { homes[c] = Array.from({ length: HOME_LEN }, (_, k) => cellCenter(ARM_OF[c], 1, 4 - k)); });

  // bases (triangle + inner white triangle + 4 diamond spots + tab) per colour
  const spotX = [4.8 * S, 7.0 * S, 5.9 * S, 5.9 * S], spotY = [0, 0, 0.65 * S, -0.65 * S];
  const bases = {}; const baseSlots = {};
  ORDER.forEach((c) => {
    const ba = 30 + ARM_OF[c] * 60;
    const tri = [rot(3 * S, 0, ba), rot(xOuter, yOuter, ba), rot(xOuter, -yOuter, ba)];
    const innerTipX = 4 * S, innerBaseX = xOuter - 0.5 * S, innerBaseY = (innerBaseX - innerTipX) / sqrt3;
    const inner = [rot(innerTipX, 0, ba), rot(innerBaseX, innerBaseY, ba), rot(innerBaseX, -innerBaseY, ba)];
    const slots = spotX.map((sx, j) => rot(sx, spotY[j], ba));
    baseSlots[c] = slots;
    bases[c] = { ba, tri, inner, slots, tab: { x: xOuter, tw: 1.2 * S, th: 1.5 * S, r: 0.4 * S }, S, xOuter };
  });

  // cells for drawing the arm grids (role + colour)
  const arms = ORDER.map((c) => {
    const a = ARM_OF[c], cells = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
      const p = cellCenter(a, row, col);
      const home = row === 1 && col < 5, start = row === 2 && col === 4, star = row === 0 && col === 1;
      cells.push({ ...p, col, row, home, start, star });
    }
    return { color: c, arm: a, cells };
  });

  const hex = Array.from({ length: 6 }, (_, i) => ({ x: cx + 3 * S * Math.cos(d2r(30 + i * 60)), y: cy + 3 * S * Math.sin(d2r(30 + i * 60)) }));
  return { size, cx, cy, S, xBase, xOuter, yOuter, rot, track, homes, bases, baseSlots, arms, hex };
}

export function tokenPos(geo, color, rel, id = 0) {
  if (rel < 0) return geo.baseSlots[color][id] || geo.baseSlots[color][0];
  if (rel <= RING - 1) return geo.track[((START[color] + rel) % RING + OFF) % RING];
  if (rel <= RING - 1 + HOME_LEN) return geo.homes[color][rel - RING];
  return { x: geo.cx, y: geo.cy };
}

/* ---------- drawing ---------- */
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
function star(ctx, x, y, ro, ri) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? ri : ro; const X = x + r * Math.cos(a), Y = y + r * Math.sin(a); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = ro * 0.18; ctx.stroke();
}
function arrowMark(ctx, x, y, sz) {
  const w = sz * 0.8, h = sz * 0.6;
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x, y - h / 2); ctx.lineTo(x, y - h / 4); ctx.lineTo(x + w / 2, y - h / 4); ctx.lineTo(x + w / 2, y + h / 4); ctx.lineTo(x, y + h / 4); ctx.lineTo(x, y + h / 2); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = sz * 0.12; ctx.stroke();
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

const INK = 'rgba(22,22,38,0.82)';
const adj = (rgb, f) => { const m = (rgb.match(/\d+/g) || [0, 0, 0]).map(Number); const v = (n) => Math.max(0, Math.min(255, Math.round(f > 0 ? n + (255 - n) * f : n * (1 + f)))); return `rgb(${v(m[0])},${v(m[1])},${v(m[2])})`; };

function mapPin(ctx, x, y, color, S, opts = {}) {
  const r = S * 0.37, yc = y - r * 0.45;
  if (opts.glow) { const g = ctx.createRadialGradient(x, yc, r * 0.35, x, yc, r * 2.5); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = opts.glow; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, yc, r * 2.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.72, r * 0.9, r * 0.34, 0, 0, 7); ctx.fill();
  // white pin outline (head + point)
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, yc, r, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - r * 0.55, yc + r * 0.55); ctx.lineTo(x + r * 0.55, yc + r * 0.55); ctx.lineTo(x, yc + r * 1.55); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = opts.sel ? '#fff' : INK; ctx.lineWidth = opts.sel ? r * 0.2 : r * 0.13;
  ctx.beginPath(); ctx.arc(x, yc, r, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r * 0.55, yc + r * 0.5); ctx.lineTo(x, yc + r * 1.55); ctx.lineTo(x + r * 0.55, yc + r * 0.5); ctx.stroke();
  // glossy colour sphere
  const sg = ctx.createRadialGradient(x - r * 0.28, yc - r * 0.32, r * 0.08, x, yc, r * 0.82);
  sg.addColorStop(0, adj(color, 0.65)); sg.addColorStop(0.5, color); sg.addColorStop(1, adj(color, -0.42));
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x, yc, r * 0.74, 0, 7); ctx.fill();
  // coloured inner point
  ctx.fillStyle = adj(color, -0.15); ctx.beginPath(); ctx.moveTo(x - r * 0.36, yc + r * 0.5); ctx.lineTo(x + r * 0.36, yc + r * 0.5); ctx.lineTo(x, yc + r * 1.22); ctx.closePath(); ctx.fill();
  // specular
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(x - r * 0.26, yc - r * 0.3, r * 0.24, r * 0.15, -0.5, 0, 7); ctx.fill();
}

export function drawGame(ctx, geo, state) {
  const { S, size } = geo, on = (c) => !state.ghosts || !state.ghosts.has(c);
  const LINE = 'rgba(255,255,255,0.16)';
  ctx.clearRect(0, 0, size, size);
  ctx.lineJoin = 'round';

  // dark GLASS board panel: deep gradient + light glass edge + top sheen
  rr(ctx, size * 0.02, size * 0.02, size * 0.96, size * 0.96, size * 0.05);
  const pg = ctx.createRadialGradient(size * 0.4, size * 0.32, size * 0.08, size * 0.5, size * 0.52, size * 0.72);
  pg.addColorStop(0, '#1d1f30'); pg.addColorStop(1, '#0a0a12');
  ctx.fillStyle = pg; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = Math.max(1.5, size * 0.005); ctx.stroke();
  ctx.save(); rr(ctx, size * 0.035, size * 0.035, size * 0.93, size * 0.93, size * 0.042); ctx.clip();
  const sh = ctx.createLinearGradient(0, size * 0.03, 0, size * 0.55);
  sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, size, size * 0.55); ctx.restore();

  // arm grids — frosted dark-glass track + glossy colour cells
  geo.arms.forEach(({ color, arm, cells }) => {
    const lit = on(color);
    cells.forEach((c) => {
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(d2r(arm * 60));
      if (c.home || c.start) {
        const g = ctx.createLinearGradient(0, -S / 2, 0, S / 2);
        if (lit) { g.addColorStop(0, adj(HEXC[color], 0.4)); g.addColorStop(0.5, HEXC[color]); g.addColorStop(1, adj(HEXC[color], -0.32)); }
        else { g.addColorStop(0, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0.03)'); }
        ctx.fillStyle = g; ctx.fillRect(-S / 2, -S / 2, S, S);
        ctx.fillStyle = 'rgba(255,255,255,0.24)'; ctx.fillRect(-S / 2, -S / 2, S, S * 0.4);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(-S / 2, -S / 2, S, S);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(-S / 2, -S / 2, S, S * 0.36);
      }
      ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.strokeRect(-S / 2, -S / 2, S, S);
      ctx.restore();
      if (c.star) star(ctx, c.x, c.y, 0.35 * S, 0.15 * S);
      if (c.start) arrowMark(ctx, c.x, c.y, 0.6 * S);
    });
  });

  // bases — glassy colour triangle + neon rim + dark-glass inner + spots
  ORDER.forEach((color) => {
    const b = geo.bases[color], lit = on(color);
    const mx = (b.tri[1].x + b.tri[2].x) / 2, my = (b.tri[1].y + b.tri[2].y) / 2;
    const tg = ctx.createLinearGradient(b.tri[0].x, b.tri[0].y, mx, my);
    if (lit) { tg.addColorStop(0, adj(HEXC[color], 0.32)); tg.addColorStop(1, adj(HEXC[color], -0.28)); }
    else { tg.addColorStop(0, 'rgba(255,255,255,0.08)'); tg.addColorStop(1, 'rgba(255,255,255,0.03)'); }
    poly(ctx, b.tri); ctx.fillStyle = tg; ctx.fill();
    ctx.strokeStyle = lit ? HEXC[color] : LINE; ctx.lineWidth = 2.2; ctx.stroke();
    poly(ctx, b.inner); ctx.fillStyle = 'rgba(10,12,22,0.5)'; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 1.2; ctx.stroke();
    b.slots.forEach((s) => {
      ctx.beginPath(); ctx.arc(s.x, s.y, 0.42 * S, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
      ctx.strokeStyle = lit ? HEXC[color] : LINE; ctx.lineWidth = 2; ctx.stroke();
    });
    // tab — glassy colour
    ctx.save(); ctx.translate(geo.cx, geo.cy); ctx.rotate(d2r(b.ba));
    const { x, tw, th, r } = b.tab;
    ctx.beginPath(); ctx.moveTo(x, -th); ctx.lineTo(x + tw - r, -th); ctx.quadraticCurveTo(x + tw, -th, x + tw, -th + r); ctx.lineTo(x + tw, th - r); ctx.quadraticCurveTo(x + tw, th, x + tw - r, th); ctx.lineTo(x, th); ctx.closePath();
    const tabg = ctx.createLinearGradient(x, -th, x, th);
    if (lit) { tabg.addColorStop(0, adj(HEXC[color], 0.3)); tabg.addColorStop(1, adj(HEXC[color], -0.22)); }
    else { tabg.addColorStop(0, 'rgba(255,255,255,0.08)'); tabg.addColorStop(1, 'rgba(255,255,255,0.03)'); }
    ctx.fillStyle = tabg; ctx.fill(); ctx.strokeStyle = lit ? HEXC[color] : LINE; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.translate(x + 0.6 * S, 0); ctx.rotate((b.ba % 360) > 180 ? Math.PI / 2 : -Math.PI / 2);
    ctx.fillStyle = lit ? '#fff' : 'rgba(255,255,255,0.45)'; ctx.font = `bold ${Math.round(0.5 * S)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(color[0].toUpperCase() + color.slice(1), 0, 0);
    ctx.restore();
  });

  // centre — glass hex with neon glow + glossy dice
  const gl = ctx.createRadialGradient(geo.cx, geo.cy, 3 * S * 0.5, geo.cx, geo.cy, 3 * S * 1.8);
  gl.addColorStop(0, 'rgba(0,190,255,0.45)'); gl.addColorStop(1, 'rgba(0,190,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(geo.cx, geo.cy, 3 * S * 1.8, 0, 7); ctx.fill();
  const rg = ctx.createRadialGradient(geo.cx - S, geo.cy - S, S * 0.3, geo.cx, geo.cy, 3 * S);
  rg.addColorStop(0, 'rgba(40,190,255,0.85)'); rg.addColorStop(0.55, 'rgba(0,90,170,0.7)'); rg.addColorStop(1, 'rgba(8,12,24,0.92)');
  poly(ctx, geo.hex); ctx.fillStyle = rg; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.2;
  geo.hex.forEach((p) => { ctx.beginPath(); ctx.moveTo(geo.cx, geo.cy); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  poly(ctx, geo.hex); ctx.strokeStyle = 'rgba(120,220,255,0.6)'; ctx.lineWidth = 2.4; ctx.stroke();
  const dS = 1.4 * S, dx = geo.cx - dS / 2, dy = geo.cy - dS / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(ctx, dx + 3, dy + 4, dS, dS, 0.4 * S); ctx.fill();
  const dg = ctx.createLinearGradient(dx, dy, dx, dy + dS);
  dg.addColorStop(0, 'rgb(130,240,255)'); dg.addColorStop(1, 'rgb(0,150,225)');
  rr(ctx, dx, dy, dS, dS, 0.4 * S); ctx.fillStyle = dg; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; rr(ctx, dx + 2, dy + 2, dS - 4, dS * 0.42, 0.3 * S); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(geo.cx, geo.cy, 0.2 * S, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2; rr(ctx, dx, dy, dS, dS, 0.4 * S); ctx.stroke();

  // tokens
  (state.players || []).forEach((p) => p.tokens.forEach((t) => {
    const pos = tokenPos(geo, p.color, t.rel, t.id);
    const movable = state.movable && state.movable.has(`${p.color}:${t.id}`);
    mapPin(ctx, pos.x, pos.y, HEXC[p.color], S, { glow: movable ? 0.9 : 0.32, sel: movable });
  }));
}

export function hitToken(geo, players, px, py) {
  const rr2 = (geo.S * 0.55) ** 2;
  for (let i = players.length - 1; i >= 0; i--) for (const t of players[i].tokens) {
    const pos = tokenPos(geo, players[i].color, t.rel, t.id);
    if ((px - pos.x) ** 2 + (py - pos.y) ** 2 <= rr2) return { color: players[i].color, id: t.id };
  }
  return null;
}
