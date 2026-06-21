import { useEffect, useRef } from 'react';
import { ORDER, buildGeometry, drawGame, hitToken } from './ludoHexCore.js';

/**
 * LudoHexCanvas — HTML5 <canvas> renderer for the 6-player hexagonal board
 * (radiating arms + triangular bases + map-pin pawns). Same props as the other
 * boards. Inactive colours (not in `players`) render frosted (ghost).
 */
export default function LudoHexCanvas({ players = [], activeColor, movable = new Set(), onToken }) {
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
    drawGame(canvas.getContext('2d'), geo, { ...stateRef.current, time });
  };

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    const resize = () => {
      const size = Math.max(260, Math.min(wrap.clientWidth, 560));
      if (size === sizeRef.current) { draw(); return; }
      sizeRef.current = size;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      geoRef.current = buildGeometry(size);
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    return () => ro.disconnect();
    // eslint-disable-next-line
  }, []);

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
        style={{ display: 'block', cursor: 'pointer', touchAction: 'manipulation', borderRadius: 16 }} />
    </div>
  );
}
