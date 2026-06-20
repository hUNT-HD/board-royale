import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Stockfish ships a WASM worker; keep it out of the dep-optimizer.
  optimizeDeps: { exclude: ['stockfish'] },
});
