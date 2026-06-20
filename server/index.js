/**
 * index.js — Express + Socket.io bootstrap and event router for Board Royale.
 *
 * Socket events (client -> server):
 *   room:create   { game, name }                -> ack { code, room }
 *   room:join     { code, name }                -> ack { room } | { error }
 *   room:start    { code }                      -> broadcasts game:started
 *   chess:move    { code, move, fen }           -> relays to opponent
 *   ludo:roll     { code }                      -> broadcasts ludo:state + dice
 *   ludo:move     { code, tokenId }             -> broadcasts ludo:state
 *
 * Socket events (server -> room):
 *   room:update, game:started, chess:move, ludo:state, room:error, peer:left
 */
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

import {
  createRoom, joinRoom, startRoom, leaveRoom, getRoom, publicRoom,
} from './rooms.js';
import {
  roll, moveToken, serialize, botChooseToken, COLORS,
} from './ludoLogic.js';

const app = express();
app.use(cors());
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || '*', methods: ['GET', 'POST'] },
});

const emitRoom = (code) => {
  const room = getRoom(code);
  if (room) io.to(code).emit('room:update', publicRoom(room));
};
const emitLudo = (code) => {
  const room = getRoom(code);
  if (room?.state) io.to(code).emit('ludo:state', serialize(room.state));
};

io.on('connection', (socket) => {
  // ---- Room lifecycle ----------------------------------------------------
  socket.on('room:create', ({ game, name }, ack) => {
    if (!['chess', 'ludo'].includes(game)) return ack?.({ error: 'Unknown game.' });
    const room = createRoom(game, socket.id, name);
    socket.join(room.code);
    ack?.({ code: room.code, room: publicRoom(room) });
  });

  socket.on('room:join', ({ code, name }, ack) => {
    code = (code || '').toUpperCase().trim();
    const { room, error } = joinRoom(code, socket.id, name);
    if (error) return ack?.({ error });
    socket.join(code);
    ack?.({ room: publicRoom(room) });
    emitRoom(code);
  });

  socket.on('room:start', ({ code }, ack) => {
    const { room, error } = startRoom(code);
    if (error) return ack?.({ error });
    io.to(code).emit('game:started', publicRoom(room));
    if (room.game === 'ludo') emitLudo(code);
    ack?.({ ok: true });
  });

  // ---- Chess: lightweight relay (chess.js validates client-side) ---------
  socket.on('chess:move', ({ code, move, fen }) => {
    // To make the server authoritative, import { Chess } from 'chess.js' here,
    // replay fen + move, and reject illegal results before relaying.
    socket.to(code).emit('chess:move', { move, fen });
  });

  // ---- Generic host-authoritative relay (Ludo runs in the host's browser) -
  // Clients send their intent; the room HOST applies it and broadcasts state.
  socket.on('lobby:action', ({ code, action }) => socket.to(code).emit('lobby:action', action));
  socket.on('lobby:state', ({ code, state }) => socket.to(code).emit('lobby:state', state));

  // ---- Ludo: server is authoritative -------------------------------------
  socket.on('ludo:roll', ({ code }, ack) => {
    const room = getRoom(code);
    if (!room?.state) return ack?.({ error: 'No active game.' });
    if (!isCurrentPlayer(room, socket.id)) return ack?.({ error: 'Not your turn.' });

    const result = roll(room.state);
    if (result.error) return ack?.({ error: result.error });
    ack?.({ dice: result.dice, moves: result.moves });
    emitLudo(code);
    maybeRunBots(code);
  });

  socket.on('ludo:move', ({ code, tokenId }, ack) => {
    const room = getRoom(code);
    if (!room?.state) return ack?.({ error: 'No active game.' });
    if (!isCurrentPlayer(room, socket.id)) return ack?.({ error: 'Not your turn.' });
    try {
      const result = moveToken(room.state, tokenId);
      ack?.({ ok: true, ...result });
      emitLudo(code);
      maybeRunBots(code);
    } catch (e) {
      ack?.({ error: e.message });
    }
  });

  socket.on('disconnect', () => {
    for (const room of leaveRoom(socket.id)) {
      io.to(room.code).emit('peer:left', { id: socket.id });
      emitRoom(room.code);
    }
  });
});

/** True if the socket controls the seat whose turn it is (Ludo). */
function isCurrentPlayer(room, socketId) {
  const seat = room.state.turn;
  const member = room.members.find((m) => m.seat === seat);
  return member?.socketId === socketId;
}

/**
 * Drive any bot-controlled seats (disconnected players or AI fillers).
 * Runs on a short timer so the dice/move animations are visible to humans.
 */
function maybeRunBots(code) {
  const room = getRoom(code);
  if (!room?.state) return;
  const game = room.state;
  const seat = game.turn;
  const member = room.members.find((m) => m.seat === seat);
  const isBot = !member || !member.socketId; // empty seat acts as a bot
  if (!isBot) return;

  setTimeout(() => {
    const r = roll(game);
    emitLudo(code);
    if (r.moves && r.moves.length > 0) {
      setTimeout(() => {
        const tokenId = botChooseToken(game, r.dice);
        if (tokenId != null) moveToken(game, tokenId);
        emitLudo(code);
        maybeRunBots(code);
      }, 700);
    } else {
      maybeRunBots(code);
    }
  }, 700);
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`♟️🎲 Board Royale server on :${PORT}`));
