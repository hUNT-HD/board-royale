import { useEffect, useState } from 'react';

// Base rotation that brings each face to the FRONT of the cube.
const BASE = {
  1: [0, 0], 2: [0, -90], 3: [90, 0], 4: [-90, 0], 5: [0, 90], 6: [0, 180],
};
const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function Face({ cls, value }) {
  const on = new Set(PIPS[value]);
  return (
    <div className={`dice-face ${cls}`}>
      {Array.from({ length: 9 }, (_, i) => <span key={i}>{on.has(i) ? <span className="pip" /> : null}</span>)}
    </div>
  );
}

/**
 * Dice — 3D die that spins and lands EXACTLY on the rolled `value`.
 *
 * Every roll (rollKey++) adds whole extra turns (×360°) so the cube tumbles
 * forward, then settles on BASE[value] — which keeps the correct face forward
 * because full turns don't change the visible face. This fixes the old bug where
 * a fixed CSS keyframe always ended on face 1 regardless of the real value.
 */
export default function Dice({ value, rollKey = 0, disabled, onRoll }) {
  const [spin, setSpin] = useState(0);
  useEffect(() => { if (rollKey) setSpin((s) => s + 1); }, [rollKey]);

  const v = value || 1;
  const [bx, by] = BASE[v];
  const transform = `rotateX(${bx + 720 * spin}deg) rotateY(${by + 1080 * spin}deg)`;

  return (
    <button onClick={onRoll} disabled={disabled}
      className="dice-scene disabled:opacity-40 disabled:cursor-not-allowed"
      title={disabled ? 'Not your turn' : 'Roll'}>
      <div className="dice" style={{ transform }}>
        <Face cls="f-front"  value={1} />
        <Face cls="f-back"   value={6} />
        <Face cls="f-right"  value={2} />
        <Face cls="f-left"   value={5} />
        <Face cls="f-top"    value={3} />
        <Face cls="f-bottom" value={4} />
      </div>
    </button>
  );
}
