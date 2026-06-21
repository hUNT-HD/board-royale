import { useEffect, useRef } from 'react';
import { ORDER, buildGeometry, drawGame, hitToken } from './ludoCanvasCore.js';

/**
 * LudoCanvas — HTML5 <canvas> renderer for the 6-player hexagonal board.
 * Same props as the SVG board: players, activeColor, movable, onToken.
 * Inactive colours (not present in `players`) render as frosted "ghost" bases.
 */
export default function LudoCanvas({ players = [], activeColor, movable = new Set(), onToken }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const geoRef = useRef(null);
  const sizeRef = useRef(0);
  const stateRef = useRef({});

  const present = new Set(players.map((p) => p.color));
  const ghosts = new Set(ORDER.filter((c) => !present.has(c)));
  stateRef.current = { players, active: activeColor, movable, ghosts };

  const draw = (time = 0) => {
    const canvas = canvasRef.current, geo = geoRef.current;
    if (!canvas || !geo) return;
    const ctx = canvas.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore();
    drawGame(ctx, geo, { ...stateRef.current, time });
  };

  // size to container (square) + device-pixel-ratio crispness
  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    const resize = () => {
      const size = Math.max(240, Math.min(wrap.clientWidth, 560));
      if (size === sizeRef.current) { draw(); return; }
      sizeRef.current = size;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      geoRef.current = buildGeometry(size / 2, size / 2, size * 0.47);
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    return () => ro.disconnect();
    // eslint-disable-next-line
  }, []);

  // redraw on state change; run an animation loop only while a token can pulse
  useEffect(() => {
    let raf;
    const animate = movable && movable.size > 0;
    const loop = (t) => { draw(t); if (animate) raf = requestAnimationFrame(loop); };
    loop(performance.now());
    return () => raf && cancelAnimationFrame(raf);
    // eslint-disable-next-line
  }, [players, activeColor, movable]);

  const handleClick = (e) => {
    const geo = geoRef.current; if (!geo) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const hit = hitToken(geo, stateRef.current.players, e.clientX - rect.left, e.clientY - rect.top);
    if (hit && movable.has(`${hit.color}:${hit.id}`)) onToken?.(hit.color, hit.id);
  };

  return (
    <div ref={wrapRef} className="ludo-canvas-wrap" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <canvas ref={canvasRef} onClick={handleClick}
        role="img" aria-label="Hexagonal Ludo board"
        style={{ display: 'block', cursor: 'pointer', touchAction: 'manipulation' }} />
    </div>
  );
}
