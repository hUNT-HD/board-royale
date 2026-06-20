import {
  EDGE_BARS, homeBar, ringCellRect, basePos, cellOf, HEXC, ORDER6,
} from './hex.js';

const ARM = 13;
const trackBg =
  'repeating-linear-gradient(90deg, rgba(255,255,255,0.86) 0, rgba(255,255,255,0.86) calc(100%/13 - 1.3px),' +
  ' rgba(8,8,14,0.5) calc(100%/13 - 1.3px), rgba(8,8,14,0.5) calc(100%/13))';
const homeBg = (c) =>
  `repeating-linear-gradient(90deg, ${c} 0, ${c} calc(100%/5 - 1.3px),` +
  ` rgba(8,8,14,0.45) calc(100%/5 - 1.3px), rgba(8,8,14,0.45) calc(100%/5))`;

// position + rotate a bar/cell
const place = (o, thickness) => ({
  left: `${o.x}%`, top: `${o.y}%`,
  width: `${o.len}%`, height: `${thickness}%`,
  transform: `translate(-50%, -50%) rotate(${o.rot}deg)`,
});

export default function HexBoard({ players = [], activeColor, movable = new Set(), onToken }) {
  const active = new Set(players.map((p) => p.color));

  return (
    <div className="hx-board mx-auto">
      <div className="hx-plate" />

      {/* six continuous track bars (the connected ring) */}
      {EDGE_BARS.map((bar) => (
        <div key={`edge${bar.k}`} className="hx-bar" style={{ ...place(bar, 5.2), backgroundImage: trackBg }} />
      ))}

      {/* coloured home stretches: each physically joins an edge to the hub */}
      {ORDER6.filter((c) => active.has(c)).map((color) => {
        const bar = homeBar(color);
        return <div key={`home${color}`} className="hx-bar hx-home"
          style={{ ...place(bar, 5.2), backgroundImage: homeBg(HEXC[color]) }} />;
      })}

      {/* start + star cell markers (active players) */}
      {ORDER6.filter((c) => active.has(c)).map((color) => {
        const i = ORDER6.indexOf(color);
        const s = ringCellRect(i * ARM);
        const star = ringCellRect((i * ARM + 8) % (ARM * 6));
        return (
          <div key={`mk${color}`}>
            <div className="hx-mark" style={{ ...place(s, 5.2), background: HEXC[color] }} />
            <div className="hx-mark hx-star" style={{ ...place(star, 5.2) }}>★</div>
          </div>
        );
      })}

      {/* central hub — home bars run into it */}
      <div className="hx-hub" />

      {/* home bases (active only) */}
      {ORDER6.filter((c) => active.has(c)).map((color) => {
        const b = basePos(color);
        return (
          <div key={`base${color}`} className="hx-base" style={{ left: `${b.x}%`, top: `${b.y}%`, '--hc': HEXC[color] }}>
            <div className="hx-base-inner">
              {[0, 1, 2, 3].map((i) => <span key={i} className="hx-slot" />)}
            </div>
          </div>
        );
      })}

      {/* tokens — centred in their cell */}
      {players.map((p) =>
        p.tokens.map((t) => {
          const { x, y } = cellOf(p.color, t.rel, t.id);
          const canMove = movable.has(`${p.color}:${t.id}`);
          return (
            <div key={`${p.color}-${t.id}`}
              onClick={() => canMove && onToken?.(p.color, t.id)}
              className={`hx-token ${canMove ? 'movable' : ''}`}
              style={{
                left: `${x}%`, top: `${y}%`, '--tk': HEXC[p.color],
                zIndex: canMove ? 9 : 6,
                outline: p.color === activeColor ? '2px solid rgba(255,255,255,0.85)' : 'none',
              }} />
          );
        })
      )}
    </div>
  );
}
