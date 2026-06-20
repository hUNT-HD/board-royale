import { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import Lobby from '../components/Lobby.jsx';
import GlassPanel from '../components/GlassPanel.jsx';
import ChessBoard from '../components/chess/ChessBoard.jsx';
import ViewToggle from '../components/ViewToggle.jsx';
import WinOverlay from '../components/WinOverlay.jsx';
import Chat from '../components/Chat.jsx';
import { useChess } from '../components/chess/useChess.js';
import { useStockfish } from '../components/chess/useStockfish.js';
import { sound } from '../sound.js';
import { socket } from '../socket.js';

const ChessBoard3D = lazy(() => import('../components/chess/ChessBoard3D.jsx'));

const hashCode = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const rollSide = (s) => (s === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : s);
const LEVEL_LABEL = (l) => (l <= 4 ? 'Beginner' : l <= 9 ? 'Casual' : l <= 14 ? 'Strong' : l <= 18 ? 'Expert' : 'Master');
const capUrl = (color, type) => `https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/${color}${type.toUpperCase()}.svg`;
const pairUp = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push([arr[i], arr[i + 1]]); return out; };

function CapturedRow({ label, pieces, color }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-white/40 w-16 shrink-0">{label}</span>
      {pieces.length === 0
        ? <span className="text-white/25">—</span>
        : pieces.map((t, i) => <img key={i} src={capUrl(color, t)} alt="" className="w-4 h-4 inline-block" draggable="false" />)}
    </div>
  );
}

export default function ChessGame() {
  const [session, setSession] = useState(null); // { mode, room } | null
  if (!session) {
    return (
      <Lobby game="chess" accent="rgba(244,213,141,0.35)" minPlayers={2} onPlay={setSession}>
        <p className="mt-5 text-center text-white/45 text-xs">
          Chess is strictly 2 players. Solo mode plays against Stockfish.
        </p>
      </Lobby>
    );
  }
  if (session.mode === 'online') return <ChessTable session={session} />;
  return <SoloChess session={session} />;
}

/* ----- Solo: choose settings BEFORE the game, then play ----- */
function SoloChess({ session }) {
  const [config, setConfig] = useState(null); // { side, level }
  if (!config) return <ChessSetup onStart={setConfig} />;
  return <ChessTable session={session} config={config} onNewGame={() => setConfig(null)} />;
}

function ChessSetup({ onStart }) {
  const [side, setSide] = useState('w');
  const [level, setLevel] = useState(8);
  return (
    <div className="max-w-md mx-auto mt-6">
      <GlassPanel glow="rgba(244,213,141,0.3)" className="space-y-6">
        <h2 className="font-display text-xl font-bold">Solo vs Stockfish</h2>

        <div className="text-sm text-white/75">
          <div className="mb-2">Play as</div>
          <div className="grid grid-cols-3 gap-2">
            {[['w', '♔ White'], ['b', '♚ Black'], ['random', '🎲 Random']].map(([v, label]) => (
              <button key={v} onClick={() => setSide(v)}
                className={`view-toggle-btn text-center ${side === v ? 'active' : ''}`}>{label}</button>
            ))}
          </div>
        </div>

        <label className="block text-sm text-white/75">
          <div className="flex justify-between mb-1">
            <span>AI difficulty</span><b className="text-amber-300">{level}/20 · {LEVEL_LABEL(level)}</b>
          </div>
          <input type="range" min="0" max="20" value={level}
            onChange={(e) => setLevel(+e.target.value)} className="w-full accent-amber-300" />
        </label>

        <button className="btn-neon w-full" onClick={() => onStart({ side, level })}>▶ Start game</button>
      </GlassPanel>
    </div>
  );
}

/* ----- The board + play (settings are locked once here) ----- */
function ChessTable({ session, config, onNewGame }) {
  const chess = useChess();
  const { bestMove } = useStockfish();
  const [thinking, setThinking] = useState(false);
  const [view, setView] = useState('2D');

  const solo = session.mode === 'solo';
  const mySeat = session.room?.members.find((m) => m.id === socket.id)?.seat ?? 0;
  const level = config?.level ?? 8;

  // solo colour resolved ONCE at game start (random → fixed); online via toss.
  const [soloColor] = useState(() => rollSide(config?.side ?? 'w'));
  const whiteSeat = useMemo(() => (session.room ? hashCode(session.room.code) % 2 : 0), [session.room]);
  const myColor = solo ? soloColor : (mySeat === whiteSeat ? 'w' : 'b');
  const myTurn = chess.turn === myColor;

  useEffect(() => {
    if (solo) return;
    const onMove = ({ move }) => chess.applyRemote(move);
    socket.on('chess:move', onMove);
    return () => socket.off('chess:move', onMove);
  }, [solo, chess]);

  useEffect(() => {
    if (!solo || chess.isOver || chess.turn === myColor) return;
    setThinking(true);
    let cancelled = false;
    bestMove(chess.fen, { level }).then((uci) => {
      if (cancelled) return;
      if (uci) chess.move(uci.slice(0, 2), uci.slice(2, 4));
      else { const ms = chess.game.moves({ verbose: true }); if (ms.length) { const m = ms[Math.floor(Math.random() * ms.length)]; chess.move(m.from, m.to); } }
      setThinking(false);
    });
    return () => { cancelled = true; };
  }, [solo, chess.fen]); // eslint-disable-line

  // game-over: result + celebration sound (once)
  const checkmate = chess.isOver && chess.game.isCheckmate();
  const winner = checkmate ? (chess.turn === 'w' ? 'b' : 'w') : null;
  const iWon = winner === myColor;
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!chess.isOver) { setClosed(false); return; }
    if (checkmate) (iWon ? sound.win() : sound.lose()); else sound.win();
  }, [chess.isOver]); // eslint-disable-line

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
              legalTargets={chess.legalTargets} onSquare={onSquare} flipped={myColor === 'b'}
              lastMove={chess.lastMove} checkSquare={chess.checkSquare} />}
      </div>

      <div className="space-y-4">
      <GlassPanel glow="rgba(244,213,141,0.3)" className="space-y-5">
        <h2 className="font-display text-xl font-bold">
          {solo ? 'Solo vs Stockfish' : `Room ${session.room.code}`}
        </h2>

        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full"
            style={{ background: chess.turn === 'w' ? 'var(--gold)' : 'var(--platinum)', boxShadow: '0 0 12px currentColor' }} />
          <span className="text-white/80">
            {chess.result ? chess.result : `${chess.turn === 'w' ? 'White' : 'Black'} to move`}
            {chess.inCheck && !chess.isOver && ' · Check!'}
          </span>
          {thinking && <span className="text-white/40 text-sm animate-pulse">AI thinking…</span>}
        </div>

        {/* settings shown as locked info — not editable mid-game */}
        <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-white/55">You play</span>
            <b>{myColor === 'w' ? '♔ White' : '♚ Black'}</b></div>
          {solo
            ? <div className="flex justify-between"><span className="text-white/55">AI difficulty</span>
                <b className="text-amber-300">{level}/20 · {LEVEL_LABEL(level)}</b></div>
            : <div className="flex justify-between"><span className="text-white/55">Sides</span><b>🪙 decided by toss</b></div>}
        </div>

        {/* captured material */}
        <div className="text-xs space-y-1">
          <CapturedRow label="White lost" pieces={chess.captured.w} color="w" />
          <CapturedRow label="Black lost" pieces={chess.captured.b} color="b" />
        </div>

        {/* move history */}
        {chess.history.length > 0 && (
          <div className="max-h-28 overflow-auto scrollbar-none rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm leading-6">
            {pairUp(chess.history).map((p, i) => (
              <span key={i} className="inline-block mr-3">
                <span className="text-white/35">{i + 1}.</span> {p[0]} {p[1] || ''}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {solo && (
            <button className="btn-neon btn-ghost flex-1 disabled:opacity-40"
              disabled={chess.history.length < 2 || thinking}
              onClick={() => chess.undo(2)}>↶ Undo</button>
          )}
          {solo
            ? <button className="btn-neon btn-ghost flex-1" onClick={onNewGame}>↺ New game</button>
            : <button className="btn-neon btn-ghost flex-1" onClick={() => chess.reset()}>↺ Reset</button>}
        </div>
      </GlassPanel>
        {!solo && <Chat code={session.room.code} name={session.room?.members.find((m) => m.id === socket.id)?.name || 'Player'} />}
      </div>

      <WinOverlay
        open={chess.isOver && !closed}
        win={checkmate ? iWon : true}
        title={checkmate ? (iWon ? 'You win!' : 'Checkmate') : chess.game.isDraw() ? "It's a draw" : 'Game over'}
        subtitle={checkmate ? (iWon ? 'Beautifully checkmated. 🏆' : 'Your king got mated — rematch?') : ''}
        onPlayAgain={solo ? onNewGame : () => chess.reset()}
        onClose={() => setClosed(true)}
      />
    </div>
  );
}
