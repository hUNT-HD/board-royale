import { useEffect, useRef } from 'react';

/** Celebration overlay shown when a game ends. Confetti burst on wins. */
export default function WinOverlay({ open, win, title, subtitle, onPlayAgain, onClose }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!open || !win) return undefined;
    const cv = canvasRef.current; if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; };
    resize();
    const COLORS = ['#ff3b5c', '#ffc23b', '#19c37d', '#3b6bff', '#9b5bff', '#ff8a3b', '#ffffff'];
    const N = 160;
    const parts = Array.from({ length: N }, () => ({
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
      if (t < 260) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [open, win]);

  if (!open) return null;
  return (
    <div className="win-overlay" onClick={onClose}>
      <canvas ref={canvasRef} className="win-confetti" />
      <div className="win-card glass" onClick={(e) => e.stopPropagation()}>
        <div className="win-emoji">{win ? '🏆' : '🤝'}</div>
        <h2 className="font-display text-2xl font-extrabold title-shimmer">{title}</h2>
        {subtitle && <p className="text-white/70 mt-1">{subtitle}</p>}
        <div className="flex gap-2 mt-5 justify-center">
          {onPlayAgain && <button className="btn-neon" onClick={onPlayAgain}>▶ Play again</button>}
          <button className="btn-neon btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
