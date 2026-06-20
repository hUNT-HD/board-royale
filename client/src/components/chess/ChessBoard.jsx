// Unicode glyphs — styled into "glass" pieces via CSS (.piece-white / .piece-black).
const GLYPH = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
};
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * ChessBoard — pure presentation. Renders the marble/quartz grid, glass pieces,
 * legal-move dots, and the spotlight on the selected piece.
 *
 * Props:
 *   board         8x8 matrix from chess.js (game.board())
 *   selected      square id or null
 *   legalTargets  [{ to, capture }]
 *   onSquare(sq)  click handler
 *   flipped       render from black's perspective
 */
export default function ChessBoard({ board, selected, legalTargets = [], onSquare, flipped }) {
  const targets = new Map(legalTargets.map((t) => [t.to, t.capture]));
  const ranks = flipped ? [...board].reverse() : board;

  return (
    <div className="chess-board mx-auto">
      <div className="chess-grid">
        {ranks.map((row, r) => {
          const cols = flipped ? [...row].reverse() : row;
          return cols.map((piece, c) => {
            const rank = flipped ? r + 1 : 8 - r;
            const file = flipped ? FILES[7 - c] : FILES[c];
            const square = `${file}${rank}`;
            const dark = (r + c) % 2 === 1;
            const isLegal = targets.has(square);
            const isCapture = targets.get(square);
            const isSel = selected === square;

            return (
              <div
                key={square}
                onClick={() => onSquare?.(square)}
                className={[
                  'chess-cell',
                  dark ? 'sq-dark' : 'sq-light',
                  isLegal ? 'legal' : '',
                  isLegal && isCapture ? 'capture' : '',
                  isSel ? 'selected spotlight' : '',
                ].join(' ')}
              >
                {piece && (
                  <span
                    className={`piece ${piece.color === 'w' ? 'piece-white' : 'piece-black'} ${isSel ? 'floaty' : ''}`}
                  >
                    {GLYPH[piece.type]}
                  </span>
                )}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
