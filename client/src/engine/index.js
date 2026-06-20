/**
 * engine/index.js — public surface of the Board Royale game engine.
 *
 * Pure logic only. Renderers (Renderer2D over SVG, Renderer3D over Three.js)
 * are built separately and simply subscribe to the manager:
 *
 *   import GameStateManager from './engine';
 *   import { VIEW_MODE } from './engine';
 *
 *   const manager = new GameStateManager();
 *
 *   // both renderers subscribe to the SAME stream of snapshots
 *   const r2d = new Renderer2D(svgEl);  manager.subscribe(s => r2d.render(s));
 *   const r3d = new Renderer3D(canvas); manager.subscribe(s => r3d.render(s));
 *   manager.on('viewmode', m => { r2d.setVisible(m === '2D'); r3d.setVisible(m === '3D'); });
 *
 *   // start a 6-player Ludo game vs bots
 *   manager.newGame('ludo', { colors: ['red','green','yellow','blue','purple','orange'],
 *                             botColors: ['green','yellow','blue','purple','orange'] });
 *
 *   // the user toggles dimension at any time — game state is untouched
 *   toggleBtn.onclick = () => manager.toggleViewMode();
 *
 *   // drive a turn
 *   manager.roll();                       // ROLL action
 *   manager.dispatch({ type:'MOVE', tokenId: 0 });
 *
 *   // ----- online (PeerJS) -----
 *   import Peer from 'peerjs';
 *   const net = new PeerNetwork({ PeerCtor: Peer });
 *   const online = new GameStateManager({ network: net });
 *   const roomId = await net.host();      // share roomId; clients call net.join(roomId)
 */
export { default } from './GameStateManager.js';
export { default as GameStateManager } from './GameStateManager.js';
export { default as EventBus } from './EventBus.js';
export { GAME_TYPE, VIEW_MODE } from './IGameEngine.js';

export { default as ChessEngine } from './chess/ChessEngine.js';
export { default as StockfishAdapter } from './chess/StockfishAdapter.js';

export { default as LudoEngine, TOKEN_STATE, PHASE } from './ludo/LudoEngine.js';
export * as LudoBoard from './ludo/ludoBoard.js';

export { default as PeerNetwork } from './net/PeerNetwork.js';
