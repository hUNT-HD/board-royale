/**
 * InputManager — unifies mouse + touch into a single "pick" gesture for both 2D
 * and 3D views. It produces normalized device coordinates (NDC) computed from
 * the canvas's live bounding rect (so any CSS margin/padding/scroll offset is
 * accounted for), and it suppresses picks that were really camera drags/pans.
 *
 * Pointer Events already cover mouse + touch + pen uniformly; we add an explicit
 * touch fallback for older WebViews. NDC is emitted as a plain {x,y} so this
 * stays Three-free and testable — Raycaster.setFromCamera reads only .x/.y.
 *
 *   const input = new InputManager(canvas, { onPick: (ndc) => {...} });
 */
export default class InputManager {
  constructor(el, { onPick, dragThreshold = 8, tapTimeout = 600 } = {}) {
    this.el = el;
    this.onPick = onPick;
    this.dragThreshold = dragThreshold;   // px of movement that still counts as a tap
    this.tapTimeout = tapTimeout;          // ms; longer press = not a tap
    this._down = null;
    this._bind();
  }

  _point(e) {
    // touchend carries position in changedTouches; touchstart in touches
    return (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
  }

  _onDown = (e) => {
    const p = this._point(e);
    this._down = { x: p.clientX, y: p.clientY, t: performance.now() };
  };

  _onUp = (e) => {
    if (!this._down) return;
    const p = this._point(e);
    const moved = Math.hypot(p.clientX - this._down.x, p.clientY - this._down.y);
    const held = performance.now() - this._down.t;
    this._down = null;
    if (moved > this.dragThreshold || held > this.tapTimeout) return; // a drag/pan, not a tap
    if (!this.onPick) return;

    const r = this.el.getBoundingClientRect();       // live rect → handles margins/padding/scroll
    if (!r.width || !r.height) return;
    const ndc = {
      x: ((p.clientX - r.left) / r.width) * 2 - 1,
      y: -((p.clientY - r.top) / r.height) * 2 + 1,
    };
    this.onPick(ndc);
  };

  _bind() {
    // Pointer events handle mouse + touch + pen. Passive so scrolling stays smooth
    // where allowed; the canvas itself uses CSS `touch-action:none` to block pans.
    this.el.addEventListener('pointerdown', this._onDown, { passive: true });
    this.el.addEventListener('pointerup', this._onUp, { passive: true });
    // Legacy touch fallback (old Android WebViews without Pointer Events)
    if (!window.PointerEvent) {
      this.el.addEventListener('touchstart', this._onDown, { passive: true });
      this.el.addEventListener('touchend', this._onUp, { passive: true });
    }
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this._onDown);
    this.el.removeEventListener('pointerup', this._onUp);
    this.el.removeEventListener('touchstart', this._onDown);
    this.el.removeEventListener('touchend', this._onUp);
  }
}
