import { ALL_RING_CELLS, tokenPos, yardSlotPos } from './ludoPath.js';
import { ENTRY, SAFE_SET } from './ludoMeta.js';

const COLOR_VAR = (c) => `var(--${c})`;

/**
 * LudoBoard — renders the hexagonal arena: glossy hex plate, 6 colored yards,
 * the 78 ring cells (safe cells highlighted) and every player's glowing tokens.
 *
 * Props:
 *   players      serialized players from the server
 *   activeColor  color whose turn it is
 *   movable      Set of "color:tokenId" that can move right now
 *   onToken(color, tokenId)
 */
export default function LudoBoard({ players = [], activeColor, movable = new Set(), onToken }) {
  return (
    <div className="ludo-stage mx-auto">
      {/* glossy hexagonal plate */}
      <div className="ludo-hex" />

      {/* player yards at the six arms */}
      {players.map((p) => {
        const slot = yardSlotPos(p.seat, 0); // anchor of the yard cluster
        return (
          <div key={`yard-${p.color}`} className="ludo-yard"
            style={{
              left: `${slot.x}%`, top: `${slot.y}%`,
              transform: 'translate(-50%,-50%)',
              '--yard': hexA(p.color, 0.22),
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 0 26px ${hexA(p.color, 0.5)}`,
            }} />
        );
      })}

      {/* shared ring cells */}
      {ALL_RING_CELLS.map((cell) => {
        const safe = SAFE_SET.has(cell.index);
        const entryColor = ENTRY[cell.index];
        return (
          <div key={`cell-${cell.index}`}
            className={`ludo-cell ${safe ? 'safe' : ''}`}
            style={{
              left: `${cell.x}%`, top: `${cell.y}%`,
              ...(entryColor && {
                background: `linear-gradient(160deg, ${hexA(entryColor, 0.5)}, ${hexA(entryColor, 0.18)})`,
                boxShadow: `0 0 14px ${hexA(entryColor, 0.6)}`,
              }),
            }} />
        );
      })}

      {/* tokens */}
      {players.map((p) =>
        p.tokens.map((t) => {
          const pos = tokenPos(p.seat, t);
          const canMove = movable.has(`${p.color}:${t.id}`);
          return (
            <div key={`tk-${p.color}-${t.id}`}
              onClick={() => canMove && onToken?.(p.color, t.id)}
              className={`ludo-token ${canMove ? 'movable' : ''}`}
              style={{
                left: `${pos.x}%`, top: `${pos.y}%`,
                '--tk': COLOR_VAR(p.color),
                '--tk-glow': hexA(p.color, 0.7),
                outline: p.color === activeColor ? '2px solid rgba(255,255,255,0.7)' : 'none',
              }} />
          );
        })
      )}
    </div>
  );
}

// helper: color name -> rgba with alpha (reads the CSS var palette inline)
const PALETTE = {
  red: '255,59,92', blue: '59,107,255', green: '25,195,125',
  yellow: '255,194,59', purple: '155,91,255', orange: '255,138,59',
};
function hexA(color, a) { return `rgba(${PALETTE[color]},${a})`; }
