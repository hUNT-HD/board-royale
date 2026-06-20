import { useEffect, useRef, useState } from 'react';
import GlassPanel from './GlassPanel.jsx';
import { socket } from '../socket.js';

/** In-room chat for online games. Self-contained — listens + sends over socket. */
export default function Chat({ code, name }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    const on = (m) => setMsgs((p) => [...p.slice(-60), m]);
    socket.on('chat:msg', on);
    return () => socket.off('chat:msg', on);
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    socket.emit('chat:msg', { code, name, text: t });
    setText('');
  };

  return (
    <GlassPanel glow="rgba(123,97,255,0.2)" className="!p-3 flex flex-col">
      <div className="text-xs text-white/50 mb-2 font-semibold">💬 Chat</div>
      <div className="chat-log scrollbar-none">
        {msgs.length === 0 && <p className="text-white/30 text-xs">Say hi to your opponents…</p>}
        {msgs.map((m, i) => (
          <div key={i} className="text-sm mb-1">
            <span className="font-semibold text-amber-300/90">{m.name}: </span>
            <span className="text-white/85 break-words">{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 mt-2">
        <input
          className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/40"
          placeholder="Message…" value={text} maxLength={300}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button className="btn-neon !py-2 !px-3 text-sm" onClick={send}>Send</button>
      </div>
    </GlassPanel>
  );
}
