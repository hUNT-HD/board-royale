/**
 * ludoCanvasCore.js — pure HTML5 Canvas geometry + drawing for the 6-player
 * hexagonal Ludo board. No DOM/React; takes a CanvasRenderingContext2D.
 *
 * Layout (matches the reference): a perfect regular hexagon with a vertex at the
 * BOTTOM and TOP. The 6 triangular colour BASES fill the corners:
 *   Blue bottom · Yellow bottom-left · Purple top-left · Red top · Green top-right · Orange bottom-right
 * The 3-column track ARMS sit in the faces BETWEEN the bases and run to the centre;
 * each arm's middle column is a colour's home stretch.
 *
 * Engine alignment (LudoEngine): 78-step ring, starts blue0/yellow13/purple26/
 * red39/green52/orange65, home 5 cells + centre. trackCoordinates[g] is the pixel
 * centre of global ring index g; OFF rotates engine index → physical slot so each
 * colour spawns by its own arm and turns into its own home.
 */
export const ORDER = ['blue', 'yellow', 'purple', 'red', 'green', 'orange'];
export const HEXC = {
  red: '#ff3b5c', green: '#19c37d', yellow: '#ffc23b',
  blue: '#3b6bff', purple: '#9b5bff', orange: '#ff8a3b',
};
const EDGE_OF = { blue: 1, yellow: 2, purple: 3, red: 4, green: 5, orange: 0 };
const BASE_ANGLE = { blue: 90, yellow: 150, purple: 210, red: 270, green: 330, orange: 30 };
const START = { blue: 0, yellow: 13, purple: 26, red: 39, green: 52, orange: 65 };
const RING = 78, OFF = 19, HOME_LEN = 5, ARM = 13, ROWS = 6, STAR_AHEAD = 8;
const SAFE = new Set(ORDER.flatMap((c) => [START[c], (START[c] + STAR_AHEAD) % RING]));
const colorOfArm = []; ORDER.forEach((c) => { colorOfArm[EDGE_OF[c]] = c; });

const d2r = (d) => (d * Math.PI) / 180;
const ux = (a) => Math.cos(d2r(a)), uy = (a) => Math.sin(d2r(a));
const armAng = (a) => 60 * a;

/** Build all pixel geometry for a board centred at (cx,cy) with radius R. */
export function buildGeometry(cx, cy, R) {
  const cell = R * 0.092, rIn = R * 0.272;
  const at = (a, r, k) => {
    const A = armAng(a), rad = rIn + (r + 0.5) * cell, lat = k * cell;
    return { x: cx + rad * ux(A) + lat * ux(A + 90), y: cy + rad * uy(A) + lat * uy(A + 90), rot: A };
  };
  const ringCell = (g) => {
    const ph = (g + OFF) % RING, a = Math.floor(ph / ARM), i = ph % ARM;
    if (i < 6) return at(a, i, -1);
    if (i === 6) return at(a, 5, 0);
    return at(a, 12 - i, 1);
  };
  const track = Array.from({ length: RING }, (_, g) => ringCell(g));
  const homes = {}; ORDER.forEach((c) => { homes[c] = Array.from({ length: HOME_LEN }, (_, k) => at(EDGE_OF[c], 4 - k, 0)); });

  const VR_OUT = rIn + ROWS * cell + R * 0.01, VR_IN = rIn - R * 0.012, WHITE = R * 0.118;
  const bases = {};
  ORDER.forEach((c) => {
    const A = BASE_ANGLE[c];
    const wr = rIn + ROWS * cell * 0.52, wc = { x: cx + wr * ux(A), y: cy + wr * uy(A) };
    const sp = R * 0.055, spawns = [];
    for (let t = 0; t < 4; t++) {
      const sx = t % 2 ? 1 : -1, sy = t < 2 ? -1 : 1;
      spawns.push({ x: wc.x + sx * sp * ux(A + 90) + sy * sp * ux(A), y: wc.y + sx * sp * uy(A + 90) + sy * sp * uy(A) });
    }
    bases[c] = {
      apex: { x: cx + VR_IN * ux(A), y: cy + VR_IN * uy(A) },
      c1: { x: cx + VR_OUT * ux(A - 30), y: cy + VR_OUT * uy(A - 30) },
      c2: { x: cx + VR_OUT * ux(A + 30), y: cy + VR_OUT * uy(A + 30) },
      white: { x: wc.x, y: wc.y, r: WHITE }, spawns,
    };
  });

  const arms = colorOfArm.map((color, a) => {
    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      cells.push({ ...at(a, r, -1), role: 'track' });
      cells.push({ ...at(a, r, 1), role: 'track' });
      cells.push({ ...at(a, r, 0), role: r < 5 ? 'home' : 'tip', color });
    }
    return { a, color, cells };
  });

  const plate = Array.from({ length: 6 }, (_, k) => { const a = 30 + 60 * k; return { x: cx + R * ux(a), y: cy + R * uy(a) }; });
  const CHV = rIn / Math.cos(d2r(30));
  const centerTris = colorOfArm.map((color, a) => {
    const A0 = armAng(a) - 30, A1 = armAng(a) + 30;
    return { color, p0: { x: cx + CHV * ux(A0), y: cy + CHV * uy(A0) }, p1: { x: cx + CHV * ux(A1), y: cy + CHV * uy(A1) } };
  });
  const startCells = {}; ORDER.forEach((c) => { startCells[c] = (START[c]) % RING; });
  return { cx, cy, R, cell, track, homes, bases, arms, plate, centerTris, START, SAFE, startCells };
}

/** Pixel centre of any token (matches LudoEngine rel model). */
export function tokenPos(geo, color, rel, id = 0) {
  if (rel < 0) return geo.bases[color].spawns[id] || geo.bases[color].white;
  if (rel <= RING - 1) return geo.track[(geo.START[color] + rel) % RING];
  if (rel <= RING - 1 + HOME_LEN) return geo.homes[color][rel - RING];
  return { x: geo.cx, y: geo.cy };
}

/* ---------- drawing ---------- */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };

function square(ctx, p, size, fill, stroke, sw) {
  ctx.save();
  ctx.translate(p.x, p.y); ctx.rotate(d2r(p.rot));
  roundRectPath(ctx, -size / 2, -size / 2, size, size, size * 0.12);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.restore();
}

/**
 * drawGame(ctx, geo, state) — full board + tokens.
 * state = { players:[{color,tokens:[{id,rel}]}], active, movable:Set('color:id'),
 *           ghosts:Set(color), time }
 */
export function drawGame(ctx, geo, state) {
  const { cx, cy, R, cell } = geo;
  const on = (c) => !state.ghosts || !state.ghosts.has(c);
  const SW = Math.max(1.5, R * 0.004);
  ctx.lineJoin = 'round';

  // board plate
  poly(ctx, geo.plate);
  ctx.fillStyle = '#ece3cd'; ctx.fill();
  ctx.lineWidth = R * 0.032; ctx.strokeStyle = '#2f2a1a'; ctx.stroke();

  // wedge bases
  ORDER.forEach((c) => {
    const b = geo.bases[c], lit = on(c);
    poly(ctx, [b.apex, b.c1, b.c2]);
    ctx.fillStyle = lit ? HEXC[c] : '#cdc6b2'; ctx.fill();
    ctx.lineWidth = R * 0.008; ctx.strokeStyle = '#2f2a1a'; ctx.stroke();
    ctx.beginPath(); ctx.arc(b.white.x, b.white.y, b.white.r, 0, 7);
    ctx.fillStyle = lit ? '#fbf7ec' : '#e7e1d0'; ctx.fill();
    ctx.lineWidth = SW; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.stroke();
    b.spawns.forEach((s) => { ctx.beginPath(); ctx.arc(s.x, s.y, cell * 0.42, 0, 7); ctx.lineWidth = SW; ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.stroke(); });
  });

  // arms: white track sides + coloured home middle (+ white tip)
  const SQ = cell * 0.9;
  geo.arms.forEach(({ color, cells }) => {
    const lit = on(color);
    cells.forEach((p) => {
      const fill = p.role === 'track' ? '#ffffff'
        : p.role === 'tip' ? '#ffffff'
          : (lit ? HEXC[color] : 'rgba(255,255,255,0.55)');
      square(ctx, p, SQ, fill, '#33312b', SW);
    });
  });

  // start arrows + safe stars
  geo.track.forEach((p, g) => {
    const startColor = g % ARM === 0 ? ORDER[g / ARM] : null;
    if (startColor && on(startColor)) {
      const a = d2r(p.rot), s = cell * 0.3;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s);
      ctx.lineTo(p.x + Math.cos(a + 2.44) * s, p.y + Math.sin(a + 2.44) * s);
      ctx.lineTo(p.x + Math.cos(a - 2.44) * s, p.y + Math.sin(a - 2.44) * s);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.fill();
      ctx.lineWidth = SW * 0.5; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
    } else if (geo.SAFE.has(g) && g % ARM !== 0) {
      ctx.fillStyle = 'rgba(70,55,25,0.5)';
      ctx.font = `${cell * 0.62}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★', p.x, p.y);
    }
  });

  // centre hexagon: colour triangles + die hub
  geo.centerTris.forEach((t) => {
    poly(ctx, [{ x: cx, y: cy }, t.p0, t.p1]);
    ctx.fillStyle = on(t.color) ? HEXC[t.color] : '#d6cfbd'; ctx.fill();
    ctx.lineWidth = SW; ctx.strokeStyle = '#2f2a1a'; ctx.stroke();
  });
  const dh = R * 0.092;
  roundRectPath(ctx, cx - dh, cy - dh, dh * 2, dh * 2, dh * 0.35);
  ctx.fillStyle = '#16161f'; ctx.fill();
  ctx.lineWidth = SW; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.022, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();

  // tokens
  (state.players || []).forEach((p) => {
    p.tokens.forEach((t) => {
      const pos = tokenPos(geo, p.color, t.rel, t.id);
      const movable = state.movable && state.movable.has(`${p.color}:${t.id}`);
      const tr = cell * 0.42;
      const pulse = movable ? 1 + Math.sin((state.time || 0) / 180) * 0.18 : 1;
      // glow
      const g = ctx.createRadialGradient(pos.x, pos.y, tr * 0.3, pos.x, pos.y, tr * 2.1 * pulse);
      g.addColorStop(0, HEXC[p.color] + 'cc'); g.addColorStop(1, HEXC[p.color] + '00');
      ctx.beginPath(); ctx.arc(pos.x, pos.y, tr * 2.1 * pulse, 0, 7); ctx.fillStyle = g; ctx.fill();
      // body
      const bg = ctx.createRadialGradient(pos.x - tr * 0.35, pos.y - tr * 0.4, tr * 0.15, pos.x, pos.y, tr);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.45, HEXC[p.color]); bg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.beginPath(); ctx.arc(pos.x, pos.y, tr, 0, 7); ctx.fillStyle = bg; ctx.fill();
      ctx.lineWidth = Math.max(1.5, tr * 0.14); ctx.strokeStyle = p.color === state.active ? '#fff' : 'rgba(255,255,255,0.85)'; ctx.stroke();
      // highlight
      ctx.beginPath(); ctx.ellipse(pos.x - tr * 0.3, pos.y - tr * 0.36, tr * 0.34, tr * 0.22, 0, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    });
  });
}

/** Hit-test a click at (px,py): returns {color,id} of the topmost token, or null. */
export function hitToken(geo, players, px, py) {
  const tr = geo.cell * 0.5;
  for (let i = players.length - 1; i >= 0; i--) {
    const p = players[i];
    for (const t of p.tokens) {
      const pos = tokenPos(geo, p.color, t.rel, t.id);
      if ((px - pos.x) ** 2 + (py - pos.y) ** 2 <= tr * tr) return { color: p.color, id: t.id };
    }
  }
  return null;
}
