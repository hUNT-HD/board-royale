import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import Lobby from '../components/Lobby.jsx';
import GlassPanel from '../components/GlassPanel.jsx';
import Dice from '../components/ludo/Dice.jsx';
import LudoSVG from '../components/ludo/LudoSVG.jsx';
import ViewToggle from '../components/ViewToggle.jsx';
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
  if (session.mode === 'online') return <OnlineNotice />;
  return <SoloLudo />;
}

function OnlineNotice() {
  return (
    <div className="max-w-md mx-auto mt-6">
      <GlassPanel glow="rgba(123,97,255,0.3)">
        <h2 className="font-display text-xl font-bold mb-2">Online multiplayer</h2>
        <p className="text-white/70 text-sm">
          Online rooms need the realtime game server (Render/Railway) running. It isn't
          connected yet — for now play <b>Solo vs bots</b>. Once the server is live and
          <code> VITE_SERVER_URL</code> is set, online lights up here.
        </p>
      </GlassPanel>
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

  const announce = (r) =>
    setBanner(r.captured?.length ? '💥 Capture! Bonus roll'
      : r.finished ? '🏠 Home! Bonus roll'
      : r.extra ? '🎲 Rolled a 6 — roll again' : '');

  const doRoll = () => {
    if (g.phase !== core.PHASE.ROLL || rolling || !myTurn) return;
    setRolling(true);
    triggerRoll();                         // animate the die
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
      const res = core.rollDice(g);
      setDice(res.dice);
      setTimeout(() => {                    // wait for the roll animation to finish
        setRolling(false);
        if (res.moves && res.moves.length) {
          const id = core.botChoose(g);
          if (id != null) core.moveToken(g, id);
        }
        rerender();
      }, 900);
    }, 600);
    return () => clearTimeout(t);
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
    </div>
  );
}
