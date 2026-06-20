import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import Lobby from '../components/Lobby.jsx';
import GlassPanel from '../components/GlassPanel.jsx';
import ChessBoard from '../components/chess/ChessBoard.jsx';
import ViewToggle from '../components/ViewToggle.jsx';
import { useChess } from '../components/chess/useChess.js';

const ChessBoard3D = lazy(() => import('../components/chess/ChessBoard3D.jsx'));
import { useStockfish } from '../components/chess/useStockfish.js';
import { socket } from '../socket.js';

export default function ChessGame() {
  const [session, setSession] = useState(null); // { mode, room } | null
  if (!session) {
    return (
      <Lobby game="chess" accent="rgba(244,213,141,0.35)" minPlayers={2}
        onPlay={setSession}>
        <p className="mt-5 text-center text-white/45 text-xs">
          Chess is strictly 2 players. Solo mode plays against Stockfish.
        </p>
      </Lobby>
    );
  }
  return <ChessTable session={session} />;
}

function ChessTable({ session }) {
  const chess = useChess();
  const { bestMove } = useStockfish();
  const [level, setLevel] = useState(8);
  const [thinking, setThinking] = useState(false);
  const [view, setView] = useState('2D');

  const solo = session.mode === 'solo';
  // In online play, our color = our seat (host = white).
  const mySeat = session.room?.members.find((m) => m.id === socket.id)?.seat ?? 0;
  const myColor = solo ? 'w' : mySeat === 0 ? 'w' : 'b';
  const myTurn = chess.turn === myColor;

  // ---- Online sync ----
  useEffect(() => {
    if (solo) return;
    const onMove = ({ move }) => chess.applyRemote(move);
    socket.on('chess:move', onMove);
    return () => socket.off('chess:move', onMove);
  }, [solo, chess]);

  // ---- Solo: let Stockfish reply when it's the AI's turn ----
  useEffect(() => {
    if (!solo || chess.isOver || chess.turn === myColor) return;
    setThinking(true);
    let cancelled = false;
    bestMove(chess.fen, { skillLevel: level, movetime: 400 + level * 30, timeout: 4000 }).then((uci) => {
      if (cancelled) return;
      if (uci) {
        chess.move(uci.slice(0, 2), uci.slice(2, 4));
      } else {
        // Engine slow/unavailable → never hang: play a random legal move.
        const moves = chess.game.moves({ verbose: true });
        if (moves.length) { const m = moves[Math.floor(Math.random() * moves.length)]; chess.move(m.from, m.to); }
      }
      setThinking(false);
    });
    return () => { cancelled = true; };
  }, [solo, chess.fen]); // eslint-disable-line

  const onSquare = useCallback((square) => {
    if (chess.isOver) return;
    if (!solo && !myTurn) return;
    if (solo && chess.turn !== myColor) return;

    if (chess.selected) {
      const legal = chess.legalTargets.some((t) => t.to === square);
      if (legal) {
        const m = chess.move(chess.selected, square);
        if (m && !solo) socket.emit('chess:move', { code: session.room.code, move: m, fen: chess.fen });
        return;
      }
    }
    chess.select(square);
  }, [chess, solo, myTurn, myColor, session]);

  return (
    <div className="game-grid px-1">
      <div className="w-full max-w-[560px] mx-auto">
        <div className="text-center"><ViewToggle view={view} onChange={setView} /></div>
        {view === '3D'
          ? <Suspense fallback={<div className="ludo3d grid place-items-center text-white/50 text-sm">Loading 3D…</div>}>
              <ChessBoard3D board={chess.board} selected={chess.selected}
                legalTargets={chess.legalTargets} onSquare={onSquare} flipped={myColor === 'b'} />
            </Suspense>
          : <ChessBoard board={chess.board} selected={chess.selected}
              legalTargets={chess.legalTargets} onSquare={onSquare} flipped={myColor === 'b'} />}
      </div>

      <GlassPanel glow="rgba(244,213,141,0.3)" className="space-y-5">
        <h2 className="font-display text-xl font-bold">
          {solo ? 'Solo vs Stockfish' : `Room ${session.room.code}`}
        </h2>

        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full"
            style={{ background: chess.turn === 'w' ? 'var(--gold)' : 'var(--platinum)',
                     boxShadow: '0 0 12px currentColor' }} />
          <span className="text-white/80">
            {chess.result ? chess.result
              : `${chess.turn === 'w' ? 'White' : 'Black'} to move`}
            {chess.inCheck && !chess.isOver && ' · Check!'}
          </span>
          {thinking && <span className="text-white/40 text-sm animate-pulse">AI thinking…</span>}
        </div>

        {solo && (
          <label className="block text-sm text-white/70">
            AI difficulty: <b>{level}</b>/20
            <input type="range" min="0" max="20" value={level}
              onChange={(e) => setLevel(+e.target.value)} className="w-full accent-amber-300" />
          </label>
        )}

        <button className="btn-neon btn-ghost w-full" onClick={chess.reset}>↺ New game</button>
        <p className="text-white/40 text-xs">
          You are <b>{myColor === 'w' ? 'White (gold)' : 'Black (platinum)'}</b>.
        </p>
      </GlassPanel>
    </div>
  );
}
