import { useState } from 'react';
import GlassPanel from './GlassPanel.jsx';
import Chat from './Chat.jsx';
import { useRoom } from '../hooks/useRoom.js';
import { socket } from '../socket.js';

const LUDO_COLORS = ['red', 'green', 'yellow', 'blue'];

/**
 * Reusable pre-game lobby. Handles: Solo vs AI, Create room, Join room, and the
 * waiting-room member list. Calls `onPlay({ mode, room })` when the game starts.
 *   mode: 'solo' | 'online'
 */
export default function Lobby({ game, accent, minPlayers = 2, children, onPlay }) {
  const { room, error, busy, connected, create, join, start, pickColor } = useRoom(game);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [view, setView] = useState('menu'); // menu | host | guest

  const isHost = room && room.members[0]?.id === room.hostId;
  const enough = room && room.members.length >= minPlayers;
  const takenColors = new Set((room?.members || []).filter((m) => m.id !== socket.id).map((m) => m.color));
  const myMember = (room?.members || []).find((m) => m.id === socket.id);

  if (room?.started) { onPlay?.({ mode: 'online', room }); }

  const copyCode = () => navigator.clipboard?.writeText(room.code);

  return (
    <div className="max-w-md mx-auto mt-4">
      <GlassPanel glow={accent}>
        {view === 'menu' && (
          <div className="space-y-4">
            <input
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 outline-none focus:border-white/40"
              placeholder="Your name" value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn-neon w-full" onClick={() => onPlay?.({ mode: 'solo' })}>
              🤖 Solo vs AI
            </button>
            <button
              className="btn-neon btn-ghost w-full disabled:opacity-50"
              disabled={busy}
              onClick={async () => { const c = await create(name); if (c) setView('host'); }}
            >
              {busy ? 'Connecting…' : '➕ Create private room'}
            </button>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 outline-none uppercase mono focus:border-white/40"
                placeholder="CODE" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button
                className="btn-neon btn-ghost disabled:opacity-50"
                disabled={busy || code.length < 4}
                onClick={async () => { if (await join(code, name)) setView('guest'); }}
              >
                {busy ? '…' : 'Join'}
              </button>
            </div>
            <p className="text-center text-xs text-white/40">
              {busy ? 'Waking the server (free tier can take ~30s the first time)…'
                : connected ? '🟢 Server connected' : '🟡 Connecting to server…'}
            </p>
          </div>
        )}

        {(view === 'host' || view === 'guest') && room && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-white/60 text-sm">Room code</p>
              <button onClick={copyCode}
                className="mono text-3xl font-bold tracking-[0.35em] title-shimmer">
                {room.code}
              </button>
              <p className="text-white/40 text-xs mt-1">tap to copy · share with friends</p>
            </div>

            <div className="space-y-2">
              {room.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
                  {m.color && (
                    <span className="w-3.5 h-3.5 rounded-full"
                      style={{ background: `var(--${m.color})`, boxShadow: `0 0 10px var(--${m.color})` }} />
                  )}
                  <span className="flex-1">{m.name}</span>
                  {m.seat === 0 && <span className="text-xs text-white/40">host</span>}
                </div>
              ))}
              <p className="text-white/40 text-xs">
                {room.members.length}/{room.maxPlayers} players
              </p>
            </div>

            {game === 'ludo' && (
              <div>
                <div className="text-sm text-white/70 mb-2">Your colour <span className="text-white/40">(taken ones are locked)</span></div>
                <div className="grid grid-cols-4 gap-2">
                  {LUDO_COLORS.map((c) => {
                    const taken = takenColors.has(c);
                    const mine = myMember?.color === c;
                    return (
                      <button key={c} disabled={taken} onClick={() => pickColor(c)}
                        className="py-3 rounded-xl capitalize text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{
                          background: `var(--${c})`, color: '#16161c',
                          outline: mine ? '3px solid #fff' : '3px solid transparent',
                          transform: mine ? 'scale(1.05)' : 'none',
                        }}>{taken ? '🔒' : c}</button>
                    );
                  })}
                </div>
              </div>
            )}

            {isHost ? (
              <button className="btn-neon w-full disabled:opacity-40"
                disabled={!enough} onClick={start}>
                ▶ Start game
              </button>
            ) : (
              <p className="text-center text-white/50 text-sm">Waiting for host to start…</p>
            )}
          </div>
        )}

        {error && <p className="text-rose-400 text-sm mt-4 text-center">{error}</p>}
        {children}
      </GlassPanel>

      {room && (view === 'host' || view === 'guest') && (
        <div className="mt-4"><Chat code={room.code} name={myMember?.name || name || 'Player'} /></div>
      )}
    </div>
  );
}
