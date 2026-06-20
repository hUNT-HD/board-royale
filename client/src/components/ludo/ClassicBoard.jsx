import { MAIN, HOME, START, HEX, cellOf } from './classic.js';

// corner each colour owns on the 15×15 board
const CORNER = { red: 'tl', green: 'tr', yellow: 'br', blue: 'bl' };

// Lookups for styling the 15×15 grid.
const mainIndexAt = {};
MAIN.forEach(([r, c], i) => { mainIndexAt[`${r},${c}`] = i; });
const homeColorAt = {};
Object.entries(HOME).forEach(([color, cells]) =>
  cells.forEach(([r, c]) => { homeColorAt[`${r},${c}`] = color; }));
const startColorAt = {};
Object.entries(START).forEach(([color, idx]) => {
  const [r, c] = MAIN[idx]; startColorAt[`${r},${c}`] = color;
});
const STAR = new Set([8, 21, 34, 47]);

function trackCellStyle(r, c, active) {
  const key = `${r},${c}`;
  const home = homeColorAt[key];
  const start = startColorAt[key];
  const idx = mainIndexAt[key];
  // colour only belongs to an ACTIVE player; otherwise stay neutral
  if (start && active.has(start)) return { background: HEX[start], boxShadow: 'inset 0 0 8px rgba(0,0,0,.3)' };
  if (home && active.has(home)) return { background: HEX[home], opacity: 0.92 };
  if (idx !== undefined && STAR.has(idx)) return { background: 'rgba(255,255,255,0.92)' };
  return { background: 'rgba(255,255,255,0.82)' };
}

const isBase = (r, c) =>
  (r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8);
const isCenter = (r, c) => r >= 6 && r <= 8 && c >= 6 && c <= 8;
const isTrack = (r, c) => !isBase(r, c) && !isCenter(r, c);

export default function ClassicBoard({ players = [], activeColor, movable = new Set(), onToken }) {
  const active = new Set(players.map((p) => p.color));
  const cells = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (isTrack(r, c)) {
        const star = STAR.has(mainIndexAt[`${r},${c}`]);
        cells.push(
          <div key={`${r},${c}`} className="lc-cell" style={trackCellStyle(r, c, active)}>
            {star && <span className="lc-star">★</span>}
          </div>
        );
      } else {
        cells.push(<div key={`${r},${c}`} className="lc-cell lc-empty" />);
      }
    }
  }

  // build the four corner home areas; active = coloured, inactive = blank/dim
  const corners = [['red', 'tl'], ['green', 'tr'], ['yellow', 'br'], ['blue', 'bl']];

  return (
    <div className="lc-board mx-auto">
      <div className="lc-grid">{cells}</div>

      {corners.map(([color, pos]) => (
        <div key={color}
          className={`lc-home lc-${pos} ${active.has(color) ? '' : 'lc-home-off'}`}
          style={active.has(color) ? { '--hc': HEX[color] } : undefined}>
          <div className={`lc-home-inner ${active.has(color) ? '' : 'lc-inner-off'}`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`lc-slot ${active.has(color) ? '' : 'lc-slot-off'}`} />
            ))}
          </div>
        </div>
      ))}

      {/* center triangle — only quadrants for active colours */}
      <div className="lc-center" style={{ background: centerGradient(active) }} />

      {players.map((p) =>
        p.tokens.map((t) => {
          const [r, c] = cellOf(p.color, t.rel, t.id);
          const canMove = movable.has(`${p.color}:${t.id}`);
          return (
            <div key={`${p.color}-${t.id}`}
              onClick={() => canMove && onToken?.(p.color, t.id)}
              className={`lc-token ${canMove ? 'movable' : ''}`}
              style={{
                left: `${((c + 0.5) / 15) * 100}%`, top: `${((r + 0.5) / 15) * 100}%`,
                '--tk': HEX[p.color], zIndex: canMove ? 9 : 5,
                outline: p.color === activeColor ? '2px solid rgba(255,255,255,0.85)' : 'none',
              }} />
          );
        })
      )}
    </div>
  );
}

// center triangle pointing toward each corner's colour (dim if inactive)
function centerGradient(active) {
  const q = (color) => (active.has(color) ? HEX[color] : 'rgba(255,255,255,0.10)');
  // green(top) yellow(right) blue(bottom) red(left)
  return `conic-gradient(from 45deg, ${q('green')} 0 90deg, ${q('yellow')} 90deg 180deg, ${q('blue')} 180deg 270deg, ${q('red')} 270deg 360deg)`;
}
