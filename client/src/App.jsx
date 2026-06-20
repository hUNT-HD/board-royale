import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import ChessGame from './pages/ChessGame.jsx';
import LudoGame from './pages/LudoGame.jsx';

export default function App() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 md:px-10 py-5">
        <Link to="/" className="flex items-center gap-3">
          <span className="text-2xl">♛</span>
          <span className="font-display text-xl md:text-2xl title-shimmer font-bold tracking-wide">
            BOARD ROYALE
          </span>
        </Link>
        {pathname !== '/' && (
          <Link to="/" className="btn-neon btn-ghost text-sm">← Lobby</Link>
        )}
      </header>

      <main className="px-4 md:px-10 pb-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chess" element={<ChessGame />} />
          <Route path="/ludo" element={<LudoGame />} />
        </Routes>
      </main>
    </div>
  );
}
