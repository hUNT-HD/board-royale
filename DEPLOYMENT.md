# 🚀 Deploying Board Royale

Two pieces deploy separately:

| Piece | Host | Why |
|---|---|---|
| **client** (React/Vite) | **Vercel** (static) | Fast CDN. Solo chess/ludo works here with zero backend. |
| **server** (Socket.io) | **Render / Railway / Fly.io** | Vercel can't run a persistent WebSocket server — online multiplayer needs a long-lived Node process. |

> Solo modes (Chess vs Stockfish, Ludo vs bots) run 100% in the browser, so the
> Vercel deploy alone already gives a playable game. The server only powers the
> online room-code multiplayer.

---

## 0. One-time: put the code in a Git repo

Vercel and Render both deploy *from a Git repo*. From the `board-royale/` folder:

```bash
git init
git add .
git commit -m "Board Royale"
git branch -M main
git remote add origin https://github.com/<you>/board-royale.git
git push -u origin main
```

---

## 1. Server → Render (do this FIRST — client needs its URL)

**Option A — Blueprint (uses the included `server/render.yaml`):**
1. Render dashboard → **New + → Blueprint** → pick the repo.
2. It detects `server/render.yaml`. Click **Apply**.
3. When asked, set `CLIENT_ORIGIN` to your Vercel URL (you can use `*` for now and tighten later).
4. Deploy. Copy the live URL, e.g. `https://board-royale-server.onrender.com`.

**Option B — Manual web service:**
- New + → **Web Service** → repo → **Root Directory:** `server` →
  **Build:** `npm install` → **Start:** `npm start` → add env var `CLIENT_ORIGIN`.

> Railway: New Project → Deploy from repo → set Root Dir `server`, start `npm start`.
> Fly.io: `fly launch` inside `server/`.

Verify it's up: open `https://<your-server>/health` → should return `{"ok":true}`.

---

## 2. Client → Vercel

Since you're deploying yourself with the CLI (no GitHub step needed if you prefer):

```bash
cd client
npm install
npx vercel            # first run: log in + link project
# set the server URL so the client knows where to connect:
npx vercel env add VITE_SERVER_URL production
#   → paste: https://board-royale-server.onrender.com
npx vercel --prod     # production deploy
```

**…or via the Vercel dashboard (Git import):**
1. **Add New → Project** → import the repo.
2. **Root Directory:** `client`  (important — not the repo root).
3. Framework preset auto-detects **Vite**. `vercel.json` handles SPA routing + headers.
4. **Environment Variables** → add `VITE_SERVER_URL` = your Render URL.
5. **Deploy.**

---

## 3. Close the loop (CORS)

Back in Render, set `CLIENT_ORIGIN` to the final Vercel domain
(`https://board-royale.vercel.app`) and redeploy the server so the browser is
allowed to connect.

---

## Troubleshooting

- **Online mode can't connect / CORS error:** `VITE_SERVER_URL` (Vercel) and
  `CLIENT_ORIGIN` (Render) must point at each other's real URLs. Re-deploy after changes.
- **Render free tier sleeps:** first connection after idle takes ~30–50s to wake. Normal.
- **Stockfish won't load:** the `vercel.json` sets COOP/COEP headers for WASM. If the
  CDN fallback in `useStockfish.js` gets blocked by COEP, either keep the bundled
  npm worker (default) or remove the `Cross-Origin-Embedder-Policy` header.
- **404 on refresh:** the SPA rewrite in `vercel.json` fixes this — make sure Root
  Directory is `client` so Vercel reads that file.
```
