/**
 * sound.js — tiny Web-Audio sound kit (no asset files, fully offline).
 * Short synthesized blips for moves, captures, dice, check and win/lose.
 */
let ctx;
let muted = false;

/* Real recorded dice-roll sample (served from /public). Cloned per roll so rapid
   rolls can overlap without the "play() interrupted" error. */
let diceEl;
const diceBase = () => {
  if (typeof Audio === 'undefined') return null;
  if (!diceEl) { diceEl = new Audio('/dice.mp3'); diceEl.preload = 'auto'; diceEl.volume = 0.7; }
  return diceEl;
};
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

export const sound = {
  move:    () => blip({ freq: 240, type: 'triangle', dur: 0.09, gain: 0.16 }),
  capture: () => { blip({ freq: 170, type: 'square', dur: 0.1, gain: 0.18 }); blip({ freq: 110, type: 'square', dur: 0.12, gain: 0.14, delay: 0.05 }); },
  select:  () => blip({ freq: 520, type: 'sine', dur: 0.05, gain: 0.08 }),
  check:   () => blip({ freq: 760, type: 'sine', dur: 0.18, gain: 0.18, slideTo: 1180 }),
  // real recorded dice-roll sample
  dice:    () => {
    if (muted) return;
    const base = diceBase(); if (!base) return;
    try { const a = base.cloneNode(); a.volume = 0.7; a.play().catch(() => {}); } catch { /* ignore */ }
  },
  token:   () => blip({ freq: 360, type: 'triangle', dur: 0.08, gain: 0.13 }),
  win:     () => [523, 659, 784, 1047].forEach((f, i) => blip({ freq: f, type: 'triangle', dur: 0.26, gain: 0.2, delay: i * 0.12 })),
  lose:    () => [392, 330, 262].forEach((f, i) => blip({ freq: f, type: 'sine', dur: 0.32, gain: 0.18, delay: i * 0.15 })),
};

export const setMuted = (m) => { muted = m; };
export const isMuted = () => muted;
