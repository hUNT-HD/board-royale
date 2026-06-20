# ♟️ Board Royale 🎲

A premium, dual-game web hub — **Chess** (2P) and **6-player Ludo** — with a luxurious
Neo-Morphism / Isometric-3D hybrid look built entirely with CSS magic (no heavy 3D engines).

> Dark glassmorphism · neon ambient glow · marble & frosted-quartz chess board ·
> hexagonal glossy Ludo board · real-time multiplayer via Socket.io · offline AI.

---

## ✨ Features

| | Chess | Ludo |
|---|---|---|
| Players | 2 (strict) | **up to 6** (hexagonal board) |
| Online | Private room code (Socket.io) | Private room code (Socket.io) |
| Solo vs AI | Stockfish.js (WASM) | Priority-based bot |
| Rules engine | `chess.js` | Custom server-side index tracking |
| Visuals | Charcoal marble + frosted quartz, glass pieces w/ gold/platinum rims, active-piece spotlight | Hex board, 6 neon player colors, semi-transparent glow tokens, 3D rolling dice |

---

## 🧱 Tech Stack

- **Frontend:** React 18 + Vite, Tailwind CSS, pure CSS/Grid boards
- **Backend:** Node.js + Express + Socket.io
- **Chess:** `chess.js` (legality/check/mate) + `stockfish` WASM (offline AI)
- **Ludo:** custom server-side logic for the 6-lane hexagonal path

---

## 📁 Folder Structure

```
board-royale/
├── README.md
├── package.json            # root – runs client + server together
├── server/                 # Node + Express + Socket.io
│   ├── package.json
│   ├── index.js            # HTTP + Socket.io bootstrap
│   ├── rooms.js            # room create/join/leave registry
│   ├── chessRelay.js       # relays validated chess moves between 2 players
│   └── ludoLogic.js        # 6-player hex path, safe spots, kill logic, bot
└── client/                 # React + Vite + Tailwind
    ├── package.json
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx          # routing between Home / Chess / Ludo
        ├── index.css        # design tokens + glassmorphism + neon + keyframes
        ├── socket.js        # singleton Socket.io client
        ├── pages/
        │   ├── Home.jsx     # hero lobby, mode + room-code picker
        │   ├── ChessGame.jsx
        │   └── LudoGame.jsx
        ├── components/
        │   ├── GlassPanel.jsx
        │   ├── chess/
        │   │   ├── ChessBoard.jsx
        │   │   ├── useChess.js
        │   │   └── useStockfish.js
        │   └── ludo/
        │       ├── LudoBoard.jsx
        │       ├── Dice.jsx
        │       └── ludoPath.js   # shared client copy of board geometry
        └── hooks/
            └── useRoom.js
```

---

## 🚀 Getting Started

```bash
# 1. install everything (root installs both workspaces)
npm install
npm --prefix server install
npm --prefix client install

# 2. run both (server :4000, client :5173)
npm run dev
```

Open http://localhost:5173.

### Solo vs AI
No network needed — Stockfish runs in a Web Worker in your browser; the Ludo bot
runs locally in component state.

### Online with friends
1. Player 1 → **Create Room** → share the 6-char code.
2. Others → **Join Room** → paste code. Moves sync instantly over Socket.io.

---

## 🧠 Architecture Notes

**Chess** uses `chess.js` as the single source of truth on each client. In online
mode the mover's client validates locally, then emits the SAN/`{from,to}` move;
the server simply relays it to the opponent who applies it to their own `chess.js`
instance. (You can promote the server to authoritative validation by importing
`chess.js` in `chessRelay.js` — hook is noted in the file.)

**Ludo** is authoritative on the **server**: `ludoLogic.js` owns each token's
position as an index into that player's personal 57-step path around the hex
board, plus turn order, dice, safe-spots and capture resolution. Clients render
state and request actions (`roll`, `moveToken`); the server validates and
broadcasts the new `GameState`.

See inline comments in `server/ludoLogic.js` for the path model.
