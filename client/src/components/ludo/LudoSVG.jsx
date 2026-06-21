/**
 * LudoSVG — unified, GPU-cheap SVG renderer for ALL player counts.
 *   mode "square" (2–4) → exact 15×15 grid  (viewBox 0 0 15 15)
 *   mode "hex"    (5–6)  → exact hexagon     (viewBox -3 -3 106 106)
 *
 * Performance: the STATIC board (tiles, bases, hub) is memoized so a turn only
 * re-renders the ~16 token nodes, and glow comes from cheap radial-gradient
 * fills — NOT per-cell CSS drop-shadow filters (those caused the jank/hang).
 */
import { useMemo, useRef, useState, useEffect } from 'react';
import LudoHexCanvas from './LudoHexCanvas.jsx';
import LudoPentCanvas from './LudoPentCanvas.jsx';
import { MAIN, HOME, START, HEX, BASE_SLOTS, cellOf as sqCellOf, lerpCell as sqLerp } from './classic.js';
import {
  ORDER6, HEXC, RING_CELLS, yardSlots, cellOf as hxCellOf, PLATE,
  CELL, ROWS, cell, colorOfArm, wedgeBase, CENTER_TRIS,
} from './hexGeo.js';

const ALL_COLORS = { ...HEX, ...HEXC };

function Defs() {
  return (
    <defs>
      <radialGradient id="boardBg" cx="50%" cy="38%" r="80%">
        <stop offset="0%" stopColor="#222539" />
        <stop offset="100%" stopColor="#0e0f18" />
      </radialGradient>
      <linearGradient id="frameWood" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#23252f" />
        <stop offset="50%" stopColor="#181a24" />
        <stop offset="100%" stopColor="#0c0d14" />
      </linearGradient>
      <linearGradient id="frameSheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
        <stop offset="12%" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
      </linearGradient>
      {Object.entries(ALL_COLORS).map(([name, hex]) => (
        <radialGradient key={name} id={`gr-${name}`} cx="34%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="20%" stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="60%" stopColor={hex} />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>
      ))}
      {Object.entries(ALL_COLORS).map(([name, hex]) => (
        <radialGradient key={`g-${name}`} id={`glow-${name}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={hex} stopOpacity="0.85" />
          <stop offset="55%" stopColor={hex} stopOpacity="0.35" />
          <stop offset="100%" stopColor={hex} stopOpacity="0" />
        </radialGradient>
      ))}
      {Object.entries(ALL_COLORS).map(([name, hex]) => (
        <radialGradient key={`b-${name}`} id={`base-${name}`} cx="32%" cy="26%" r="90%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="38%" stopColor={hex} />
          <stop offset="100%" stopColor={hex} />
        </radialGradient>
      ))}
      <linearGradient id="cellGloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.13" />
        <stop offset="40%" stopColor="#ffffff" stopOpacity="0.06" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.03" />
      </linearGradient>
      <radialGradient id="surface" cx="42%" cy="30%" r="95%">
        <stop offset="0%" stopColor="#1d1f30" />
        <stop offset="70%" stopColor="#111321" />
        <stop offset="100%" stopColor="#0a0a12" />
      </radialGradient>
      <radialGradient id="vignette" cx="50%" cy="42%" r="72%">
        <stop offset="52%" stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.34" />
      </radialGradient>
      <radialGradient id="centerGlow" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stopColor="rgba(0,190,255,0.55)" />
        <stop offset="100%" stopColor="rgba(10,16,28,0.9)" />
      </radialGradient>
      <linearGradient id="goldStar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f7d774" />
        <stop offset="100%" stopColor="#bd8a2c" />
      </linearGradient>
      <filter id="softSh" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0.12" stdDeviation="0.14" floodColor="#000000" floodOpacity="0.4" />
      </filter>
      <filter id="tokenSh" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0.06" stdDeviation="0.09" floodColor="#000000" floodOpacity="0.45" />
      </filter>
    </defs>
  );
}

/* ============================ SQUARE ============================ */
const mainIndexAt = {}; MAIN.forEach(([r, c], i) => { mainIndexAt[`${r},${c}`] = i; });
const homeColorAt = {}; Object.entries(HOME).forEach(([col, cs]) => cs.forEach(([r, c]) => { homeColorAt[`${r},${c}`] = col; }));
const startColorAt = {}; Object.entries(START).forEach(([col, i]) => { const [r, c] = MAIN[i]; startColorAt[`${r},${c}`] = col; });
const SQ_STAR = new Set([8, 21, 34, 47]);
const CORNER = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };
const START_DIR = { red: 'right', green: 'down', yellow: 'left', blue: 'up' };
const STAR_COLOR = {}; [8, 21, 34, 47].forEach((g) => { const co = ['red', 'green', 'yellow', 'blue'][(g - 8) / 13]; const [r, c] = MAIN[g]; STAR_COLOR[`${r},${c}`] = co; });
const sqIsBase = (r, c) => (r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8);
const sqIsCenter = (r, c) => r >= 6 && r <= 8 && c >= 6 && c <= 8;

const arrowPts = (c, r, dir) => {
  const x = c + 0.5, y = r + 0.5, s = 0.2;
  return {
    right: `${x - s},${y - s} ${x + s},${y} ${x - s},${y + s}`,
    left: `${x + s},${y - s} ${x - s},${y} ${x + s},${y + s}`,
    down: `${x - s},${y - s} ${x + s},${y - s} ${x},${y + s}`,
    up: `${x - s},${y + s} ${x + s},${y + s} ${x},${y - s}`,
  }[dir];
};

function buildSquare(active) {
  const cells = [];
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
    if (sqIsBase(r, c) || sqIsCenter(r, c)) continue;
    const key = `${r},${c}`;
    const start = startColorAt[key], home = homeColorAt[key];
    const star = SQ_STAR.has(mainIndexAt[key]);
    const col = (start && active.has(start) && start) || (home && active.has(home) && home);
    const fill = col ? `url(#base-${col})` : 'url(#cellGloss)';
    cells.push(
      <g key={key}>
        <rect x={c + 0.05} y={r + 0.05} width="0.9" height="0.9" rx="0.18" fill={fill}
          stroke={col ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.09)'} strokeWidth="0.045" />
        <rect x={c + 0.12} y={r + 0.1} width="0.76" height="0.34" rx="0.14" fill="#ffffff" opacity={col ? 0.16 : 0.05} />
        {col && start && active.has(start) && <polygon points={arrowPts(c, r, START_DIR[start])} fill="rgba(255,255,255,0.96)" stroke="rgba(0,0,0,0.25)" strokeWidth="0.03" />}
        {star && !col && <text x={c + 0.5} y={r + 0.76} fontSize="0.72" textAnchor="middle"
          fill={STAR_COLOR[key] && active.has(STAR_COLOR[key]) ? HEX[STAR_COLOR[key]] : 'rgba(255,255,255,0.28)'}>★</text>}
      </g>
    );
  }
  const bases = Object.entries(CORNER).map(([color, [cb, rb]]) => {
    const on = active.has(color);
    return (
      <g key={color} filter="url(#softSh)">
        {/* dark-glass panel with a neon colour rim */}
        <rect x={cb + 0.1} y={rb + 0.1} width="5.8" height="5.8" rx="1.35"
          fill="rgba(255,255,255,0.05)" stroke={on ? HEX[color] : 'rgba(255,255,255,0.14)'} strokeWidth="0.16" />
        <rect x={cb + 0.1} y={rb + 0.1} width="5.8" height="2.5" rx="1.35" fill="#ffffff" opacity="0.08" />
        <rect x={cb + 0.92} y={rb + 0.92} width="4.16" height="4.16" rx="0.85"
          fill="rgba(8,10,18,0.5)" stroke={on ? `${HEX[color]}66` : 'rgba(255,255,255,0.1)'} strokeWidth="0.06" />
        {BASE_SLOTS[color].map(([r, c], i) => (
          <g key={i}>
            <circle cx={c + 0.5} cy={r + 0.5} r="0.5" fill={on ? `${HEX[color]}26` : 'transparent'} />
            <circle cx={c + 0.5} cy={r + 0.5} r="0.4" fill="rgba(255,255,255,0.05)"
              stroke={on ? HEX[color] : 'rgba(255,255,255,0.16)'} strokeWidth="0.05" />
          </g>
        ))}
      </g>
    );
  });
  // centre — four colour triangles meeting at a glassy neon hub
  const tri = [['green', '6,6 9,6 7.5,7.5'], ['yellow', '9,6 9,9 7.5,7.5'], ['blue', '9,9 6,9 7.5,7.5'], ['red', '6,9 6,6 7.5,7.5']]
    .map(([color, pts]) => (
      <polygon key={color} points={pts} fill={active.has(color) ? `url(#base-${color})` : 'rgba(255,255,255,0.05)'}
        stroke="rgba(255,255,255,0.2)" strokeWidth="0.05" />
    ));
  const emblem = (
    <g filter="url(#softSh)">
      <circle cx="7.5" cy="7.5" r="1.35" fill="url(#centerGlow)" />
      <circle cx="7.5" cy="7.5" r="0.92" fill="rgba(8,14,26,0.6)" stroke="rgba(120,220,255,0.6)" strokeWidth="0.08" />
      <ellipse cx="7.32" cy="7.22" rx="0.4" ry="0.22" fill="rgba(255,255,255,0.35)" />
      <circle cx="7.5" cy="7.5" r="0.22" fill="#ffffff" />
    </g>
  );
  return <>{cells}{tri}{bases}{emblem}</>;
}

const SQ_SPEED = 0.011; // cells per ms
function SquareSVG({ players, activeColor, movable, onToken }) {
  const active = useMemo(() => new Set(players.map((p) => p.color)), [players.map((p) => p.color).join()]); // eslint-disable-line
  const board = useMemo(() => buildSquare(active), [[...active].sort().join()]); // eslint-disable-line

  // cell-by-cell token movement animation
  const animRef = useRef(new Map());
  const lastRef = useRef(0);
  const [, force] = useState(0);
  useEffect(() => {
    let raf;
    lastRef.current = performance.now();
    const loop = (t) => {
      const dt = Math.min(64, t - lastRef.current); lastRef.current = t;
      let animating = false;
      players.forEach((p) => p.tokens.forEach((tk) => {
        const key = `${p.color}:${tk.id}`;
        let cur = animRef.current.has(key) ? animRef.current.get(key) : tk.rel;
        if (cur !== tk.rel) {
          if (tk.rel < cur) cur = tk.rel;
          else { cur = Math.min(tk.rel, cur + dt * SQ_SPEED); if (tk.rel - cur > 0.02) animating = true; else cur = tk.rel; }
          animRef.current.set(key, cur);
        }
      }));
      if (animating) { force((n) => n + 1); raf = requestAnimationFrame(loop); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line
  }, [players, activeColor, movable]);

  const posMap = {};
  players.forEach((p) => p.tokens.forEach((tk) => {
    const key = `${p.color}:${tk.id}`;
    const cur = animRef.current.has(key) ? animRef.current.get(key) : tk.rel;
    posMap[key] = sqLerp(p.color, cur, tk.id);
  }));

  return (
    <svg className="ludo-svg" viewBox="-0.85 -0.85 16.7 16.7" role="img" aria-label="Ludo board">
      <Defs />
      <rect x="-0.85" y="-0.85" width="16.7" height="16.7" rx="1.25" fill="url(#boardBg)" />
      {/* dark-glass frame + top sheen + light glass edge */}
      <rect x="-0.64" y="-0.64" width="16.28" height="16.28" rx="1.05" fill="url(#frameWood)" stroke="rgba(255,255,255,0.14)" strokeWidth="0.09" />
      <rect x="-0.64" y="-0.64" width="16.28" height="16.28" rx="1.05" fill="url(#frameSheen)" pointerEvents="none" />
      {/* dark-glass play surface */}
      <rect x="-0.08" y="-0.08" width="15.16" height="15.16" rx="0.55" fill="url(#surface)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.06" />
      {board}
      <Tokens players={players} activeColor={activeColor} movable={movable} onToken={onToken} cellOf={sqCellOf} r={0.4} off={0.13} posMap={posMap} />
      <rect x="-0.08" y="-0.08" width="15.16" height="15.16" rx="0.55" fill="url(#vignette)" pointerEvents="none" />
    </svg>
  );
}

/* ===================== HEX — Radiating Star & Wedge ===================== */
const SQ = CELL * 0.9;
const sqCell = (p, fill, key, sw = 2.4) => (
  <rect key={key} x={p.x - SQ / 2} y={p.y - SQ / 2} width={SQ} height={SQ} rx="5"
    fill={fill} stroke="#33312b" strokeWidth={sw} transform={`rotate(${p.rot} ${p.x} ${p.y})`} />
);

function buildHex(active) {
  const on = (c) => active.has(c);

  // 1) big wedge bases (drawn first, behind the arms)
  const wedges = ORDER6.map((color) => {
    const w = wedgeBase(color), lit = on(color);
    return (
      <g key={`w${color}`}>
        <polygon points={w.points} fill={lit ? `url(#base-${color})` : '#cdc6b2'}
          stroke="#2f2a1a" strokeWidth="4" strokeLinejoin="round" />
        <circle cx={w.white.cx} cy={w.white.cy} r={w.white.r}
          fill={lit ? '#fbf7ec' : '#e7e1d0'} stroke="rgba(0,0,0,0.25)" strokeWidth="3" />
        {yardSlots(color).map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r="18" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
        ))}
      </g>
    );
  });

  // 2) six arms (3×6): white side-column track + coloured middle home lane (+ white tip)
  const arms = colorOfArm.flatMap((color, a) => {
    const lit = on(color), mid = lit ? HEXC[color] : 'rgba(255,255,255,0.55)';
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      out.push(sqCell(cell(a, r, -1), '#ffffff', `a${a}r${r}L`));
      out.push(sqCell(cell(a, r, 1), '#ffffff', `a${a}r${r}R`));
      out.push(sqCell(cell(a, r, 0), r < 5 ? mid : '#ffffff', `a${a}r${r}M`));
    }
    return out;
  });

  // 3) start arrows (spawn cells) + safe stars, overlaid on the ring
  const marks = RING_CELLS.flatMap((o) => {
    if (o.startColor && on(o.startColor)) {
      const a = (o.rot * Math.PI) / 180, s = 13;
      return [<polygon key={`ar${o.g}`}
        points={`${o.x + Math.cos(a) * s},${o.y + Math.sin(a) * s} ${o.x + Math.cos(a + 2.44) * s},${o.y + Math.sin(a + 2.44) * s} ${o.x + Math.cos(a - 2.44) * s},${o.y + Math.sin(a - 2.44) * s}`}
        fill="rgba(255,255,255,0.96)" stroke="rgba(0,0,0,0.3)" strokeWidth="1.2" />];
    }
    if (o.star) return [<text key={`st${o.g}`} x={o.x} y={o.y + 9} fontSize="26" textAnchor="middle" fill="rgba(70,55,25,0.5)">★</text>];
    return [];
  });

  // 4) centre hexagon: six colour triangles + die hub
  const center = (
    <g>
      {CENTER_TRIS.map((t) => (
        <polygon key={t.color} points={t.points} fill={on(t.color) ? `url(#base-${t.color})` : '#d6cfbd'}
          stroke="#2f2a1a" strokeWidth="3" />
      ))}
      <rect x="454" y="454" width="92" height="92" rx="18" fill="#16161f" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
      <circle cx="500" cy="500" r="11" fill="#fff" />
    </g>
  );

  return <>{wedges}{arms}{marks}{center}</>;
}

function HexSVG({ players, activeColor, movable, onToken }) {
  const active = useMemo(() => new Set(players.map((p) => p.color)), [players.map((p) => p.color).join()]); // eslint-disable-line
  const board = useMemo(() => buildHex(active), [[...active].sort().join()]); // eslint-disable-line
  return (
    <svg className="ludo-svg" viewBox="0 0 1000 1000" role="img" aria-label="Hexagonal Ludo board">
      <Defs />
      <polygon points={PLATE} fill="url(#surface)" stroke="#2f2a1a" strokeWidth="16" strokeLinejoin="round" />
      {board}
      <Tokens players={players} activeColor={activeColor} movable={movable} onToken={onToken} cellOf={hxCellOf} r={19} off={6} />
      <polygon points={PLATE} fill="url(#vignette)" pointerEvents="none" />
    </svg>
  );
}

/* ---------- shared 3-D-looking token layer (cheap glow, no filters) ---------- */
function Tokens({ players, activeColor, movable, onToken, cellOf, r, off, posMap }) {
  return (
    <g>
      {players.map((p) =>
        p.tokens.map((t) => {
          const key = `${p.color}:${t.id}`;
          const raw = (posMap && posMap[key]) || cellOf(p.color, t.rel, t.id);
          const pos = Array.isArray(raw) ? { x: raw[1] + 0.5, y: raw[0] + 0.5 } : raw;
          const cx = pos.x + (t.rel >= 0 ? (t.id - 1.5) * off : 0);
          const cy = pos.y;
          const canMove = movable.has(`${p.color}:${t.id}`);
          const hcy = cy - r * 0.45, hex = HEX[p.color] || HEXC[p.color], stroke = canMove ? '#ffffff' : 'rgba(22,22,38,0.85)';
          const whitePoint = `${cx - r * 0.55},${hcy + r * 0.55} ${cx + r * 0.55},${hcy + r * 0.55} ${cx},${hcy + r * 1.5}`;
          const innerPoint = `${cx - r * 0.36},${hcy + r * 0.5} ${cx + r * 0.36},${hcy + r * 0.5} ${cx},${hcy + r * 1.2}`;
          return (
            <g key={`${p.color}-${t.id}`} className={`svg-token ${canMove ? 'move' : ''}`}
              onClick={() => canMove && onToken?.(p.color, t.id)}>
              {/* ground shadow */}
              <ellipse cx={cx} cy={cy + r * 0.72} rx={r * 0.88} ry={r * 0.3} fill="rgba(0,0,0,0.32)" />
              {/* glow halo */}
              <circle cx={cx} cy={hcy} r={r * (canMove ? 1.9 : 1.35)} fill={`url(#glow-${p.color})`} opacity={canMove ? 0.95 : 0.4} />
              {/* white pin (head + point) */}
              <polygon points={whitePoint} fill="#ffffff" />
              <circle cx={cx} cy={hcy} r={r} fill="#ffffff" />
              <path d={`M ${cx - r * 0.55} ${hcy + r * 0.5} L ${cx} ${hcy + r * 1.5} L ${cx + r * 0.55} ${hcy + r * 0.5}`}
                fill="none" stroke={stroke} strokeWidth={r * 0.14} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={cx} cy={hcy} r={r} fill="none" stroke={stroke} strokeWidth={r * 0.13} />
              {/* glossy colour sphere + coloured point */}
              <circle cx={cx} cy={hcy} r={r * 0.74} fill={`url(#gr-${p.color})`} />
              <polygon points={innerPoint} fill={hex} />
              {/* specular */}
              <ellipse cx={cx - r * 0.26} cy={hcy - r * 0.3} rx={r * 0.24} ry={r * 0.15} fill="rgba(255,255,255,0.92)"
                transform={`rotate(-28 ${cx - r * 0.26} ${hcy - r * 0.3})`} />
            </g>
          );
        })
      )}
    </g>
  );
}

export default function LudoSVG({ mode, players = [], activeColor, movable = new Set(), onToken }) {
  if (mode === 'pent') return <LudoPentCanvas players={players} activeColor={activeColor} movable={movable} onToken={onToken} />;
  if (mode === 'hex') return <LudoHexCanvas players={players} activeColor={activeColor} movable={movable} onToken={onToken} />;
  return <SquareSVG players={players} activeColor={activeColor} movable={movable} onToken={onToken} />;
}
