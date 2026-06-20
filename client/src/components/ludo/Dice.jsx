import { useEffect, useRef } from 'react';

// Rotation that brings each face to the front of the cube.
const FACE_ROT = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateY(-90deg)',
  3: 'rotateX(90deg)',
  4: 'rotateX(-90deg)',
  5: 'rotateY(90deg)',
  6: 'rotateY(180deg)',
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
 * Dice — 3D rolling die.
 *
 * `rollKey` increments on EVERY roll (human or bot). We restart the CSS tumble
 * animation imperatively with a forced reflow so it fires every single time —
 * fixing the bug where the class stopped re-triggering after a few rolls.
 */
export default function Dice({ value, rollKey = 0, disabled, onRoll }) {
  const cubeRef = useRef(null);

  useEffect(() => {
    if (!rollKey) return;
    const el = cubeRef.current;
    if (!el) return;
    el.classList.remove('rolling');
    // eslint-disable-next-line no-unused-expressions
    void el.offsetWidth;        // force DOM reflow → animation restarts reliably
    el.classList.add('rolling');
    const t = setTimeout(() => el.classList.remove('rolling'), 850);
    return () => clearTimeout(t);
  }, [rollKey]);

  return (
    <button onClick={onRoll} disabled={disabled}
      className="dice-scene disabled:opacity-40 disabled:cursor-not-allowed"
      title={disabled ? 'Not your turn' : 'Roll'}>
      <div ref={cubeRef} className="dice" style={{ transform: FACE_ROT[value] || FACE_ROT[1] }}>
        <Face cls="f-front"  value={value || 1} />
        <Face cls="f-back"   value={6} />
        <Face cls="f-right"  value={2} />
        <Face cls="f-left"   value={5} />
        <Face cls="f-top"    value={3} />
        <Face cls="f-bottom" value={4} />
      </div>
    </button>
  );
}
