import { useState } from 'react';
import GlassPanel from './GlassPanel.jsx';
import { useRoom } from '../hooks/useRoom.js';

/**
 * Reusable pre-game lobby. Handles: Solo vs AI, Create room, Join room, and the
 * waiting-room member list. Calls `onPlay({ mode, room })` when the game starts.
 *   mode: 'solo' | 'online'
 */
export default function Lobby({ game, accent, minPlayers = 2, children, onPlay }) {
  const { room, error, create, join, start } = useRoom(game);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [view, setView] = useState('menu'); // menu | host | guest

  const isHost = room && room.members[0]?.id === room.hostId;
  const enough = room && room.members.length >= minPlayers;

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
              className="btn-neon btn-ghost w-full"
              onClick={async () => { await create(name); setView('host'); }}
            >
              ➕ Create private room
            </button>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 outline-none uppercase mono focus:border-white/40"
                placeholder="CODE" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button
                className="btn-neon btn-ghost"
                onClick={async () => { if (await join(code, name)) setView('guest'); }}
              >
                Join
              </button>
            </div>
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
    </div>
  );
}
