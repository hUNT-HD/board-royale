/**
 * rooms.js — In-memory room registry for both games.
 * Swap the Map for Redis to scale horizontally; the shape stays identical.
 */
import { customAlphabet } from 'nanoid';
import { createGame } from './ludoLogic.js';

const LUDO_COLORS = ['red', 'green', 'yellow', 'blue']; // 4-player classic

// Unambiguous, uppercase, human-shareable 6-char codes (no 0/O/1/I).
const makeCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 6);

/** @typedef {'chess'|'ludo'} GameType */

const rooms = new Map(); // code -> Room

export function createRoom(game, hostSocketId, hostName) {
  let code;
  do { code = makeCode(); } while (rooms.has(code));

  const maxPlayers = game === 'chess' ? 2 : 4;
  const room = {
    code,
    game,            // 'chess' | 'ludo'
    maxPlayers,
    hostId: hostSocketId,
    members: [],     // [{ socketId, name, seat, color? }]
    started: false,
    // chess: { fen, turn } is filled by chessRelay; ludo: full engine state
    state: null,
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  joinRoom(code, hostSocketId, hostName); // host auto-joins as seat 0
  return room;
}

export function joinRoom(code, socketId, name) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found.' };
  if (room.started) return { error: 'Game already started.' };
  if (room.members.length >= room.maxPlayers) return { error: 'Room is full.' };
  if (room.members.some((m) => m.socketId === socketId)) return { room };

  const seat = room.members.length;
  const member = { socketId, name: name || `Player ${seat + 1}`, seat };
  if (room.game === 'ludo') {
    // default to the first colour not already taken
    member.color = LUDO_COLORS.find((c) => !room.members.some((m) => m.color === c)) || LUDO_COLORS[seat];
  }
  room.members.push(member);
  return { room, member };
}

/** Let a Ludo player pick a colour, rejecting one another player already holds. */
export function setColor(code, socketId, color) {
  const room = rooms.get(code);
  if (!room || room.game !== 'ludo') return { error: 'Not a Ludo room.' };
  if (room.started) return { error: 'Game already started.' };
  if (!LUDO_COLORS.includes(color)) return { error: 'Invalid colour.' };
  if (room.members.some((m) => m.color === color && m.socketId !== socketId)) return { error: 'Colour already taken.' };
  const me = room.members.find((m) => m.socketId === socketId);
  if (!me) return { error: 'Not in room.' };
  me.color = color;
  return { room };
}

export function startRoom(code) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found.' };
  if (room.game === 'chess' && room.members.length !== 2)
    return { error: 'Chess needs exactly 2 players.' };
  if (room.game === 'ludo' && room.members.length < 2)
    return { error: 'Ludo needs at least 2 players.' };

  room.started = true;
  if (room.game === 'ludo') {
    room.state = createGame(room.members.map((m) => m.color));
  } else {
    room.state = { fen: 'startpos', turn: 'w' }; // chess.js owns truth client-side
  }
  return { room };
}

export function leaveRoom(socketId) {
  const affected = [];
  for (const room of rooms.values()) {
    const idx = room.members.findIndex((m) => m.socketId === socketId);
    if (idx === -1) continue;
    room.members.splice(idx, 1);
    if (room.members.length === 0) {
      rooms.delete(room.code); // garbage-collect empty rooms
    } else {
      if (room.hostId === socketId) room.hostId = room.members[0].socketId;
      affected.push(room);
    }
  }
  return affected;
}

export const getRoom = (code) => rooms.get(code);
export const publicRoom = (room) => room && ({
  code: room.code,
  game: room.game,
  maxPlayers: room.maxPlayers,
  hostId: room.hostId,
  started: room.started,
  members: room.members.map(({ socketId, ...m }) => ({ id: socketId, ...m })),
});
