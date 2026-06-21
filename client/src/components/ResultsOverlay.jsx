import { useEffect, useRef } from 'react';

const MEDAL = ['🥇', '🥈', '🥉'];

/**
 * Final standings shown ONLY when the whole game is over (everyone ranked).
 * ranking = array of colours in finish order (1st → last).
 */
export default function ResultsOverlay({ open, ranking = [], myColor, colorsMap = {}, nameOf, onPlayAgain, onLeave }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const cv = canvasRef.current; if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; };
    resize();
    const COLORS = ['#ff3b5c', '#ffc23b', '#19c37d', '#3b6bff', '#9b5bff', '#ff8a3b', '#ffffff'];
    const parts = Array.from({ length: 170 }, () => ({
      x: Math.random() * cv.width, y: -Math.random() * cv.height * 0.4,
      r: (4 + Math.random() * 6) * dpr, c: COLORS[(Math.random() * COLORS.length) | 0],
      vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 4) * dpr,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    }));
    let raf, t = 0;
    const tick = () => {
      t += 1; ctx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.04 * dpr; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.5); ctx.restore();
      });
      if (t < 280) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [open]);

  if (!open) return null;
  return (
    <div className="win-overlay">
      <canvas ref={canvasRef} className="win-confetti" />
      <div className="win-card glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="win-emoji">🎉</div>
        <h2 className="font-display text-2xl font-extrabold title-shimmer">Game Over</h2>
        <p className="text-white/70 mt-1 mb-4">Congratulations — final standings</p>
        <div className="space-y-2 text-left">
          {ranking.map((color, i) => (
            <div key={color} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{
                background: color === myColor ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${color === myColor ? (colorsMap[color] || 'rgba(255,255,255,0.25)') : 'rgba(255,255,255,0.08)'}`,
              }}>
              <span style={{ width: 30, textAlign: 'center', fontSize: i < 3 ? '1.25rem' : '1rem', fontWeight: 700 }}>
                {MEDAL[i] || `${i + 1}`}
              </span>
              <span className="w-4 h-4 rounded-full shrink-0"
                style={{ background: colorsMap[color], boxShadow: `0 0 10px ${colorsMap[color]}` }} />
              <span className="capitalize flex-1 font-semibold">
                {nameOf ? nameOf(color) : color}{color === myColor ? ' (You)' : ''}
              </span>
              {i === 0 && <span className="text-amber-300 text-sm font-bold">Winner 👑</span>}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-6 justify-center">
          {onPlayAgain && <button className="btn-neon" onClick={onPlayAgain}>▶ Play again</button>}
          {onLeave && <button className="btn-neon btn-ghost" onClick={onLeave}>Leave</button>}
        </div>
      </div>
    </div>
  );
}
