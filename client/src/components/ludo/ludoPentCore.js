/**
 * ludoPentCore.js — Canvas geometry + black-glass drawing for the 5-player
 * PENTAGONAL board (radiating arms + triangular bases + map-pin pawns), wired to
 * LudoEngine's 'pent' topology (65-step ring = 5 arms × 13).
 *
 * Engine starts: blue 0, orange 13, green 26, red 39, yellow 52.
 * Same per-arm ring order as hex: [row0 0..5, row1 5, row2 5..0]; OFF rotates
 * engine index → physical so each colour spawns on its own start square.
 */
export const ORDER = ['blue', 'orange', 'green', 'red', 'yellow'];
export const HEXC = {
  blue: 'rgb(0,162,232)', orange: 'rgb(255,127,39)', green: 'rgb(34,177,76)',
  red: 'rgb(237,28,36)', yellow: 'rgb(255,242,0)',
};
const ARM_OF = { blue: 0, orange: 1, green: 2, red: 3, yellow: 4 };
const START = { blue: 0, orange: 13, green: 26, red: 39, yellow: 52 };
const N = 5, STEP = 72, RING = 65, OFF = 8, HOME_LEN = 5, ARM = 13;

const d2r = (d) => (d * Math.PI) / 180;
const A36 = d2r(36), SIN36 = Math.sin(A36), COS36 = Math.cos(A36), TAN36 = Math.tan(A36);

export function buildGeometry(size) {
  const cx = size / 2, cy = size * 0.5, S = size / 18.5;
  const rPent = (3 * S) / (2 * SIN36), xBase = rPent * COS36;
  const xOuter = rPent + 6 * S * COS36, yOuter = 6 * S * SIN36;
  const rot = (lx, ly, deg) => { const a = d2r(deg); return { x: cx + lx * Math.cos(a) - ly * Math.sin(a), y: cy + lx * Math.sin(a) + ly * Math.cos(a) }; };
  const armAng = (a) => 54 + a * STEP, baseAng = (a) => 90 + a * STEP;

  const rcOf = (local) => local < 6 ? [0, local] : local === 6 ? [1, 5] : [2, 12 - local];
  const cellCenter = (arm, row, col) => rot(xBase + (col + 0.5) * S, (row - 1) * S, armAng(arm));

  const track = Array.from({ length: RING }, (_, ph) => { const a = Math.floor(ph / ARM), [row, col] = rcOf(ph % ARM); return cellCenter(a, row, col); });
  const homes = {}; ORDER.forEach((c) => { homes[c] = Array.from({ length: HOME_LEN }, (_, k) => cellCenter(ARM_OF[c], 1, 4 - k)); });

  const spotX = [4.2 * S, 6.1 * S, 5.15 * S, 5.15 * S], spotY = [0, 0, -0.8 * S, 0.8 * S];
  const bases = {}, baseSlots = {};
  ORDER.forEach((c) => {
    const ba = baseAng(ARM_OF[c]);
    const tri = [rot(rPent, 0, ba), rot(xOuter, yOuter, ba), rot(xOuter, -yOuter, ba)];
    const innerTipX = rPent + 0.5 * S / SIN36, innerBaseX = xOuter - 0.5 * S, innerBaseY = TAN36 * (innerBaseX - innerTipX);
    const inner = [rot(innerTipX, 0, ba), rot(innerBaseX, innerBaseY, ba), rot(innerBaseX, -innerBaseY, ba)];
    baseSlots[c] = spotX.map((sx, j) => rot(sx, spotY[j], ba));
    bases[c] = { ba, tri, inner, slots: baseSlots[c], tab: { x: xOuter, tw: 1.4 * S, th: 1.5 * S, r: 0.4 * S } };
  });

  const arms = ORDER.map((c) => {
    const a = ARM_OF[c], cells = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
      const p = cellCenter(a, row, col);
      cells.push({ ...p, col, row, home: row === 1 && col < 5, start: row === 2 && col === 4, star: row === 0 && col === 1, rot: armAng(a) });
    }
    return { color: c, arm: a, cells };
  });

  const pent = Array.from({ length: N }, (_, i) => rot(rPent, 0, baseAng(i)));
  return { size, cx, cy, S, rPent, track, homes, bases, baseSlots, arms, pent };
}

export function tokenPos(geo, color, rel, id = 0) {
  if (rel < 0) return geo.baseSlots[color][id] || geo.baseSlots[color][0];
  if (rel <= RING - 1) return geo.track[((START[color] + rel) % RING + OFF) % RING];
  if (rel <= RING - 1 + HOME_LEN) return geo.homes[color][rel - RING];
  return { x: geo.cx, y: geo.cy };
}

/* ---------- drawing (black-glass) ---------- */
const INK = 'rgba(22,22,38,0.82)';
const adj = (rgb, f) => { const m = (rgb.match(/\d+/g) || [0, 0, 0]).map(Number); const v = (n) => Math.max(0, Math.min(255, Math.round(f > 0 ? n + (255 - n) * f : n * (1 + f)))); return `rgb(${v(m[0])},${v(m[1])},${v(m[2])})`; };
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
function star(ctx, x, y, ro, ri, col) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? ri : ro; const X = x + r * Math.cos(a), Y = y + r * Math.sin(a); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = col || INK; ctx.lineWidth = ro * 0.22; ctx.stroke(); }
function arrowMark(ctx, x, y, sz) { const w = sz * 0.8, h = sz * 0.6; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x, y - h / 2); ctx.lineTo(x, y - h / 4); ctx.lineTo(x + w / 2, y - h / 4); ctx.lineTo(x + w / 2, y + h / 4); ctx.lineTo(x, y + h / 4); ctx.lineTo(x, y + h / 2); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = sz * 0.12; ctx.stroke(); }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function mapPin(ctx, x, y, color, S, opts = {}) {
  const r = S * 0.37, yc = y - r * 0.45;
  if (opts.glow) { const g = ctx.createRadialGradient(x, yc, r * 0.35, x, yc, r * 2.5); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = opts.glow; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, yc, r * 2.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.72, r * 0.9, r * 0.34, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, yc, r, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - r * 0.55, yc + r * 0.55); ctx.lineTo(x + r * 0.55, yc + r * 0.55); ctx.lineTo(x, yc + r * 1.55); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = opts.sel ? '#fff' : INK; ctx.lineWidth = opts.sel ? r * 0.2 : r * 0.13;
  ctx.beginPath(); ctx.arc(x, yc, r, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r * 0.55, yc + r * 0.5); ctx.lineTo(x, yc + r * 1.55); ctx.lineTo(x + r * 0.55, yc + r * 0.5); ctx.stroke();
  const sg = ctx.createRadialGradient(x - r * 0.28, yc - r * 0.32, r * 0.08, x, yc, r * 0.82);
  sg.addColorStop(0, adj(color, 0.65)); sg.addColorStop(0.5, color); sg.addColorStop(1, adj(color, -0.42));
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x, yc, r * 0.74, 0, 7); ctx.fill();
  ctx.fillStyle = adj(color, -0.15); ctx.beginPath(); ctx.moveTo(x - r * 0.36, yc + r * 0.5); ctx.lineTo(x + r * 0.36, yc + r * 0.5); ctx.lineTo(x, yc + r * 1.22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(x - r * 0.26, yc - r * 0.3, r * 0.24, r * 0.15, -0.5, 0, 7); ctx.fill();
}

export function drawGame(ctx, geo, state) {
  const { S, size } = geo, on = (c) => !state.ghosts || !state.ghosts.has(c);
  const LINE = 'rgba(255,255,255,0.16)';
  ctx.clearRect(0, 0, size, size); ctx.lineJoin = 'round';

  rr(ctx, size * 0.02, size * 0.02, size * 0.96, size * 0.96, size * 0.05);
  const pg = ctx.createRadialGradient(size * 0.4, size * 0.32, size * 0.08, size * 0.5, size * 0.52, size * 0.72);
  pg.addColorStop(0, '#1d1f30'); pg.addColorStop(1, '#0a0a12'); ctx.fillStyle = pg; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = Math.max(1.5, size * 0.005); ctx.stroke();
  ctx.save(); rr(ctx, size * 0.035, size * 0.035, size * 0.93, size * 0.93, size * 0.042); ctx.clip();
  const sh = ctx.createLinearGradient(0, size * 0.03, 0, size * 0.55); sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, size, size * 0.55); ctx.restore();

  geo.arms.forEach(({ color, arm, cells }) => {
    const lit = on(color);
    cells.forEach((c) => {
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(d2r(54 + arm * STEP));
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
      if (c.star) star(ctx, c.x, c.y, 0.4 * S, 0.15 * S, lit ? HEXC[color] : null);
      if (c.start) arrowMark(ctx, c.x, c.y, 0.6 * S);
    });
  });

  ORDER.forEach((color) => {
    const b = geo.bases[color], lit = on(color);
    const mx = (b.tri[1].x + b.tri[2].x) / 2, my = (b.tri[1].y + b.tri[2].y) / 2;
    const tg = ctx.createLinearGradient(b.tri[0].x, b.tri[0].y, mx, my);
    if (lit) { tg.addColorStop(0, adj(HEXC[color], 0.32)); tg.addColorStop(1, adj(HEXC[color], -0.28)); }
    else { tg.addColorStop(0, 'rgba(255,255,255,0.08)'); tg.addColorStop(1, 'rgba(255,255,255,0.03)'); }
    poly(ctx, b.tri); ctx.fillStyle = tg; ctx.fill(); ctx.strokeStyle = lit ? HEXC[color] : LINE; ctx.lineWidth = 2.2; ctx.stroke();
    poly(ctx, b.inner); ctx.fillStyle = 'rgba(10,12,22,0.5)'; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 1.2; ctx.stroke();
    b.slots.forEach((s) => { ctx.beginPath(); ctx.arc(s.x, s.y, 0.42 * S, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill(); ctx.strokeStyle = lit ? HEXC[color] : LINE; ctx.lineWidth = 2; ctx.stroke(); });
    ctx.save(); ctx.translate(geo.cx, geo.cy); ctx.rotate(d2r(b.ba));
    const { x, tw, th, r } = b.tab;
    ctx.beginPath(); ctx.moveTo(x, -th); ctx.lineTo(x + tw - r, -th); ctx.quadraticCurveTo(x + tw, -th, x + tw, -th + r); ctx.lineTo(x + tw, th - r); ctx.quadraticCurveTo(x + tw, th, x + tw - r, th); ctx.lineTo(x, th); ctx.closePath();
    const tabg = ctx.createLinearGradient(x, -th, x, th);
    if (lit) { tabg.addColorStop(0, adj(HEXC[color], 0.3)); tabg.addColorStop(1, adj(HEXC[color], -0.22)); }
    else { tabg.addColorStop(0, 'rgba(255,255,255,0.08)'); tabg.addColorStop(1, 'rgba(255,255,255,0.03)'); }
    ctx.fillStyle = tabg; ctx.fill(); ctx.strokeStyle = lit ? HEXC[color] : LINE; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.translate(x + 0.62 * S, 0); ctx.rotate((b.ba % 360) > 180 ? Math.PI / 2 : -Math.PI / 2);
    ctx.fillStyle = lit ? '#fff' : 'rgba(255,255,255,0.45)'; ctx.font = `bold ${Math.round(0.46 * S)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(color[0].toUpperCase() + color.slice(1), 0, 0);
    ctx.restore();
  });

  // centre pentagon — glass + neon glow + dice dots
  const R = geo.rPent;
  const gl = ctx.createRadialGradient(geo.cx, geo.cy, R * 0.5, geo.cx, geo.cy, R * 1.8);
  gl.addColorStop(0, 'rgba(0,190,255,0.4)'); gl.addColorStop(1, 'rgba(0,190,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(geo.cx, geo.cy, R * 1.8, 0, 7); ctx.fill();
  const rg = ctx.createRadialGradient(geo.cx - R * 0.4, geo.cy - R * 0.4, R * 0.2, geo.cx, geo.cy, R);
  rg.addColorStop(0, 'rgba(40,190,255,0.85)'); rg.addColorStop(0.55, 'rgba(0,90,170,0.7)'); rg.addColorStop(1, 'rgba(8,12,24,0.92)');
  poly(ctx, geo.pent); ctx.fillStyle = rg; ctx.fill();
  ctx.strokeStyle = 'rgba(120,220,255,0.6)'; ctx.lineWidth = 2.4; ctx.stroke();
  const sp = 1.0 * S, dot = 0.16 * S;
  const dx = [-0.25 * sp, 0.25 * sp, -0.25 * sp, 0.25 * sp, -0.25 * sp, 0.25 * sp];
  const dy = [-0.32 * sp, -0.32 * sp, 0, 0, 0.32 * sp, 0.32 * sp];
  ctx.fillStyle = '#fff';
  for (let j = 0; j < 6; j++) { ctx.beginPath(); ctx.arc(geo.cx + dx[j], geo.cy + dy[j], dot, 0, 7); ctx.fill(); }

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
