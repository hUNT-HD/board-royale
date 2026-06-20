/**
 * GameStateManager — the single source of truth and orchestrator.
 *
 *  • Owns the active engine (Chess or Ludo) and the global view mode.
 *  • Knows NOTHING about how things are drawn. It only broadcasts normalized
 *    snapshots over an EventBus; a Renderer2D (SVG) and a Renderer3D (Three.js)
 *    each subscribe and update their own visuals. Toggling currentViewMode does
 *    not touch game state — it simply tells whichever renderers are mounted
 *    which one should be visible.
 *  • Routes every state mutation through dispatch(), so the same code path is
 *    used for local play and for network-synced multiplayer.
 *
 * Events emitted on the bus:
 *   'state'     (snapshot, events)   — after any state change
 *   'viewmode'  (mode)               — '2D' | '3D'
 *   'gameover'  (snapshot)
 *   'error'     (message)
 */
import EventBus from './EventBus.js';
import { VIEW_MODE, GAME_TYPE } from './IGameEngine.js';
import ChessEngine from './chess/ChessEngine.js';
import LudoEngine from './ludo/LudoEngine.js';

const ENGINES = { [GAME_TYPE.CHESS]: ChessEngine, [GAME_TYPE.LUDO]: LudoEngine };

export default class GameStateManager {
  constructor({ network = null } = {}) {
    this.bus = new EventBus();
    this.engine = null;
    this.gameType = null;
    this.mode = 'solo';                 // 'solo' | 'online'
    this.currentViewMode = VIEW_MODE.TWO_D;
    this.localActor = null;             // which side/colour this client controls
    this.network = network;
    if (network) this._wireNetwork(network);
  }

  /* ---------------- subscription API (renderers use this) ---------------- */
  subscribe(fn) { return this.bus.on('state', fn); }
  on(event, fn) { return this.bus.on(event, fn); }

  /* ----------------------------- view mode ------------------------------ */
  setViewMode(mode) {
    if (mode !== VIEW_MODE.TWO_D && mode !== VIEW_MODE.THREE_D) return;
    this.currentViewMode = mode;
    this.bus.emit('viewmode', mode);
    this._broadcast();                  // re-emit so the newly-active renderer paints
  }
  toggleViewMode() {
    this.setViewMode(this.currentViewMode === VIEW_MODE.TWO_D ? VIEW_MODE.THREE_D : VIEW_MODE.TWO_D);
  }

  /* ----------------------------- lifecycle ------------------------------ */
  newGame(gameType, config = {}) {
    const Engine = ENGINES[gameType];
    if (!Engine) throw new Error(`Unknown game type: ${gameType}`);
    this.gameType = gameType;
    this.mode = config.mode || 'solo';
    this.localActor = config.localActor ?? null;
    this.engine = new Engine(config);
    this.engine.init(config);
    this._broadcast();
    return this;
  }

  /* ------------------------------ actions ------------------------------- */
  /**
   * dispatch — the ONLY way to mutate game state.
   * In online mode a non-host client forwards the action to the host instead of
   * applying it locally; the host applies it and broadcasts authoritative state.
   */
  dispatch(action) {
    if (!this.engine) return { error: 'No active game.' };

    if (this.mode === 'online' && this.network && !this.network.isHost) {
      this.network.send({ kind: 'action', action });
      return { forwarded: true };
    }

    const result = this.engine.applyAction(action);
    if (result?.error) { this.bus.emit('error', result.error); return result; }

    this._broadcast(result?.events);
    if (this.mode === 'online' && this.network?.isHost) {
      this.network.broadcastState(this.engine.serialize());
    }
    if (this.engine.isGameOver()) this.bus.emit('gameover', this.getSnapshot());
    return result;
  }

  /** Convenience for dice games / engines that expose a roll action. */
  roll() { return this.dispatch({ type: 'ROLL' }); }

  async requestAIMove() {
    if (!this.engine) return null;
    const action = await this.engine.requestAIMove();
    if (action) return this.dispatch(action);
    return null;
  }

  /* ------------------------------ snapshot ------------------------------ */
  getSnapshot() {
    return {
      gameType: this.gameType,
      viewMode: this.currentViewMode,
      mode: this.mode,
      localActor: this.localActor,
      ...(this.engine ? this.engine.getSnapshot() : {}),
    };
  }
  getLegalActions() { return this.engine ? this.engine.getLegalActions() : []; }
  _broadcast(events) { this.bus.emit('state', this.getSnapshot(), events); }

  /* ------------------------- network integration ------------------------ */
  _wireNetwork(network) {
    network.onMessage((msg, fromHost) => {
      if (msg.kind === 'action' && network.isHost) {
        // a client asked the host to apply an action
        this.dispatch(msg.action);
      } else if (msg.kind === 'state' && !network.isHost) {
        // host pushed authoritative state to clients
        this.engine?.loadSnapshot(msg.state);
        this._broadcast();
        if (this.engine?.isGameOver()) this.bus.emit('gameover', this.getSnapshot());
      }
    });
  }
}
