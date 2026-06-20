/**
 * EventBus — minimal synchronous pub/sub. The backbone of "separation of
 * concerns": the engine emits events, renderers (2D SVG / 3D WebGL) and the
 * network layer subscribe. Nothing in the engine ever references a renderer.
 */
export default class EventBus {
  constructor() { this._listeners = new Map(); }

  /** Subscribe. Returns an unsubscribe function. */
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  once(event, fn) {
    const wrap = (...a) => { this.off(event, wrap); fn(...a); };
    return this.on(event, wrap);
  }

  off(event, fn) { this._listeners.get(event)?.delete(fn); }

  emit(event, ...payload) {
    this._listeners.get(event)?.forEach((fn) => {
      try { fn(...payload); } catch (e) { console.error(`[EventBus] ${event} handler failed`, e); }
    });
  }

  clear() { this._listeners.clear(); }
}
