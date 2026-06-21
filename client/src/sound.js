/**
 * sound.js — tiny Web-Audio sound kit (no asset files, fully offline).
 * Short synthesized blips for moves, captures, dice, check and win/lose.
 */
let ctx;
let muted = false;
const ac = () => {
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
};

function blip({ freq = 440, type = 'sine', dur = 0.12, gain = 0.2, slideTo, delay = 0 }) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

/** A short woody "clack" — filtered white-noise burst, like a die hitting the table. */
function clack({ delay = 0, dur = 0.045, gain = 0.18, freq = 1800, q = 1 }) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + delay;
  const frames = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;   // white noise
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);                // sharp attack
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);               // quick decay
  src.connect(bp); bp.connect(g); g.connect(c.destination);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

export const sound = {
  move:    () => blip({ freq: 240, type: 'triangle', dur: 0.09, gain: 0.16 }),
  capture: () => { blip({ freq: 170, type: 'square', dur: 0.1, gain: 0.18 }); blip({ freq: 110, type: 'square', dur: 0.12, gain: 0.14, delay: 0.05 }); },
  select:  () => blip({ freq: 520, type: 'sine', dur: 0.05, gain: 0.08 }),
  check:   () => blip({ freq: 760, type: 'sine', dur: 0.18, gain: 0.18, slideTo: 1180 }),
  // realistic tumbling die: a cluster of woody clacks that rattle then settle, ending on a softer landing tap
  dice:    () => {
    let t = 0;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const prog = i / n;
      clack({
        delay: t,
        dur: 0.025 + Math.random() * 0.03,
        gain: (0.22 - prog * 0.12) * (0.8 + Math.random() * 0.4),   // fade as it settles
        freq: 1300 + Math.random() * 2400,                          // random woody pitch
        q: 0.7 + Math.random() * 1.2,
      });
      t += 0.04 + Math.random() * 0.05 + prog * 0.035;              // intervals widen → slowing down
    }
    clack({ delay: t + 0.02, dur: 0.07, gain: 0.15, freq: 820, q: 1.6 });  // final settle
  },
  token:   () => blip({ freq: 360, type: 'triangle', dur: 0.08, gain: 0.13 }),
  win:     () => [523, 659, 784, 1047].forEach((f, i) => blip({ freq: f, type: 'triangle', dur: 0.26, gain: 0.2, delay: i * 0.12 })),
  lose:    () => [392, 330, 262].forEach((f, i) => blip({ freq: f, type: 'sine', dur: 0.32, gain: 0.18, delay: i * 0.15 })),
};

export const setMuted = (m) => { muted = m; };
export const isMuted = () => muted;
