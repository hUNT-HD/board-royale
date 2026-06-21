import { useEffect, useRef } from 'react';
import { ORDER, buildGeometry, drawGame, hitToken, lerpPos } from './ludoHexCore.js';

const SPEED = 0.011;   // cells per ms (≈ 90ms per cell → a 6 takes ~0.5s)

/** LudoHexCanvas — 6-player hexagonal board with cell-by-cell token movement. */
export default function LudoHexCanvas({ players = [], activeColor, movable = new Set(), onToken }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const geoRef = useRef(null);
  const sizeRef = useRef(0);
  const stateRef = useRef({});
  const animRef = useRef(new Map());   // tokenKey -> current (animated) float rel
  const lastRef = useRef(0);

  const present = new Set(players.map((p) => p.color));
  const ghosts = new Set(ORDER.filter((c) => !present.has(c)));
  stateRef.current = { players, active: activeColor, movable, ghosts };

  const draw = (time) => {
    const canvas = canvasRef.current, geo = geoRef.current;
    if (!canvas || !geo) return false;
    const dt = Math.min(64, time - lastRef.current); lastRef.current = time;
    const tokenXY = {}; let animating = false;
    stateRef.current.players.forEach((p) => p.tokens.forEach((t) => {
      const key = `${p.color}:${t.id}`;
      let cur = animRef.current.has(key) ? animRef.current.get(key) : t.rel;
      if (cur !== t.rel) {
        if (t.rel < cur) cur = t.rel;                              // sent home / reset → snap
        else { cur = Math.min(t.rel, cur + dt * SPEED); if (t.rel - cur > 0.02) animating = true; else cur = t.rel; }
      }
      animRef.current.set(key, cur);
      tokenXY[key] = lerpPos(geo, p.color, cur, t.id);
    }));
    drawGame(canvas.getContext('2d'), geo, { ...stateRef.current, time, tokenXY });
    return animating;
  };

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    const resize = () => {
      const size = Math.max(260, Math.min(wrap.clientWidth, 560));
      if (size === sizeRef.current) return;
      sizeRef.current = size;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`; canvas.style.height = `${size}px`;
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      geoRef.current = buildGeometry(size);
    };
    const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
    return () => ro.disconnect();
    // eslint-disable-next-line
  }, []);

  // single animation loop — keeps running while a token is moving or can pulse
  useEffect(() => {
    let raf;
    lastRef.current = performance.now();
    const loop = (t) => {
      const animating = draw(t);
      if (animating || (movable && movable.size > 0)) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
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
      <canvas ref={canvasRef} onClick={handleClick} role="img" aria-label="Hexagonal Ludo board"
        style={{ display: 'block', cursor: 'pointer', touchAction: 'manipulation', borderRadius: 16 }} />
    </div>
  );
}
