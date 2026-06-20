/**
 * PeerNetwork — multiplayer transport over PeerJS (WebRTC), host-authoritative.
 *
 * Topology: the room HOST owns the canonical GameStateManager. Clients send
 * intent ({kind:'action'}); the host applies it through its manager and pushes
 * the resulting authoritative state ({kind:'state'}) to every client. This keeps
 * all rule-evaluation in ONE place and makes desync impossible.
 *
 * Dependency-injected `PeerCtor` (the PeerJS `Peer` class) so the engine layer
 * has no hard import and stays unit-testable:
 *     import Peer from 'peerjs';
 *     const net = new PeerNetwork({ PeerCtor: Peer });
 *
 * Wire into the manager:
 *     const manager = new GameStateManager({ network: net });
 *     await net.host();              // or net.join(hostId)
 */
export default class PeerNetwork {
  constructor({ PeerCtor, peerOptions = {} } = {}) {
    if (!PeerCtor) throw new Error('PeerNetwork needs a PeerJS constructor (PeerCtor).');
    this.PeerCtor = PeerCtor;
    this.peerOptions = peerOptions;
    this.peer = null;
    this.isHost = false;
    this.roomId = null;
    this.connections = [];          // host: many clients; client: one host conn
    this._messageHandlers = new Set();
    this._statusHandlers = new Set();
  }

  /* ------------------------------ events -------------------------------- */
  onMessage(fn) { this._messageHandlers.add(fn); return () => this._messageHandlers.delete(fn); }
  onStatus(fn) { this._statusHandlers.add(fn); return () => this._statusHandlers.delete(fn); }
  _emitMessage(msg, fromHost) { this._messageHandlers.forEach((h) => h(msg, fromHost)); }
  _emitStatus(s, info) { this._statusHandlers.forEach((h) => h(s, info)); }

  /* --------------------------- room creation ---------------------------- */
  /** Create a room. Resolves with the shareable room id (the host's peer id). */
  host() {
    this.isHost = true;
    return new Promise((resolve, reject) => {
      this.peer = new this.PeerCtor(undefined, this.peerOptions);
      this.peer.on('open', (id) => { this.roomId = id; this._emitStatus('hosting', { roomId: id }); resolve(id); });
      this.peer.on('connection', (conn) => this._registerConnection(conn));
      this.peer.on('error', (err) => { this._emitStatus('error', err); reject(err); });
    });
  }

  /* ------------------------------ joining ------------------------------- */
  /** Join an existing room by host id. Resolves once the data channel is open. */
  join(hostId) {
    this.isHost = false;
    this.roomId = hostId;
    return new Promise((resolve, reject) => {
      this.peer = new this.PeerCtor(undefined, this.peerOptions);
      this.peer.on('open', () => {
        const conn = this.peer.connect(hostId, { reliable: true });
        conn.on('open', () => { this._registerConnection(conn); this._emitStatus('joined', { roomId: hostId }); resolve(conn); });
        conn.on('error', reject);
      });
      this.peer.on('error', (err) => { this._emitStatus('error', err); reject(err); });
    });
  }

  _registerConnection(conn) {
    this.connections.push(conn);
    conn.on('data', (msg) => this._emitMessage(msg, /* fromHost */ !this.isHost));
    conn.on('close', () => {
      this.connections = this.connections.filter((c) => c !== conn);
      this._emitStatus('peerleft', { peerId: conn.peer });
    });
    this._emitStatus('connected', { peerId: conn.peer });
  }

  /* ------------------------------ sending ------------------------------- */
  /** Client → host: forward an intent (e.g. a dice roll or token move). */
  send(message) { this.connections.forEach((c) => c.open && c.send(message)); }

  /** Host → all clients: push authoritative serialized state. */
  broadcastState(state) {
    if (!this.isHost) return;
    const msg = { kind: 'state', state };
    this.connections.forEach((c) => c.open && c.send(msg));
  }

  /** Host → all clients: relay a dice-roll event for animation parity. */
  broadcastRoll(roll) {
    if (!this.isHost) return;
    this.connections.forEach((c) => c.open && c.send({ kind: 'roll', roll }));
  }

  disconnect() {
    this.connections.forEach((c) => c.close?.());
    this.peer?.destroy?.();
    this.connections = [];
  }
}
