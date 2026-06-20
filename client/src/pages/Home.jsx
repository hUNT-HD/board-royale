import { useNavigate } from 'react-router-dom';
import GlassPanel from '../components/GlassPanel.jsx';

const GAMES = [
  {
    id: 'chess', to: '/chess', emoji: '♛',
    title: 'Chess', tag: '2 Players · Stockfish AI',
    blurb: 'Charcoal marble & frosted quartz. Glass pieces with gold and platinum rims.',
    glow: 'rgba(244,213,141,0.35)',
  },
  {
    id: 'ludo', to: '/ludo', emoji: '🎲',
    title: 'Ludo Royale', tag: 'Up to 6 Players · Hex board',
    blurb: 'A hexagonal arena, six neon colors, glowing tokens and satisfying 3D dice.',
    glow: 'rgba(123,97,255,0.35)',
  },
];

export default function Home() {
  const nav = useNavigate();
  return (
    <div className="max-w-5xl mx-auto">
      <section className="text-center mt-6 mb-12">
        <h1 className="font-display text-4xl md:text-6xl font-extrabold title-shimmer">
          Play. In Style.
        </h1>
        <p className="mt-4 text-white/70 max-w-xl mx-auto">
          A premium board-game hub. Challenge a friend with a private room code,
          or sharpen your skills against the AI — beautifully, instantly.
        </p>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        {GAMES.map((g) => (
          <button key={g.id} onClick={() => nav(g.to)} className="text-left group">
            <GlassPanel glow={g.glow} className="h-full transition-transform duration-300 group-hover:-translate-y-1.5">
              <div className="text-5xl mb-4 animate-floaty">{g.emoji}</div>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-2xl font-bold">{g.title}</h2>
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/15">
                  {g.tag}
                </span>
              </div>
              <p className="mt-3 text-white/65">{g.blurb}</p>
              <div className="mt-6 inline-flex btn-neon text-sm">Enter →</div>
            </GlassPanel>
          </button>
        ))}
      </div>
    </div>
  );
}
