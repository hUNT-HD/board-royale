import { useState } from 'react';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };

// Real, professional vector piece set (Cburnett — the classic Lichess set),
// with a couple of CDN fallbacks and a final unicode fallback if all fail.
const PIECE_CDNS = [
  (c) => `https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/${c}.svg`,
  (c) => `https://upload.wikimedia.org/wikipedia/commons/${WIKI[c]}`,
];
// Wikimedia Commons Cburnett file paths (stable).
const WIKI = {
  wK: '4/42/Chess_klt45.svg', wQ: '1/15/Chess_qlt45.svg', wR: '7/72/Chess_rlt45.svg',
  wB: 'b/b1/Chess_blt45.svg', wN: '7/70/Chess_nlt45.svg', wP: '4/45/Chess_plt45.svg',
  bK: 'f/f0/Chess_kdt45.svg', bQ: '4/47/Chess_qdt45.svg', bR: 'f/ff/Chess_rdt45.svg',
  bB: '9/98/Chess_bdt45.svg', bN: 'e/ef/Chess_ndt45.svg', bP: 'c/cd/Chess_pdt45.svg',
};

function Piece({ piece }) {
  const code = `${piece.color}${piece.type.toUpperCase()}`;
  const [i, setI] = useState(0);
  if (i >= PIECE_CDNS.length) {
    return <span className={`cpiece-fallback ${piece.color === 'w' ? 'cp-w' : 'cp-b'}`}>{GLYPH[piece.type]}</span>;
  }
  return <img className="cpiece-img" src={PIECE_CDNS[i](code)} alt="" draggable="false" onError={() => setI(i + 1)} />;
}

/**
 * ChessBoard — a clean, REAL-looking classic chess board: warm wooden frame
 * with rank/file coordinates, two-tone wood squares, ivory/ebony pieces.
 *
 * Props: board (8x8 from chess.js), selected, legalTargets [{to,capture}],
 *        onSquare(sq), flipped
 */
export default function ChessBoard({ board, selected, legalTargets = [], onSquare, flipped, lastMove, checkSquare }) {
  const targets = new Map(legalTargets.map((t) => [t.to, t.capture]));
  const ranks = flipped ? [...board].reverse() : board;
  const lastRow = flipped ? 0 : 7;
  const firstCol = 0;

  return (
    <div className="chess-frame mx-auto">
      <div className="chess-grid2">
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
              <div key={square} onClick={() => onSquare?.(square)}
                className={[
                  'csq', dark ? 'csq-d' : 'csq-l',
                  isSel ? 'csq-sel' : '',
                  (lastMove && (lastMove.from === square || lastMove.to === square)) ? 'csq-last' : '',
                  checkSquare === square ? 'csq-check' : '',
                  isLegal ? 'csq-legal' : '',
                  isLegal && isCapture ? 'csq-cap' : '',
                ].join(' ')}>
                {c === firstCol && <span className="csq-rank">{rank}</span>}
                {r === lastRow && <span className="csq-file">{file}</span>}
                {piece && <Piece piece={piece} />}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
