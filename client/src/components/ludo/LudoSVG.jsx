/**
 * LudoSVG — unified, GPU-cheap SVG renderer for ALL player counts.
 *   mode "square" (2–4) → exact 15×15 grid  (viewBox 0 0 15 15)
 *   mode "hex"    (5–6)  → exact hexagon     (viewBox -3 -3 106 106)
 *
 * Performance: the STATIC board (tiles, bases, hub) is memoized so a turn only
 * re-renders the ~16 token nodes, and glow comes from cheap radial-gradient
 * fills — NOT per-cell CSS drop-shadow filters (those caused the jank/hang).
 */
import { useMemo } from 'react';
import { MAIN, HOME, START, HEX, BASE_SLOTS, cellOf as sqCellOf } from './classic.js';
import {
  ORDER6, HEXC, RING_CELLS, homeCells, baseRect, cellOf as hxCellOf, PLATE, HUB,
} from './hexGeo.js';

const ALL_COLORS = { ...HEX, ...HEXC };

function Defs() {
  return (
    <defs>
      <linearGradient id="boardBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#191a2b" />
        <stop offset="100%" stopColor="#090910" />
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
    </defs>
  );
}

/* ============================ SQUARE ============================ */
const mainIndexAt = {}; MAIN.forEach(([r, c], i) => { mainIndexAt[`${r},${c}`] = i; });
const homeColorAt = {}; Object.entries(HOME).forEach(([col, cs]) => cs.forEach(([r, c]) => { homeColorAt[`${r},${c}`] = col; }));
const startColorAt = {}; Object.entries(START).forEach(([col, i]) => { const [r, c] = MAIN[i]; startColorAt[`${r},${c}`] = col; });
const SQ_STAR = new Set([8, 21, 34, 47]);
const CORNER = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };
const sqIsBase = (r, c) => (r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8);
const sqIsCenter = (r, c) => r >= 6 && r <= 8 && c >= 6 && c <= 8;

function buildSquare(active) {
  const tracks = [];
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
    if (sqIsBase(r, c) || sqIsCenter(r, c)) continue;
    const key = `${r},${c}`;
    const start = startColorAt[key], home = homeColorAt[key];
    const idx = mainIndexAt[key], star = SQ_STAR.has(idx);
    const col = (start && active.has(start) && start) || (home && active.has(home) && home);
    const fill = col ? HEX[col] : star ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.11)';
    tracks.push(
      <g key={key}>
        <rect x={c + 0.05} y={r + 0.05} width="0.9" height="0.9" rx="0.16" fill={fill}
          stroke={col ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.13)'} strokeWidth="0.035" />
        {star && !col && <text x={c + 0.5} y={r + 0.72} fontSize="0.58" textAnchor="middle" fill="rgba(255,255,255,0.6)">★</text>}
      </g>
    );
  }
  const bases = Object.entries(CORNER).map(([color, [cb, rb]]) => {
    const on = active.has(color);
    return (
      <g key={color}>
        <rect x={cb + 0.1} y={rb + 0.1} width="5.8" height="5.8" rx="0.9"
          fill={on ? HEX[color] : 'rgba(255,255,255,0.05)'} stroke="rgba(255,255,255,0.16)" strokeWidth="0.06" />
        <rect x={cb + 1} y={rb + 1} width="4" height="4" rx="0.6" fill={on ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.06)'} />
        {BASE_SLOTS[color].map(([r, c], i) => (
          <circle key={i} cx={c + 0.5} cy={r + 0.5} r="0.34"
            fill={on ? '#fff' : 'rgba(255,255,255,0.10)'} stroke={on ? HEX[color] : 'rgba(255,255,255,0.22)'} strokeWidth="0.08" />
        ))}
      </g>
    );
  });
  const tri = [['green', '6,6 9,6 7.5,7.5'], ['yellow', '9,6 9,9 7.5,7.5'], ['blue', '9,9 6,9 7.5,7.5'], ['red', '6,9 6,6 7.5,7.5']]
    .map(([color, pts]) => (
      <polygon key={color} points={pts} fill={active.has(color) ? HEX[color] : 'rgba(255,255,255,0.05)'}
        stroke="rgba(255,255,255,0.15)" strokeWidth="0.04" />
    ));
  return <>{tracks}{bases}{tri}</>;
}

function SquareSVG({ players, activeColor, movable, onToken }) {
  const active = useMemo(() => new Set(players.map((p) => p.color)), [players.map((p) => p.color).join()]); // eslint-disable-line
  const board = useMemo(() => buildSquare(active), [[...active].sort().join()]); // eslint-disable-line
  return (
    <svg className="ludo-svg" viewBox="0 0 15 15" role="img" aria-label="Ludo board">
      <Defs />
      <rect x="-0.4" y="-0.4" width="15.8" height="15.8" rx="0.8" fill="url(#boardBg)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.08" />
      {board}
      <Tokens players={players} activeColor={activeColor} movable={movable} onToken={onToken} cellOf={sqCellOf} r={0.42} off={0.13} />
    </svg>
  );
}

/* ============================== HEX ============================== */
function buildHex(active) {
  const ring = RING_CELLS.map((o) => {
    const lit = o.startColor && active.has(o.startColor);
    const fill = lit ? HEX[o.startColor] : o.star ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.13)';
    return (
      <rect key={`r${o.g}`} x={o.cx - o.w / 2} y={o.cy - o.h / 2} width={o.w} height={o.h} rx="0.7"
        fill={fill} stroke={lit ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.14)'} strokeWidth="0.2"
        transform={`rotate(${o.angle} ${o.cx} ${o.cy})`} />
    );
  });
  const homes = ORDER6.flatMap((color) =>
    homeCells(color).map((o, k) => (
      <rect key={`h${color}${k}`} x={o.cx - o.w / 2} y={o.cy - o.h / 2} width={o.w} height={o.h} rx="0.7"
        fill={active.has(color) ? HEX[color] : 'rgba(255,255,255,0.06)'} stroke="rgba(255,255,255,0.14)" strokeWidth="0.2"
        transform={`rotate(${o.angle} ${o.cx} ${o.cy})`} />
    )));
  const bases = ORDER6.map((color) => {
    const b = baseRect(color), on = active.has(color);
    return (
      <g key={`b${color}`}>
        <rect x={b.x} y={b.y} width={b.size} height={b.size} rx="1.5" fill={on ? HEX[color] : 'rgba(255,255,255,0.05)'} stroke="rgba(255,255,255,0.16)" strokeWidth="0.3" />
        <rect x={b.x + 1.4} y={b.y + 1.4} width={b.size - 2.8} height={b.size - 2.8} rx="1" fill={on ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.06)'} />
        {[0, 1, 2, 3].map((i) => {
          const sx = b.cx + (i % 2 ? 1 : -1) * 2.1, sy = b.cy + (i < 2 ? -1 : 1) * 2.1;
          return <circle key={i} cx={sx} cy={sy} r="1.5" fill={on ? '#fff' : 'rgba(255,255,255,0.1)'} stroke={on ? HEX[color] : 'rgba(255,255,255,0.22)'} strokeWidth="0.3" />;
        })}
      </g>
    );
  });
  return <>{ring}{homes}<polygon points={HUB} fill="#191a26" stroke="rgba(255,255,255,0.18)" strokeWidth="0.4" />{bases}</>;
}

function HexSVG({ players, activeColor, movable, onToken }) {
  const active = useMemo(() => new Set(players.map((p) => p.color)), [players.map((p) => p.color).join()]); // eslint-disable-line
  const board = useMemo(() => buildHex(active), [[...active].sort().join()]); // eslint-disable-line
  return (
    <svg className="ludo-svg" viewBox="-3 -3 106 106" role="img" aria-label="Hexagonal Ludo board">
      <Defs />
      <polygon points={PLATE} fill="url(#boardBg)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
      {board}
      <Tokens players={players} activeColor={activeColor} movable={movable} onToken={onToken} cellOf={hxCellOf} r={2.7} off={0.9} />
    </svg>
  );
}

/* ---------- shared 3-D-looking token layer (cheap glow, no filters) ---------- */
function Tokens({ players, activeColor, movable, onToken, cellOf, r, off }) {
  return (
    <g>
      {players.map((p) =>
        p.tokens.map((t) => {
          const raw = cellOf(p.color, t.rel, t.id);
          const pos = Array.isArray(raw) ? { x: raw[1] + 0.5, y: raw[0] + 0.5 } : raw;
          const cx = pos.x + (t.rel >= 0 ? (t.id - 1.5) * off : 0);
          const cy = pos.y;
          const canMove = movable.has(`${p.color}:${t.id}`);
          return (
            <g key={`${p.color}-${t.id}`} className={`svg-token ${canMove ? 'move' : ''}`}
              onClick={() => canMove && onToken?.(p.color, t.id)}>
              <circle cx={cx} cy={cy} r={r * 1.9} fill={`url(#glow-${p.color})`} opacity={canMove ? 0.95 : 0.55} />
              <circle cx={cx} cy={cy} r={r} fill={`url(#gr-${p.color})`}
                stroke={p.color === activeColor ? '#fff' : 'rgba(255,255,255,0.85)'} strokeWidth={r * 0.14} />
              <ellipse cx={cx - r * 0.3} cy={cy - r * 0.36} rx={r * 0.4} ry={r * 0.26} fill="rgba(255,255,255,0.9)" />
            </g>
          );
        })
      )}
    </g>
  );
}

export default function LudoSVG({ mode, players = [], activeColor, movable = new Set(), onToken }) {
  const Comp = mode === 'hex' ? HexSVG : SquareSVG;
  return <Comp players={players} activeColor={activeColor} movable={movable} onToken={onToken} />;
}
