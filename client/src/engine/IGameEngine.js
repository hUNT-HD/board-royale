/**
 * IGameEngine — the contract every game (Chess, Ludo) implements so that the
 * GameStateManager, the network layer, and BOTH renderers can treat them
 * uniformly. Renderers never read game-specific internals; they only consume
 * the normalized, serializable snapshot returned by getSnapshot().
 *
 * This is documentation-as-interface (JS has no interfaces). Each engine class
 * must implement every method below.
 *
 *   type: 'chess' | 'ludo'
 *
 *   init(config)            -> void      // build initial state
 *   getSnapshot()           -> Snapshot  // renderer-agnostic, JSON-serializable
 *   getLegalActions()       -> Action[]  // what the current actor may do
 *   applyAction(action)     -> Result    // validate + mutate + return events
 *   isGameOver()            -> boolean
 *   getCurrentActor()       -> actorId   // 'w'|'b' or a ludo colour
 *   serialize()             -> object     // full state for network sync
 *   loadSnapshot(state)     -> void       // overwrite from a network update
 *   requestAIMove()         -> Promise<Action|null>  // solo bot (optional)
 *
 * Snapshot shape (consumed identically by Renderer2D and Renderer3D):
 *   {
 *     type, status, currentActor, winner,
 *     // CHESS:  board: 8x8 logical squares; pieces:[{id,type,color,square}]
 *     // LUDO:   tokens:[{id,color,state,zone,trackIndex,homeIndex,logical}]
 *     entities: [...],     // abstract, coordinate-free game objects
 *     highlights: [...],   // legal targets etc. (abstract ids/squares)
 *     meta: { ... }        // dice value, check flags, etc.
 *   }
 *
 * Crucial design rule for seamless 2D/3D: entity positions are *logical*
 * (a chess square like "e4", or a ludo {color, trackIndex}). Mapping logical →
 * pixels (2D) or → world coordinates (3D) is the renderer's job, never the
 * engine's. Switching renderers therefore needs zero engine changes.
 */
export const GAME_TYPE = Object.freeze({ CHESS: 'chess', LUDO: 'ludo' });

export const VIEW_MODE = Object.freeze({ TWO_D: '2D', THREE_D: '3D' });

/** Optional base class providing no-op defaults + a type tag. */
export default class IGameEngine {
  constructor(type) { this.type = type; }
  init() { throw new Error('init() not implemented'); }
  getSnapshot() { throw new Error('getSnapshot() not implemented'); }
  getLegalActions() { return []; }
  applyAction() { throw new Error('applyAction() not implemented'); }
  isGameOver() { return false; }
  getCurrentActor() { return null; }
  serialize() { throw new Error('serialize() not implemented'); }
  loadSnapshot() { throw new Error('loadSnapshot() not implemented'); }
  async requestAIMove() { return null; }
}
