import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import Lobby from '../components/Lobby.jsx';
import GlassPanel from '../components/GlassPanel.jsx';
import Dice from '../components/ludo/Dice.jsx';
import LudoSVG from '../components/ludo/LudoSVG.jsx';
import ViewToggle from '../components/ViewToggle.jsx';
import WinOverlay from '../components/WinOverlay.jsx';
import { sound } from '../sound.js';
import { socket } from '../socket.js';
import * as core from '../components/ludo/ludoCore.js';

const LudoBoard3D = lazy(() => import('../components/ludo/LudoBoard3D.jsx'));
import { HEX } from '../components/ludo/classic.js';
import { HEXC } from '../components/ludo/hex.js';

const SEATS = {
  2: ['red', 'yellow'],
  3: ['red', 'green', 'yellow'],
  4: ['red', 'green', 'yellow', 'blue'],
  5: ['red', 'green', 'yellow', 'blue', 'purple'],
  6: ['red', 'green', 'yellow', 'blue', 'purple', 'orange'],
};

export default function LudoGame() {
  const [session, setSession] = useState(null);
  if (!session) {
    return (
      <Lobby game="ludo" accent="rgba(123,97,255,0.35)" minPlayers={2} onPlay={setSession}>
        <p className="mt-5 text-center text-white/45 text-xs">
          Solo lets you pick 2–6 players vs bots. 5–6 switches to the hexagonal board.
        </p>
      </Lobby>
    );
  }
  if (session.mode === 'online') return <OnlineLudo room={session.room} onExit={() => setSession(null)} />;
  return <SoloLudo />;
}

// compact, JSON-serializable snapshot the host broadcasts to other clients
const packLudo = (g) => ({
  players: g.players.map((p) => ({ color: p.color, finished: p.finished, tokens: p.tokens.map((t) => ({ id: t.id, rel: t.rel })) })),
  turn: g.turn, dice: g.dice, phase: g.phase, validMoves: g.validMoves, winner: g.winner,
});

/* ----- Online Ludo: host runs the engine, others sync via the server relay ----- */
function OnlineLudo({ room, onExit }) {
  const members = useMemo(() => [...room.members].sort((a, b) => a.seat - b.seat), [room]);
  const colors = members.map((m) => m.color);
  const mode = colors.length >= 5 ? 'hex' : 'square';
  const COLORS = mode === 'hex' ? HEXC : HEX;
  const mySeat = members.find((m) => m.id === socket.id)?.seat ?? 0;
  const myColor = colors[mySeat];
  const amHost = socket.id === room.hostId;

  const gameRef = useRef(amHost ? core.createGame(mode, colors) : null);
  const [snap, setSnap] = useState(amHost ? packLudo(gameRef.current) : null);
  const [view, setView] = useState('2D');
  const [dice, setDice] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [rollKey, setRollKey] = useState(0);
  const wonRef = useRef(false);
  const [closedWin, setClosedWin] = useState(false);

  const broadcast = () => { const s = packLudo(gameRef.current); setSnap(s); socket.emit('lobby:state', { code: room.code, state: s }); };

  useEffect(() => {
    if (amHost) {
      broadcast();
      const onAction = (a) => {
        const g = gameRef.current;
        if (a.type === 'HELLO') return broadcast();
        if (a.bySeat !== g.turn) return; // only the player on turn may act
        if (a.type === 'ROLL' && g.phase === core.PHASE.ROLL) core.rollDice(g);
        else if (a.type === 'MOVE' && g.phase === core.PHASE.MOVE) core.moveToken(g, a.tokenId);
        broadcast();
      };
      socket.on('lobby:action', onAction);
      return () => socket.off('lobby:action', onAction);
    }
    const onState = (s) => setSnap(s);
    socket.on('lobby:state', onState);
    socket.emit('lobby:action', { code: room.code, action: { type: 'HELLO' } });
    return () => socket.off('lobby:state', onState);
    // eslint-disable-next-line
  }, []);

  // dice animation + win sound when the snapshot changes
  const prevDice = useRef(undefined);
  useEffect(() => {
    if (!snap) return;
    if (snap.dice && snap.dice !== prevDice.current) {
      setDice(snap.dice); setRollKey((k) => k + 1); setRolling(true); setTimeout(() => setRolling(false), 800);
    }
    prevDice.current = snap.dice;
    if (snap.winner && !wonRef.current) { wonRef.current = true; sound.win(); }
  }, [snap]);

  const sendAction = (action) => {
    if (amHost) {
      const g = gameRef.current;
      if (action.type === 'ROLL' && g.phase === core.PHASE.ROLL) core.rollDice(g);
      else if (action.type === 'MOVE' && g.phase === core.PHASE.MOVE) core.moveToken(g, action.tokenId);
      broadcast();
    } else socket.emit('lobby:action', { code: room.code, action: { ...action, bySeat: mySeat } });
  };

  if (!snap) return <p className="text-center text-white/60 mt-10">Connecting to host…</p>;

  const active = snap.players[snap.turn].color;
  const myTurn = active === myColor && !snap.winner;
  const movable = new Set(myTurn && snap.phase === core.PHASE.MOVE ? snap.validMoves.map((m) => `${myColor}:${m.tokenId}`) : []);

  const doRoll = () => { if (!myTurn || snap.phase !== core.PHASE.ROLL || rolling) return; sound.dice(); sendAction({ type: 'ROLL' }); };
  const onToken = (color, id) => { if (!myTurn || snap.phase !== core.PHASE.MOVE) return; sound.token(); sendAction({ type: 'MOVE', tokenId: id }); };

  return (
    <div className="game-grid px-1">
      <div className="w-full max-w-[560px] mx-auto">
        <ViewToggle view={view} onChange={setView} />
        {view === '3D'
          ? <Suspense fallback={<div className="ludo3d grid place-items-center text-white/50 text-sm">Loading 3D…</div>}>
              <LudoBoard3D mode={mode} players={snap.players} activeColor={active} movable={movable} onToken={onToken} />
            </Suspense>
          : <LudoSVG mode={mode} players={snap.players} activeColor={active} movable={movable} onToken={onToken} />}
      </div>

      <GlassPanel glow="rgba(123,97,255,0.3)" className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 rounded-full" style={{ background: COLORS[active], boxShadow: `0 0 14px ${COLORS[active]}` }} />
          <span className="font-display text-lg font-bold capitalize">
            {snap.winner ? `${snap.winner} wins! 🏆` : myTurn ? 'Your turn' : `${active}'s turn`}
          </span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Dice value={dice} rollKey={rollKey} disabled={!myTurn || snap.phase !== core.PHASE.ROLL || rolling} onRoll={doRoll} />
          <span className="text-white/50 text-sm">
            {!myTurn ? `Waiting for ${active}…` : snap.phase === core.PHASE.MOVE ? 'Tap a glowing token' : 'Tap the die to roll'}
          </span>
        </div>

        <div className="space-y-1.5">
          {snap.players.map((p) => (
            <div key={p.color} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full" style={{ background: COLORS[p.color], boxShadow: `0 0 8px ${COLORS[p.color]}` }} />
              <span className="capitalize flex-1">{p.color}{p.color === myColor ? ' (you)' : ''}</span>
              <span className="text-white/50">🏠 {p.finished}/4</span>
            </div>
          ))}
        </div>

        <p className="text-white/40 text-xs">Room {room.code} · {members.length} players online</p>
        <button className="btn-neon btn-ghost w-full" onClick={onExit}>← Leave</button>
      </GlassPanel>

      <WinOverlay open={!!snap.winner && !closedWin} win={snap.winner === myColor}
        title={snap.winner === myColor ? 'You win!' : `${snap.winner ? snap.winner[0].toUpperCase() + snap.winner.slice(1) : ''} wins`}
        subtitle={snap.winner === myColor ? 'All four tokens home! 🏆' : 'Good game!'}
        onClose={() => setClosedWin(true)} />
    </div>
  );
}

function SoloLudo() {
  const [count, setCount] = useState(null);
  if (!count) {
    return (
      <div className="max-w-md mx-auto mt-6">
        <GlassPanel glow="rgba(123,97,255,0.3)">
          <h2 className="font-display text-xl font-bold mb-1">How many players?</h2>
          <p className="text-white/55 text-sm mb-5">You are <b>Red</b>; the rest are bots.</p>
          <div className="grid grid-cols-5 gap-2">
            {[2, 3, 4, 5, 6].map((n) => (
              <button key={n} className="btn-neon btn-ghost py-3" onClick={() => setCount(n)}>{n}</button>
            ))}
          </div>
          <p className="text-white/40 text-xs mt-4">2–4 → classic square board · 5–6 → hexagonal board</p>
        </GlassPanel>
      </div>
    );
  }
  return <Game count={count} key={count} onExit={() => setCount(null)} />;
}

function Game({ count, onExit }) {
  const hex = count >= 5;
  const mode = hex ? 'hex' : 'square';
  const COLORS = hex ? HEXC : HEX;

  const gameRef = useRef(core.createGame(mode, SEATS[count]));
  const [view, setView] = useState('2D');
  const [tick, force] = useState(0);
  const [dice, setDice] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [rollKey, setRollKey] = useState(0); // increments every roll → re-triggers dice anim
  const [banner, setBanner] = useState('');
  const rerender = () => force((n) => n + 1);
  const triggerRoll = () => setRollKey((k) => k + 1);

  const g = gameRef.current;
  const active = g.players[g.turn].color;
  const myTurn = active === 'red' && !g.winner;

  const movable = useMemo(() => {
    if (!myTurn || g.phase !== core.PHASE.MOVE) return new Set();
    return new Set(g.validMoves.map((m) => `red:${m.tokenId}`));
  }, [tick, myTurn, g.phase]); // eslint-disable-line

  const announce = (r) => {
    if (r.captured?.length) sound.capture(); else if (r.finished || r.to !== undefined) sound.token();
    setBanner(r.captured?.length ? '💥 Capture! Bonus roll'
      : r.finished ? '🏠 Home! Bonus roll'
      : r.extra ? '🎲 Rolled a 6 — roll again' : '');
  };

  const doRoll = () => {
    if (g.phase !== core.PHASE.ROLL || rolling || !myTurn) return;
    setRolling(true);
    triggerRoll();                         // animate the die
    sound.dice();
    const res = core.rollDice(g);
    setDice(res.dice);
    setBanner(res.forfeited ? 'Three 6s in a row — turn forfeited!'
      : res.autoPass ? 'No valid move — turn skipped' : '');
    setTimeout(() => {                      // only act after the roll is seen
      setRolling(false);
      if (res.moves && res.moves.length === 1) announce(core.moveToken(g, res.moves[0].tokenId));
      rerender();
    }, 850);
  };

  const onToken = (color, id) => {
    if (!myTurn || g.phase !== core.PHASE.MOVE) return;
    announce(core.moveToken(g, id));
    rerender();
  };

  // bots: tick-driven so extra turns (6 / capture / home) never stall.
  // The bot rolls the SAME animated die as the human, then moves only AFTER the
  // tumble finishes — so you actually watch the bot roll.
  useEffect(() => {
    if (g.winner || myTurn) return;
    const t = setTimeout(() => {
      setRolling(true);
      triggerRoll();                       // bot rolls — animate the die
      sound.dice();
      const res = core.rollDice(g);
      setDice(res.dice);
      setTimeout(() => {                    // wait for the roll animation to finish
        setRolling(false);
        if (res.moves && res.moves.length) {
          const id = core.botChoose(g);
          if (id != null) { const m = core.moveToken(g, id); if (m.captured?.length) sound.capture(); else sound.token(); }
        }
        rerender();
      }, 900);
    }, 600);
    return () => clearTimeout(t);
  }, [tick]); // eslint-disable-line

  // win celebration (once)
  const wonRef = useRef(false);
  const [closedWin, setClosedWin] = useState(false);
  useEffect(() => {
    if (g.winner && !wonRef.current) { wonRef.current = true; sound.win(); }
  }, [tick]); // eslint-disable-line

  return (
    <div className="game-grid px-1">
      <div className="w-full max-w-[560px] mx-auto">
        <ViewToggle view={view} onChange={setView} />
        {view === '3D'
          ? <Suspense fallback={<div className="ludo3d grid place-items-center text-white/50 text-sm">Loading 3D…</div>}>
              <LudoBoard3D mode={mode} players={g.players} activeColor={active} movable={movable} onToken={onToken} />
            </Suspense>
          : <LudoSVG mode={mode} players={g.players} activeColor={active} movable={movable} onToken={onToken} />}
      </div>

      <GlassPanel glow="rgba(123,97,255,0.3)" className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 rounded-full"
            style={{ background: COLORS[active], boxShadow: `0 0 14px ${COLORS[active]}` }} />
          <span className="font-display text-lg font-bold capitalize">
            {g.winner ? `${g.winner} wins! 🏆` : `${active}'s turn`}
          </span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Dice value={dice} rollKey={rollKey}
            disabled={!myTurn || g.phase !== core.PHASE.ROLL || rolling} onRoll={doRoll} />
          <span className="text-white/50 text-sm">
            {!myTurn ? `${active} (bot) playing…`
              : g.phase === core.PHASE.MOVE ? 'Tap a glowing token' : 'Tap the die to roll'}
          </span>
        </div>

        {banner && <p className="text-center text-amber-300 text-sm h-5">{banner}</p>}

        <div className="space-y-1.5">
          {g.players.map((p) => (
            <div key={p.color} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full"
                style={{ background: COLORS[p.color], boxShadow: `0 0 8px ${COLORS[p.color]}` }} />
              <span className="capitalize flex-1">{p.color}{p.color === 'red' ? ' (you)' : ''}</span>
              <span className="text-white/50">🏠 {p.finished}/4</span>
            </div>
          ))}
        </div>

        <button className="btn-neon btn-ghost w-full" onClick={onExit}>↺ Change players</button>
        <p className="text-white/40 text-xs">Roll a 6 to leave base. Land on a rival (off a star) to send it home.</p>
      </GlassPanel>

      <WinOverlay
        open={!!g.winner && !closedWin}
        win={g.winner === 'red'}
        title={g.winner === 'red' ? 'You win!' : `${g.winner ? g.winner[0].toUpperCase() + g.winner.slice(1) : ''} wins`}
        subtitle={g.winner === 'red' ? 'All four tokens home! 🏆' : 'Better luck next round!'}
        onPlayAgain={onExit}
        onClose={() => setClosedWin(true)}
      />
    </div>
  );
}
